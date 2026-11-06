import { ExternalLink, Loader2, XCircle } from 'lucide-react';
import { QrCode } from './QrCode';
import type { useAgentPass } from './useAgentPass';

const ghost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-45';

/** Link + QR + user code while waiting, and the outcome when World ID did not approve. Shared by the Business and Agent screens. */
export function AgentPassPanel({
  pass,
  what,
  busy,
  canStartAgain,
  onResume,
  onStartAgain,
}: {
  pass: ReturnType<typeof useAgentPass>;
  /** What the person is approving, e.g. "the change". */
  what: string;
  busy: boolean;
  canStartAgain: boolean;
  onResume: () => void;
  onStartAgain: () => void;
}) {
  const { state } = pass;
  const link = state.kind === 'waiting' ? (state.session.verificationUriComplete ?? state.session.verificationUri) : null;

  return (
    <>
      {state.kind === 'waiting' && link && (
        <div className="mt-4 grid gap-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 sm:grid-cols-[auto_1fr]" role="status">
          <QrCode value={link} label="QR code for the World ID verification link" />
          <div className="space-y-2">
            <p className="text-sm">Open this link in World App, or scan the code, and approve {what}.</p>
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 break-all text-sm font-semibold text-[var(--accent-hover)] underline">
              {link}
              <ExternalLink size={14} aria-hidden />
            </a>
            <p className="text-sm">
              Code <span className="mono tnum rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-base font-semibold">{state.session.userCode}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Waiting for your approval (checking every {state.session.interval} s)
            </p>
            <button type="button" className={ghost} onClick={pass.cancel}>
              Cancel verification
            </button>
          </div>
        </div>
      )}

      {state.kind === 'not-approved' && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm" role="alert">
          <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--danger)]" aria-hidden />
          <span>
            <b>Not approved. Nothing changed.</b> No transaction was sent. ({state.status}
            {state.detail ? `: ${state.detail}` : ''})
            {state.status === 'unknown' && ' The backend no longer knows this verification session (it may have restarted). Start again.'}
          </span>
        </p>
      )}

      {state.kind === 'error' && (
        <div className="mt-4 rounded-2xl border border-[var(--danger)] bg-white/70 p-4 text-sm" role="alert">
          <p>
            <b>World ID check failed:</b> {state.message}
          </p>
          <div className="mt-3 flex gap-2">
            {state.session ? (
              <button type="button" className={ghost} disabled={busy} onClick={onResume}>
                Retry
              </button>
            ) : (
              <button type="button" className={ghost} disabled={busy || !canStartAgain} onClick={onStartAgain}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
