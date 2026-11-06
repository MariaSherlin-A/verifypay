import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, getAddress, http, type Address, type EIP1193Provider, type Hex } from 'viem';
import { arcChainFromConfig, type AppConfig } from '@/lib/appConfig';
import { decodeTxError } from '@/lib/txErrors';
import { WalletContext, type TxState, type WalletContextValue, type WriteParams } from './walletContext';

const CONNECTED_FLAG = 'vp:wallet:connected';

const readFlag = (): boolean => {
  try {
    return localStorage.getItem(CONNECTED_FLAG) === '1';
  } catch {
    return false;
  }
};
const setFlag = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(CONNECTED_FLAG, '1');
    else localStorage.removeItem(CONNECTED_FLAG);
  } catch {
    // storage unavailable: the wallet still works, it just will not auto-reconnect
  }
};

const isProvider = (v: unknown): v is EIP1193Provider =>
  typeof v === 'object' && v !== null && 'request' in v && typeof v.request === 'function' && 'on' in v && typeof v.on === 'function';

/** The injected wallet (MetaMask, Rabby, ...), checked at runtime because browsers do not guarantee window.ethereum. */
const getProvider = (): EIP1193Provider | undefined => {
  if (typeof window === 'undefined') return undefined;
  const candidate: unknown = Reflect.get(window, 'ethereum');
  return isProvider(candidate) ? candidate : undefined;
};

const hexToChainId = (id: string): number => (id.startsWith('0x') ? parseInt(id, 16) : Number(id));

/** The chain the injected wallet is on RIGHT NOW (eth_chainId straight from the provider, never from our Arc RPC client). */
const readWalletChainId = async (provider: EIP1193Provider): Promise<number> => hexToChainId(await provider.request({ method: 'eth_chainId' }));

export function WalletProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  const queryClient = useQueryClient();
  const chain = useMemo(() => arcChainFromConfig(config), [config]);
  const publicClient = useMemo(
    () => createPublicClient({ chain, transport: http(config.rpcUrl) }),
    [chain, config.rpcUrl],
  );

  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);
  const hasProvider = getProvider() !== undefined;

  const walletClient = useCallback(
    (acct?: Address) => {
      const provider = getProvider();
      if (!provider) throw new Error('No browser wallet found. Install MetaMask or Rabby to continue.');
      return createWalletClient({ account: acct, chain, transport: custom(provider) });
    },
    [chain],
  );

  /** Re-reads eth_chainId from the wallet, stores it, and returns it. The single source for the network badge. */
  const refreshChainId = useCallback(async (): Promise<number> => {
    const provider = getProvider();
    if (!provider) throw new Error('No browser wallet found. Install MetaMask or Rabby to continue.');
    const id = await readWalletChainId(provider);
    setChainId(id);
    return id;
  }, []);

  // Switch to Arc; if the wallet does not know the chain, add it (web/app.js connect handler).
  const ensureArc = useCallback(async () => {
    const wc = walletClient();
    try {
      await wc.switchChain({ id: chain.id });
    } catch (e) {
      if (decodeTxError(e).kind === 'rejected') throw e;
      await wc.addChain({ chain });
      try {
        await wc.switchChain({ id: chain.id });
      } catch (e2) {
        if (decodeTxError(e2).kind === 'rejected') throw e2;
      }
    }
    await refreshChainId();
  }, [walletClient, chain, refreshChainId]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const wc = walletClient();
      const [first] = await wc.requestAddresses();
      if (!first) throw new Error('The wallet did not return an account.');
      setAccount(getAddress(first));
      setFlag(true);
      const current = await refreshChainId();
      if (current !== chain.id) await ensureArc();
    } catch (e) {
      setError(decodeTxError(e).message);
    } finally {
      setIsConnecting(false);
    }
  }, [walletClient, chain.id, ensureArc, refreshChainId]);

  const disconnect = useCallback(() => {
    setFlag(false);
    setAccount(null);
    setTx(null);
    setError(null);
  }, []);

  const switchToArc = useCallback(async () => {
    setError(null);
    try {
      await ensureArc();
    } catch (e) {
      setError(decodeTxError(e).message);
    }
  }, [ensureArc]);

  // Restore a previous session silently (eth_accounts never prompts) and follow the wallet live.
  useEffect(() => {
    const eth = getProvider();
    if (!eth) return;
    let cancelled = false;

    if (readFlag()) {
      void (async () => {
        try {
          const accounts = await eth.request({ method: 'eth_accounts' });
          const first = accounts[0];
          if (cancelled || !first) return;
          setAccount(getAddress(first));
          const id = await readWalletChainId(eth);
          if (!cancelled) setChainId(id);
        } catch (e) {
          if (!cancelled) setError(decodeTxError(e).message);
        }
      })();
    } else {
      void readWalletChainId(eth).then(
        (id) => {
          if (!cancelled) setChainId(id);
        },
        (e: unknown) => {
          if (!cancelled) setError(decodeTxError(e).message);
        },
      );
    }

    const onAccounts = (accounts: readonly string[]) => {
      if (!readFlag()) return; // the wallet may emit this before the user connected here
      const first = accounts[0];
      if (!first) {
        disconnect();
        return;
      }
      setAccount(getAddress(first));
      setTx(null);
    };
    const onChain = (id: string) => setChainId(hexToChainId(id));

    // Fallback for iframes where chainChanged may never arrive: re-read the real wallet value when the page
    // regains focus or becomes visible. This re-reads eth_chainId; it never assumes a chain.
    const recheck = () => {
      void readWalletChainId(eth).then(
        (id) => {
          if (!cancelled) setChainId(id);
        },
        (e: unknown) => {
          if (!cancelled) setError(decodeTxError(e).message);
        },
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      eth.removeListener('accountsChanged', onAccounts);
      eth.removeListener('chainChanged', onChain);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [disconnect]);

  const write = useCallback(
    async (params: WriteParams, label = 'Transaction') => {
      if (!account) throw new Error('Connect your wallet first');
      let hash: Hex | undefined;
      setTx({ phase: 'wallet', label });
      try {
        const wc = walletClient(account);
        const walletChain = await refreshChainId(); // the wallet's real chain, read immediately before sending
        if (walletChain !== chain.id) {
          throw new Error(`Your wallet is on chain ${walletChain}, not ${chain.name} (${chain.id}). Switch to Arc and try again.`);
        }
        // Simulate first so a revert comes back as a named custom error instead of a wallet gas-estimation failure.
        await publicClient.simulateContract({ ...params, account });
        hash = await wc.writeContract({ ...params, account, chain });
        setTx({ phase: 'confirming', label, hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error(`Transaction reverted on chain: ${hash}`);
        setTx({ phase: 'success', label, hash });
        void queryClient.invalidateQueries({ queryKey: ['balances'] });
        void queryClient.invalidateQueries({ queryKey: ['escrows'] }); // held payments: re-read pendings(id)
        return { hash, receipt };
      } catch (e) {
        const failure = decodeTxError(e);
        setTx(failure.kind === 'rejected' ? null : { phase: 'error', label, hash, failure });
        throw e;
      }
    },
    [account, walletClient, chain, refreshChainId, publicClient, queryClient],
  );

  const clearTx = useCallback(() => setTx(null), []);

  const value = useMemo<WalletContextValue>(
    () => ({
      config,
      chain,
      publicClient,
      hasProvider,
      account,
      chainId,
      onArc: chainId === chain.id,
      canTransact: account !== null && chainId === chain.id,
      isConnecting,
      error,
      connect,
      disconnect,
      switchToArc,
      write,
      tx,
      clearTx,
    }),
    [config, chain, publicClient, hasProvider, account, chainId, isConnecting, error, connect, disconnect, switchToArc, write, tx, clearTx],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
