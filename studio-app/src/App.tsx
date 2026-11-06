import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { fetchAppConfig } from '@/lib/appConfig';
import { Header } from '@/components/Header';
import { BusinessScreen } from '@/components/business/BusinessScreen';
import { HistoryShield } from '@/components/history/HistoryShield';
import { TopNav } from '@/components/nav/TopNav';
import { useTab } from '@/hooks/useTab';
import { PayScreen } from '@/components/pay/PayScreen';
import { TxStatus } from '@/components/TxStatus';
import { UndoWindow } from '@/components/undo/UndoWindow';
import { WalletProvider } from '@/wallet/WalletProvider';
import { useWallet } from '@/wallet/walletContext';

function Contracts() {
  const { config } = useWallet();
  const rows: [string, string][] = [
    ['PayeeRegistry', config.registry],
    ['SafeSend', config.safeSend],
    ['AgentWallet', config.agentWallet],
    ['USDC', config.usdc],
    ['EURC', config.eurc],
  ];
  return (
    <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="contracts-title">
      <h2 id="contracts-title" className="display text-lg font-semibold">
        Contracts on Arc Testnet
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Loaded live from the VerifyPay backend.</p>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {rows.map(([name, address]) => (
          <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-sm font-medium">{name}</span>
            <a
              href={`${config.explorer}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono tnum inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--ink-2)] underline-offset-2 hover:underline"
            >
              {address}
              <ExternalLink size={12} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Main() {
  const [tab, setTab] = useTab();
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <TopNav tab={tab} onChange={setTab} />
      {tab === 'pay' && (
        <>
          <PayScreen />
          <UndoWindow />
          <HistoryShield />
        </>
      )}
      {tab === 'business' && <BusinessScreen />}
      <div className="sticky bottom-4 z-30 empty:hidden">
        <TxStatus />
      </div>
      <Contracts />
    </main>
  );
}

export default function App() {
  const { data: config, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['app-config'],
    queryFn: fetchAppConfig,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-[var(--muted)]" role="status">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} aria-hidden />
          Loading VerifyPay…
        </span>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="glass max-w-md rounded-3xl p-6" role="alert">
          <h1 className="display text-xl font-semibold">Cannot load VerifyPay</h1>
          <p className="mt-2 text-sm text-[var(--danger)]">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">The app needs the backend (bun run server) for its contract addresses.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <WalletProvider config={config}>
      <div className="min-h-dvh">
        <Header />
        <Main />
      </div>
    </WalletProvider>
  );
}
