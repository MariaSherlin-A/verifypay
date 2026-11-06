import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Loader2, Timer } from 'lucide-react';
import { TokenEURC, TokenUSDC } from '@web3icons/react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { txUrl } from '@/lib/appConfig';
import { findLookalike } from '@/lib/counterparties';
import { isBlocked, isInstant, lookupRecipient, shortAddr, VERDICT } from '@/lib/recipient';
import { useCounterparties } from '@/wallet/useCounterparties';
import { useBalances } from '@/wallet/useBalances';
import { useWallet } from '@/wallet/walletContext';
import { VerdictChip } from './VerdictChip';
import { tokenSymbol, usePay, type PayResult, type TokenKey } from './usePay';

function ResultCard({ result }: { result: PayResult }) {
  const { config } = useWallet();
  const link = (
    <a
      href={txUrl(config, result.hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="mono inline-flex items-center gap-1 underline underline-offset-2"
    >
      {result.hash.slice(0, 10)}…{result.hash.slice(-6)}
      <ExternalLink size={12} aria-hidden />
      <span className="sr-only">View on explorer</span>
    </a>
  );
  if (result.kind === 'paid') {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-[#1a8047]/30 bg-[#e9f6ee] px-4 py-3 text-sm text-[#14633a]" role="status">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Paid {result.to.startsWith('0x') ? shortAddr(result.to) : result.to}. {link}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-[#9a6700]/30 bg-[#fff6dd] px-4 py-3 text-sm text-[#7a5200]" role="status">
      <Timer size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Held for 10 minutes. You can still undo it.</p>
        <p className="tnum">
          Escrow #{result.id.toString()} to {shortAddr(result.to)} · undo until {new Date(Number(result.releaseAt) * 1000).toLocaleTimeString()} · {link}
        </p>
        <p>Saved for the Undo window.</p>
      </div>
    </div>
  );
}

export function PayScreen() {
  const { config, publicClient, account, onArc, canTransact } = useWallet();
  const balances = useBalances();
  const { pay, parseAmount, step, result, formError, busy } = usePay();

  const [input, setInput] = useState('');
  const [tokenKey, setTokenKey] = useState<TokenKey>('usdc');
  const [amountText, setAmountText] = useState('');

  const typed = input.trim();
  const debounced = useDebouncedValue(typed, 300);
  const settled = typed === debounced;

  const lookup = useQuery({
    queryKey: ['recipient', config.registry, debounced],
    queryFn: () => lookupRecipient(publicClient, config.registry, debounced),
    enabled: debounced.length > 0,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const counterparties = useCounterparties();
  const recipient = settled && !lookup.isFetching ? lookup.data : undefined;
  // Personal look-alike check (no DNS): only for addresses the registry does not know, against the addresses I have really paid.
  const unknownAddress = recipient?.kind === 'address' && recipient.verdict === VERDICT.Unknown ? recipient : null;
  const historyPending = unknownAddress !== null && account !== null && counterparties.isPending;
  const personal = unknownAddress && counterparties.data ? findLookalike(unknownAddress.target, counterparties.data) : null;
  const historyError = unknownAddress && counterparties.error ? counterparties.error.message : null;
  const checking = typed.length > 0 && (!settled || lookup.isFetching || historyPending);
  const lookupError = settled && !lookup.isFetching && lookup.error ? lookup.error : null;

  const amountState = amountText.trim() ? parseAmount(amountText, tokenKey) : null;
  const amountError = amountState && 'error' in amountState ? amountState.error : null;
  const amountOk = amountState !== null && 'raw' in amountState;

  const canPay = canTransact && recipient !== undefined && !isBlocked(recipient) && amountOk && !busy && !checking;
  const label = isInstant(recipient) ? 'Pay now' : 'Send with 10-minute undo';
  const tokenBalance = balances.data ? balances.data[tokenKey] : null;

  const helper = !account ? 'Connect your wallet to pay.' : !onArc ? 'Switch to Arc to pay.' : null;

  return (
    <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="pay-title">
      <h1 id="pay-title" className="display text-3xl font-semibold text-balance sm:text-4xl">
        Pay the business, not the address
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-[var(--muted)]">
        Type a verified domain like acme.com, or paste a wallet address. VerifyPay checks it on Arc before any money moves.
      </p>

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPay && recipient) void pay(recipient, tokenKey, amountText);
        }}
      >
        <div>
          <label htmlFor="recipient" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Pay to
          </label>
          <input
            id="recipient"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="acme.com or 0x…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="mono mt-1.5 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-base outline-none transition focus:border-[var(--border-strong)]"
          />
        </div>

        <VerdictChip
          state={{ checking, error: lookupError, input, recipient, personal, historyError, historyNeedsWallet: unknownAddress !== null && account === null }}
        />

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Token</legend>
            <div role="radiogroup" aria-label="Token" className="mt-1.5 inline-flex rounded-2xl bg-[var(--surface-muted)] p-1">
              {(['usdc', 'eurc'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={tokenKey === k}
                  onClick={() => setTokenKey(k)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                    tokenKey === k ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {k === 'usdc' ? <TokenUSDC variant="branded" size={18} /> : <TokenEURC variant="branded" size={18} />}
                  {tokenSymbol(k)}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="amount" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Amount
              </label>
              {tokenBalance && (
                <span className="tnum text-xs text-[var(--muted)]">
                  Balance: {tokenBalance.display} {tokenSymbol(tokenKey)}
                </span>
              )}
            </div>
            <input
              id="amount"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              aria-invalid={amountError !== null}
              aria-describedby={amountError ? 'amount-error' : undefined}
              className="tnum mt-1.5 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-2xl font-semibold outline-none transition focus:border-[var(--border-strong)]"
            />
            {amountError && (
              <p id="amount-error" className="mt-1.5 text-sm text-[var(--danger)]">
                {amountError}
              </p>
            )}
          </div>
        </div>

        {step && (
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--ink-2)]" role="status">
            <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
            {step}
          </p>
        )}
        {formError && (
          <p className="rounded-2xl bg-[#fdecef] px-4 py-3 text-sm text-[#8f1d38]" role="alert">
            {formError}
          </p>
        )}
        {result && <ResultCard result={result} />}

        <div>
          <button
            type="submit"
            disabled={!canPay}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-64"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {label}
          </button>
          {helper && <p className="mt-2 text-sm text-[var(--muted)]">{helper}</p>}
        </div>
      </form>
    </section>
  );
}
