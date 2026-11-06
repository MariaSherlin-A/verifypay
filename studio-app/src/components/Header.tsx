import { useState } from 'react';
import { Check, Copy, Loader2, LogOut, ShieldCheck, Wallet } from 'lucide-react';
import { TokenEURC, TokenUSDC } from '@web3icons/react';
import type { Address } from 'viem';
import { useWallet } from '@/wallet/walletContext';
import { useBalances } from '@/wallet/useBalances';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function AddressChip({ address }: { address: Address }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={address}
      aria-label={copyError ? 'Copy failed. Select the address manually.' : `Copy address ${address}`}
      className="glass mono tnum inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[var(--ink)] transition hover:border-[var(--border-strong)] active:scale-[0.98]"
    >
      {short(address)}
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Address copied' : copyError ? 'Copy failed' : ''}
      </span>
    </button>
  );
}

function NetworkBadge() {
  const { account, chainId, onArc, switchToArc, chain } = useWallet();
  const [switching, setSwitching] = useState(false);

  if (!account) {
    return (
      <span className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[var(--muted)]">
        <span className="h-2 w-2 rounded-full bg-[var(--subtle)]" aria-hidden />
        Not connected
      </span>
    );
  }
  if (chainId === null) {
    return (
      <span className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[var(--muted)]" role="status">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Checking network…
      </span>
    );
  }
  const source = `eth_chainId from your wallet for ${window.location.origin}: ${chainId}`;
  if (onArc) {
    return (
      <span title={source} className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-[var(--success)]">
        <span className="h-2 w-2 rounded-full bg-[var(--success)]" aria-hidden />
        {chain.name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2" role="alert">
      <span title={source} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--danger)] px-4 text-sm font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
        Wrong network ({chainId})
      </span>
      <button
        type="button"
        disabled={switching}
        onClick={() => {
          setSwitching(true);
          void switchToArc().finally(() => setSwitching(false));
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {switching && <Loader2 size={14} className="animate-spin" aria-hidden />}
        Switch to Arc
      </button>
    </span>
  );
}

function Balances() {
  const { data, isLoading, error } = useBalances();

  if (error) {
    return (
      <span className="inline-flex min-h-11 items-center rounded-full bg-[var(--surface-muted)] px-4 text-sm text-[var(--danger)]" role="alert" title={error.message}>
        Balances unavailable: {error.message}
      </span>
    );
  }
  return (
    <span className="glass tnum inline-flex min-h-11 items-center gap-4 rounded-full px-4 text-sm" aria-live="polite" aria-busy={isLoading}>
      <span className="inline-flex items-center gap-1.5" title={data ? `${data.usdc.raw} (6 decimals)` : undefined}>
        <TokenUSDC variant="branded" size={18} />
        <span className="sr-only">USDC</span>
        {isLoading || !data ? <span className="h-3 w-12 animate-pulse rounded bg-[var(--surface-muted)]" /> : <b className="font-semibold">{data.usdc.display}</b>}
        <span className="text-[var(--muted)]">USDC</span>
      </span>
      <span className="inline-flex items-center gap-1.5" title={data ? `${data.eurc.raw} (6 decimals)` : undefined}>
        <TokenEURC variant="branded" size={18} />
        <span className="sr-only">EURC</span>
        {isLoading || !data ? <span className="h-3 w-12 animate-pulse rounded bg-[var(--surface-muted)]" /> : <b className="font-semibold">{data.eurc.display}</b>}
        <span className="text-[var(--muted)]">EURC</span>
      </span>
    </span>
  );
}

function ConnectButton() {
  const { connect, isConnecting, hasProvider } = useWallet();

  if (!hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
      >
        <Wallet size={16} aria-hidden />
        Install a browser wallet
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={isConnecting}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-60"
    >
      {isConnecting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Wallet size={16} aria-hidden />}
      {isConnecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}

export function Header() {
  const { account, disconnect, error } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-strong)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-white">
            <ShieldCheck size={20} aria-hidden />
          </span>
          <span className="display text-xl font-semibold">VerifyPay</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NetworkBadge />
          {account ? (
            <>
              <Balances />
              <AddressChip address={account} />
              <button
                type="button"
                onClick={disconnect}
                aria-label="Disconnect wallet"
                title="Disconnect"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
              >
                <LogOut size={16} aria-hidden />
              </button>
            </>
          ) : (
            <ConnectButton />
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </header>
  );
}
