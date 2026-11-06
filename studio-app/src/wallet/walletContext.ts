import { createContext, useContext } from 'react';
import type { Abi, Address, Chain, Hex, PublicClient, TransactionReceipt } from 'viem';
import type { AppConfig } from '@/lib/appConfig';
import type { TxFailure } from '@/lib/txErrors';

export type TxPhase = 'wallet' | 'confirming' | 'success' | 'error';

export interface TxState {
  phase: TxPhase;
  label: string;
  hash?: Hex;
  failure?: TxFailure;
}

export interface WriteParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

export interface WalletContextValue {
  config: AppConfig;
  chain: Chain;
  publicClient: PublicClient;
  /** True when the browser exposes an injected wallet (window.ethereum). */
  hasProvider: boolean;
  account: Address | null;
  /** The wallet's current chain id, or null before the first read. */
  chainId: number | null;
  onArc: boolean;
  /** True only when a wallet is connected AND eth_chainId is the Arc chain id. Every transaction button must use `disabled={!canTransact}`. */
  canTransact: boolean;
  isConnecting: boolean;
  /** Last connect or network-switch failure, already decoded. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToArc: () => Promise<void>;
  /** Simulates, sends, and waits for the receipt. Throws the original error after recording it in `tx`. */
  write: (params: WriteParams, label?: string) => Promise<{ hash: Hex; receipt: TransactionReceipt }>;
  tx: TxState | null;
  clearTx: () => void;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
