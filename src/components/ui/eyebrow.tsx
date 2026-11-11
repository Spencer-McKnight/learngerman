import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const TONES = {
  muted: "text-ink-muted",
  accent: "text-accent",
  success: "text-success",
  milestone: "text-milestone",
} as const;

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: ElementType;
  tone?: keyof typeof TONES;
}

/**
 * The small uppercase tracked label in DIN that sits above a heading or
 * a card's content ("HEUTE", "SZENE", "DEINE WÖRTER"). Muted by default;
 * `accent` for the beat/mode name on a screen; `milestone` only inside
 * the milestone overlay. Keep it to one to three words — tracking makes
 * long strings hard to read — and never use it for body copy or buttons.
 */
export function Eyebrow({ children, as: Tag = "p", tone = "muted", className, ...props }: EyebrowProps) {
  return (
    <Tag
      className={cn("font-display text-label font-semibold uppercase", TONES[tone], className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** v1 alias: an `Eyebrow` rendered as an `h2`, muted. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Eyebrow as="h2" className={className}>
      {children}
    </Eyebrow>
  );
}
