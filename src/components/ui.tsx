import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-bright active:scale-[0.97] active:shadow-none disabled:opacity-50 shadow-sm animate-breathe",
  quiet:
    "bg-transparent text-accent-bright hover:bg-accent/10 active:scale-[0.97] disabled:opacity-50",
  outline:
    "border border-line bg-surface text-foreground hover:border-accent-bright hover:shadow-md active:scale-[0.97] disabled:opacity-50",
  answer:
    "border-2 border-line bg-surface text-foreground text-lg font-medium hover:border-accent-bright hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-200",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
}) {
  const breathe = variant === "primary" && !props.disabled ? "animate-breathe" : "";
  const base = VARIANTS[variant].replace(" animate-breathe", "");
  return (
    <button
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${base} ${breathe} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
  lifted = false,
}: {
  children: ReactNode;
  className?: string;
  lifted?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 transition-all duration-200 ${
        lifted
          ? "shadow-lg ring-1 ring-accent-bright/10"
          : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
      } ${className}`}
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

export function ProgressBar({
  value,
  max = 1,
  className = "",
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value / max)) * 100);
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-line ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
