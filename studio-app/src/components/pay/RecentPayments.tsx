import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { getAbiItem, type AbiEvent, type Address, type Hex } from 'viem';
import { txUrl } from '@/lib/appConfig';
import { shortAddr } from '@/lib/recipient';
import { paced, SAFESEND_DEPLOY_BLOCK } from '@/lib/safesendFeed';
import { REGISTRY_ABI, SAFESEND_ABI } from '@/lib/txErrors';
import { formatUnitsFixed } from '@/onchain-money';
import { useWallet } from '@/wallet/walletContext';

const CHUNK = 10_000n; // largest log range the Arc RPCs accept

interface Payment {
  hash: Hex;
  block: bigint;
  kind: 'instant' | 'held';
  token: Address;
  to: Address;
  amount: bigint;
  domain: string | null;
}

const PAID = getAbiItem({ abi: SAFESEND_ABI, name: 'Paid' }) as AbiEvent;
const ESCROWED = getAbiItem({ abi: SAFESEND_ABI, name: 'Escrowed' }) as AbiEvent;

/**
 * Every payment this wallet made through SafeSend, read from the chain: `Paid` (settled instantly to a verified business)
 * and `Escrowed` (held for the undo window), filtered on the indexed `sender`. Domain names come from the registry.
 */
function useMyPayments() {
  const { config, publicClient, account } = useWallet();
  return useQuery({
    queryKey: ['my-payments', account, config.safeSend],
    enabled: account !== null,
    retry: false,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Payment[]> => {
      if (!account) throw new Error('Connect your wallet first');
      // Registered domain names, so a domain hash can be shown as its name.
      const names = new Map<string, string>();
      const count = (await paced(() => publicClient.readContract({ address: config.registry, abi: REGISTRY_ABI, functionName: 'domainCount' }))) as bigint;
      for (let i = 0n; i < count; i++) {
        const [hash, name] = (await paced(() => publicClient.readContract({ address: config.registry, abi: REGISTRY_ABI, functionName: 'domainAt', args: [i] }))) as readonly [Hex, string, number];
        names.set(hash.toLowerCase(), name);
      }

      const head = await paced(() => publicClient.getBlockNumber());
      const out: Payment[] = [];
      for (let from = SAFESEND_DEPLOY_BLOCK; from <= head; from += CHUNK) {
        const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
        const logs = await paced(() =>
          publicClient.getLogs({ address: config.safeSend, events: [PAID, ESCROWED], fromBlock: from, toBlock: to }),
        );
        for (const l of logs) {
          const a = l.args as Record<string, unknown>;
          if (String(a.sender).toLowerCase() !== account.toLowerCase()) continue;
          if (!l.transactionHash || l.blockNumber === null) continue;
          out.push({
            hash: l.transactionHash,
            block: l.blockNumber,
            kind: l.eventName === 'Paid' ? 'instant' : 'held',
            token: a.token as Address,
            to: a.to as Address,
            amount: a.amount as bigint,
            domain: l.eventName === 'Paid' ? (names.get(String(a.domainHash).toLowerCase()) ?? null) : null,
          });
        }
      }
      return out.sort((x, y) => (x.block === y.block ? 0 : x.block > y.block ? -1 : 1));
    },
  });
}

export function RecentPayments() {
  const { config, account } = useWallet();
  const q = useMyPayments();
  const symbol = (t: Address) => (t.toLowerCase() === config.eurc.toLowerCase() ? 'EURC' : 'USDC');

  let body;
  if (!account) body = <p className="text-sm text-[var(--muted)]">Connect your wallet to see your payments.</p>;
  else if (q.isPending)
    body = (
      <p className="inline-flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Reading your payments from Arc…
      </p>
    );
  else if (q.error)
    body = (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-[var(--danger)]">Could not load your payments: {q.error.message}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          <RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''} aria-hidden />
          Retry
        </button>
      </div>
    );
  else if (q.data.length === 0) body = <p className="text-sm text-[var(--muted)]">No payments yet</p>;
  else
    body = (
      <ul className="divide-y divide-[var(--border)]">
        {q.data.map((p) => (
          <li key={p.hash + p.kind} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="tnum font-semibold">
                {formatUnitsFixed(p.amount, 6, 2)} {symbol(p.token)}
                <span className="font-normal text-[var(--muted)]"> → {p.domain ?? shortAddr(p.to)}</span>
              </p>
              <p className="text-xs text-[var(--muted)]">
                {p.kind === 'instant' ? 'Settled instantly (verified business)' : 'Held for the 10-minute undo window (see Undo window)'}
              </p>
            </div>
            <a
              href={txUrl(config, p.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--ink-2)] underline-offset-2 hover:underline"
            >
              {p.hash.slice(0, 10)}…{p.hash.slice(-6)}
              <ExternalLink size={12} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    );

  return (
    <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="payments-title">
      <h2 id="payments-title" className="display text-2xl font-semibold">
        My payments
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Every payment you sent through VerifyPay, read live from Arc.</p>
      <div className="mt-4">{body}</div>
    </section>
  );
}
