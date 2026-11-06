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

/** Makes the wallet show its account picker (MetaMask: the "connect to this site" account list). */
const requestAccountPicker = (provider: EIP1193Provider) =>
  provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });

/** The account the wallet reports as selected: eth_accounts[0]. Never prompts. */
const readSelectedAccount = async (provider: EIP1193Provider): Promise<Address | null> => {
  const accounts = await provider.request({ method: 'eth_accounts' });
  const first = accounts[0];
  return first ? getAddress(first) : null;
};

/** The wallet's own throttling error (MetaMask: "Request is being rate limited", code -32005 / HTTP 429 upstream). */
const isWalletRateLimit = (e: unknown): boolean => {
  const text = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ''}` : String(e);
  return /rate limit|-32005|429/i.test(text);
};

const hexToChainId =(id: string): number => (id.startsWith('0x') ? parseInt(id, 16) : Number(id));

/** The chain the injected wallet is on RIGHT NOW (eth_chainId straight from the provider, never from our Arc RPC client). */
const readWalletChainId = async (provider: EIP1193Provider): Promise<number> => hexToChainId(await provider.request({ method: 'eth_chainId' }));

export function WalletProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  const queryClient = useQueryClient();
  const chain = useMemo(() => arcChainFromConfig(config), [config]);
  const publicClient = useMemo(
    // The public Arc RPC throttles bursts (HTTP 429 / -32005). viem retries exactly those with a growing delay.
    () => createPublicClient({ chain, transport: http(config.rpcUrl, { retryCount: 6, retryDelay: 1000 }) }),
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
      const provider = getProvider();
      if (!provider) throw new Error('No browser wallet found. Install MetaMask or Rabby to continue.');
      // An explicit connect always lets the user choose the account: if this site is already permitted
      // (eth_requestAccounts would return silently), open the picker with wallet_requestPermissions.
      const permitted = await provider.request({ method: 'eth_accounts' });
      if (permitted.length > 0) await requestAccountPicker(provider);
      else await provider.request({ method: 'eth_requestAccounts' });
      const selected = await readSelectedAccount(provider);
      if (!selected) throw new Error('The wallet did not return an account.');
      setAccount(selected);
      setFlag(true);
      const current = await refreshChainId();
      if (current !== chain.id) await ensureArc();
    } catch (e) {
      setError(decodeTxError(e).message);
    } finally {
      setIsConnecting(false);
    }
  }, [chain.id, ensureArc, refreshChainId]);

  const disconnect = useCallback(() => {
    setFlag(false);
    setAccount(null);
    setTx(null);
    setError(null);
  }, []);

  /** Opens the wallet's account picker, then follows whichever account the wallet reports as selected. */
  const switchAccount = useCallback(async () => {
    setError(null);
    const provider = getProvider();
    if (!provider) {
      setError('No browser wallet found. Install MetaMask or Rabby to continue.');
      return;
    }
    try {
      await requestAccountPicker(provider);
      const selected = await readSelectedAccount(provider);
      if (!selected) {
        disconnect();
        return;
      }
      setAccount(selected);
      setFlag(true);
      setTx(null);
      await refreshChainId();
    } catch (e) {
      const failure = decodeTxError(e);
      if (failure.kind !== 'rejected') setError(failure.message);
    }
  }, [disconnect, refreshChainId]);

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
        try {
          hash = await wc.writeContract({ ...params, account, chain });
        } catch (e) {
          // MetaMask reads nonce and gas from the same public Arc RPC; when that RPC throttles it, MetaMask answers
          // "Request is being rate limited" and nothing was sent. Wait, then ask the wallet once more.
          if (!isWalletRateLimit(e)) throw e;
          setTx({ phase: 'wallet', label: `${label} (Arc RPC busy, retrying…)` });
          await new Promise((r) => setTimeout(r, 4000));
          hash = await wc.writeContract({ ...params, account, chain });
        }
        setTx({ phase: 'confirming', label, hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error(`Transaction reverted on chain: ${hash}`);
        setTx({ phase: 'success', label, hash });
        void queryClient.invalidateQueries({ queryKey: ['balances'] });
        void queryClient.invalidateQueries({ queryKey: ['escrows'] }); // held payments: re-read pendings(id)
        void queryClient.invalidateQueries({ queryKey: ['payee'] }); // business status, queued changes
        void queryClient.invalidateQueries({ queryKey: ['counterparties'] }); // new Paid / released payments
        void queryClient.invalidateQueries({ queryKey: ['agent-wallet'] }); // limits, pause state, balance
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
      switchAccount,
      switchToArc,
      write,
      tx,
      clearTx,
    }),
    [config, chain, publicClient, hasProvider, account, chainId, isConnecting, error, connect, disconnect, switchAccount, switchToArc, write, tx, clearTx],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
