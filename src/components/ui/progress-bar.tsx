import { cn } from "./cn";

const TONES = {
  accent: "bg-accent",
  success: "bg-success",
  milestone: "bg-milestone",
} as const;

interface CommonProps {
  /** Accessible name, e.g. "Schritt 3 von 9" — from `useStrings()`. */
  label?: string;
  tone?: keyof typeof TONES;
  className?: string;
}

export type ProgressBarProps = CommonProps &
  (
    | {
        /** Continuous: fraction of `max` (default 1). */
        value: number;
        max?: number;
        segments?: undefined;
        current?: undefined;
      }
    | {
        /** Segmented: `segments` beats, `current` is the 0-based index in play.
         *  Beats before `current` are filled, `current` is highlighted. */
        segments: number;
        current: number;
        value?: undefined;
        max?: undefined;
      }
  );

/**
 * Honest progress. The continuous bar shows a fraction that means
 * something (toward the next vocabulary sign, mastery of a contrast).
 * The `segments` form shows a lesson's beats: n segments with the current
 * one highlighted, so the learner always sees how much is left. Both are
 * `role="progressbar"` with values. Never animate it for decoration, never
 * show fake fill for time spent, and never use it as a loading spinner.
 */
export function ProgressBar(props: ProgressBarProps) {
  const { label, tone = "accent", className } = props;
  if (props.segments !== undefined) {
    const { segments, current } = props;
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={segments}
        aria-valuenow={Math.min(segments, current + 1)}
        className={cn("flex h-2 w-full gap-1", className)}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-full flex-1 rounded-pill transition-[background-color,opacity] duration-(--dur-slow)",
              i < current ? TONES[tone] : i === current ? cn(TONES[tone], "opacity-60") : "bg-hairline",
            )}
          />
        ))}
      </div>
    );
  }
  const max = props.max ?? 1;
  const fraction = max > 0 ? Math.max(0, Math.min(1, props.value / max)) : 0;
  const pct = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-hairline", className)}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-(--dur-slow) ease-standard", TONES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
