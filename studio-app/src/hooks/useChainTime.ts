import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/wallet/walletContext';

export interface ChainTime {
  /** Timestamp (unix seconds) of the latest block, re-read from the chain every few seconds. Null until the first read. */
  blockTimestamp: number | null;
  /** The latest block timestamp advanced by the seconds elapsed since it was read, so countdowns tick smoothly between block reads. */
  now: number | null;
  error: Error | null;
}

/** Chain time for countdowns. Anchored to the latest block timestamp, never to the local clock's date. */
export function useChainTime(): ChainTime {
  const { publicClient, config } = useWallet();
  const block = useQuery({
    queryKey: ['latest-block-time', config.chainId],
    queryFn: async () => Number((await publicClient.getBlock({ blockTag: 'latest' })).timestamp),
    // Countdowns tick locally between reads, so a 12 s refresh is enough and keeps the public Arc RPC (shared with the
    // wallet) from throttling MetaMask.
    refetchInterval: 12_000,
    retry: false,
  });

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const blockTimestamp = block.data ?? null;
  const elapsed = block.dataUpdatedAt ? Math.max(0, Math.floor((tick - block.dataUpdatedAt) / 1000)) : 0;
  return { blockTimestamp, now: blockTimestamp === null ? null : blockTimestamp + elapsed, error: block.error };
}
