import { erc20Abi, isAddress, type Address, type PublicClient } from 'viem';
import { AGENT_WALLET_ABI } from '@/lib/txErrors';

export interface AgentWalletState {
  /** Per-payment cap, atomic units (6 decimals). */
  perPayment: bigint;
  /** Per-day cap, atomic units. */
  perDay: bigint;
  spentToday: bigint;
  agent: Address;
  owner: Address;
  paused: boolean;
  /** ERC20.balanceOf(AgentWallet) for the selected token. */
  balance: bigint;
}

const bad = (what: string) => new Error(`AgentWallet.${what} returned data in an unexpected format`);

/** Reads AgentWallet limits(token), spentToday(token), agent(), owner(), paused() and the token balance of the wallet. */
export async function fetchAgentWallet(client: PublicClient, wallet: Address, token: Address): Promise<AgentWalletState> {
  const read = (functionName: string, args?: readonly unknown[]): Promise<unknown> =>
    client.readContract({ address: wallet, abi: AGENT_WALLET_ABI, functionName, args });

  const [limits, spent, agent, owner, paused, balance] = await Promise.all([
    read('limits', [token]),
    read('spentToday', [token]),
    read('agent'),
    read('owner'),
    read('paused'),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
  ]);

  if (!Array.isArray(limits) || typeof limits[0] !== 'bigint' || typeof limits[1] !== 'bigint') throw bad('limits');
  if (typeof spent !== 'bigint') throw bad('spentToday');
  if (typeof agent !== 'string' || !isAddress(agent)) throw bad('agent');
  if (typeof owner !== 'string' || !isAddress(owner)) throw bad('owner');
  if (typeof paused !== 'boolean') throw bad('paused');

  return { perPayment: limits[0], perDay: limits[1], spentToday: spent, agent, owner, paused, balance };
}
