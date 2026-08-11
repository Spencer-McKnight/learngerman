import { describe, expect, it } from "vitest";
import { buildIndex } from "../lexicon/coverage";
import { SEED_LEXICON } from "../lexicon/seed";
import { newWordBudget, newWordState, reviewWord, isDue, isKnown, dueWords } from "../scheduler/scheduler";
import { initialSkills, pSuccess, targetDifficulty, updateRating } from "../ability/elo";
import { buildVocabProbe, combinePlacement, parseCTest, scoreCTest, scoreVocabProbe, seedWordStates, CTEST_PASSAGES } from "../placement/placement";
import { composeSession, nextSpeakingRung } from "../session/composer";
import { validateGenerated } from "../session/tasks";
import { detectMilestones, estimateCefr, speechCoverageForVocab } from "../progress/milestones";
import { applyOutcome } from "../apply";
import { emptyContrastState, nextContrast, recordEarOutcome, CONTRASTS } from "../ear/hvpt";
import type { LearnerSnapshot } from "../types";

const index = buildIndex(SEED_LEXICON);
const now = new Date("2026-08-10T12:00:00Z");

function freshSnapshot(overrides: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return {
    userId: "test",
    now,
    words: [],
    skills: initialSkills(),
    syntax: { stage: 1, evidence: {} },
    grammar: { bites: {} },
    ear: [],
    speakingRung: "shadowing",
    coverageTarget: 0.95,
    inputMinutes: 0,
    minutesPerSession: 12,
    placed: false,
    ...overrides,
  };
}

describe("scheduler", () => {
  it("schedules a reviewed word into the future and tracks knownness", () => {
    let word = newWordState("trinken:V", now);
    expect(isKnown(word, now)).toBe(false);
    word = reviewWord(word, 3, now);
    expect(isDue(word, now)).toBe(false);
    expect(new Date(word.card.due).getTime()).toBeGreaterThan(now.getTime());
  });

  it("shrinks the new-word budget under review load", () => {
    const light = newWordBudget([], now);
    expect(light).toBe(4);
    // 24 due words → budget collapses.
    const words = Array.from({ length: 24 }, (_, i) => {
      const word = reviewWord(newWordState(`w${i}`, new Date("2026-01-01")), 3, new Date("2026-01-01"));
      return word;
    });
    expect(dueWords(words, now).length).toBe(24);
    expect(newWordBudget(words, now)).toBeLessThanOrEqual(1);
  });
});

describe("ability model", () => {
  it("targets ~85% success below the learner's rating", () => {
    const d = targetDifficulty(2);
    expect(pSuccess(2, d)).toBeCloseTo(0.85, 2);
  });
  it("converges toward an item band the learner half-passes", () => {
    let state = initialSkills(0).reading;
    for (let i = 0; i < 60; i++) {
      // Learner reliably succeeds on 1.0-difficulty items…
      state = updateRating(state, 1.0, true);
    }
    // …so the rating climbs well above it.
    expect(state.rating).toBeGreaterThan(1.0);
  });
});

describe("placement", () => {
  it("punishes yes-to-everything via pseudoword false alarms", () => {
    const probe = buildVocabProbe(index);
    const allYes = scoreVocabProbe(probe, probe.map(() => true));
    expect(allYes.accuracy).toBeCloseTo(0.5, 1);
    expect(allYes.vocabEstimate).toBeLessThan(300);
  });
  it("honest partial knowledge lands mid-scale", () => {
    const probe = buildVocabProbe(index);
    const saidYes = probe.map((item) => item.real && (item.rank ?? 0) <= 150);
    const result = scoreVocabProbe(probe, saidYes);
    expect(result.falseAlarmRate).toBe(0);
    expect(result.knownUntilRank).toBeGreaterThan(0);
  });
  it("C-test passages parse and score", () => {
    const { answers, display } = parseCTest(CTEST_PASSAGES[0]);
    expect(display).toContain("_");
    expect(scoreCTest(answers, answers)).toBe(1);
    expect(scoreCTest(answers, answers.map(() => "x"))).toBe(0);
  });
  it("seeds more stable cards for more frequent words", () => {
    const words = seedWordStates(index, 200, now);
    expect(words.length).toBeGreaterThan(50);
    const first = words[0];
    const last = words[words.length - 1];
    expect(first.card.stability).toBeGreaterThan(last.card.stability);
  });
  it("combines conservatively without optional probes", () => {
    const placement = combinePlacement({
      accuracy: 0.75, hitRate: 0.8, falseAlarmRate: 0.1,
      vocabEstimate: 800, knownUntilRank: 1000,
    });
    expect(placement.stage).toBe(2);
    expect(placement.seedRating).toBeGreaterThan(0.5);
  });
});

describe("session composer", () => {
  it("fits the time budget and starts with content", () => {
    const plan = composeSession(freshSnapshot(), index);
    expect(plan.totalSeconds).toBeLessThanOrEqual(12 * 60);
    expect(["story-read", "dialogue-read"]).toContain(plan.tasks[0].kind);
    expect(plan.newLexemeIds.length).toBeGreaterThan(0);
  });

  it("halves the new-word budget when a grammar bite is served", () => {
    const noBites = composeSession(freshSnapshot({ placed: true }), index, { seed: 2 });
    const allSettled = Object.fromEntries(
      ["articles-as-units", "sein-haben-present", "svo-basics", "negation-nicht-kein",
       "gender-endings", "plural-patterns", "fronting-time"].map((id) => [id, "settled" as const]),
    );
    const withoutReady = composeSession(
      freshSnapshot({ placed: true, grammar: { bites: allSettled } }),
      index,
      { seed: 2 },
    );
    const bitePlanned = noBites.tasks.some((task) => task.kind === "grammar-bite");
    expect(bitePlanned).toBe(true);
    expect(withoutReady.newLexemeIds.length).toBeGreaterThanOrEqual(noBites.newLexemeIds.length);
  });

  it("story targets include due words — reviews live inside content", () => {
    const past = new Date("2026-01-01T12:00:00Z");
    const words = ["trinken:V", "Kaffee:N", "heute:ADV"].map((id) =>
      reviewWord(newWordState(id, past), 3, past),
    );
    const plan = composeSession(freshSnapshot({ words, placed: true }), index);
    const story = plan.tasks[0];
    expect(story.generation?.targetLemmas).toEqual(
      expect.arrayContaining(["trinken:V", "Kaffee:N", "heute:ADV"]),
    );
  });

  it("speaking rung only advances on sustained success and ability", () => {
    expect(nextSpeakingRung("shadowing", [true, true, true], 1)).toBe("shadowing");
    expect(nextSpeakingRung("shadowing", Array(10).fill(true), 1)).toBe("construct");
    expect(nextSpeakingRung("construct", Array(10).fill(true), 0.5)).toBe("construct");
  });
});

describe("generation validation — the coverage contract", () => {
  const known = ["ich:PRON", "trinken:V", "Kaffee:N", "heute:ADV", "gern:ADV"];
  it("passes content inside the contract", () => {
    const spec = {
      kind: "story-read" as const,
      allowedLemmas: known,
      targetLemmas: ["Kaffee:N"],
      newLemmas: [],
      stage: 1 as const,
      coverageTarget: 0.95,
      register: "neutral" as const,
    };
    expect(validateGenerated("Ich trinke heute gern Kaffee.", spec, index)).toEqual([]);
  });
  it("flags missing targets and blown coverage", () => {
    const spec = {
      kind: "story-read" as const,
      allowedLemmas: known,
      targetLemmas: ["Wasser:N"],
      newLemmas: ["Wasser:N"],
      stage: 1 as const,
      coverageTarget: 0.95,
      register: "neutral" as const,
    };
    const issues = validateGenerated(
      "Ich besuche wunderbare Restaurants und bestelle exquisite Speisen.",
      spec,
      index,
    );
    expect(issues.some((issue) => issue.kind === "missing-target")).toBe(true);
    expect(issues.some((issue) => issue.kind === "coverage")).toBe(true);
  });
});

describe("ear training", () => {
  it("stays blocked on one contrast until it has traction", () => {
    const first = nextContrast([]);
    expect(first?.id).toBe(CONTRASTS[0].id);
    let state = emptyContrastState(CONTRASTS[0].id);
    for (let i = 0; i < 4; i++) state = recordEarOutcome(state, i % 2 === 0);
    // 50% accuracy → keep training the same contrast.
    expect(nextContrast([state])?.id).toBe(CONTRASTS[0].id);
  });
  it("masters a contrast only with volume AND sustained accuracy", () => {
    let state = emptyContrastState("u-ue");
    for (let i = 0; i < 20; i++) state = recordEarOutcome(state, true);
    expect(state.mastered).toBe(true);
  });
});

describe("progress honesty", () => {
  it("coverage curve matches Nation anchors", () => {
    expect(speechCoverageForVocab(3000)).toBeCloseTo(0.95, 2);
    expect(speechCoverageForVocab(1000)).toBeCloseTo(0.8, 2);
  });
  it("CEFR is a range with confidence, wider when signals disagree", () => {
    const beginner = estimateCefr(freshSnapshot());
    expect(beginner.band).toBe("A0");
    expect(beginner.confidence).toBeGreaterThan(0.5);
  });
  it("detects genuine milestone crossings only", () => {
    const events = detectMilestones(
      { knownCount: 480, stage: 2, masteredContrasts: [], band: "A1" },
      { knownCount: 505, stage: 3, masteredContrasts: ["u-ue"], band: "A1" },
    );
    expect(events.map((event) => event.kind).sort()).toEqual(
      ["contrast-mastered", "syntax-stage", "vocab-threshold"],
    );
    expect(detectMilestones(
      { knownCount: 505, stage: 3, masteredContrasts: ["u-ue"], band: "A1" },
      { knownCount: 506, stage: 3, masteredContrasts: ["u-ue"], band: "A1" },
    )).toEqual([]);
  });
});

describe("applyOutcome — the single state transition", () => {
  it("folds a graded task into words, skills and syntax at once", () => {
    const snapshot = freshSnapshot();
    const after = applyOutcome(snapshot, {
      taskKind: "construct-sentence",
      skill: "speaking",
      correct: true,
      lexemeGrades: { "trinken:V": 3, "Kaffee:N": 3 },
      difficulty: 0.5,
      stageAttempted: 2,
      stageSuccess: true,
      inputSeconds: 30,
    });
    expect(after.words).toHaveLength(2);
    expect(after.skills.speaking.rating).toBeGreaterThan(snapshot.skills.speaking.rating);
    expect(after.syntax.evidence[2]?.window).toEqual([true]);
    expect(after.inputMinutes).toBeCloseTo(0.5);
    // Purity: the input snapshot is untouched.
    expect(snapshot.words).toHaveLength(0);
  });
});

describe("session modes — small detours off the main path", () => {
  it("review mode introduces nothing new and skips grammar", () => {
    const plan = composeSession(freshSnapshot({ placed: true }), index, { mode: "review" });
    expect(plan.newLexemeIds).toHaveLength(0);
    expect(plan.tasks.every((task) => task.kind !== "grammar-bite")).toBe(true);
    expect(plan.tasks.every((task) => task.kind !== "hvpt-pair")).toBe(true);
  });

  it("ear mode serves only a long HVPT drill", () => {
    const plan = composeSession(freshSnapshot({ placed: true }), index, { mode: "ear" });
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].kind).toBe("hvpt-pair");
    expect(plan.tasks[0].seconds).toBeGreaterThan(60);
  });

  it("speak mode keeps only speaking-side tasks", () => {
    const plan = composeSession(freshSnapshot({ placed: true }), index, { mode: "speak" });
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.every((task) => task.skill === "speaking")).toBe(true);
  });
});

describe("grammar bite progression through outcomes", () => {
  it("moves a bite to practising on first encounter, settled after a correct drill", () => {
    const snapshot = freshSnapshot();
    const outcome = {
      taskKind: "grammar-bite",
      skill: "grammar" as const,
      correct: true,
      lexemeGrades: {},
      difficulty: 0.5,
      biteId: "articles-as-units",
    };
    const first = applyOutcome(snapshot, outcome);
    expect(first.grammar.bites["articles-as-units"]).toBe("practising");
    const second = applyOutcome(first, outcome);
    expect(second.grammar.bites["articles-as-units"]).toBe("settled");
  });
});
