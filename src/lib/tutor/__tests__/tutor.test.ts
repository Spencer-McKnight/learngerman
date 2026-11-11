/**
 * The tutor's pure core: signals from synthetic evidence, deterministic
 * key performances, hand-composed fallbacks, the variation contract and
 * cache-shaped prompts. The station is a hand-made fixture — the real
 * lines may be mid-edit and are not this module's contract.
 */

import { describe, expect, it } from "vitest";
import { buildIndex, newWordState, SEED_LEXICON, type Lexeme } from "@/lib/engine";
import type { LearnerSnapshot } from "@/lib/engine/types";
import type { Station } from "@/lib/curriculum/types";
import { keyPerformances, learnerSignals, signalsSignature, type ReviewEventRow } from "../signals";
import { fallbackBrief, fallbackDebrief, buildBriefPrompt, validateBrief, validateDebrief } from "../coach";
import { buildVariationPrompt, validateVariation, variationCacheKey } from "../scene";
import { buildConversePrompt, resolveCounterpart } from "../converse";
import { JULE } from "../persona";

const BREZN: Lexeme = { id: "Brezn:N", lemma: "Brezn", pos: "N", gender: "die", plural: "Brezn", english: "pretzel", rank: 9000, cefr: "A1", forms: [] };
const index = buildIndex([...SEED_LEXICON, BREZN]);

const KNOWN = [
  "ich:PRON", "sein:V", "du:PRON", "der:DET", "nicht:ADV", "es:PRON", "und:CONJ",
  "ein:DET", "in:PREP", "haben:V", "was:PRON", "gut:ADJ", "trinken:V", "Kaffee:N",
  "heute:ADV", "gern:ADV", "hallo:INTJ", "bitte:INTJ", "danke:INTJ", "morgen:ADV",
  "gehen:V", "kommen:V", "hier:ADV", "sehr:ADV", "auch:ADV", "ja:INTJ", "zwei:NUM",
];
const allowed = new Set(KNOWN);

const station: Station = {
  id: "t1-baeckerei",
  lineId: "t1",
  order: 1,
  name: "Bäckerei",
  title: "Eine Brezn, bitte",
  titleEn: "A pretzel, please",
  canDoEn: "Order a pretzel and a coffee at the bakery.",
  vocabulary: [BREZN],
  stage: 2,
  earContrastId: "u-ue",
  grammarBiteId: "articles-as-units",
  scene: {
    title: "Eine Brezn, bitte",
    titleEn: "A pretzel, please",
    settingEn: "Monday morning at the bakery on the corner.",
    place: "Bäckerei Yilmaz, Altstadt",
    cast: [{ id: "yilmaz", name: "Herr Yilmaz", roleEn: "the baker", voice: "conrad" }],
    lines: [
      { speaker: "narrator", de: "Es ist Morgen.", en: "It's morning." },
      { speaker: "narrator", de: "Du bist hier.", en: "You're here." },
      { speaker: "yilmaz", de: "Hallo! Was trinkst du?", en: "Hello! What are you drinking?" },
      { speaker: "du", de: "Ich trinke gern Kaffee.", en: "I like drinking coffee." },
      { speaker: "yilmaz", de: "Und eine Brezn?", en: "And a pretzel?" },
      { speaker: "du", de: "Ja, bitte. Eine Brezn.", en: "Yes, please. One pretzel." },
      { speaker: "yilmaz", de: "Sehr gut. Hier, bitte.", en: "Very good. Here you go." },
      { speaker: "du", de: "Danke.", en: "Thanks." },
      { speaker: "narrator", de: "Der Kaffee ist gut.", en: "The coffee is good." },
      { speaker: "yilmaz", de: "Kommst du morgen auch?", en: "Are you coming tomorrow too?" },
      { speaker: "du", de: "Ja, morgen.", en: "Yes, tomorrow." },
    ],
  },
  checks: [],
  shadowLineIndices: [3, 5],
  construct: [
    { promptEn: "I'd like a coffee.", targetDe: "Ich trinke gern Kaffee.", alternatives: [], stage: 1 },
    { promptEn: "Today I'm coming too.", targetDe: "Heute komme ich auch.", alternatives: [], stage: 2 },
  ],
  performance: {
    kind: "role-play",
    canDoEn: "Order a pretzel and a coffee at the bakery.",
    situationEn: "You're at the counter. Order a Brezn and a coffee.",
    lines: [
      { speaker: "yilmaz", de: "Hallo! Was trinkst du?", en: "Hello! What are you drinking?" },
      { speaker: "du", de: "Kaffee, bitte. Und eine Brezn.", en: "Coffee, please. And a pretzel." },
    ],
    counterpart: "yilmaz",
  },
  coach: {
    briefEn: "Today you order at Herr Yilmaz's counter. Listen for how he asks what you want.",
    listenForEn: ["'Was trinkst du?' — the question you will answer", "'Hier, bitte.' — handing over"],
    debriefEn: "You ordered a Brezn. That is the station done.",
  },
  minutes: 8,
};

const NOW = new Date("2026-11-06T09:00:00Z");

function snapshot(overrides: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return {
    userId: "u1",
    now: NOW,
    words: [newWordState("Kaffee:N", NOW)],
    skills: {} as LearnerSnapshot["skills"],
    syntax: { stage: 1, evidence: {} },
    grammar: { bites: {} },
    ear: [],
    speakingRung: "construct",
    coverageTarget: 0.95,
    inputMinutes: 0,
    minutesPerSession: 12,
    placed: true,
    ...overrides,
  };
}

function event(overrides: Partial<ReviewEventRow> & { daysAgo?: number } = {}): ReviewEventRow {
  const { daysAgo = 1, ...rest } = overrides;
  return {
    task_kind: "retrieval-tap",
    skill: "reading",
    correct: true,
    difficulty: 0,
    lexeme_grades: {},
    payload: {},
    created_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    ...rest,
  };
}

const richEvents: ReviewEventRow[] = [
  event({ lexeme_grades: { "Brezn:N": 1 }, correct: false }),
  event({ lexeme_grades: { "Brezn:N": 1 }, correct: false, daysAgo: 2 }),
  event({ lexeme_grades: { "Kaffee:N": 3 } }),
  event({ lexeme_grades: { "morgen:ADV": 3 }, daysAgo: 3 }),
  event({ lexeme_grades: { "gern:ADV": 4 }, daysAgo: 3 }),
  event({ lexeme_grades: { "hier:ADV": 3 }, daysAgo: 4 }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: false, payload: { stageAttempted: 2, stageSuccess: false } }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: false, payload: { stageAttempted: 2, stageSuccess: false } }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: true, payload: { stageAttempted: 2, stageSuccess: true } }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: true, payload: { stageAttempted: 1, stageSuccess: true } }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: true, payload: { stageAttempted: 1, stageSuccess: true } }),
  event({ task_kind: "construct-sentence", skill: "speaking", correct: true, payload: { stageAttempted: 1, stageSuccess: true } }),
];

describe("learnerSignals", () => {
  it("names lapsing words, the weak stage, the weak contrast and the bite", () => {
    const signals = learnerSignals(
      snapshot({
        ear: [{ contrastId: "u-ue", seen: 5, correct: 2, window: [], mastered: false }],
        grammar: { bites: { "articles-as-units": "practising" } },
      }),
      richEvents,
      index,
    );
    expect(signals.lapsingWords[0]).toEqual({ id: "Brezn:N", lemma: "Brezn", english: "pretzel", lapses: 2 });
    expect(signals.weakStage).toMatchObject({ stage: 2, attempts: 3 });
    expect(signals.weakStage?.successRate).toBeCloseTo(1 / 3);
    expect(signals.weakContrast).toEqual({ id: "u-ue", label: "u vs ü", accuracy: 0.4 });
    expect(signals.biteInProgress).toEqual({ id: "articles-as-units", title: "Words come with their article" });
    expect(signals.rung).toBe("construct");
    expect(signals.sessionsThisWeek).toBe(4);
  });

  it("only claims strengths the week's numbers support", () => {
    const taps = Array.from({ length: 6 }, (_, i) => event({ correct: i !== 0 }));
    const signals = learnerSignals(snapshot(), taps, index);
    expect(signals.strengths).toEqual(["retrieval taps are solid: 5/6 this week"]);
    expect(learnerSignals(snapshot(), taps.slice(0, 3), index).strengths).toEqual([]);
  });

  it("is quiet for a fresh learner", () => {
    const signals = learnerSignals(snapshot(), [], index);
    expect(signals).toMatchObject({ lapsingWords: [], weakStage: null, weakContrast: null, biteInProgress: null, strengths: [], sessionsThisWeek: 0 });
  });

  it("has a stable, compact signature", () => {
    const a = learnerSignals(snapshot(), richEvents, index);
    const b = learnerSignals(snapshot(), [...richEvents].reverse(), index);
    expect(signalsSignature(a)).toBe(signalsSignature(b));
    expect(signalsSignature(a)).toContain("Brezn:N");
    expect(signalsSignature(a).length).toBeLessThan(200);
  });
});

describe("keyPerformances", () => {
  it("points at the scene line that carries the lapsing word", () => {
    const signals = learnerSignals(snapshot(), richEvents, index);
    const kps = keyPerformances(station, signals, index);
    expect(kps.length).toBeLessThanOrEqual(2);
    expect(kps[0]).toMatchObject({ kind: "word", focusDe: "die Brezn", lineIndex: 4 });
    expect(kps[0].whyEn).toContain("Herr Yilmaz's second line");
    expect(kps[1]).toMatchObject({ kind: "stage", focusDe: "Heute komme ich auch." });
    expect(kps[1].whyEn).toContain("second construct");
    expect(keyPerformances(station, signals, index)).toEqual(kps);
  });

  it("falls back to the performance for a fresh learner", () => {
    const kps = keyPerformances(station, learnerSignals(snapshot(), [], index), index);
    expect(kps).toHaveLength(1);
    expect(kps[0]).toMatchObject({ kind: "performance", focusDe: "Kaffee, bitte. Und eine Brezn." });
  });

  it("uses the pinned contrast and the bite when they belong to this station", () => {
    const signals = learnerSignals(
      snapshot({ ear: [{ contrastId: "u-ue", seen: 5, correct: 2, window: [], mastered: false }], grammar: { bites: { "articles-as-units": "seen" } } }),
      [],
      index,
    );
    const kinds = keyPerformances(station, signals, index).map((kp) => kp.kind);
    expect(kinds).toEqual(["ear", "bite"]);
  });
});

describe("coach fallbacks and contract", () => {
  it("fallbackBrief composes the hand-written briefing with the key performances", () => {
    const kps = keyPerformances(station, learnerSignals(snapshot(), richEvents, index), index);
    const brief = fallbackBrief(station, kps);
    expect(brief.briefEn.startsWith(station.coach.briefEn)).toBe(true);
    expect(brief.briefEn).toContain("Two things for you today. Watch for 'die Brezn' in Herr Yilmaz's second line");
    expect(brief.listenForEn).toEqual(station.coach.listenForEn);
    expect(brief.keyPerformances).toEqual(kps.map(({ focusDe, whyEn }) => ({ focusDe, whyEn })));
    expect(validateBrief(brief, kps)).toEqual([]);
  });

  it("fallbackDebrief is honest about misses and skips", () => {
    const good = fallbackDebrief(station, { steps: [{ stepKind: "understand", correct: true }, { stepKind: "words", correct: true }], performanceGrade: 4 });
    expect(good.mood).toBe("proud");
    expect(good.debriefEn).toContain("2 of 2 steps landed");

    const shaky = fallbackDebrief(station, {
      steps: [{ stepKind: "understand", correct: true }, { stepKind: "words", correct: false, detail: "missed 'Brezn'" }],
      performanceGrade: 2,
      transcript: [{ saidDe: "Kaffee bitte", expectedDe: "Kaffee, bitte. Und eine Brezn." }],
    });
    expect(shaky.mood).toBe("warm");
    expect(shaky.debriefEn).toContain('you said "Kaffee bitte"');
    expect(shaky.nextTimeEn).toContain("Kaffee, bitte. Und eine Brezn.");

    const skipped = fallbackDebrief(station, { steps: [{ stepKind: "words", correct: false }], performanceGrade: null });
    expect(skipped.mood).toBe("matter-of-fact");
    expect(skipped.debriefEn).toContain("skipped the Leistung");
    expect(validateDebrief(skipped)).toEqual([]);
  });

  it("rejects a brief that invents a focus or says fluent", () => {
    const kps = keyPerformances(station, learnerSignals(snapshot(), richEvents, index), index);
    const issues = validateBrief(
      { briefEn: "You are nearly fluent!!", listenForEn: ["x", "y"], keyPerformances: [{ focusDe: "der Zug", whyEn: "made up" }] },
      kps,
    );
    expect(issues.map((i) => i.detail)).toEqual([
      'Never use the word "fluent".',
      "No runs of exclamation marks.",
      'keyPerformances.focusDe "der Zug" was not one of the offered focuses.',
    ]);
  });

  it("puts the station block first and the learner data after (cache-shaped)", () => {
    const signals = learnerSignals(snapshot(), richEvents, index);
    const { system, prompt } = buildBriefPrompt(station, signals, keyPerformances(station, signals, index), "en");
    expect(system).toBe(JULE.systemPrompt);
    expect(prompt.startsWith(`Station: ${station.name}`)).toBe(true);
    expect(prompt.indexOf("Learner data")).toBeGreaterThan(prompt.indexOf("Hand-written debrief"));
    expect(buildBriefPrompt(station, signals, [], "de").prompt).toContain("A2-level German");
  });
});

const goodVariation = [
  { speaker: "narrator", de: "Es ist morgen.", en: "" },
  { speaker: "yilmaz", de: "Hallo! Du bist hier.", en: "" },
  { speaker: "du", de: "Hallo. Ich trinke heute Kaffee.", en: "" },
  { speaker: "yilmaz", de: "Gut. Und eine Brezn?", en: "" },
  { speaker: "du", de: "Zwei Brezn, bitte.", en: "" },
  { speaker: "yilmaz", de: "Zwei? Sehr gut.", en: "" },
  { speaker: "narrator", de: "Du hast zwei Brezn.", en: "" },
  { speaker: "du", de: "Danke. Es ist sehr gut hier.", en: "" },
  { speaker: "yilmaz", de: "Ja. Kommst du morgen auch?", en: "" },
  { speaker: "du", de: "Ja, gern.", en: "" },
];

describe("scene variations", () => {
  it("accepts a variation inside the contract", () => {
    expect(validateVariation(goodVariation, station, allowed, index)).toEqual([]);
  });

  it("rejects an out-of-vocabulary line", () => {
    const lines = goodVariation.map((line, i) =>
      i === 2
        ? { ...line, de: "Ich hätte gerne einen Cappuccino mit Hafermilch, ein Croissant mit Marmelade und außerdem noch eine Zeitung, bitte." }
        : line,
    );
    const issues = validateVariation(lines, station, allowed, index);
    expect(issues.some((i) => i.kind === "coverage")).toBe(true);
    expect(issues.find((i) => i.kind === "coverage")?.detail).toContain("cappuccino");
  });

  it("rejects a variation that drops the station's vocabulary, on both floors", () => {
    const lines = goodVariation.map((line) => ({ ...line, de: line.de.replace(/Brezn/g, "Kaffee") }));
    expect(validateVariation(lines, station, allowed, index).map((i) => i.kind)).toContain("missing-vocabulary");
    expect(validateVariation(lines, station, allowed, index, { strict: false }).map((i) => i.kind)).toContain("missing-vocabulary");
  });

  it("rejects unknown speakers, too few lines and a copied script", () => {
    const stranger = validateVariation([...goodVariation.slice(0, 9), { speaker: "anna", de: "Ja.", en: "" }], station, allowed, index);
    expect(stranger.some((i) => i.detail.startsWith("Unknown speakers: anna"))).toBe(true);
    expect(validateVariation(goodVariation.slice(0, 5), station, allowed, index).some((i) => i.kind === "structure")).toBe(true);
    const copied = validateVariation(station.scene.lines, station, allowed, index);
    expect(copied.some((i) => i.detail.includes("copied from the scripted scene"))).toBe(true);
    expect(validateVariation(station.scene.lines, station, allowed, index, { strict: false })).toEqual([]);
  });

  it("builds a cache-shaped prompt: sorted allowed list first, seed last", () => {
    const { prompt } = buildVariationPrompt(station, allowed, index, "visit-2");
    expect(prompt.startsWith("Allowed words: ")).toBe(true);
    const list = prompt.split("\n")[0].replace("Allowed words: ", "").split(", ");
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, "de")));
    expect(prompt.trimEnd().endsWith("Variation seed: visit-2")).toBe(true);
    expect(prompt).toContain("die Brezn (pretzel)");
    expect(prompt).toContain("Sentence structures:");
  });

  it("keys the cache by station, vocabulary set and seed, order-free", () => {
    const a = variationCacheKey("m", station.id, new Set(["a", "b"]), "1");
    expect(variationCacheKey("m", station.id, new Set(["b", "a"]), "1")).toBe(a);
    expect(variationCacheKey("m", station.id, new Set(["a", "b"]), "2")).not.toBe(a);
    expect(variationCacheKey("m", station.id, new Set(["a"]), "1")).not.toBe(a);
  });
});

describe("converse", () => {
  it("plays the requested cast member, else Jule", () => {
    expect(resolveCounterpart(station, "yilmaz").name).toBe("Herr Yilmaz");
    expect(resolveCounterpart(station, "nobody").id).toBe("jule");
    expect(resolveCounterpart(station, undefined).name).toBe(JULE.name);
  });

  it("leads with the sorted allowed list and sends only the last 12 turns", () => {
    const history = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? "learner" : "tutor", text: `turn ${i}` } as const));
    const { prompt } = buildConversePrompt(station, allowed, index, 1, "yilmaz", history);
    expect(prompt.startsWith("Allowed words: ")).toBe(true);
    expect(prompt).not.toContain("turn 2\n");
    expect(prompt).toContain("turn 14");
    expect(prompt).toContain("You are Herr Yilmaz (the baker)");
    expect(prompt).toContain("Sentence structures:");
  });
});
