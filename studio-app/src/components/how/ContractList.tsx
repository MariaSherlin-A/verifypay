import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { isAddress, type Address } from 'viem';
import { REGISTRY_ABI } from '@/lib/txErrors';
import { buildAddressExplorerUrl } from '@/onchain-facts';
import { useWallet } from '@/wallet/walletContext';

interface Row {
  name: string;
  role: string;
  address: Address;
}

/** All addresses come from GET /api/config, except the Chainlink forwarder, which is read live from PayeeRegistry.forwarder(). */
export function ContractList() {
  const { config, publicClient } = useWallet();
  const forwarder = useQuery({
    queryKey: ['registry-forwarder', config.registry],
    retry: false,
    queryFn: async (): Promise<Address> => {
      const f = await publicClient.readContract({ address: config.registry, abi: REGISTRY_ABI, functionName: 'forwarder' });
      if (typeof f !== 'string' || !isAddress(f)) throw new Error('PayeeRegistry.forwarder() returned an unexpected value');
      return f;
    },
  });

  const rows: Row[] = [
    { name: 'PayeeRegistry', role: 'Which businesses are verified, frozen or imitated', address: config.registry },
    { name: 'SafeSend', role: 'Instant payments to verified businesses, 10-minute undo escrow for the rest', address: config.safeSend },
    { name: 'AgentWallet', role: 'Spending limits and pause for an AI agent', address: config.agentWallet },
    { name: 'USDC', role: 'ERC-20, 6 decimals', address: config.usdc },
    { name: 'EURC', role: 'ERC-20, 6 decimals', address: config.eurc },
  ];

  const link = (address: Address) => buildAddressExplorerUrl(config.chainId, address) ?? `${config.explorer}/address/${address}`;

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="contracts-title">
      <h2 id="contracts-title" className="display text-xl font-semibold">
        Contracts and tokens
      </h2>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <Item key={r.name} name={r.name} role={r.role} address={r.address} href={link(r.address)} />
        ))}
        <li className="py-3">
          {forwarder.data ? (
            <Item
              bare
              name="Chainlink forwarder (MockKeystoneForwarder, simulation)"
              role="Delivers Chainlink CRE reports to PayeeRegistry. Read live from PayeeRegistry.forwarder()."
              address={forwarder.data}
              href={link(forwarder.data)}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]" role={forwarder.isError ? 'alert' : undefined}>
              {forwarder.isError ? `Could not read the Chainlink forwarder: ${forwarder.error.message}` : 'Reading the Chainlink forwarder from PayeeRegistry…'}
            </p>
          )}
        </li>
      </ul>
    </section>
  );
}

function Item({ name, role, address, href, bare }: { name: string; role: string; address: Address; href: string; bare?: boolean }) {
  const body = (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-sm text-[var(--muted)]">{role}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mono inline-flex min-h-11 items-center gap-1.5 break-all text-[13px] text-[var(--accent-hover)] underline"
        aria-label={`${name} on the Arc explorer`}
      >
        {address}
        <ExternalLink size={13} aria-hidden className="shrink-0" />
      </a>
    </div>
  );
  return bare ? body : <li className="py-3">{body}</li>;
}
