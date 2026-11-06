import type { Address } from 'viem';
import type { AppConfig } from '@/lib/appConfig';
import { formatUnitsExact, parseUnitsExact, usdcDecimalsFor } from '@/onchain-money';
import { EURC_EXPECTED_DECIMALS } from '@/wallet/useBalances';

export type TokenKey = 'usdc' | 'eurc';

export interface AgentToken {
  key: TokenKey;
  symbol: 'USDC' | 'EURC';
  address: Address;
  decimals: number;
}

export function tokenFor(key: TokenKey, config: AppConfig): AgentToken {
  return key === 'eurc'
    ? { key, symbol: 'EURC', address: config.eurc, decimals: EURC_EXPECTED_DECIMALS }
    : { key, symbol: 'USDC', address: config.usdc, decimals: usdcDecimalsFor(config.chainId) };
}

/** Shows a token amount with at least 2 decimals (1 -> "1.00"), exact otherwise. */
export function showAmount(raw: bigint, decimals: number): string {
  const exact = formatUnitsExact(raw, decimals);
  const [whole = '0', frac = ''] = exact.split('.');
  return `${whole}.${frac.padEnd(2, '0')}`;
}

export type ParsedAmount = { ok: true; raw: bigint } | { ok: false; message: string };

/** Parses what the person typed using the token's own decimal count (6 for USDC and EURC). Empty is not an error, just not ready. */
export function parseTokenAmount(text: string, decimals: number): ParsedAmount | null {
  if (text.trim() === '') return null;
  try {
    return { ok: true, raw: parseUnitsExact(text.trim(), decimals) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Contract caps are uint128. */
export const MAX_UINT128 = (1n << 128n) - 1n;
