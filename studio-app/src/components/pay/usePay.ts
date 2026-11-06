import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { decodeEventLog, erc20Abi, keccak256, toBytes, type Address, type Hex, type TransactionReceipt } from 'viem';
import { isBlocked, lookupRecipient, type Recipient } from '@/lib/recipient';
import { savePending } from '@/lib/pending';
import { decodeTxError, SAFESEND_ABI } from '@/lib/txErrors';
import { parseUnitsExact, usdcDecimalsFor } from '@/onchain-money';
import { EURC_EXPECTED_DECIMALS } from '@/wallet/useBalances';
import { useWallet } from '@/wallet/walletContext';

export type TokenKey = 'usdc' | 'eurc';

export type PayResult =
  | { kind: 'paid'; hash: Hex; to: string }
  | { kind: 'held'; hash: Hex; id: bigint; to: Address; releaseAt: bigint };

interface EscrowedArgs {
  id: bigint;
  to: Address;
  releaseAt: bigint;
}

const isEscrowedArgs = (a: unknown): a is EscrowedArgs =>
  typeof a === 'object' && a !== null && 'id' in a && typeof a.id === 'bigint' && 'to' in a && typeof a.to === 'string' && 'releaseAt' in a && typeof a.releaseAt === 'bigint';

/** Finds SafeSend's Escrowed event in the receipt (the payment was held for the undo window). */
function findEscrowed(receipt: TransactionReceipt, safeSend: Address): EscrowedArgs | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== safeSend.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: SAFESEND_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === 'Escrowed' && isEscrowedArgs(ev.args)) return ev.args;
    } catch {
      // a log from this contract that is not in the ABI: ignore
    }
  }
  return null;
}

export const tokenSymbol = (k: TokenKey): string => (k === 'eurc' ? 'EURC' : 'USDC');

export function usePay() {
  const { config, account, publicClient, write } = useWallet();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decimalsFor = useCallback(
    (k: TokenKey): number => (k === 'eurc' ? EURC_EXPECTED_DECIMALS : usdcDecimalsFor(config.chainId)),
    [config.chainId],
  );

  /** Returns the parsed amount in the token's smallest unit, or an error message. Never rounds. */
  const parseAmount = useCallback(
    (text: string, k: TokenKey): { raw: bigint } | { error: string } => {
      try {
        const raw = parseUnitsExact(text, decimalsFor(k));
        return raw > 0n ? { raw } : { error: 'Enter an amount greater than zero.' };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    [decimalsFor],
  );

  const pay = useCallback(
    async (recipient: Recipient, tokenKey: TokenKey, amountText: string) => {
      setFormError(null);
      setResult(null);
      if (!account) return setFormError('Connect your wallet first.');
      const parsed = parseAmount(amountText, tokenKey);
      if ('error' in parsed) return setFormError(parsed.error);
      const amount = parsed.raw;
      const token = tokenKey === 'eurc' ? config.eurc : config.usdc;
      const symbol = tokenSymbol(tokenKey);

      setBusy(true);
      // write() records its own failures for <TxStatus />; remember when one came from it so the error is not shown twice.
      const flags = { writeFailed: false };
      const send: typeof write = async (params, label) => {
        try {
          return await write(params, label);
        } catch (e) {
          flags.writeFailed = true;
          throw e;
        }
      };
      try {
        // Re-read the verdict right before paying: it may have changed since it was displayed.
        const target = recipient.kind === 'domain' ? recipient.target : recipient.kind === 'address' ? recipient.target : '';
        const fresh = await lookupRecipient(publicClient, config.registry, target);
        if (isBlocked(fresh)) throw new Error('This recipient can no longer be paid: its status changed on chain. Check the verdict above.');

        const allowance = await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, config.safeSend],
        });
        if (allowance < amount) {
          setStep(`Step 1 of 2: allow VerifyPay to move exactly this ${symbol} amount from your wallet. A token needs this permission once per amount before any payment.`);
          await send({ address: token, abi: erc20Abi, functionName: 'approve', args: [config.safeSend, amount] }, `Allow VerifyPay to move ${amountText.trim()} ${symbol}`);
        }

        setStep(allowance < amount ? 'Step 2 of 2: confirm the payment in your wallet.' : 'Confirm the payment in your wallet.');
        // A unique reference per payment so the same amount to the same recipient is never ambiguous.
        const ref = keccak256(toBytes(`vp:${account}:${Date.now()}:${crypto.randomUUID()}`));

        if (fresh.kind === 'domain') {
          const { hash } = await send(
            { address: config.safeSend, abi: SAFESEND_ABI, functionName: 'payByName', args: [token, fresh.domainHash, amount, ref] },
            `Pay ${fresh.target} ${amountText.trim()} ${symbol}`,
          );
          setResult({ kind: 'paid', hash, to: fresh.target });
        } else if (fresh.kind === 'address') {
          const { hash, receipt } = await send(
            { address: config.safeSend, abi: SAFESEND_ABI, functionName: 'send', args: [token, fresh.target, amount, ref] },
            `Send ${amountText.trim()} ${symbol} to ${fresh.target.slice(0, 6)}…${fresh.target.slice(-4)}`,
          );
          const escrowed = findEscrowed(receipt, config.safeSend);
          if (escrowed) {
            savePending(config.safeSend, escrowed.id);
            void queryClient.invalidateQueries({ queryKey: ['escrows'] }); // show the new escrow in the Undo window now
            setResult({ kind: 'held', hash, id: escrowed.id, to: escrowed.to, releaseAt: escrowed.releaseAt });
          } else {
            setResult({ kind: 'paid', hash, to: fresh.target });
          }
        }
      } catch (e) {
        // write() already recorded the transaction error for <TxStatus />; anything before it is shown here.
        const failure = decodeTxError(e);
        if (!flags.writeFailed && failure.kind !== 'rejected') setFormError(failure.message);
      } finally {
        setStep(null);
        setBusy(false);
      }
    },
    [account, config, parseAmount, publicClient, queryClient, write],
  );

  return { pay, parseAmount, step, result, formError, busy, clearResult: () => setResult(null) };
}
