import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "answer"
  | "danger"
  /** @deprecated alias of `secondary`, kept for pages written against v1. */
  | "outline";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-flat hover:bg-accent-hover active:scale-[0.98] active:shadow-none disabled:bg-accent/50 disabled:shadow-none",
  secondary:
    "border border-hairline bg-surface text-ink shadow-flat hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-50",
  outline:
    "border border-hairline bg-surface text-ink shadow-flat hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-50",
  quiet: "bg-transparent text-accent hover:bg-accent-soft active:scale-[0.98] disabled:opacity-50",
  answer:
    "w-full justify-start border-2 border-hairline bg-surface text-left text-title text-ink hover:border-accent hover:shadow-raised active:scale-[0.99] disabled:opacity-60",
  danger:
    "border border-error/40 bg-transparent text-error hover:bg-error-soft active:scale-[0.98] disabled:opacity-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 rounded-sm px-3 text-body-sm",
  md: "min-h-11 gap-2 rounded-md px-4 text-body-sm",
  lg: "min-h-13 gap-2 rounded-md px-5 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner, sets `aria-busy` and disables the button.
   *  The label stays rendered so the button keeps its width (no shift). */
  loading?: boolean;
  /** Icon rendered before the label (16–20px, `aria-hidden` by the caller). */
  icon?: ReactNode;
  /** Icon rendered after the label. */
  iconEnd?: ReactNode;
  fullWidth?: boolean;
}

/**
 * The one button. `primary` is the single traffic-blue action on a screen
 * (ideally in the bottom 40% of the viewport, thumb reach); `secondary`
 * for the alternative; `quiet` for tertiary text actions; `answer` for a
 * tappable option in a drill (tall, left-aligned, full width, pair it
 * with `animate-correct` / `animate-wrong`); `danger` for destructive
 * confirmations only. `md` is ≥ 44 px tall; `sm` (36 px) is only for
 * dense toolbars where the parent provides the hit area.
 * Not for navigation: wrap a `next/link` in page code and style it, or
 * pass the button inside `<Link>` as today's pages do. Never put two
 * `primary` buttons on one screen, and never animate it at rest.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconEnd,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-(--dur-fast) ease-standard",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
      {iconEnd}
    </button>
  );
}
