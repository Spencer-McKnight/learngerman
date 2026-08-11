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
