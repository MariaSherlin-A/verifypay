import { ContractList } from './ContractList';
import { CreEvidence } from './CreEvidence';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Address poisoning',
    body: 'Attackers send you a transfer from an address that looks like one you trust and wait for you to copy it from your history. One study counted 270M poisoning attempts and $83.8M stolen in stablecoins (Jul 2022 to Jun 2024, Ethereum and BSC), and a single copy-paste cost $50M of USDT in December 2025.',
  },
  {
    title: 'Automatic 10-minute undo escrow',
    body: 'Paying a verified business by its domain settles instantly. Paying an address VerifyPay has not verified, or one that imitates a verified business, goes into escrow for 10 minutes, and you can undo it.',
  },
  {
    title: 'Chainlink CRE auto-freeze',
    body: 'A Chainlink CRE workflow keeps re-checking each business’s DNS proof. If the proof disappears or points somewhere else, the business is frozen automatically and payments to it are blocked.',
  },
  {
    title: 'World ID on payout and limit changes',
    body: 'Changing where a business gets paid, or raising what an AI agent may spend, needs a fresh World ID human check. Lowering limits or pausing never does.',
  },
];

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-3xl p-5 sm:p-8" aria-labelledby="how-title">
        <h1 id="how-title" className="display text-3xl font-semibold text-balance">
          How VerifyPay works
        </h1>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span
                className="tnum mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{s.title}</h2>
                <p className="mt-0.5 text-pretty text-sm text-[var(--ink-2)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-[var(--muted)]">
          Sources for the figures: Tsuchiya et al., “Blockchain Address Poisoning” (arXiv 2501.16681); The Block and Cointelegraph for the December 2025 loss.
        </p>
      </section>

      <CreEvidence />
      <ContractList />
    </div>
  );
}
