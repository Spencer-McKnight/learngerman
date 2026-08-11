/**
 * The Ortsschild — the yellow German town sign a traveller passes when
 * arriving somewhere new. Reserved, like its colour, for genuine
 * milestones: this is the only place Ortsschild yellow appears.
 */

export function Ortsschild({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-1 rounded-lg border-4 border-[#1b1f24] bg-[#f7c600] px-8 py-5 text-center text-[#1b1f24] shadow-lg">
      <span className="font-display text-3xl font-bold uppercase tracking-wide">
        {label}
      </span>
      {detail && <span className="max-w-60 text-sm font-medium">{detail}</span>}
    </div>
  );
}
