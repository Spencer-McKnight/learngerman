import type { ReactNode } from "react";
import { cn } from "./cn";

const SIZES = {
  sm: "text-display-m",
  md: "text-display-l",
  lg: "text-display-xl",
} as const;

export interface StatProps {
  /** The number (pre-formatted by the caller with the UI locale). */
  value: ReactNode;
  /** What the number is: "Wörter", "Tage", "Minuten gehört". */
  label: ReactNode;
  /** A short unit shown after the value at a smaller size: "%", "min". */
  unit?: ReactNode;
  size?: keyof typeof SIZES;
  /** Plays `animate-count-up` once on mount (pages key it to re-trigger). */
  animate?: boolean;
  align?: "start" | "center";
  className?: string;
}

/**
 * A big DIN number with its label underneath, tabular so columns of
 * stats line up and the digits do not jitter as they change. Use it for
 * the honest metrics — known words, days, minutes understood — and for
 * nothing invented (no XP, no percent-fluent). One `lg` per screen at
 * most; rows of `sm` for secondary numbers. Not for currency or dates,
 * and not inside a button.
 */
export function Stat({ value, label, unit, size = "md", animate = false, align = "start", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "center" && "items-center text-center", className)}>
      <span
        className={cn("font-display tabular text-ink", SIZES[size], animate && "animate-count-up inline-block")}
      >
        {value}
        {unit !== undefined && (
          <span className="ml-1 text-[0.55em] font-semibold text-ink-muted">{unit}</span>
        )}
      </span>
      <span className="text-body-sm text-ink-muted">{label}</span>
    </div>
  );
}
