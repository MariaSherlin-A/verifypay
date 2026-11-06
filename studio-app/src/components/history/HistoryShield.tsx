import { useMutation } from '@tanstack/react-query';
import type { Address } from 'viem';
import { ExternalLink, Info, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { AddressDiff } from '@/components/AddressDiff';
import { fetchHistoryScan, type PoisoningAttempt } from '@/lib/historyScan';
import { shortAddr } from '@/lib/recipient';
import { formatUnitsExact, usdcDecimalsFor } from '@/onchain-money';
import { EURC_EXPECTED_DECIMALS } from '@/wallet/useBalances';
import { useWallet } from '@/wallet/walletContext';

function AttemptCard({ attempt }: { attempt: PoisoningAttempt }) {
  const { config } = useWallet();
  const token = attempt.token.toLowerCase();
  const isEurc = token === config.eurc.toLowerCase();
  const isUsdc = token === config.usdc.toLowerCase();
  let amount = attempt.value;
  try {
    amount = formatUnitsExact(BigInt(attempt.value), isEurc ? EURC_EXPECTED_DECIMALS : usdcDecimalsFor(config.chainId));
  } catch {
    // keep the raw value from the backend
  }
  const symbol = isEurc ? 'EURC' : isUsdc ? 'USDC' : attempt.token ? shortAddr(attempt.token) : '';
  const when = attempt.timestamp ? new Date(attempt.timestamp) : null;

  return (
    <li className="rounded-2xl border-2 border-[#ba2b4c] bg-[#fdecef] p-4 text-[#8f1d38] sm:p-5">
      <p className="flex items-start gap-2.5 text-base font-semibold sm:text-lg">
        <ShieldAlert size={22} className="mt-0.5 shrink-0" aria-hidden />
        <span>Poisoning attempt · Never copy from this row</span>
      </p>
      <div className="pl-[34px]">
        <AddressDiff pasted={attempt.poisoned} real={attempt.imitates} pastedLabel="Poisoned address" realLabel="Real address it imitates" />
        <p className="tnum mt-3 text-sm">
          Transfer of {amount} {symbol}
          {when && !Number.isNaN(when.getTime()) ? ` · ${when.toLocaleString()}` : ''} ·{' '}
          <a
            href={`${config.explorer}/tx/${attempt.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono inline-flex items-center gap-1 underline underline-offset-2"
          >
            {attempt.txHash.slice(0, 10)}…{attempt.txHash.slice(-6)}
            <ExternalLink size={12} aria-hidden />
            <span className="sr-only">View transaction on explorer</span>
          </a>
        </p>
      </div>
    </li>
  );
}

function ShieldBody({ account }: { account: Address }) {
  const scan = useMutation({ mutationFn: () => fetchHistoryScan(account) });

  return (
    <div>
      <button
        type="button"
        onClick={() => scan.mutate()}
        disabled={scan.isPending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
      >
        {scan.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
        {scan.isPending ? 'Scanning…' : 'Scan my history'}
      </button>

      <div aria-live="polite" className="mt-5 space-y-3">
        {scan.isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ba2b4c]/40 bg-[#fdecef] px-4 py-3 text-sm text-[#8f1d38]" role="alert">
            <p className="flex min-w-0 items-start gap-2">
              <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span className="break-words">{scan.error.message}</span>
            </p>
            <button
              type="button"
              onClick={() => scan.mutate()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#8f1d38]/40 px-4 font-semibold hover:bg-white/60"
            >
              <RefreshCw size={14} aria-hidden />
              Retry
            </button>
          </div>
        )}

        {scan.isSuccess && (
          <>
            {scan.data.attempts.length > 0 ? (
              <ul className="space-y-3">
                {scan.data.attempts.map((a) => (
                  <AttemptCard key={`${a.txHash}-${a.poisoned}`} attempt={a} />
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2.5 rounded-2xl border border-[#1a8047]/30 bg-[#e9f6ee] px-4 py-3 text-sm font-medium text-[#14633a]">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
                No poisoning attempts found across {scan.data.realCounterparties.length} real counterpart
                {scan.data.realCounterparties.length === 1 ? 'y' : 'ies'}
              </p>
            )}
            <p className="tnum flex items-start gap-2 text-xs text-[var(--muted)]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              {scan.data.hasMore
                ? `Scanned the latest ${scan.data.scanned} transfers. Older transfers were not scanned.`
                : `Scanned all ${scan.data.scanned} transfers of this wallet.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function HistoryShield() {
  const { account } = useWallet();
  return (
    <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="shield-title">
      <h2 id="shield-title" className="display text-2xl font-semibold">
        History shield
      </h2>
      <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">
        Scammers send tiny or zero-value transfers from addresses that look like your real counterparties, hoping you copy the wrong one from your history. Scan to find them.
      </p>
      <div className="mt-5">
        {account ? (
          <ShieldBody key={account} account={account} />
        ) : (
          <p className="text-sm text-[var(--muted)]">Connect your wallet to scan your history.</p>
        )}
      </div>
    </section>
  );
}
