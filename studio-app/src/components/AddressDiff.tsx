import { diffSegments } from '@/lib/recipient';

/** An address with every character that differs from the real one marked, and the real address underneath. */
export function AddressDiff({
  pasted,
  real,
  pastedLabel = 'You pasted',
  realLabel = 'Real payee',
}: {
  pasted: string;
  real: string;
  pastedLabel?: string;
  realLabel?: string;
}) {
  let segments: { ch: string; differs: boolean }[];
  try {
    segments = diffSegments(pasted, real);
  } catch {
    segments = [...pasted].map((ch) => ({ ch, differs: false })); // not a valid address: show it unmarked
  }
  return (
    <div className="mono mt-3 space-y-1.5 break-all text-[13px] font-normal leading-relaxed">
      <p>
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.08em] opacity-80">{pastedLabel} </span>
        <br />
        {segments.map((s, i) =>
          s.differs ? (
            <mark key={i} className="rounded bg-[#ba2b4c] px-[1px] font-semibold text-white">
              {s.ch}
            </mark>
          ) : (
            <span key={i}>{s.ch}</span>
          ),
        )}
      </p>
      <p>
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.08em] opacity-80">{realLabel} </span>
        <br />
        {real}
      </p>
    </div>
  );
}
