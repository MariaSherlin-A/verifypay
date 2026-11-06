import { isAddress, isHex, type Address, type Hex, type PublicClient } from 'viem';
import { REGISTRY_ABI } from '@/lib/txErrors';

export const STATUS_LABEL = ['None', 'Pending', 'Active', 'Frozen'] as const;
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** Same rule as PayeeRegistry._validDomain: lowercase a-z, 0-9, '-' and '.', 3..253 characters, at least one dot, no dot first or last. */
export function isContractDomain(s: string): boolean {
  if (s.length < 3 || s.length > 253) return false;
  let dot = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === '.') {
      if (i === 0 || i === s.length - 1) return false;
      dot = true;
    } else if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-')) {
      return false;
    }
  }
  return dot;
}

/** PayeeRegistry.getPayee(bytes32) result. */
export interface Payee {
  domain: string;
  controller: Address;
  payout: Address;
  leiHash: Hex;
  status: number;
  verifiedAt: bigint;
  pendingPayout: Address;
  payoutEta: bigint;
  pendingController: Address;
  controllerEta: bigint;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function toPayee(v: unknown): Payee {
  if (
    !isRecord(v) ||
    typeof v.domain !== 'string' ||
    typeof v.controller !== 'string' || !isAddress(v.controller) ||
    typeof v.payout !== 'string' || !isAddress(v.payout) ||
    typeof v.leiHash !== 'string' || !isHex(v.leiHash) ||
    typeof v.status !== 'number' ||
    typeof v.verifiedAt !== 'bigint' ||
    typeof v.pendingPayout !== 'string' || !isAddress(v.pendingPayout) ||
    typeof v.payoutEta !== 'bigint' ||
    typeof v.pendingController !== 'string' || !isAddress(v.pendingController) ||
    typeof v.controllerEta !== 'bigint'
  ) {
    throw new Error('PayeeRegistry.getPayee returned data in an unexpected format');
  }
  return {
    domain: v.domain,
    controller: v.controller,
    payout: v.payout,
    leiHash: v.leiHash,
    status: v.status,
    verifiedAt: v.verifiedAt,
    pendingPayout: v.pendingPayout,
    payoutEta: v.payoutEta,
    pendingController: v.pendingController,
    controllerEta: v.controllerEta,
  };
}

export async function fetchPayee(client: PublicClient, registry: Address, domainHash: Hex): Promise<Payee> {
  const raw: unknown = await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'getPayee', args: [domainHash] });
  return toPayee(raw);
}
