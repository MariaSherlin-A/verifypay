import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { isAddress } from 'viem';
import { VerdictChip } from '@/components/pay/VerdictChip';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { lookupRecipient, VERDICT } from '@/lib/recipient';
import { useWallet } from '@/wallet/walletContext';

const VERDICT_NAME = ['Unknown', 'Verified', 'Frozen', 'Lookalike'] as const;

export function Builders() {
  const { config, publicClient } = useWallet();
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const address = input.trim();
  const debounced = useDebouncedValue(address, 300);

  // The signature below is exactly PayeeRegistry.inspectRecipient in the compiled ABI.
  const snippet = `import { createPublicClient, http, parseAbi } from 'viem';

const registry = '${config.registry}'; // PayeeRegistry on Arc Testnet (chain ${config.chainId})
const client = createPublicClient({ transport: http('${config.rpcUrl}') });

// Call this before your wallet or agent pays an address.
const [verdict, domainHash, imitated] = await client.readContract({
  address: registry,
  abi: parseAbi([
    'function inspectRecipient(address recipient) view returns (uint8 verdict, bytes32 domainHash, address imitated)',
  ]),
  functionName: 'inspectRecipient',
  args: [recipient],
});

// 0 Unknown, 1 Verified, 2 Frozen, 3 Lookalike (imitated = the real payee it copies)
if (verdict === 3) throw new Error(\`Look-alike of \${imitated}. Do not send.\`);
if (verdict === 2) throw new Error('Payee is frozen. Do not send.');`;

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const validAddress = isAddress(debounced);
  const query = useQuery({
    queryKey: ['builders-inspect', config.registry, debounced],
    enabled: validAddress,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: () => lookupRecipient(publicClient, config.registry, debounced),
  });

  const settled = address === debounced;
  const notAddress = address.length > 0 && settled && !validAddress;
  const recipient = settled && validAddress && !query.isFetching ? query.data : undefined;
  const raw = recipient?.kind === 'address' ? recipient : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="builders-title">
        <h1 id="builders-title" className="display text-3xl font-semibold text-balance">
          Check an address before you pay it
        </h1>
        <p className="mt-2 max-w-prose text-pretty text-[var(--muted)]">
          Any wallet or agent can ask PayeeRegistry whether an address is a verified business, a frozen one, or a look-alike of one. It is a read-only call, so it costs nothing and needs no key.
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#14141f]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">viem</span>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white/85 hover:bg-white/10"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mono overflow-x-auto p-4 text-[12.5px] leading-relaxed text-white/90">
            <code>{snippet}</code>
          </pre>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="try-title">
        <h2 id="try-title" className="display text-xl font-semibold">
          Try it on any address
        </h2>
        <label htmlFor="inspect-address" className="mt-3 block text-sm font-semibold">
          Address
        </label>
        <input
          id="inspect-address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="mono mt-1 min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm outline-none focus:border-[var(--border-strong)]"
        />
        {notAddress && (
          <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
            Enter a full 0x address (42 characters).
          </p>
        )}

        <div className="mt-3">
          <VerdictChip
            state={{
              input: validAddress || !settled ? address : '',
              checking: validAddress ? !settled || query.isPending || query.isFetching : false,
              error: validAddress && settled && query.isError ? query.error : null,
              recipient,
            }}
          />
        </div>

        {raw && (
          <dl className="mono mt-3 grid gap-1 text-[12.5px] text-[var(--ink-2)]" aria-label="Raw inspectRecipient result">
            <div>
              <dt className="inline text-[var(--muted)]">verdict: </dt>
              <dd className="inline">
                {raw.verdict} ({VERDICT_NAME[raw.verdict] ?? 'unknown'})
              </dd>
            </div>
            <div className="break-all">
              <dt className="inline text-[var(--muted)]">domainHash: </dt>
              <dd className="inline">{raw.domainHash}</dd>
            </div>
            <div className="break-all">
              <dt className="inline text-[var(--muted)]">imitated: </dt>
              <dd className="inline">{raw.imitated}</dd>
            </div>
            {raw.verdict === VERDICT.Lookalike && (
              <div>
                <dt className="inline text-[var(--muted)]">imitated domain: </dt>
                <dd className="inline">{raw.imitatedDomain ?? 'not resolvable'}</dd>
              </div>
            )}
          </dl>
        )}
      </section>
    </div>
  );
}
