/**
 * The authoring contract (curriculum/types.ts), enforced. Every station
 * must be comprehensible with what the learner knows on arrival, must
 * actually contain the words it claims to teach, and must point only at
 * grammar bites, contrasts and voices that exist.
 */

import { describe, expect, it } from "vitest";
import { analyzeCoverage, buildIndex, tokenize } from "@/lib/engine";
import { CURRICULUM } from "@/lib/engine/grammar/curriculum";
import { CONTRASTS } from "@/lib/engine/ear/hvpt";
import { VOICES } from "@/lib/audio/voices";
import { COURSE_LEXICON, knownAtStation, LINES, STATIONS, stationStatuses, currentStation } from "@/lib/curriculum";

const index = buildIndex(COURSE_LEXICON);
const COVERAGE_FLOOR = 0.95;

/** Names and places are free: capitalised tokens that are nobody's lexeme. */
function effectiveCoverage(text: string, known: ReadonlySet<string>) {
  const report = analyzeCoverage(text, known, index);
  const surface = text.match(/[A-ZÄÖÜ][a-zäöüß]+/g) ?? [];
  const names = new Set(surface.map((w) => w.toLowerCase()).filter((w) => !index.byForm.has(w)));
  const free = report.outOfLexicon.filter((token) => names.has(token)).length;
  return {
    coverage: (report.knownTokens + free) / Math.max(report.tokens, 1),
    offenders: [...report.unknownInLexicon, ...report.outOfLexicon.filter((t) => !names.has(t))],
  };
}

describe("course shape", () => {
  it("has lines with stations in order and unique ids", () => {
    const ids = new Set<string>();
    for (const line of LINES) {
      expect(line.stations.length).toBeGreaterThan(0);
      line.stations.forEach((station, i) => {
        expect(station.lineId).toBe(line.id);
        expect(station.order).toBe(i + 1);
        expect(ids.has(station.id)).toBe(false);
        ids.add(station.id);
        expect(station.stage).toBeLessThanOrEqual(line.maxStage);
      });
    }
  });

  it("introduces each lexeme once, course-wide, never clashing with the seed shape", () => {
    const seen = new Map<string, string>();
    for (const station of STATIONS) {
      for (const lexeme of station.vocabulary) {
        expect(lexeme.id, `${station.id} vocabulary`).toMatch(/^[^:]+:(N|V|ADJ|ADV|PRON|PREP|CONJ|DET|NUM|PART|INTJ)$/);
        expect(seen.get(lexeme.id), `${lexeme.id} introduced twice (${seen.get(lexeme.id)} and ${station.id})`).toBeUndefined();
        seen.set(lexeme.id, station.id);
        if (lexeme.pos === "N") expect(lexeme.gender, `${lexeme.id} needs a gender`).toBeDefined();
        expect(lexeme.english.length).toBeGreaterThan(0);
      }
    }
  });

  it("unlocks stations in order and finds the current one", () => {
    const statuses = stationStatuses([]);
    expect(statuses.get(STATIONS[0].id)).toBe("unseen");
    expect(statuses.get(STATIONS[1].id)).toBe("locked");
    expect(currentStation([]).id).toBe(STATIONS[0].id);
    const passed = [{ stationId: STATIONS[0].id, status: "passed" as const, bestGrade: 3 as const, visits: 1, lastVisitedAt: null, passedAt: null }];
    expect(stationStatuses(passed).get(STATIONS[1].id)).toBe("unseen");
    expect(currentStation(passed).id).toBe(STATIONS[1].id);
  });
});

describe.each(STATIONS.map((station) => [station.id, station] as const))("station %s", (_id, station) => {
  const known = new Set(knownAtStation(station.id));
  for (const lexeme of station.vocabulary) known.add(lexeme.id);
  const sceneText = station.scene.lines.map((line) => line.de).join(" ");

  it("scene is comprehensible with what the learner knows", () => {
    const { coverage, offenders } = effectiveCoverage(sceneText, known);
    expect(coverage, `offenders: ${offenders.join(", ")}`).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
  });

  it("every introduced lexeme appears in the scene", () => {
    const tokens = new Set(tokenize(sceneText));
    for (const lexeme of station.vocabulary) {
      const forms = [lexeme.lemma, ...(lexeme.plural ? [lexeme.plural] : []), ...lexeme.forms].map((f) => f.toLowerCase());
      expect(forms.some((f) => tokens.has(f)), `${lexeme.id} never appears in the scene`).toBe(true);
    }
  });

  it("speaking material is comprehensible and well-formed", () => {
    for (const item of station.construct) {
      const { coverage, offenders } = effectiveCoverage([item.targetDe, ...item.alternatives].join(" "), known);
      expect(coverage, `construct "${item.targetDe}": ${offenders.join(", ")}`).toBeGreaterThanOrEqual(0.9);
      expect(item.stage).toBeLessThanOrEqual(station.stage);
    }
    expect(station.shadowLineIndices.length).toBeGreaterThanOrEqual(2);
    for (const i of station.shadowLineIndices) expect(station.scene.lines[i]).toBeDefined();
    const perf = station.performance;
    if (perf.kind === "role-play") {
      expect(perf.lines?.some((line) => line.speaker === "du")).toBe(true);
      const { coverage, offenders } = effectiveCoverage(perf.lines!.map((l) => l.de).join(" "), known);
      expect(coverage, `performance: ${offenders.join(", ")}`).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
    } else {
      expect(perf.prompts?.length).toBeGreaterThan(0);
    }
  });

  it("checks are answerable", () => {
    expect(station.checks.length).toBeGreaterThanOrEqual(2);
    for (const check of station.checks) {
      expect(check.options.length).toBeGreaterThanOrEqual(2);
      if (check.kind !== "order") expect(check.answer).toBeLessThan(check.options.length);
      if (check.kind === "true-false") expect(check.options).toEqual(["Richtig", "Falsch"]);
    }
  });

  it("references only things that exist", () => {
    const speakers = new Set(station.scene.cast.map((c) => c.id));
    for (const line of station.scene.lines) {
      expect(speakers.has(line.speaker) || line.speaker === "narrator" || line.speaker === "du", `unknown speaker ${line.speaker}`).toBe(true);
    }
    for (const member of station.scene.cast) expect(member.voice in VOICES, `voice ${member.voice}`).toBe(true);
    if (station.grammarBiteId) expect(CURRICULUM.some((b) => b.id === station.grammarBiteId), station.grammarBiteId).toBe(true);
    if (station.earContrastId) expect(CONTRASTS.some((c) => c.id === station.earContrastId), station.earContrastId).toBe(true);
    expect(station.coach.briefEn.length).toBeGreaterThan(20);
    expect(station.coach.debriefEn.length).toBeGreaterThan(10);
  });
});
