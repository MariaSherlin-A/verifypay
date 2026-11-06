import { defineChain, getAddress, isAddress, type Address, type Chain } from 'viem';

/** Shape of GET /api/config (served by server/src/server.js). Every address comes from the backend. */
export interface AppConfig {
  chainId: number;
  rpcUrl: string;
  explorer: string;
  registry: Address;
  safeSend: Address;
  agentWallet: Address;
  usdc: Address;
  eurc: Address;
  approvalSigner: Address | null;
}

const ADDRESS_FIELDS = ['registry', 'safeSend', 'agentWallet', 'usdc', 'eurc'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Fetches /api/config and validates it. Throws the real reason on any failure; never returns defaults. */
export async function fetchAppConfig(): Promise<AppConfig> {
  let res: Response;
  try {
    res = await fetch('/api/config');
  } catch (e) {
    throw new Error(`Cannot reach the VerifyPay backend (/api/config): ${e instanceof Error ? e.message : String(e)}`);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = isRecord(body) && typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new Error(`Backend config error: ${detail}`);
  }
  if (!isRecord(body)) throw new Error('Backend config error: response is not a JSON object');

  const { chainId, rpcUrl, explorer, approvalSigner } = body;
  if (typeof chainId !== 'number') throw new Error('Backend config error: chainId is missing');
  if (typeof rpcUrl !== 'string' || typeof explorer !== 'string') throw new Error('Backend config error: rpcUrl or explorer is missing');

  const addresses: Partial<Record<(typeof ADDRESS_FIELDS)[number], Address>> = {};
  for (const field of ADDRESS_FIELDS) {
    const v = body[field];
    if (typeof v !== 'string' || !isAddress(v)) throw new Error(`Backend config error: ${field} is not a valid address`);
    addresses[field] = getAddress(v);
  }
  const signer = typeof approvalSigner === 'string' && isAddress(approvalSigner) ? getAddress(approvalSigner) : null;

  return {
    chainId,
    rpcUrl,
    explorer: explorer.replace(/\/$/, ''),
    registry: addresses.registry as Address,
    safeSend: addresses.safeSend as Address,
    agentWallet: addresses.agentWallet as Address,
    usdc: addresses.usdc as Address,
    eurc: addresses.eurc as Address,
    approvalSigner: signer,
  };
}

/** The viem chain object built from the backend config. Gas is USDC at 18 decimals: display only, never used for payments. */
export function arcChainFromConfig(cfg: AppConfig): Chain {
  return defineChain({
    id: cfg.chainId,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: cfg.explorer } },
  });
}

export const txUrl = (cfg: Pick<AppConfig, 'explorer'>, hash: string): string => `${cfg.explorer}/tx/${hash}`;
