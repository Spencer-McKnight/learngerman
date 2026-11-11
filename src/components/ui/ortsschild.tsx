import { cn } from "./cn";

const SIZES = {
  sm: { box: "gap-0.5 px-5 py-3 border-[3px]", name: "text-display-m", detail: "text-caption" },
  md: { box: "gap-1 px-8 py-5 border-4", name: "text-display-l", detail: "text-body-sm" },
  lg: { box: "gap-1 px-10 py-6 border-4", name: "text-display-xl", detail: "text-body" },
} as const;

export interface OrtsschildProps {
  /** The place or milestone name, set in DIN caps: "A2", "500 WÖRTER", "LINIE 1". */
  label: string;
  /** One line under the name: what this milestone means. */
  detail?: string;
  /** The small line a real Ortsschild carries: "Landkreis Erlangen-Höchstadt". */
  landkreis?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * The yellow German town sign a traveller passes when arriving somewhere
 * new: Ortsschild yellow, black border, name in DIN capitals, optional
 * "Landkreis" line. This is the ONLY component that may use the milestone
 * yellow as a fill, and it appears only for genuine ability events (a
 * CEFR band, a vocabulary threshold, a line completed) inside the
 * milestone overlay or the Weg history. Never for decoration, never for
 * a correct answer, never for a streak. Its colours do not change with
 * the theme — a sign is a physical object.
 */
export function Ortsschild({ label, detail, landkreis, size = "md", className }: OrtsschildProps) {
  const s = SIZES[size];
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-sm border-milestone-ink bg-milestone text-center text-milestone-ink shadow-floating",
        s.box,
        className,
      )}
    >
      <span className={cn("font-display font-bold uppercase leading-none tracking-wide", s.name)}>
        {label}
      </span>
      {detail && <span className={cn("max-w-64 font-medium", s.detail)}>{detail}</span>}
      {landkreis && (
        <span className={cn("mt-1 border-t-2 border-milestone-ink/80 pt-1 text-caption font-semibold tracking-wide")}>
          {landkreis}
        </span>
      )}
    </div>
  );
}
