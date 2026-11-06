import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { TokenEURC, TokenUSDC } from '@web3icons/react';
import { fetchAgentWallet } from '@/lib/agentWallet';
import { shortAddr } from '@/lib/recipient';
import { useWallet } from '@/wallet/walletContext';
import { showAmount, tokenFor, type TokenKey } from './agentToken';
import { LimitsCard } from './LimitsCard';
import { OwnerControls } from './OwnerControls';

const same = (a: string | null | undefined, b: string): boolean => !!a && a.toLowerCase() === b.toLowerCase();

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt>
      <dd className="tnum mt-1 text-base font-semibold">{children}</dd>
    </div>
  );
}

export function AgentScreen() {
  const { config, publicClient, account } = useWallet();
  const [tokenKey, setTokenKey] = useState<TokenKey>('usdc');
  const token = tokenFor(tokenKey, config);

  const wallet = useQuery({
    queryKey: ['agent-wallet', config.agentWallet, token.address],
    queryFn: () => fetchAgentWallet(publicClient, config.agentWallet, token.address),
    retry: false,
    refetchInterval: 15000,
  });

  const state = wallet.data;
  const isOwner = !!state && same(account, state.owner);
  const link = (addr: string) => (
    <a href={`${config.explorer}/address/${addr}`} target="_blank" rel="noopener noreferrer" className="mono inline-flex items-center gap-1 text-sm underline" title={addr}>
      {shortAddr(addr)}
      <ExternalLink size={12} aria-hidden />
    </a>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="agent-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id="agent-title" className="display text-2xl font-semibold text-balance">
              Agent wallet
            </h1>
            <p className="mt-1 max-w-prose text-pretty text-sm text-[var(--muted)]">
              An AI agent can pay verified businesses by name from this wallet, within the limits below. {link(config.agentWallet)}
            </p>
          </div>
          <div role="radiogroup" aria-label="Token" className="inline-flex gap-1 rounded-full bg-[var(--surface-muted)] p-1">
            {(['usdc', 'eurc'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={tokenKey === k}
                onClick={() => setTokenKey(k)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${tokenKey === k ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-2)]'}`}
              >
                {k === 'usdc' ? <TokenUSDC variant="branded" size={18} /> : <TokenEURC variant="branded" size={18} />}
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm font-medium">Raising limits needs a fresh World ID human check; lowering or pausing never does.</p>

        {wallet.isPending && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Reading the agent wallet from Arc…
          </p>
        )}
        {wallet.isError && (
          <div className="mt-4 rounded-2xl border border-[var(--danger)] bg-white/70 p-4 text-sm" role="alert">
            <p>
              <b>Could not read the agent wallet:</b> {wallet.error.message}
            </p>
            <button type="button" onClick={() => void wallet.refetch()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 font-semibold">
              <RefreshCw size={14} aria-hidden />
              Retry
            </button>
          </div>
        )}

        {state && (
          <>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Row label={`${token.symbol} balance`}>{showAmount(state.balance, token.decimals)}</Row>
              <Row label="Per payment">{showAmount(state.perPayment, token.decimals)}</Row>
              <Row label="Per day">{showAmount(state.perDay, token.decimals)}</Row>
              <Row label="Spent today">{showAmount(state.spentToday, token.decimals)}</Row>
              <Row label="Agent">{link(state.agent)}</Row>
              <Row label="Owner">{link(state.owner)}</Row>
              <Row label="Status">{state.paused ? 'Paused' : 'Running'}</Row>
            </dl>
            {!isOwner && (
              <p className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-3 text-sm" role="note">
                Only the owner (<span className="mono">{state.owner}</span>) can change this.
                {account ? '' : ' Connect that wallet to make changes.'}
              </p>
            )}
          </>
        )}
      </section>

      {state && <LimitsCard token={token} state={state} isOwner={isOwner} />}
      {state && <OwnerControls token={token} state={state} isOwner={isOwner} />}
    </div>
  );
}
