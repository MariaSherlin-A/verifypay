import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, ShieldAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { AddressDiff } from '@/components/AddressDiff';
import type { Address } from 'viem';
import { shortAddr, STATUS, VERDICT, type Recipient } from '@/lib/recipient';

type Tone = 'ok' | 'frozen' | 'warn' | 'bad' | 'info';

const TONES: Record<Tone, string> = {
  ok: 'border-[#1a8047]/30 bg-[#e9f6ee] text-[#14633a]',
  frozen: 'border-[#6b6580]/30 bg-[#eceaf0] text-[#4a4560]',
  warn: 'border-[#9a6700]/30 bg-[#fff6dd] text-[#7a5200]',
  bad: 'border-[#ba2b4c]/40 bg-[#fdecef] text-[#8f1d38]',
  info: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-2)]',
};

function Chip({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${TONES[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export interface VerdictState {
  /** The input has not settled yet (still typing) or the read is in flight. */
  checking: boolean;
  error: Error | null;
  input: string;
  recipient: Recipient | undefined;
  /** An address this wallet has paid before that this unknown address imitates (same first 4 + last 4 hex characters). */
  personal?: Address | null;
  /** Why the payment-history check could not run (real error), shown under the verdict. */
  historyError?: string | null;
  /** The address is unknown to the registry and no wallet is connected, so the history check cannot run. */
  historyNeedsWallet?: boolean;
}

/** The live verdict for the typed recipient. The container stays mounted so screen readers announce every change politely. */
export function VerdictChip({ state }: { state: VerdictState }) {
  const { checking, error, input, recipient, personal, historyError, historyNeedsWallet } = state;
  let body: ReactNode = null;

  if (!input.trim()) {
    body = null;
  } else if (checking) {
    body = (
      <Chip tone="info" icon={<Loader2 size={18} className="animate-spin" aria-hidden />}>
        Checking on Arc…
      </Chip>
    );
  } else if (error) {
    body = (
      <Chip tone="bad" icon={<XCircle size={18} aria-hidden />}>
        Lookup failed: {error.message}
      </Chip>
    );
  } else if (recipient?.kind === 'invalid') {
    body = (
      <Chip tone="warn" icon={<Info size={18} aria-hidden />}>
        Enter a domain like acme.com or a 0x address
      </Chip>
    );
  } else if (recipient?.kind === 'domain') {
    if (recipient.status === STATUS.Active) {
      body = (
        <Chip tone="ok" icon={<CheckCircle2 size={18} aria-hidden />}>
          Verified · settles instantly
          <span className="mono tnum block text-xs font-normal opacity-80">
            {recipient.target} → {shortAddr(recipient.payout)}
          </span>
        </Chip>
      );
    } else if (recipient.status === STATUS.Frozen) {
      body = (
        <Chip tone="frozen" icon={<Lock size={18} aria-hidden />}>
          Frozen: verification lapsed, payments blocked
        </Chip>
      );
    } else {
      body = (
        <Chip tone="warn" icon={<AlertTriangle size={18} aria-hidden />}>
          Not a verified business
        </Chip>
      );
    }
  } else if (recipient?.kind === 'address') {
    if (recipient.verdict === VERDICT.Verified) {
      body = (
        <Chip tone="ok" icon={<CheckCircle2 size={18} aria-hidden />}>
          Verified business wallet · settles instantly
        </Chip>
      );
    } else if (recipient.verdict === VERDICT.Frozen) {
      body = (
        <Chip tone="frozen" icon={<Lock size={18} aria-hidden />}>
          Frozen: verification lapsed, payments blocked
        </Chip>
      );
    } else if (recipient.verdict === VERDICT.Lookalike) {
      body = (
        <div className="rounded-2xl border-2 border-[#ba2b4c] bg-[#fdecef] p-4 text-[#8f1d38]">
          <p className="flex items-start gap-2.5 text-base font-semibold sm:text-lg">
            <ShieldAlert size={22} className="mt-0.5 shrink-0" aria-hidden />
            <span>Look-alike of {recipient.imitatedDomain ?? shortAddr(recipient.imitated)}. Likely address poisoning.</span>
          </p>
          <p className="mt-1 pl-[34px] text-sm">If you send anyway, the payment waits 10 minutes with Undo.</p>
          <div className="pl-[34px]">
            <AddressDiff pasted={recipient.target} real={recipient.imitated} lowercase />
          </div>
        </div>
      );
    } else if (personal) {
      body = (
        <div className="rounded-2xl border-2 border-[#ba2b4c] bg-[#fdecef] p-4 text-[#8f1d38]">
          <p className="flex items-start gap-2.5 text-base font-semibold sm:text-lg">
            <ShieldAlert size={22} className="mt-0.5 shrink-0" aria-hidden />
            <span>Look-alike of an address you paid before ({shortAddr(personal)}). Likely address poisoning.</span>
          </p>
          <div className="pl-[34px]">
            <AddressDiff pasted={recipient.target} real={personal} realLabel="Address you paid before" lowercase />
            <p className="mt-3 text-xs">Held for 10 minutes. Not a verified business, so this check uses your own payment history.</p>
          </div>
        </div>
      );
    } else {
      body = (
        <Chip tone="warn" icon={<AlertTriangle size={18} aria-hidden />}>
          First payment to this address: it waits 10 minutes with Undo
        </Chip>
      );
    }
  }

  const note =
    recipient?.kind === 'address' && recipient.verdict === VERDICT.Unknown && !checking && !error
      ? historyError
        ? `Could not check your payment history: ${historyError}`
        : historyNeedsWallet
          ? 'Connect your wallet to also check this address against the addresses you have paid before.'
          : null
      : null;

  return (
    <div aria-live="polite" className="min-h-0">
      {body}
      {note && <p className="mt-2 text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
}
