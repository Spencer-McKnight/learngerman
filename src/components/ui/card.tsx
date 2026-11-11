import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "surface" | "raised" | "outline";

const VARIANTS: Record<CardVariant, string> = {
  surface: "border border-hairline bg-surface shadow-flat",
  raised: "border border-hairline bg-surface-raised shadow-raised",
  outline: "border border-hairline bg-transparent",
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: CardVariant;
  /** Semantic element: `section` by default; `article`, `li`, `div` … */
  as?: ElementType;
  /** Adds hover/active affordance when the whole card is tappable
   *  (the caller wraps it in a link or gives it `onClick` + role). */
  interactive?: boolean;
  /** No padding — for media or lists that run edge to edge. */
  flush?: boolean;
  /** @deprecated use `variant="raised"`. */
  lifted?: boolean;
}

/**
 * A rounded surface that groups one idea: today's round, a skill, a
 * beat. `surface` is the default; `raised` lifts the one card that
 * matters most on a screen (never more than one); `outline` sits inside
 * another card or on a coloured ground. Cards do not move on hover
 * unless `interactive`, and they are not buttons — put a `Button` or a
 * `Link` inside, or wrap the card. Avoid nesting cards more than one deep
 * and avoid cards for single lines of text (use spacing instead).
 */
export function Card({
  children,
  variant,
  as: Tag = "section",
  interactive = false,
  flush = false,
  lifted = false,
  className,
  ...props
}: CardProps) {
  const resolved: CardVariant = variant ?? (lifted ? "raised" : "surface");
  return (
    <Tag
      className={cn(
        "rounded-lg transition-[box-shadow,border-color,transform]",
        VARIANTS[resolved],
        !flush && "p-5",
        interactive && "hover:border-accent hover:shadow-raised active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
