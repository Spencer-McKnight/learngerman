/**
 * The course registry: every line in order, plus the pure helpers the
 * engine, the tutor and the UI share. Lines live in ./lines/*.ts and are
 * hand-authored data — see types.ts for the authoring contract.
 */

import type { Lexeme } from "../engine/lexicon/types";
import { SEED_LEXICON } from "../engine/lexicon/seed";
import type { Line, Station, StationProgress, StationStatus } from "./types";
import { LINIE_1 } from "./lines/linie-1";
import { LINIE_2 } from "./lines/linie-2";
import { LINIE_3 } from "./lines/linie-3";
import { LINIE_4 } from "./lines/linie-4";
import { LINIE_5 } from "./lines/linie-5";

export * from "./types";

export const LINES: Line[] = [LINIE_1, LINIE_2, LINIE_3, LINIE_4, LINIE_5];

/** Every station in course order. */
export const STATIONS: Station[] = LINES.flatMap((line) => line.stations);

const stationIndex = new Map(STATIONS.map((station, i) => [station.id, i]));

export function stationById(id: string): Station | undefined {
  const i = stationIndex.get(id);
  return i === undefined ? undefined : STATIONS[i];
}

export function lineById(id: string): Line | undefined {
  return LINES.find((line) => line.id === id);
}

export function lineOf(station: Station): Line {
  return LINES.find((line) => line.id === station.lineId) ?? LINES[0];
}

/** The station after this one in course order (crosses lines), or null. */
export function nextStation(id: string): Station | null {
  const i = stationIndex.get(id);
  if (i === undefined) return null;
  return STATIONS[i + 1] ?? null;
}

/** Lexemes introduced by every station up to and including `id` (course order). */
export function lexemesIntroducedThrough(id: string): Lexeme[] {
  const end = stationIndex.get(id);
  if (end === undefined) return [];
  return STATIONS.slice(0, end + 1).flatMap((station) => station.vocabulary);
}

/**
 * The full lexicon: the frequency seed plus everything the course
 * introduces, deduplicated by id (the seed wins on conflicts so ranks
 * and forms stay canonical).
 */
export const COURSE_LEXICON: Lexeme[] = (() => {
  const seen = new Set(SEED_LEXICON.map((lexeme) => lexeme.id));
  const extra: Lexeme[] = [];
  for (const station of STATIONS) {
    for (const lexeme of station.vocabulary) {
      if (seen.has(lexeme.id)) continue;
      seen.add(lexeme.id);
      extra.push(lexeme);
    }
  }
  return [...SEED_LEXICON, ...extra];
})();

/** Lexeme ids the learner is expected to know on arriving at a station. */
export function knownAtStation(id: string): Set<string> {
  const i = stationIndex.get(id) ?? 0;
  const ids = new Set(SEED_LEXICON.map((lexeme) => lexeme.id));
  for (const station of STATIONS.slice(0, i)) {
    for (const lexeme of station.vocabulary) ids.add(lexeme.id);
  }
  return ids;
}

/**
 * Status of every station given the learner's progress rows. Stations
 * unlock in order within a line; a line unlocks when the previous line
 * is fully passed. Replaying a passed station is always allowed.
 */
export function stationStatuses(
  progress: StationProgress[],
): Map<string, StationStatus> {
  const byId = new Map(progress.map((row) => [row.stationId, row]));
  const statuses = new Map<string, StationStatus>();
  let previousLinePassed = true;
  for (const line of LINES) {
    let previousPassed = previousLinePassed;
    let allPassed = true;
    for (const station of line.stations) {
      const row = byId.get(station.id);
      const status: StationStatus = row
        ? row.status
        : previousPassed
          ? "unseen"
          : "locked";
      statuses.set(station.id, status);
      const passed = row?.status === "passed";
      previousPassed = passed;
      if (!passed) allPassed = false;
    }
    previousLinePassed = allPassed;
  }
  return statuses;
}

/** The station the learner should play next: first unlocked, unpassed one. */
export function currentStation(progress: StationProgress[]): Station {
  const statuses = stationStatuses(progress);
  for (const station of STATIONS) {
    const status = statuses.get(station.id);
    if (status === "unseen" || status === "started") return station;
  }
  return STATIONS[STATIONS.length - 1];
}

/** Share of a line's stations passed, 0–1. */
export function lineCompletion(line: Line, progress: StationProgress[]): number {
  const passed = new Set(progress.filter((row) => row.status === "passed").map((row) => row.stationId));
  if (line.stations.length === 0) return 0;
  return line.stations.filter((station) => passed.has(station.id)).length / line.stations.length;
}
