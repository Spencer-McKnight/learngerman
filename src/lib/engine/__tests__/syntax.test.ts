import { describe, expect, it } from "vitest";
import { buildIndex } from "../lexicon/coverage";
import { SEED_LEXICON } from "../lexicon/seed";
import { analyzeProduction, isStabilised, recordStageOutcome } from "../syntax/stages";
import type { SyntaxState } from "../types";

const index = buildIndex(SEED_LEXICON);

describe("analyzeProduction — the staircase detectors", () => {
  it("stage 1: canonical SVO", () => {
    const observations = analyzeProduction("Ich trinke Kaffee.", index);
    expect(observations).toContainEqual({ stage: 1, success: true });
  });

  it("stage 2 without stage 4: fronted adverb, no inversion", () => {
    const observations = analyzeProduction("Heute ich trinke Kaffee.", index);
    expect(observations).toContainEqual({ stage: 2, success: true });
    expect(observations).toContainEqual({ stage: 4, success: false });
  });

  it("stage 4: fronted adverb with inversion", () => {
    const observations = analyzeProduction("Heute trinke ich Kaffee.", index);
    expect(observations).toContainEqual({ stage: 4, success: true });
  });

  it("stage 3: separable particle stranded clause-finally", () => {
    const observations = analyzeProduction("Ich stehe um sieben auf.", index);
    expect(observations).toContainEqual({ stage: 3, success: true });
  });

  it("stage 5: verb-final subordinate clause", () => {
    const observations = analyzeProduction("Ich bin müde, weil ich früh aufstehe.", index);
    expect(observations).toContainEqual({ stage: 5, success: true });
  });

  it("stage 5 violated: verb not final after weil", () => {
    const observations = analyzeProduction("Ich bin müde, weil ich trinke viel Kaffee.", index);
    expect(observations).toContainEqual({ stage: 5, success: false });
  });
});

describe("stage stabilisation", () => {
  it("requires repeated success across separate days, in order", () => {
    let state: SyntaxState = { stage: 1, evidence: {} };
    // 10 successes but all on one day → not stabilised.
    const day1 = new Date("2026-08-10T10:00:00Z");
    for (let i = 0; i < 10; i++) state = recordStageOutcome(state, 2, true, day1);
    expect(state.stage).toBe(1);
    // Two more days of success → stabilised.
    state = recordStageOutcome(state, 2, true, new Date("2026-08-11T10:00:00Z"));
    state = recordStageOutcome(state, 2, true, new Date("2026-08-12T10:00:00Z"));
    expect(state.stage).toBe(2);
  });

  it("never skips a stage", () => {
    let state: SyntaxState = { stage: 1, evidence: {} };
    for (let day = 1; day <= 12; day++) {
      state = recordStageOutcome(state, 4, true, new Date(`2026-08-${String(day).padStart(2, "0")}T10:00:00Z`));
    }
    // Stage 4 evidence is banked, but the stage stays 1 until 2 and 3 stabilise.
    expect(state.stage).toBe(1);
    expect(isStabilised(state.evidence[4]!)).toBe(true);
  });
});
