import { getAddress, zeroAddress, type Address, type PublicClient } from 'viem';
import type { AppConfig } from '@/lib/appConfig';
import { syncFeed } from '@/lib/safesendFeed';

/**
 * The addresses this wallet has really paid: SafeSend `Paid` events where sender = me, plus escrows of mine that were
 * released (the recipient got the money). Read from the chain from the SafeSend deployment block (the shared, cached
 * event feed), per wallet in memory.
 */
export async function loadCounterparties(client: PublicClient, config: AppConfig, account: Address): Promise<Address[]> {
  const me = account.toLowerCase();
  const feed = await syncFeed(client, config.safeSend);
  const all = new Set<string>();
  for (const p of feed.paid) if (p.sender.toLowerCase() === me) all.add(p.to.toLowerCase());
  // An escrow of mine that was released: the recipient got the money.
  for (const e of feed.escrowed.values()) if (e.sender.toLowerCase() === me && feed.released.has(e.id.toString())) all.add(e.to.toLowerCase());
  all.delete(me);
  all.delete(zeroAddress);
  return [...all].map((a) => getAddress(a)).sort();
}

/**
 * A counterparty with the same first 4 and last 4 hex characters (case-insensitive) as `target` but a different address:
 * the pattern of an address-poisoning look-alike.
 */
export function findLookalike(target: Address, counterparties: readonly Address[]): Address | null {
  const t = target.toLowerCase();
  const head = t.slice(2, 6);
  const tail = t.slice(-4);
  return (
    counterparties.find((c) => {
      const l = c.toLowerCase();
      return l !== t && l.slice(2, 6) === head && l.slice(-4) === tail;
    }) ?? null
  );
}
