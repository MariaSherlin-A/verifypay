import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react';
import { txUrl } from '@/lib/appConfig';
import { useWallet } from '@/wallet/walletContext';

/** Shows the real state of the latest transaction: wallet prompt, confirming, confirmed, or the decoded error. */
export function TxStatus() {
  const { tx, clearTx, config } = useWallet();
  if (!tx) return null;

  const link = tx.hash ? (
    <a
      href={txUrl(config, tx.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="mono inline-flex items-center gap-1 underline underline-offset-2"
    >
      {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
      <ExternalLink size={12} aria-hidden />
      <span className="sr-only">View on explorer</span>
    </a>
  ) : null;

  return (
    <div className="glass flex items-start gap-3 rounded-2xl p-4 text-sm" role={tx.phase === 'error' ? 'alert' : 'status'}>
      <span className="mt-0.5 shrink-0">
        {tx.phase === 'success' && <CheckCircle2 size={18} className="text-[var(--success)]" aria-hidden />}
        {tx.phase === 'error' && <AlertTriangle size={18} className="text-[var(--danger)]" aria-hidden />}
        {(tx.phase === 'wallet' || tx.phase === 'confirming') && <Loader2 size={18} className="animate-spin" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{tx.label}</p>
        {tx.phase === 'wallet' && <p className="text-[var(--muted)]">Confirm in your wallet…</p>}
        {tx.phase === 'confirming' && <p className="text-[var(--muted)]">Waiting for confirmation… {link}</p>}
        {tx.phase === 'success' && <p className="text-[var(--muted)]">Confirmed on Arc Testnet. {link}</p>}
        {tx.phase === 'error' && tx.failure && (
          <p className="text-[var(--danger)]">
            {tx.failure.message} {link}
          </p>
        )}
      </div>
      {(tx.phase === 'success' || tx.phase === 'error') && (
        <button
          type="button"
          onClick={clearTx}
          aria-label="Dismiss"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-muted)]"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
