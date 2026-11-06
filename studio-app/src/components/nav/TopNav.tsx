import type { Tab } from '@/hooks/useTab';

const ITEMS: { id: Tab; label: string; enabled: boolean }[] = [
  { id: 'pay', label: 'Pay', enabled: true },
  { id: 'business', label: 'Business', enabled: true },
  // The Agent wallet screen is the next build step; the tab is shown but cannot be opened yet.
  { id: 'agent', label: 'Agent', enabled: false },
];

export function TopNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="Sections" className="glass inline-flex gap-1 self-start rounded-full p-1">
      {ITEMS.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.enabled}
            aria-current={active ? 'page' : undefined}
            title={item.enabled ? undefined : 'Built in the next step'}
            onClick={() => onChange(item.id)}
            className={`min-h-11 rounded-full px-5 text-sm font-semibold transition ${
              active ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-2)] hover:bg-white/70'
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
