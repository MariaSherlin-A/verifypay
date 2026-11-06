import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, decodeErrorResult, isHex, type Abi } from 'viem';
import payeeRegistryAbi from '@/abis/PayeeRegistry.json';
import safeSendAbi from '@/abis/SafeSend.json';
import agentWalletAbi from '@/abis/AgentWallet.json';

/** The three deployed contracts' ABIs, used to decode any custom error by selector (never by string matching). */
export const ALL_CONTRACT_ABI = [...payeeRegistryAbi, ...safeSendAbi, ...agentWalletAbi] as Abi;
export const REGISTRY_ABI = payeeRegistryAbi as Abi;
export const SAFESEND_ABI = safeSendAbi as Abi;
export const AGENT_WALLET_ABI = agentWalletAbi as Abi;

export type TxFailure =
  | { kind: 'rejected'; message: string }
  | { kind: 'contract'; name: string; args: readonly unknown[]; message: string }
  | { kind: 'other'; message: string };

const fmtArg = (v: unknown): string => (typeof v === 'bigint' ? v.toString() : String(v));

/** Plain-language copy for each custom error. The key is the error name decoded from the ABI. */
const COPY: Record<string, string> = {
  PayeeNotActive: 'This business is not verified yet, so it cannot be paid by name.',
  PayeeFrozen: 'This business is frozen: its domain verification lapsed, so payments are blocked.',
  WindowOver: 'The undo window has closed, so this payment can no longer be undone.',
  WindowOpen: 'The undo window is still open, so this payment cannot be released yet.',
  NotSender: 'Only the wallet that sent this payment can undo it.',
  NotOpen: 'This held payment has already been settled or undone.',
  UnsupportedToken: 'This token is not supported. Use USDC or EURC.',
  NotController: 'Only the business controller wallet can do this.',
  NotActive: 'This business is not active.',
  BadSignature: 'The World ID approval signature is not valid for this request.',
  Expired: 'The World ID approval expired. Start the verification again.',
  LookalikeCollision: 'This wallet looks too much like an existing registered payout wallet.',
  PayoutInUse: 'This payout wallet is already used by another business.',
  TooEarly: 'The public delay has not finished yet.',
  NotAuthorized: 'This wallet is not allowed to do this.',
  OverPerPayment: 'The amount is over the per-payment limit.',
  OverDaily: 'The amount would go over the daily limit.',
};

/** Turns anything thrown by a viem read, simulation, write or receipt wait into a decoded failure. */
export function decodeTxError(e: unknown): TxFailure {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) {
      return { kind: 'rejected', message: 'You cancelled the request in your wallet.' };
    }
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      let name = reverted.data?.errorName;
      let args: readonly unknown[] = reverted.data?.args ?? [];
      if (!name && reverted.raw && isHex(reverted.raw)) {
        try {
          const decoded = decodeErrorResult({ abi: ALL_CONTRACT_ABI, data: reverted.raw });
          name = decoded.errorName;
          args = decoded.args ?? [];
        } catch {
          // not one of our errors: fall through to the generic message
        }
      }
      if (name) {
        const detail = args.length ? ` (${args.map(fmtArg).join(', ')})` : '';
        return { kind: 'contract', name, args, message: `${name}: ${COPY[name] ?? 'The contract rejected this call.'}${detail}` };
      }
      return { kind: 'other', message: reverted.reason ?? reverted.shortMessage };
    }
    return { kind: 'other', message: e.shortMessage };
  }
  return { kind: 'other', message: e instanceof Error ? e.message : String(e) };
}
