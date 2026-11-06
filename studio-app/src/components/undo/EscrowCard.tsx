import { CheckCircle2, ExternalLink, Loader2, RotateCcw, Send, ShieldAlert, Timer } from 'lucide-react';
import { TokenEURC, TokenUSDC } from '@web3icons/react';
import type { Escrow } from '@/lib/escrows';
import { shortAddr } from '@/lib/recipient';
import { formatUnitsExact, usdcDecimalsFor } from '@/onchain-money';
import { EURC_EXPECTED_DECIMALS } from '@/wallet/useBalances';
import { useWallet } from '@/wallet/walletContext';

/** "1" -> "1.00", "0.5" -> "0.50", "0.001" -> "0.001": at least 2 decimals, never rounded. */
function amountText(raw: bigint, decimals: number): string {
  const exact = formatUnitsExact(raw, decimals);
  const [whole, frac = ''] = exact.split('.');
  return `${whole}.${frac.padEnd(2, '0')}`;
}

const mmss = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function EscrowCard({
  escrow,
  chainNow,
  blockTimestamp,
  busy,
  onAct,
}: {
  escrow: Escrow;
  /** Chain time, advanced between block reads. */
  chainNow: number | null;
  /** Timestamp of the latest block actually read from the chain. */
  blockTimestamp: number | null;
  busy: boolean;
  onAct: (fn: 'cancel' | 'release') => void;
}) {
  const { config, canTransact } = useWallet();
  const isEurc = escrow.token.toLowerCase() === config.eurc.toLowerCase();
  const isUsdc = escrow.token.toLowerCase() === config.usdc.toLowerCase();
  const symbol = isEurc ? 'EURC' : isUsdc ? 'USDC' : shortAddr(escrow.token);
  const decimals = isEurc ? EURC_EXPECTED_DECIMALS : usdcDecimalsFor(config.chainId);
  const releaseAt = Number(escrow.releaseAt);

  // The button state follows the latest block actually read; the countdown text ticks between block reads.
  const windowOpen = blockTimestamp !== null && blockTimestamp < releaseAt;
  const remaining = chainNow === null ? null : Math.max(0, releaseAt - chainNow);

  const reasonLabel =
    escrow.reason === 1
      ? `Look-alike of ${escrow.imitatedDomain ?? (escrow.imitated ? shortAddr(escrow.imitated) : 'a registered payee')}`
      : 'First-time address';

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum flex items-center gap-2 text-2xl font-semibold">
            {isEurc ? <TokenEURC variant="branded" size={22} /> : <TokenUSDC variant="branded" size={22} />}
            {amountText(escrow.amount, decimals)} {symbol}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            To{' '}
            <a
              href={`${config.explorer}/address/${escrow.to}`}
              target="_blank"
              rel="noopener noreferrer"
              title={escrow.to}
              className="mono inline-flex items-center gap-1 underline underline-offset-2"
            >
              {shortAddr(escrow.to)}
              <ExternalLink size={12} aria-hidden />
              <span className="sr-only">View recipient on explorer</span>
            </a>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            escrow.reason === 1 ? 'bg-[#fdecef] text-[#8f1d38]' : 'bg-[#fff6dd] text-[#7a5200]'
          }`}
        >
          {escrow.reason === 1 ? <ShieldAlert size={14} aria-hidden /> : <Timer size={14} aria-hidden />}
          {reasonLabel}
        </span>
      </div>

      <div className="mt-4">
        {!escrow.open ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-2)]">
            <CheckCircle2 size={16} className="text-[var(--success)]" aria-hidden />
            Settled
            {escrow.outcome === 'undone' && ' · undone, funds returned to you'}
            {escrow.outcome === 'released' && ' · released to the recipient'}
          </p>
        ) : blockTimestamp === null ? (
          <p className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Reading chain time…
          </p>
        ) : windowOpen ? (
          <div className="space-y-2">
            <p className="tnum text-sm text-[var(--ink-2)]" aria-live="off">
              {remaining && remaining > 0 ? (
                <>
                  <b className="text-base">{mmss(remaining)}</b> left to undo
                </>
              ) : (
                'Window closing, confirming on chain…'
              )}
            </p>
            <button
              type="button"
              disabled={!canTransact || busy}
              onClick={() => onAct('cancel')}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <RotateCcw size={16} aria-hidden />}
              Undo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--ink-2)]">The undo window is over. The payment can now be released to the recipient.</p>
            <button
              type="button"
              disabled={!canTransact || busy}
              onClick={() => onAct('release')}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-transparent px-6 text-base font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-muted)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              Release to recipient
            </button>
          </div>
        )}
      </div>
      <p className="tnum mt-3 text-xs text-[var(--subtle)]">Escrow #{escrow.id.toString()}</p>
    </li>
  );
}
