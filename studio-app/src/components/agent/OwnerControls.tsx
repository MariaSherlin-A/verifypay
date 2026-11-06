import { useState } from 'react';
import { Coins, PauseCircle, PlayCircle } from 'lucide-react';
import { erc20Abi } from 'viem';
import type { AgentWalletState } from '@/lib/agentWallet';
import { AGENT_WALLET_ABI } from '@/lib/txErrors';
import { useBalances } from '@/wallet/useBalances';
import { useWallet } from '@/wallet/walletContext';
import { MAX_UINT128, parseTokenAmount, type AgentToken } from './agentToken';
import { ghost, input, primary } from './styles';

/** Owner-only actions that never need World ID: pause / unpause the agent, and fund the wallet from my wallet. */
export function OwnerControls({ token, state, isOwner }: { token: AgentToken; state: AgentWalletState; isOwner: boolean }) {
  const { config, canTransact, write } = useWallet();
  const balances = useBalances();
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = parseTokenAmount(amountText, token.decimals);
  const myBalance = balances.data?.[token.key].raw;
  let amountError: string | null = null;
  if (parsed && !parsed.ok) amountError = parsed.message;
  else if (parsed?.ok && parsed.raw === 0n) amountError = 'Enter an amount above zero.';
  else if (parsed?.ok && parsed.raw > MAX_UINT128) amountError = 'That is larger than the contract allows.';
  else if (parsed?.ok && myBalance !== undefined && parsed.raw > myBalance) amountError = `That is more than your ${token.symbol} balance.`;
  const amount = parsed?.ok && !amountError ? parsed.raw : null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      // write() recorded the decoded error for the status card
    } finally {
      setBusy(false);
    }
  };

  const togglePause = () =>
    run(() => write({ address: config.agentWallet, abi: AGENT_WALLET_ABI, functionName: 'setPaused', args: [!state.paused] }, state.paused ? 'Unpause agent' : 'Pause agent'));

  const fund = () => {
    if (amount === null) return Promise.resolve();
    return run(async () => {
      await write({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [config.agentWallet, amount] }, `Fund agent wallet with ${amountText.trim()} ${token.symbol}`);
      setAmountText('');
    });
  };

  const disabled = !isOwner || !canTransact || busy;

  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="owner-title">
      <h2 id="owner-title" className="display text-xl font-semibold">
        Owner controls
      </h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
        <p className="text-sm">
          The agent is <b>{state.paused ? 'paused' : 'running'}</b>. {state.paused ? 'It cannot pay anyone until you unpause it.' : 'Pause it to stop every payment at once.'}
        </p>
        <button type="button" className={ghost} disabled={disabled} onClick={() => void togglePause()}>
          {state.paused ? <PlayCircle size={16} aria-hidden /> : <PauseCircle size={16} aria-hidden />}
          {state.paused ? 'Unpause' : 'Pause'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4">
        <label className="block text-sm font-medium" htmlFor="fund-amount">
          Fund agent wallet ({token.symbol} from your wallet)
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input id="fund-amount" inputMode="decimal" className={`${input} min-w-0 flex-1`} placeholder="0.00" autoComplete="off" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          <button type="button" className={primary} disabled={disabled || amount === null} onClick={() => void fund()}>
            <Coins size={16} aria-hidden />
            Fund agent wallet
          </button>
        </div>
        {amountError && <p className="mt-1 text-sm text-[var(--danger)]">{amountError}</p>}
      </div>
    </section>
  );
}
