import { zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import type { AppConfig } from '@/lib/appConfig';
import { loadPending } from '@/lib/pending';
import { paced, syncFeed } from '@/lib/safesendFeed';
import { REGISTRY_ABI, SAFESEND_ABI } from '@/lib/txErrors';

export { SAFESEND_DEPLOY_BLOCK } from '@/lib/safesendFeed';

export type Outcome = 'undone' | 'released' | 'settled';

export interface Escrow {
  id: bigint;
  token: Address;
  to: Address;
  amount: bigint;
  releaseAt: bigint;
  /** 0 = first-time address, 1 = look-alike */
  reason: number;
  open: boolean;
  /** The real payee wallet this one imitates (look-alike only). */
  imitated: Address | null;
  /** Domain of that real payee when it can still be resolved. */
  imitatedDomain: string | null;
  /** How a closed escrow ended, from the Cancelled / Released events. */
  outcome: Outcome | null;
}

const domainCache = new Map<string, string | null>();

async function domainOf(client: PublicClient, registry: Address, wallet: Address): Promise<string | null> {
  const cached = domainCache.get(wallet);
  if (cached !== undefined) return cached;
  const [, domainHash] = (await paced(() => client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'inspectRecipient', args: [wallet] }))) as readonly [number, Hex, Address];
  let domain: string | null = null;
  if (domainHash !== `0x${'0'.repeat(64)}`) {
    const payee = (await paced(() => client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'getPayee', args: [domainHash] }))) as { domain: string };
    domain = payee.domain || null;
  }
  domainCache.set(wallet, domain);
  return domain;
}

const toBigInt = (s: string): bigint | null => {
  try {
    return BigInt(s);
  } catch {
    return null;
  }
};

/**
 * My held payments: the SafeSend Escrowed events where I am the sender (read from the deployment block, in chunks, cached),
 * merged with the ids this browser saved, then SafeSend.pendings(id) for each to get the current open state. Undone or
 * released comes from the Cancelled / Released events of the same feed.
 */
export async function loadEscrows(client: PublicClient, config: AppConfig, account: Address): Promise<Escrow[]> {
  const feed = await syncFeed(client, config.safeSend);
  const me = account.toLowerCase();

  const ids = new Map<string, bigint>();
  for (const e of feed.escrowed.values()) if (e.sender.toLowerCase() === me) ids.set(e.id.toString(), e.id);
  for (const s of loadPending(config.safeSend)) {
    const id = toBigInt(s);
    if (id !== null) ids.set(id.toString(), id);
  }

  const escrows: Escrow[] = [];
  for (const id of ids.values()) {
    const p = (await paced(() => client.readContract({ address: config.safeSend, abi: SAFESEND_ABI, functionName: 'pendings', args: [id] }))) as readonly [Address, Address, Address, bigint, bigint, number, boolean];
    const [token, sender, to, amount, releaseAt, reason, open] = p;
    if (sender.toLowerCase() !== me) continue; // unknown id, or another account's escrow

    const log = feed.escrowed.get(id.toString());
    const imitated = log && log.imitated !== zeroAddress ? log.imitated : null;
    const imitatedDomain = reason === 1 && imitated ? await domainOf(client, config.registry, imitated) : null;
    let outcome: Outcome | null = null;
    if (!open) outcome = feed.cancelled.has(id.toString()) ? 'undone' : feed.released.has(id.toString()) ? 'released' : 'settled';
    escrows.push({ id, token, to, amount, releaseAt, reason, open, imitated, imitatedDomain, outcome });
  }
  return escrows.sort((a, b) => (a.id < b.id ? 1 : -1));
}
