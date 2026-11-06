import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const VARIANTS = {
  quiet: "bg-transparent text-ink-muted hover:bg-accent-soft hover:text-accent",
  secondary: "border border-hairline bg-surface text-ink shadow-flat hover:border-accent hover:text-accent",
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
} as const;

const SIZES = {
  sm: "size-9 rounded-sm [&>svg]:size-4",
  md: "size-11 rounded-md [&>svg]:size-5",
  lg: "size-13 rounded-md [&>svg]:size-6",
} as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The accessible name — required, comes from `useStrings()`. */
  label: string;
  /** A lucide icon or an inline svg; sized by the button. */
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Toggle buttons pass their state; the button then exposes `aria-pressed`. */
  pressed?: boolean;
}

/**
 * A square button whose only content is an icon, with a mandatory text
 * `label` for assistive tech and a 44 px hit area at `md`. Use it for
 * close, play, replay, back-to-top: actions whose icon is universally
 * understood. Do not use it when the action needs words to be clear —
 * use `Button` with an `icon` — and never for the screen's primary action.
 */
export function IconButton({
  label,
  children,
  variant = "quiet",
  size = "md",
  pressed,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-[background-color,color,border-color,transform] duration-(--dur-fast) active:scale-95 disabled:opacity-50",
        SIZES[size],
        VARIANTS[variant],
        pressed && "bg-accent-soft text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
