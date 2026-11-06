/**
 * The humane streak (gamification-strategy.md): one small session keeps
 * it alive, a single missed day is bridged by a free automatic freeze,
 * and coming back after a longer break gets "Willkommen zurück!" —
 * never guilt. Computed purely from activity dates each time; there is
 * no stored counter to defend or lose.
 *
 * Days are UTC calendar days — fine at this scale, revisit if learners
 * ever span far-flung timezones.
 */

export interface Streak {
  /** Consecutive active days (freezes bridge, they don't count). */
  length: number;
  activeToday: boolean;
  /** Yesterday was missed but bridged by the free freeze. */
  frozeYesterday: boolean;
  /** Back after a real break — greet warmly, start fresh. */
  returning: boolean;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDay(date);
}

/** @param activeDays ISO days (yyyy-mm-dd) with at least one completed task. */
export function computeStreak(activeDays: string[], now = new Date()): Streak {
  const days = new Set(activeDays);
  const today = isoDay(now);
  const activeToday = days.has(today);
  let cursor = activeToday ? today : shiftDay(today, -1);
  let length = 0;
  let frozeYesterday = false;
  while (true) {
    if (days.has(cursor)) {
      length++;
      cursor = shiftDay(cursor, -1);
    } else if (days.has(shiftDay(cursor, -1))) {
      // A single missed day between active days: the free auto-freeze.
      if (cursor === shiftDay(today, -1)) frozeYesterday = true;
      cursor = shiftDay(cursor, -1);
    } else {
      break;
    }
  }
  return {
    length,
    activeToday,
    frozeYesterday,
    returning: length === 0 && days.size > 0,
  };
}

export type DayState = "active" | "frozen" | "missed" | "today";

export interface DayDot {
  /** ISO day (yyyy-mm-dd). */
  day: string;
  state: DayState;
}

/**
 * The last `count` calendar days ending today, each with an honest
 * state for the streak row: `active` (a session was completed),
 * `frozen` (a single missed day bridged by the free freeze — the day
 * before and the day after were active), `missed`, or `today` when
 * today has no session yet (today with a session is `active`).
 */
export function recentDays(activeDays: string[], now = new Date(), count = 7): DayDot[] {
  const days = new Set(activeDays);
  const today = isoDay(now);
  const dots: DayDot[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const day = shiftDay(today, -offset);
    const active = days.has(day);
    const next = shiftDay(day, 1);
    let state: DayState;
    if (active) state = "active";
    else if (day === today) state = "today";
    else if (days.has(shiftDay(day, -1)) && (days.has(next) || next === today)) state = "frozen";
    else state = "missed";
    dots.push({ day, state });
  }
  return dots;
}
