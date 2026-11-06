import { getAbiItem, zeroAddress, type AbiEvent, type Address, type Hex, type PublicClient } from 'viem';
import type { AppConfig } from '@/lib/appConfig';
import { loadPending } from '@/lib/pending';
import { REGISTRY_ABI, SAFESEND_ABI } from '@/lib/txErrors';

/** Block of the SafeSend deployment (tx 0x6666…1fa2, confirmed on chain): no Escrowed event can exist before it. */
export const SAFESEND_DEPLOY_BLOCK = 70933971n;

/** Largest log range the Arc RPC accepts is just above 10,000 blocks (20,000 is rejected: "requested range too large"). */
const CHUNK = 10_000n;
const SMALL_CHUNK = 2_000n;

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

interface EscrowedLog {
  id: bigint;
  token: Address;
  to: Address;
  amount: bigint;
  releaseAt: bigint;
  reason: number;
  imitated: Address;
  blockNumber: bigint;
}

type SimpleLog = { blockNumber: bigint; args: unknown };

function eventItem(name: 'Escrowed' | 'Cancelled' | 'Released'): AbiEvent {
  const item = getAbiItem({ abi: SAFESEND_ABI, name });
  if (!item || item.type !== 'event') throw new Error(`The SafeSend ABI has no ${name} event`);
  return item;
}

interface LogQuery {
  address: Address;
  event: AbiEvent;
  args?: Record<string, unknown>;
  fromBlock: bigint;
  toBlock: bigint;
}

async function logsInRange(client: PublicClient, q: LogQuery, fromBlock: bigint, toBlock: bigint): Promise<SimpleLog[]> {
  const logs = await client.getLogs({ address: q.address, event: q.event, args: q.args, fromBlock, toBlock });
  return logs.map((l) => ({ blockNumber: l.blockNumber ?? 0n, args: l.args }));
}

/**
 * Reads logs for the whole range in one call. If the RPC rejects the range, reads it in 10,000-block chunks,
 * and in 2,000-block pieces if a chunk is rejected too. If that still fails, the real RPC error is thrown.
 */
async function getLogsChunked(client: PublicClient, q: LogQuery): Promise<SimpleLog[]> {
  if (q.fromBlock > q.toBlock) return [];
  try {
    return await logsInRange(client, q, q.fromBlock, q.toBlock);
  } catch (whole) {
    if (q.toBlock - q.fromBlock < CHUNK) throw whole;
  }
  const out: SimpleLog[] = [];
  for (let from = q.fromBlock; from <= q.toBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < q.toBlock ? from + CHUNK - 1n : q.toBlock;
    try {
      out.push(...(await logsInRange(client, q, from, to)));
    } catch {
      for (let f = from; f <= to; f += SMALL_CHUNK) {
        const t = f + SMALL_CHUNK - 1n < to ? f + SMALL_CHUNK - 1n : to;
        out.push(...(await logsInRange(client, q, f, t))); // a failure here is the real error: it propagates
      }
    }
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseEscrowed(log: SimpleLog): EscrowedLog | null {
  const a = log.args;
  if (!isRecord(a)) return null;
  const { id, token, to, amount, releaseAt, reason, imitated } = a;
  if (typeof id !== 'bigint' || typeof token !== 'string' || typeof to !== 'string') return null;
  if (typeof amount !== 'bigint' || typeof releaseAt !== 'bigint' || typeof reason !== 'number' || typeof imitated !== 'string') return null;
  return { id, token: token as Address, to: to as Address, amount, releaseAt, reason, imitated: imitated as Address, blockNumber: log.blockNumber };
}

// Incremental scan state: the chain is only read from where the previous scan stopped.
const scanCache = new Map<string, { scannedTo: bigint; logs: Map<string, EscrowedLog> }>();
const outcomeCache = new Map<string, Outcome>();
const domainCache = new Map<string, string | null>();

async function scanEscrowed(client: PublicClient, safeSend: Address, sender: Address, head: bigint) {
  const key = `${safeSend}:${sender}`;
  const state = scanCache.get(key) ?? { scannedTo: SAFESEND_DEPLOY_BLOCK - 1n, logs: new Map<string, EscrowedLog>() };
  if (state.scannedTo < head) {
    const found = await getLogsChunked(client, {
      address: safeSend,
      event: eventItem('Escrowed'),
      args: { sender },
      fromBlock: state.scannedTo + 1n,
      toBlock: head,
    });
    for (const l of found) {
      const parsed = parseEscrowed(l);
      if (parsed) state.logs.set(parsed.id.toString(), parsed);
    }
    state.scannedTo = head; // only advanced after every chunk succeeded
    scanCache.set(key, state);
  }
  return state.logs;
}

async function findOutcome(client: PublicClient, safeSend: Address, id: bigint, fromBlock: bigint, head: bigint): Promise<Outcome> {
  const key = `${safeSend}:${id}`;
  const cached = outcomeCache.get(key);
  if (cached) return cached;
  const cancelled = await getLogsChunked(client, { address: safeSend, event: eventItem('Cancelled'), args: { id }, fromBlock, toBlock: head });
  if (cancelled.length) {
    outcomeCache.set(key, 'undone');
    return 'undone';
  }
  const released = await getLogsChunked(client, { address: safeSend, event: eventItem('Released'), args: { id }, fromBlock, toBlock: head });
  if (released.length) {
    outcomeCache.set(key, 'released');
    return 'released';
  }
  return 'settled'; // closed but no Cancelled/Released event found: not cached, looked up again next time
}

async function domainOf(client: PublicClient, registry: Address, wallet: Address): Promise<string | null> {
  const cached = domainCache.get(wallet);
  if (cached !== undefined) return cached;
  const [, domainHash] = (await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'inspectRecipient', args: [wallet] })) as readonly [number, Hex, Address];
  let domain: string | null = null;
  if (domainHash !== `0x${'0'.repeat(64)}`) {
    const payee = (await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'getPayee', args: [domainHash] })) as { domain: string };
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
 * My held payments: Escrowed logs where I am the sender (from the SafeSend deployment block), merged with the ids this
 * browser saved, then SafeSend.pendings(id) for each to get the current open state.
 */
export async function loadEscrows(client: PublicClient, config: AppConfig, account: Address): Promise<Escrow[]> {
  const head = await client.getBlockNumber();
  const logs = await scanEscrowed(client, config.safeSend, account, head);

  const ids = new Map<string, bigint>();
  for (const l of logs.values()) ids.set(l.id.toString(), l.id);
  for (const s of loadPending(config.safeSend)) {
    const id = toBigInt(s);
    if (id !== null) ids.set(id.toString(), id);
  }

  const escrows = await Promise.all(
    [...ids.values()].map(async (id): Promise<Escrow | null> => {
      const p = (await client.readContract({ address: config.safeSend, abi: SAFESEND_ABI, functionName: 'pendings', args: [id] })) as readonly [Address, Address, Address, bigint, bigint, number, boolean];
      const [token, sender, to, amount, releaseAt, reason, open] = p;
      if (sender.toLowerCase() !== account.toLowerCase()) return null; // unknown id, or another account's escrow

      let log = logs.get(id.toString());
      if (!log) {
        const byId = await getLogsChunked(client, { address: config.safeSend, event: eventItem('Escrowed'), args: { id }, fromBlock: SAFESEND_DEPLOY_BLOCK, toBlock: head });
        const parsed = byId[0] ? parseEscrowed(byId[0]) : null;
        if (parsed) log = parsed;
      }
      const imitated = log && log.imitated !== zeroAddress ? log.imitated : null;
      const imitatedDomain = reason === 1 && imitated ? await domainOf(client, config.registry, imitated) : null;
      const outcome = open ? null : await findOutcome(client, config.safeSend, id, log?.blockNumber ?? SAFESEND_DEPLOY_BLOCK, head);
      return { id, token, to, amount, releaseAt, reason, open, imitated, imitatedDomain, outcome };
    }),
  );
  return escrows.filter((e): e is Escrow => e !== null).sort((a, b) => (a.id < b.id ? 1 : -1));
}
