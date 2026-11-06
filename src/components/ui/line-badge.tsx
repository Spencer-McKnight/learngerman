import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "./cn";

export type LineNumber = 1 | 2 | 3 | 4 | 5;

const SIZES = {
  sm: "size-6 text-caption",
  md: "size-8 text-body-sm",
  lg: "size-10 text-body",
} as const;

export interface LineBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  line: LineNumber;
  /** Text inside the circle; defaults to the line number. Keep it ≤ 2 chars. */
  label?: string;
  size?: keyof typeof SIZES;
}

/** Inline style that points at a line's colour tokens, for custom marks. */
export function lineStyle(line: LineNumber): CSSProperties {
  return {
    "--badge-bg": `var(--line-${line})`,
    "--badge-ink": `var(--line-${line}-ink)`,
    "--badge-fill": `var(--line-${line}-fill)`,
  } as CSSProperties;
}

/**
 * The U-Bahn-style circle with a line number in the line's colour. Use
 * it wherever a station or lesson is listed, next to a `StationSign`, in
 * the Weg summary, in the lesson header — so the five lines stay
 * recognisable by position, colour and number together (never colour
 * alone). The badge is a label, not a button; pass `aria-label` with the
 * line's full name when the number alone would not make sense, and do
 * not use it for anything that is not one of the five course lines.
 */
export function LineBadge({ line, label, size = "md", className, style, ...props }: LineBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-pill bg-(--badge-bg) font-display font-bold tabular text-(--badge-ink)",
        SIZES[size],
        className,
      )}
      style={{ ...lineStyle(line), ...style }}
      {...props}
    >
      {label ?? line}
    </span>
  );
}
