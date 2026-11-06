import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { decodeEventLog, isHex, keccak256, toBytes, type Hex } from 'viem';
import { STATUS_LABEL, fetchPayee } from '@/lib/payee';
import { REGISTRY_ABI } from '@/lib/txErrors';
import { useWallet } from '@/wallet/walletContext';

/** Public evidence inputs, from .env (VITE_CRE_EVIDENCE_DOMAIN / VITE_CRE_EVIDENCE_TX). */
const env = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const DOMAIN = env(import.meta.env.VITE_CRE_EVIDENCE_DOMAIN);
const TX = env(import.meta.env.VITE_CRE_EVIDENCE_TX);

const fmtTime = (s: bigint) => new Date(Number(s) * 1000).toLocaleString();

export function CreEvidence() {
  const { config, publicClient } = useWallet();

  const configured = Boolean(DOMAIN) && isHex(TX) && TX.length === 66;
  const domainHash = DOMAIN ? keccak256(toBytes(DOMAIN)) : undefined;

  const payee = useQuery({
    queryKey: ['cre-evidence-payee', config.registry, domainHash],
    enabled: configured && Boolean(domainHash),
    refetchInterval: 10_000,
    retry: false,
    queryFn: () => {
      if (!domainHash) throw new Error('No evidence domain configured');
      return fetchPayee(publicClient, config.registry, domainHash);
    },
  });

  // The receipt of the CRE report transaction, checked live: did PayeeRegistry emit PayeeVerified for this domain?
  const receipt = useQuery({
    queryKey: ['cre-evidence-receipt', TX, domainHash],
    enabled: configured && Boolean(domainHash),
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const r = await publicClient.getTransactionReceipt({ hash: TX as Hex });
      const verified = r.logs.some((log) => {
        if (log.address.toLowerCase() !== config.registry.toLowerCase()) return false;
        try {
          const ev = decodeEventLog({ abi: REGISTRY_ABI, data: log.data, topics: log.topics });
          const args = ev.args;
          return ev.eventName === 'PayeeVerified' && args !== undefined && !Array.isArray(args) && (args as { domainHash?: string }).domainHash === domainHash;
        } catch {
          return false;
        }
      });
      return { success: r.status === 'success', block: r.blockNumber, verified };
    },
  });

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="cre-title">
      <h2 id="cre-title" className="display text-xl font-semibold">
        Verified by Chainlink CRE, live
      </h2>

      {!configured || !DOMAIN ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="alert">
          The evidence is not configured: set VITE_CRE_EVIDENCE_DOMAIN and VITE_CRE_EVIDENCE_TX in .env.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="mono">{DOMAIN}</span> proved its DNS TXT record to a Chainlink CRE workflow, which wrote the verification onchain. Everything below is read from Arc Testnet right now.
          </p>

          {payee.isPending && <p className="mt-4 text-sm text-[var(--muted)]">Reading PayeeRegistry.getPayee…</p>}
          {payee.isError && (
            <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
              Could not read PayeeRegistry.getPayee: {payee.error.message}
            </p>
          )}
          {payee.data && (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  {payee.data.status === 2 ? <CheckCircle2 size={16} className="text-[#1a8047]" aria-hidden /> : <XCircle size={16} aria-hidden />}
                  {STATUS_LABEL[payee.data.status] ?? `Unknown (${payee.data.status})`}
                </span>
              </Field>
              <Field label="Verified at">{payee.data.verifiedAt > 0n ? fmtTime(payee.data.verifiedAt) : 'Not verified'}</Field>
              <Field label="Payout wallet">
                <span className="mono break-all text-[13px]">{payee.data.payout}</span>
              </Field>
              <Field label="Controller">
                <span className="mono break-all text-[13px]">{payee.data.controller}</span>
              </Field>
            </dl>
          )}

          <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm">
            <p className="font-semibold">The CRE report transaction</p>
            {receipt.isPending && <p className="mt-1 text-[var(--muted)]">Reading the transaction receipt…</p>}
            {receipt.isError && (
              <p className="mt-1 text-[var(--danger)]" role="alert">
                Could not read the receipt: {receipt.error.message}
              </p>
            )}
            {receipt.data && (
              <p className="mt-1">
                {receipt.data.success ? 'Succeeded' : 'Failed'} in block <span className="tnum">{receipt.data.block.toString()}</span>.{' '}
                {receipt.data.verified
                  ? 'PayeeRegistry emitted PayeeVerified for this domain in that transaction.'
                  : 'No PayeeVerified event for this domain was found in it.'}
              </p>
            )}
            <a
              href={`${config.explorer}/tx/${TX}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono mt-2 inline-flex min-h-11 items-center gap-1.5 break-all text-[13px] text-[var(--accent-hover)] underline"
            >
              {TX}
              <ExternalLink size={13} aria-hidden className="shrink-0" />
            </a>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
