"use client";

import { Check, Snowflake } from "lucide-react";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { cn } from "@/components/ui";
import type { DayDot, DayState } from "@/lib/streak";

export interface StreakProps {
  /** The last seven days, oldest first (from `recentDays`). */
  days: DayDot[];
  /** Consecutive active days (from `computeStreak`). */
  length: number;
  activeToday: boolean;
  frozeYesterday: boolean;
  className?: string;
}

const LOCALES = { de: "de-DE", en: "en-GB" } as const;

/**
 * The humane streak as a short stretch of tram line: seven stops for
 * the last seven days. A stop is filled when a session was completed,
 * carries a small snowflake when the free freeze bridged a single
 * missed day, is an empty outline when nothing happened, and today
 * without a session is an open accent ring. Under it the honest line:
 * "4 Tage" — never a demand, never a loss. Nothing here is yellow and
 * nothing animates at rest.
 */
export function Streak({ days, length, activeToday, frozeYesterday, className }: StreakProps) {
  const t = useStrings();
  const lang = useUiLang();
  const weekday = new Intl.DateTimeFormat(LOCALES[lang], { weekday: "short", timeZone: "UTC" });
  const note = activeToday ? t.home.streakToday : frozeYesterday ? t.home.streakFroze : null;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <ol aria-label={t.home.streakWeek} className="relative flex items-center gap-2">
        <span aria-hidden className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-hairline" />
        {days.map((dot) => {
          const label = weekday.format(new Date(`${dot.day}T12:00:00Z`));
          return (
            <li key={dot.day} className="relative flex flex-col items-center gap-1">
              <Stop state={dot.state} />
              <span aria-hidden className="text-[10px] font-medium leading-none text-ink-muted">
                {label}
              </span>
              <span className="sr-only">
                {label}: {STATE_LABEL[dot.state](t)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-title font-semibold tabular text-ink">
          {t.home.streakDays(length)}
        </span>
        {note && <span className="truncate text-caption text-ink-muted">{note}</span>}
      </p>
    </div>
  );
}

const STATE_LABEL: Record<DayState, (t: ReturnType<typeof useStrings>) => string> = {
  active: (t) => t.home.dayActive,
  frozen: (t) => t.home.dayFrozen,
  missed: (t) => t.home.dayMissed,
  today: (t) => t.home.dayToday,
};

function Stop({ state }: { state: DayState }) {
  const base = "relative flex size-5 items-center justify-center rounded-pill border-2";
  switch (state) {
    case "active":
      return (
        <span aria-hidden className={cn(base, "border-accent bg-accent text-accent-ink")}>
          <Check className="size-3" strokeWidth={3} />
        </span>
      );
    case "frozen":
      return (
        <span aria-hidden className={cn(base, "border-accent bg-surface text-accent")}>
          <Snowflake className="size-3" strokeWidth={2.5} />
        </span>
      );
    case "today":
      return (
        <span aria-hidden className={cn(base, "border-accent bg-surface")}>
          <span className="size-1.5 rounded-pill bg-accent" />
        </span>
      );
    default:
      return <span aria-hidden className={cn(base, "border-hairline bg-surface")} />;
  }
}
