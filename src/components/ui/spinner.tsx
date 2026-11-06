import { cn } from "./cn";

const SIZES = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-[3px]",
} as const;

/**
 * A ring spinner in the current text colour. Pass `label` (from
 * `useStrings()`) when the spinner stands alone and the wait needs
 * announcing; it then becomes a polite status region. Without a label it
 * is decorative (`aria-hidden`), which is right inside a `Button`'s
 * `loading` state where the button already says `aria-busy`.
 * Do not use it for waits under ~300 ms (flicker) or for progress that
 * has a known fraction — use `ProgressBar` for that.
 */
export function Spinner({
  size = "md",
  label,
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  const ring = (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 animate-spin rounded-pill border-current border-t-transparent",
        SIZES[size],
        className,
      )}
    />
  );
  if (!label) return ring;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {ring}
      <span className="sr-only">{label}</span>
    </span>
  );
}
