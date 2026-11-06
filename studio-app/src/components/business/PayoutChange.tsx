import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getAddress, isAddress, type Address, type Hex } from 'viem';
import type { AgentPassApproval } from '@/lib/agentPass';
import { ZERO_ADDRESS, type Payee } from '@/lib/payee';
import { REGISTRY_ABI } from '@/lib/txErrors';
import { shortAddr } from '@/lib/recipient';
import { useChainTime } from '@/hooks/useChainTime';
import { useWallet } from '@/wallet/walletContext';
import { AgentPassPanel } from './AgentPassPanel';
import { useAgentPass } from './useAgentPass';

const input = 'min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 mono text-sm outline-none focus:border-[var(--border-strong)]';
const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45';
const ghost = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-45';

const countdown = (sec: number): string => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

const same = (a: string | null | undefined, b: string): boolean => !!a && a.toLowerCase() === b.toLowerCase();

export function PayoutChange({ domainHash, payee }: { domainHash: Hex; payee: Payee | undefined }) {
  const { config, account, canTransact, write } = useWallet();
  const pass = useAgentPass();
  const time = useChainTime();
  const [newPayout, setNewPayout] = useState('');
  const [target, setTarget] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = newPayout.trim();
  const validPayout = isAddress(trimmed);
  const isController = !!payee && same(account, payee.controller);
  const active = payee?.status === 2;
  const flowRunning = pass.state.kind === 'starting' || pass.state.kind === 'waiting';
  const hasPending = !!payee && payee.pendingPayout !== ZERO_ADDRESS;

  const queueChange = async (approval: AgentPassApproval, to: Address) => {
    try {
      // The exact values the backend signed: domainHash, newPayout, deadline, signature.
      await write(
        { address: config.registry, abi: REGISTRY_ABI, functionName: 'requestPayoutChange', args: [domainHash, to, BigInt(approval.deadline), approval.signature] },
        'Queue payout change',
      );
    } catch {
      // write() already recorded the decoded error for the status card
    }
  };

  const verify = async () => {
    if (!validPayout) return;
    const to = getAddress(trimmed);
    setTarget(to);
    setBusy(true);
    try {
      const approval = await pass.start('payoutChange', { domainHash, newPayout: to });
      if (approval) await queueChange(approval, to);
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const approval = await pass.resume();
      if (approval) await queueChange(approval, target);
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: 'executePayoutChange' | 'cancelPayoutChange', label: string) => {
    setBusy(true);
    try {
      await write({ address: config.registry, abi: REGISTRY_ABI, functionName: fn, args: [domainHash] }, label);
    } catch {
      // shown by the status card
    } finally {
      setBusy(false);
    }
  };

  const pendingEta = payee ? Number(payee.payoutEta) : 0;
  const canExecute = hasPending && time.blockTimestamp !== null && time.blockTimestamp >= pendingEta;
  const mayCancel = !!payee && (same(account, payee.controller) || same(account, payee.payout));

  let blocked: string | null = null;
  if (!payee) blocked = 'Look up a registered domain first.';
  else if (!active) blocked = 'A payout wallet can be changed once the domain is Active.';
  else if (!account) blocked = 'Connect your wallet.';
  else if (!isController) blocked = `Only the controller wallet (${shortAddr(payee.controller)}) can change the payout wallet.`;

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="payout-title">
      <h2 id="payout-title" className="display text-xl font-semibold">
        Change payout wallet
      </h2>
      <p className="mt-1 max-w-prose text-pretty text-sm text-[var(--muted)]">
        A fresh World ID check approves the change. It then waits a public delay, and the old wallet can cancel it.
      </p>

      {hasPending && payee && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
          <p className="text-sm">
            Pending payout change to <span className="mono">{shortAddr(payee.pendingPayout)}</span>:{' '}
            {time.now === null ? 'reading chain time…' : canExecute ? 'ready to execute' : `${countdown(pendingEta - time.now)} left (chain time)`}.
          </p>
          <p className="mt-1 text-sm font-semibold">Payments keep going to the old wallet until execution.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={!canExecute || !canTransact || busy} onClick={() => void act('executePayoutChange', 'Execute payout change')}>
              Execute change
            </button>
            <button type="button" className={ghost} disabled={!mayCancel || !canTransact || busy} onClick={() => void act('cancelPayoutChange', 'Cancel payout change')}>
              Cancel (old wallet)
            </button>
          </div>
        </div>
      )}

      <label className="mt-4 block text-sm font-medium" htmlFor="new-payout">
        New payout wallet
      </label>
      <input id="new-payout" className={`${input} mt-1`} placeholder="0x…" spellCheck={false} autoComplete="off" value={newPayout} onChange={(e) => setNewPayout(e.target.value)} />
      {trimmed !== '' && !validPayout && <p className="mt-1 text-sm text-[var(--danger)]">That is not a valid 0x address.</p>}
      {blocked && <p className="mt-2 text-sm text-[var(--muted)]">{blocked}</p>}

      <button type="button" className={`${primary} mt-4 w-full sm:w-auto`} disabled={!!blocked || !validPayout || !canTransact || flowRunning || busy} onClick={() => void verify()}>
        {pass.state.kind === 'starting' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
        Verify with World ID
      </button>

      <AgentPassPanel pass={pass} what="the change" busy={busy} canStartAgain={validPayout} onResume={() => void resume()} onStartAgain={() => void verify()} />
    </section>
  );
}
