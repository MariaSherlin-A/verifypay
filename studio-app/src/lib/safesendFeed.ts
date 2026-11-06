import { getAbiItem, type AbiEvent, type Address, type PublicClient } from 'viem';
import { SAFESEND_ABI } from '@/lib/txErrors';

/** Block of the SafeSend deployment (tx 0x6666…1fa2, confirmed on chain): no SafeSend event can exist before it. */
export const SAFESEND_DEPLOY_BLOCK = 70933971n;

/** Largest log range the Arc RPC accepts is just above 10,000 blocks (20,000 is rejected: "requested range too large"). */
const CHUNK = 10_000n;
const SMALL_CHUNK = 2_000n;

// The Arc RPC answers bursts with "rate limit exceeded" (-32005). Measured from a cold start: 3 back-to-back calls fail, a
// 600 ms gap holds for 40 calls. Every chain read of the Undo window and the payment-history check goes through this one
// queue, so they never burst together.
const MIN_GAP_MS = 450;
let queue: Promise<unknown> = Promise.resolve();
export function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  const gap = () => new Promise<void>((r) => setTimeout(r, MIN_GAP_MS));
  queue = run.then(gap, gap);
  return run;
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function eventItem(name: 'Escrowed' | 'Cancelled' | 'Released' | 'Paid'): AbiEvent {
  const item = getAbiItem({ abi: SAFESEND_ABI, name });
  if (!item || item.type !== 'event') throw new Error(`The SafeSend ABI has no ${name} event`);
  return item;
}
const FEED_EVENTS: readonly AbiEvent[] = [eventItem('Escrowed'), eventItem('Cancelled'), eventItem('Released'), eventItem('Paid')];

export interface EscrowedEvent {
  id: bigint;
  token: Address;
  sender: Address;
  to: Address;
  amount: bigint;
  releaseAt: bigint;
  /** 0 = first-time address, 1 = look-alike */
  reason: number;
  imitated: Address;
}

/** Everything SafeSend has emitted that the app needs, from the deployment block to `scannedTo`. */
export interface SafeSendFeed {
  scannedTo: bigint;
  /** Escrowed events by id. */
  escrowed: Map<string, EscrowedEvent>;
  /** Ids that were undone (Cancelled). */
  cancelled: Set<string>;
  /** Ids that were released to the recipient (Released). */
  released: Set<string>;
  /** Instant payments (Paid). */
  paid: { sender: Address; to: Address }[];
}

const feeds = new Map<string, SafeSendFeed>();
const syncing = new Map<string, Promise<unknown>>();

const isAddr = (v: unknown): v is Address => typeof v === 'string' && v.startsWith('0x');

function apply(feed: SafeSendFeed, eventName: string | undefined, args: unknown): void {
  if (!isRecord(args)) return;
  if (eventName === 'Escrowed') {
    const { id, token, sender, to, amount, releaseAt, reason, imitated } = args;
    if (typeof id === 'bigint' && isAddr(token) && isAddr(sender) && isAddr(to) && typeof amount === 'bigint' && typeof releaseAt === 'bigint' && typeof reason === 'number' && isAddr(imitated)) {
      feed.escrowed.set(id.toString(), { id, token, sender, to, amount, releaseAt, reason, imitated });
    }
  } else if (eventName === 'Cancelled') {
    if (typeof args.id === 'bigint') feed.cancelled.add(args.id.toString());
  } else if (eventName === 'Released') {
    if (typeof args.id === 'bigint') feed.released.add(args.id.toString());
  } else if (eventName === 'Paid') {
    if (isAddr(args.sender) && isAddr(args.to)) feed.paid.push({ sender: args.sender, to: args.to });
  }
}

const isRateLimit = (e: unknown): boolean => e instanceof Error && /rate limit|exceeds defined limit/i.test(e.message);

async function readRange(client: PublicClient, safeSend: Address, from: bigint, to: bigint, feed: SafeSendFeed): Promise<void> {
  const logs = await paced(() => client.getLogs({ address: safeSend, events: FEED_EVENTS, fromBlock: from, toBlock: to }));
  for (const l of logs) apply(feed, l.eventName, l.args);
}

async function doSync(client: PublicClient, safeSend: Address): Promise<SafeSendFeed> {
  const key = safeSend.toLowerCase();
  const feed = feeds.get(key) ?? { scannedTo: SAFESEND_DEPLOY_BLOCK - 1n, escrowed: new Map(), cancelled: new Set(), released: new Set(), paid: [] };
  feeds.set(key, feed);
  const head = await client.getBlockNumber();
  // Progress is saved chunk by chunk (scannedTo only moves after a chunk succeeded), so a failure later never loses what was read.
  for (let from = feed.scannedTo + 1n; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    try {
      await readRange(client, safeSend, from, to, feed);
    } catch (e) {
      if (isRateLimit(e)) throw e; // the real RPC error: smaller pieces would only make more requests
      for (let f = from; f <= to; f += SMALL_CHUNK) {
        const t = f + SMALL_CHUNK - 1n < to ? f + SMALL_CHUNK - 1n : to;
        await readRange(client, safeSend, f, t, feed); // a failure here is the real error: it propagates
      }
    }
    feed.scannedTo = to;
  }
  return feed;
}

/**
 * Brings the in-memory SafeSend feed up to the chain head (first call reads from the deployment block in 10,000-block
 * chunks, later calls only the new blocks). Concurrent callers share one scan.
 */
export async function syncFeed(client: PublicClient, safeSend: Address): Promise<SafeSendFeed> {
  const key = safeSend.toLowerCase();
  const previous = syncing.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => doSync(client, safeSend));
  syncing.set(key, run);
  return run;
}
