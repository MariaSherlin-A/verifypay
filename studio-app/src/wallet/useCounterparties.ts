import { useQuery } from '@tanstack/react-query';
import { loadCounterparties } from '@/lib/counterparties';
import { useWallet } from '@/wallet/walletContext';

/** "My real counterparties" for the connected wallet, read from chain (SafeSend Paid events and released escrows). */
export function useCounterparties() {
  const { config, publicClient, account } = useWallet();
  return useQuery({
    queryKey: ['counterparties', account, config.safeSend],
    enabled: account !== null,
    queryFn: () => {
      if (!account) throw new Error('Connect your wallet first');
      return loadCounterparties(publicClient, config, account);
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}
