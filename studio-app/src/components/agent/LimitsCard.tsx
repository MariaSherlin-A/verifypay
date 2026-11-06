import { useState } from 'react';
import { Loader2, ShieldCheck, TrendingDown } from 'lucide-react';
import type { Address } from 'viem';
import type { AgentPassApproval } from '@/lib/agentPass';
import type { AgentWalletState } from '@/lib/agentWallet';
import { AGENT_WALLET_ABI } from '@/lib/txErrors';
import { useWallet } from '@/wallet/walletContext';
import { AgentPassPanel } from '@/components/business/AgentPassPanel';
import { useAgentPass } from '@/components/business/useAgentPass';
import { MAX_UINT128, parseTokenAmount, showAmount, type AgentToken, type ParsedAmount } from './agentToken';
import { ghost, input, primary } from './styles';

interface Target {
  token: Address;
  perPayment: bigint;
  perDay: bigint;
}

function fieldError(p: ParsedAmount | null): string | null {
  if (p === null) return null;
  if (!p.ok) return p.message;
  if (p.raw > MAX_UINT128) return 'That is larger than the contract allows.';
  return null;
}

/** Raise (needs a fresh World ID human check) or lower (owner only, no World ID) the agent's spending limits. */
export function LimitsCard({ token, state, isOwner }: { token: AgentToken; state: AgentWalletState; isOwner: boolean }) {
  const { config, canTransact, write } = useWallet();
  const pass = useAgentPass();
  const [perPaymentText, setPerPaymentText] = useState('');
  const [perDayText, setPerDayText] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);

  const pp = parseTokenAmount(perPaymentText, token.decimals);
  const pd = parseTokenAmount(perDayText, token.decimals);
  const ppError = fieldError(pp);
  const pdError = fieldError(pd);
  const ready = pp?.ok === true && pd?.ok === true && !ppError && !pdError;
  const newPer = ready && pp.ok ? pp.raw : 0n;
  const newDay = ready && pd.ok ? pd.raw : 0n;

  const anyHigher = ready && (newPer > state.perPayment || newDay > state.perDay);
  const anyLower = ready && (newPer < state.perPayment || newDay < state.perDay);
  const canRaise = anyHigher;
  const canLower = ready && !anyHigher && anyLower;
  const flowRunning = pass.state.kind === 'starting' || pass.state.kind === 'waiting';
  const idle = !isOwner || !canTransact || busy;

  const sendRaise = async (approval: AgentPassApproval, t: Target) => {
    try {
      // The exact values the backend signed: token, perPayment, perDay, deadline, signature.
      await write(
        { address: config.agentWallet, abi: AGENT_WALLET_ABI, functionName: 'raiseLimits', args: [t.token, t.perPayment, t.perDay, BigInt(approval.deadline), approval.signature] },
        `Raise ${token.symbol} limits`,
      );
    } catch {
      // write() recorded the decoded error for the status card
    }
  };

  const raise = async () => {
    if (!canRaise) return;
    const t: Target = { token: token.address, perPayment: newPer, perDay: newDay };
    setTarget(t);
    setBusy(true);
    try {
      const approval = await pass.start('raiseLimits', {
        wallet: config.agentWallet,
        token: t.token,
        perPayment: t.perPayment.toString(),
        perDay: t.perDay.toString(),
      });
      if (approval) await sendRaise(approval, t);
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const approval = await pass.resume();
      if (approval) await sendRaise(approval, target);
    } finally {
      setBusy(false);
    }
  };

  const lower = async () => {
    if (!canLower) return;
    setBusy(true);
    try {
      await write(
        { address: config.agentWallet, abi: AGENT_WALLET_ABI, functionName: 'lowerLimits', args: [token.address, newPer, newDay] },
        `Lower ${token.symbol} limits`,
      );
    } catch {
      // shown by the status card
    } finally {
      setBusy(false);
    }
  };

  let hint: string | null = null;
  if (ready && !anyHigher && !anyLower) hint = 'These are the current limits. Enter different amounts.';
  else if (canRaise) hint = 'These raise the limits, so a fresh World ID check is required.';
  else if (canLower) hint = 'These only lower the limits, so no World ID check is needed.';

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="limits-title">
      <h2 id="limits-title" className="display text-xl font-semibold">
        Spending limits ({token.symbol})
      </h2>
      <p className="mt-1 max-w-prose text-pretty text-sm text-[var(--muted)]">
        Currently {showAmount(state.perPayment, token.decimals)} per payment and {showAmount(state.perDay, token.decimals)} per day. Enter the new limits in {token.symbol}.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium" htmlFor="limit-per-payment">
            Per payment
          </label>
          <input id="limit-per-payment" inputMode="decimal" className={`${input} mt-1`} placeholder="0.00" autoComplete="off" value={perPaymentText} onChange={(e) => setPerPaymentText(e.target.value)} />
          {ppError && <p className="mt-1 text-sm text-[var(--danger)]">{ppError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="limit-per-day">
            Per day
          </label>
          <input id="limit-per-day" inputMode="decimal" className={`${input} mt-1`} placeholder="0.00" autoComplete="off" value={perDayText} onChange={(e) => setPerDayText(e.target.value)} />
          {pdError && <p className="mt-1 text-sm text-[var(--danger)]">{pdError}</p>}
        </div>
      </div>
      {hint && <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={idle || !canRaise || flowRunning} onClick={() => void raise()}>
          {pass.state.kind === 'starting' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
          Raise limits (World ID)
        </button>
        <button type="button" className={ghost} disabled={idle || !canLower || flowRunning} onClick={() => void lower()}>
          <TrendingDown size={16} aria-hidden />
          Lower limits
        </button>
      </div>

      <AgentPassPanel pass={pass} what="raising the limits" busy={busy} canStartAgain={canRaise} onResume={() => void resume()} onStartAgain={() => void raise()} />
    </section>
  );
}
