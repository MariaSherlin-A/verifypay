import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, encodeFunctionData, fallback, getAddress, http, type Address, type EIP1193Provider, type Hex } from 'viem';
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
const isAlreadyKnown = (e: unknown): boolean => {
  for (let x: unknown = e, depth = 0; x && depth < 8; x = (x as { cause?: unknown }).cause, depth++) {
    const o = x as { message?: unknown; details?: unknown; shortMessage?: unknown };
    if (/already known/i.test(`${String(o.message ?? '')} ${String(o.details ?? '')} ${String(o.shortMessage ?? '')}`)) return true;
  }
  return false;
};

/**
 * Finds the transaction this wallet really sent: same sender, nonce ≥ the nonce before sending, same contract and exactly
 * the same call data (payments carry a unique ref, so the data identifies one payment). Read from the Arc explorer API,
 * polled every 2 s for up to 90 s. Returns null if it never appears (then the original error is shown).
 */
async function findSentTransaction(explorer: string, from: Address, nonceBefore: number, to: Address, data: Hex): Promise<Hex | null> {
  const url = `${explorer.replace(/\/$/, '')}/api/v2/addresses/${from}/transactions`;
  for (const deadline = Date.now() + 90_000; Date.now() < deadline; ) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body: unknown = await res.json();
        const items = (body as { items?: unknown[] }).items ?? [];
        for (const it of items) {
          const t = it as { hash?: string; nonce?: number; to?: { hash?: string } | null; raw_input?: string };
          if (
            typeof t.hash === 'string' &&
            typeof t.nonce === 'number' &&
            t.nonce >= nonceBefore &&
            t.to?.hash?.toLowerCase() === to.toLowerCase() &&
            t.raw_input?.toLowerCase() === data.toLowerCase()
          ) {
            return t.hash as Hex;
          }
        }
      }
    } catch {
      // explorer briefly unreachable: keep polling until the deadline
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

/** Arc Testnet partner RPCs from Arc's docs (verified: both return chain 5042002 and our registry's state). */
const ARC_TESTNET_BLOCKDAEMON_RPC = 'https://rpc.blockdaemon.testnet.arc.io';
const ARC_TESTNET_DRPC_RPC = 'https://rpc.drpc.testnet.arc.io';

// viem wraps -32005 as LimitExceededRpcError ("Request exceeds defined limit."), so check codes along the cause chain too.
const isWalletRateLimit = (e: unknown): boolean => {
  for (let x: unknown = e, depth = 0; x && depth < 8; x = (x as { cause?: unknown }).cause, depth++) {
    const o = x as { code?: unknown; status?: unknown; message?: unknown; details?: unknown };
    if (o.code === -32005 || o.status === 429) return true;
    if (/rate limit|exceeds defined limit|429/i.test(`${String(o.message ?? '')} ${String(o.details ?? '')}`)) return true;
  }
  return false;
};

const hexToChainId =(id: string): number => (id.startsWith('0x') ? parseInt(id, 16) : Number(id));

/** The chain the injected wallet is on RIGHT NOW (eth_chainId straight from the provider, never from our Arc RPC client). */
const readWalletChainId = async (provider: EIP1193Provider): Promise<number> => hexToChainId(await provider.request({ method: 'eth_chainId' }));

export function WalletProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  const queryClient = useQueryClient();
  const chain = useMemo(() => arcChainFromConfig(config), [config]);
  const publicClient = useMemo(
    // The public Arc RPC throttles bursts (HTTP 429 / -32005) per IP, and the wallet shares that limit. Reads therefore go
    // first to Blockdaemon's Arc Testnet RPC (listed in Arc's docs, docs.arc.network → Connect to Arc), then fall back to
    // the public Arc RPC, then dRPC (free plan rejects log ranges ≥ 10k blocks, so it is last). Same chain, real nodes.
    () =>
      createPublicClient({
        chain,
        transport: fallback([
          http(ARC_TESTNET_BLOCKDAEMON_RPC, { retryCount: 2, retryDelay: 800 }),
          http(config.rpcUrl, { retryCount: 3, retryDelay: 1000 }),
          http(ARC_TESTNET_DRPC_RPC, { retryCount: 2, retryDelay: 1000 }),
        ]),
      }),
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
        // Only this read is retried when the RPC is busy (4 s, 8 s, 12 s): nothing has been signed yet.
        for (let attempt = 0; ; attempt++) {
          try {
            await publicClient.simulateContract({ ...params, account });
            break;
          } catch (e) {
            if (!isWalletRateLimit(e) || attempt >= 3) throw e;
            setTx({ phase: 'wallet', label: `${label} (Arc RPC busy, retrying in ${4 * (attempt + 1)} s…)` });
            await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
            setTx({ phase: 'wallet', label });
          }
        }
        // The wallet is asked exactly once. Never re-prompt automatically: if the wallet's RPC failed after you confirmed,
        // the transaction may still land, and a second prompt could pay twice.
        const nonceBefore = await publicClient.getTransactionCount({ address: account, blockTag: 'latest' });
        try {
          hash = await wc.writeContract({ ...params, account, chain });
        } catch (e) {
          // MetaMask sometimes submits the signed transaction twice; the second copy is answered "already known" and
          // MetaMask reports a failure although the first copy is on its way. Find the real transaction instead.
          if (!isAlreadyKnown(e)) throw e;
          setTx({ phase: 'confirming', label: `${label} (your wallet reported a duplicate; finding the transaction…)` });
          const found = await findSentTransaction(config.explorer, account, nonceBefore, params.address, encodeFunctionData(params));
          if (!found) throw e;
          hash = found;
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
        void queryClient.invalidateQueries({ queryKey: ['my-payments'] }); // the new payment in "My payments"
        return { hash, receipt };
      } catch (e) {
        const failure = decodeTxError(e);
        setTx(failure.kind === 'rejected' ? null : { phase: 'error', label, hash, failure });
        throw e;
      }
    },
    [account, walletClient, chain, refreshChainId, publicClient, queryClient, config.explorer],
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
