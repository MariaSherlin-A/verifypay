import { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import type { Hex } from 'viem';
import { isContractDomain, STATUS_LABEL, ZERO_ADDRESS } from '@/lib/payee';
import { shortAddr } from '@/lib/recipient';
import { REGISTRY_ABI } from '@/lib/txErrors';
import { useWallet } from '@/wallet/walletContext';
import { PayoutChange } from './PayoutChange';
import { usePayee } from './usePayee';

const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45';
const ghost = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-45';

const when = (seconds: bigint): string => new Date(Number(seconds) * 1000).toLocaleString();
const same = (a: string | null | undefined, b: string): boolean => !!a && a.toLowerCase() === b.toLowerCase();

export function BusinessScreen() {
  const { config, account, canTransact, write } = useWallet();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const [requested, setRequested] = useState<{ domain: string; hash: Hex } | null>(null);

  const domain = input.trim();
  const valid = isContractDomain(domain);
  const payee = usePayee(domain);
  const txt = account ? `_verifypay.${valid ? domain : '<your-domain>'}  TXT  "arc:${account}"` : 'Connect a wallet first';
  const isController = !!payee.data && same(account, payee.data.controller);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(null), 1800);
  };

  const register = async () => {
    setBusy(true);
    try {
      const { hash } = await write({ address: config.registry, abi: REGISTRY_ABI, functionName: 'requestRegistration', args: [domain] }, `Request verification for ${domain}`);
      setRequested({ domain, hash });
    } catch {
      // the status card shows the decoded error
    } finally {
      setBusy(false);
    }
  };

  const cancelController = async () => {
    if (!payee.domainHash) return;
    setBusy(true);
    try {
      await write({ address: config.registry, abi: REGISTRY_ABI, functionName: 'cancelControllerChange', args: [payee.domainHash] }, 'Cancel controller change');
    } catch {
      // the status card shows the decoded error
    } finally {
      setBusy(false);
    }
  };

  const p = payee.data;
  const takeoverPending = !!p && p.pendingController !== ZERO_ADDRESS;

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="biz-title">
        <h1 id="biz-title" className="display text-3xl font-semibold text-balance">
          Prove your business owns its wallet
        </h1>
        <p className="mt-2 max-w-prose text-pretty text-[var(--muted)]">
          Publish one DNS record. Chainlink CRE checks it, and payers can then pay your domain instead of an address.
        </p>

        <label className="mt-5 block text-sm font-medium" htmlFor="biz-domain">
          Your domain
        </label>
        <input
          id="biz-domain"
          className="mt-1 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 mono text-sm outline-none focus:border-[var(--border-strong)]"
          placeholder="acme.com"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setRequested(null);
          }}
        />
        {domain !== '' && !valid && (
          <p className="mt-1 text-sm text-[var(--danger)]">Use lowercase letters, digits, - and . only, with at least one dot (for example acme.com).</p>
        )}

        <p className="mt-4 text-sm font-medium">Add this DNS record at your domain provider</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="mono min-w-0 flex-1 break-all rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-[13px]">{txt}</code>
          <button type="button" className={ghost} disabled={!account || !valid} onClick={() => void copy()}>
            {copied === 'ok' ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied === 'ok' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--subtle)]">The record names your connected wallet as the controller of this domain.</p>

        <button type="button" className={`${primary} mt-4 w-full sm:w-auto`} disabled={!valid || !canTransact || busy} onClick={() => void register()}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          Request verification
        </button>
        {!account && <p className="mt-2 text-sm text-[var(--muted)]">Connect your wallet to request verification.</p>}
        {account && !canTransact && <p className="mt-2 text-sm text-[var(--muted)]">Switch to Arc Testnet to request verification.</p>}

        {requested && requested.domain === domain && (
          <p className="mt-3 text-sm" role="status">
            <b>Requested.</b> Chainlink CRE will verify your DNS record.{' '}
            <a className="inline-flex items-center gap-1 font-semibold text-[var(--accent-hover)] underline" href={`${config.explorer}/tx/${requested.hash}`} target="_blank" rel="noopener noreferrer">
              View transaction <ExternalLink size={13} aria-hidden />
            </a>
          </p>
        )}
      </section>

      {valid && (
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="status-title" aria-live="polite">
          <h2 id="status-title" className="display text-xl font-semibold">
            Status of {domain}
          </h2>
          {payee.isPending && <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin" aria-hidden />Reading the registry…</p>}
          {payee.isError && (
            <div className="mt-3 text-sm" role="alert">
              <p className="text-[var(--danger)]">Could not read the registry: {payee.error.message}</p>
              <button type="button" className={`${ghost} mt-2`} onClick={() => void payee.refetch()}>
                Retry
              </button>
            </div>
          )}
          {p && (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-[var(--muted)]">Status</dt>
              <dd className="font-semibold">
                {STATUS_LABEL[p.status] ?? `Unknown (${p.status})`}
                {p.status === 0 && ' · not registered yet'}
                {p.status === 1 && ' · waiting for Chainlink CRE'}
                {p.status === 3 && ' · verification lapsed, payments blocked'}
              </dd>
              {p.status >= 1 && (
                <>
                  <dt className="text-[var(--muted)]">Controller</dt>
                  <dd className="mono break-all">{p.controller === ZERO_ADDRESS ? 'not set until verified' : p.controller}</dd>
                </>
              )}
              {p.status >= 2 && (
                <>
                  <dt className="text-[var(--muted)]">Payout wallet</dt>
                  <dd className="mono break-all">{p.payout}</dd>
                  <dt className="text-[var(--muted)]">Verified</dt>
                  <dd>{when(p.verifiedAt)}</dd>
                </>
              )}
            </dl>
          )}

          {takeoverPending && p && (
            <div className="mt-4 rounded-2xl border border-[var(--danger)] bg-white/70 p-4" role="alert">
              <p className="flex items-start gap-2 text-sm">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--danger)]" aria-hidden />
                <span>
                  DNS now points to <span className="mono">{p.pendingController}</span>; it can take over at {when(p.controllerEta)} unless you cancel.
                </span>
              </p>
              <button type="button" className={`${ghost} mt-3`} disabled={!isController || !canTransact || busy} onClick={() => void cancelController()}>
                Cancel controller change
              </button>
              {!isController && <p className="mt-2 text-xs text-[var(--muted)]">Only the current controller ({shortAddr(p.controller)}) can cancel.</p>}
            </div>
          )}
        </section>
      )}

      {valid && payee.domainHash && <PayoutChange domainHash={payee.domainHash} payee={payee.data} />}
    </div>
  );
}
