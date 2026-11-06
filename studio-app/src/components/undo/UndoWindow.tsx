import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useChainTime } from '@/hooks/useChainTime';
import { loadEscrows, type Escrow } from '@/lib/escrows';
import { SAFESEND_ABI } from '@/lib/txErrors';
import { useWallet } from '@/wallet/walletContext';
import { EscrowCard } from './EscrowCard';

export function UndoWindow() {
  const { config, publicClient, account, write } = useWallet();
  const chainTime = useChainTime();
  const [busyId, setBusyId] = useState<bigint | null>(null);

  const escrows = useQuery({
    queryKey: ['escrows', account, config.safeSend],
    enabled: account !== null,
    queryFn: () => {
      if (!account) throw new Error('No connected account');
      return loadEscrows(publicClient, config, account);
    },
    refetchInterval: 15_000,
    retry: false,
  });

  const act = async (escrow: Escrow, fn: 'cancel' | 'release') => {
    setBusyId(escrow.id);
    try {
      // write() simulates first (WindowOver / WindowOpen / NotSender / NotOpen show by name), waits for the receipt,
      // then refreshes balances and this list, which re-reads pendings(id).
      await write(
        { address: config.safeSend, abi: SAFESEND_ABI, functionName: fn, args: [escrow.id] },
        `${fn === 'cancel' ? 'Undo' : 'Release'} held payment #${escrow.id.toString()}`,
      );
    } catch {
      // the failure is already recorded and shown by <TxStatus />
    } finally {
      setBusyId(null);
    }
  };

  let body;
  if (!account) {
    body = <p className="text-sm text-[var(--muted)]">Connect your wallet to see your held payments.</p>;
  } else if (escrows.isPending) {
    body = (
      <p className="inline-flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Reading your held payments from Arc…
      </p>
    );
  } else if (escrows.error) {
    body = (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-[var(--danger)]">Could not load your held payments: {escrows.error.message}</p>
        <button
          type="button"
          onClick={() => void escrows.refetch()}
          disabled={escrows.isFetching}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          <RefreshCw size={14} className={escrows.isFetching ? 'animate-spin' : ''} aria-hidden />
          Retry
        </button>
      </div>
    );
  } else if (escrows.data.length === 0) {
    body = <p className="text-sm text-[var(--muted)]">No held payments</p>;
  } else {
    body = (
      <ul className="space-y-3">
        {escrows.data.map((e) => (
          <EscrowCard
            key={e.id.toString()}
            escrow={e}
            chainNow={chainTime.now}
            blockTimestamp={chainTime.blockTimestamp}
            busy={busyId === e.id}
            onAct={(fn) => void act(e, fn)}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="undo-title">
      <h2 id="undo-title" className="display text-2xl font-semibold">
        Undo window
      </h2>
      <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">
        Payments to first-time or look-alike addresses wait here for 10 minutes. Undo sends the money back to you.
      </p>
      <div className="mt-5">{body}</div>
      {chainTime.error && (
        <p className="mt-3 text-xs text-[var(--danger)]" role="alert">
          Chain time unavailable: {chainTime.error.message}
        </p>
      )}
    </section>
  );
}
