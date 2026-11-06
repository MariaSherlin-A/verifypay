import { useQuery } from '@tanstack/react-query';
import { keccak256, toBytes, type Hex } from 'viem';
import { fetchPayee, isContractDomain, ZERO_ADDRESS } from '@/lib/payee';
import { useWallet } from '@/wallet/walletContext';

/** Live PayeeRegistry.getPayee for a domain. Re-reads every few seconds while Pending or while a change is queued. */
export function usePayee(domain: string) {
  const { config, publicClient } = useWallet();
  const valid = isContractDomain(domain);
  const domainHash: Hex | null = valid ? keccak256(toBytes(domain)) : null;

  const query = useQuery({
    queryKey: ['payee', config.registry, domainHash],
    enabled: domainHash !== null,
    queryFn: () => {
      if (!domainHash) throw new Error('Enter a valid domain first');
      return fetchPayee(publicClient, config.registry, domainHash);
    },
    retry: false,
    refetchInterval: (q) => {
      const p = q.state.data;
      if (!p) return false;
      const queued = p.pendingPayout !== ZERO_ADDRESS || p.pendingController !== ZERO_ADDRESS;
      return p.status === 1 ? 3000 : queued ? 5000 : false;
    },
  });

  return { valid, domainHash, ...query };
}
