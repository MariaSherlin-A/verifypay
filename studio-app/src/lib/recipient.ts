import { getAddress, isAddress, keccak256, toBytes, type Address, type Hex, type PublicClient } from 'viem';
import { REGISTRY_ABI } from '@/lib/txErrors';

/** PayeeRegistry.Status */
export const STATUS = { None: 0, Pending: 1, Active: 2, Frozen: 3 } as const;
/** PayeeRegistry.Verdict */
export const VERDICT = { Unknown: 0, Verified: 1, Frozen: 2, Lookalike: 3 } as const;

/** Same pattern as web/app.js isDomain: lowercase letters, digits and hyphens, at least one dot. */
export const isDomain = (s: string): boolean => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s);

export const shortAddr = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

export type Recipient =
  | { kind: 'invalid' }
  | { kind: 'domain'; target: string; domainHash: Hex; payout: Address; status: number }
  | {
      kind: 'address';
      target: Address;
      verdict: number;
      domainHash: Hex;
      imitated: Address;
      /** Domain of the real payee, only read for a look-alike verdict. */
      imitatedDomain: string | null;
    };

/**
 * Reads the verdict for what was typed, straight from PayeeRegistry. Input is only trimmed (web/app.js does the
 * same): an uppercase domain is not accepted as a domain, it is not silently lowercased.
 */
export async function lookupRecipient(client: PublicClient, registry: Address, raw: string): Promise<Recipient> {
  const v = raw.trim();
  if (isDomain(v)) {
    const domainHash = keccak256(toBytes(v));
    const [payout, status] = (await client.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: 'resolve',
      args: [domainHash],
    })) as readonly [Address, number];
    return { kind: 'domain', target: v, domainHash, payout, status };
  }
  if (isAddress(v)) {
    const [verdict, domainHash, imitated] = (await client.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: 'inspectRecipient',
      args: [v],
    })) as readonly [number, Hex, Address];
    let imitatedDomain: string | null = null;
    if (verdict === VERDICT.Lookalike) {
      const payee = (await client.readContract({
        address: registry,
        abi: REGISTRY_ABI,
        functionName: 'getPayee',
        args: [domainHash],
      })) as { domain: string };
      imitatedDomain = payee.domain;
    }
    return { kind: 'address', target: getAddress(v), verdict, domainHash, imitated, imitatedDomain };
  }
  return { kind: 'invalid' };
}

/** True when the payment settles in one step (a verified business), false when SafeSend will hold it in the undo escrow. */
export const isInstant = (r: Recipient | undefined): boolean =>
  r !== undefined && ((r.kind === 'domain' && r.status === STATUS.Active) || (r.kind === 'address' && r.verdict === VERDICT.Verified));

/** True when SafeSend would revert for this recipient (frozen or unverified name), so Pay must stay disabled. */
export const isBlocked = (r: Recipient | undefined): boolean =>
  r === undefined ||
  r.kind === 'invalid' ||
  (r.kind === 'domain' && r.status !== STATUS.Active) ||
  (r.kind === 'address' && r.verdict === VERDICT.Frozen);

/** Splits two addresses into per-character segments, marking each character that differs (case-insensitive), as web/app.js highlightDiff. */
export function diffSegments(pasted: string, imitated: string): { ch: string; differs: boolean }[] {
  const a = getAddress(pasted);
  const b = getAddress(imitated);
  return [...a].map((ch, i) => ({ ch, differs: ch.toLowerCase() !== (b[i] ?? '').toLowerCase() }));
}
