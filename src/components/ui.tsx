/**
 * Tiny shared primitives — "signage modern": calm disciplined surfaces,
 * one accent, joy carried by type weight rather than decoration.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-bright disabled:opacity-50 shadow-sm",
  quiet:
    "bg-transparent text-accent-bright hover:bg-accent/10 disabled:opacity-50",
  outline:
    "border border-line bg-surface text-foreground hover:border-accent-bright disabled:opacity-50",
  answer:
    "border-2 border-line bg-surface text-foreground text-lg font-medium hover:border-accent-bright active:scale-[0.98] disabled:opacity-60",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <button
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted">
      {children}
    </h2>
  );
}
