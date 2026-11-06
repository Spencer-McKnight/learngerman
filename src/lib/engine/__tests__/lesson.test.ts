import { describe, expect, it } from "vitest";
import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";
import type { Station } from "@/lib/curriculum/types";
import type { LearnerSnapshot, WordState } from "../types";
import { initialSkills } from "../ability/elo";
import { buildIndex } from "../lexicon/coverage";
import { SEED_LEXICON } from "../lexicon/seed";
import { composeLesson, duLineIndices, suggestStartStation } from "../session/lesson";

const index = buildIndex(SEED_LEXICON);
const now = new Date("2026-11-06T09:00:00Z");

const station: Station = {
  id: "t-1",
  lineId: "l1",
  order: 1,
  name: "Test",
  title: "Ein Kaffee",
  titleEn: "A coffee",
  canDoEn: "I can order a coffee",
  vocabulary: [
    { id: "Kaffee:N", lemma: "Kaffee", pos: "N", gender: "der", english: "coffee", rank: 400, cefr: "A1", forms: [] },
  ],
  reviewIds: ["gut:ADJ"],
  grammarBiteId: "articles-as-units",
  earContrastId: "u-ue",
  stage: 1,
  scene: {
    title: "Ein Kaffee",
    titleEn: "A coffee",
    settingEn: "At the counter.",
    place: "Café",
    cast: [{ id: "lena", name: "Lena", roleEn: "barista", voice: "ingrid" }],
    lines: [
      { speaker: "narrator", de: "Du bist im Café.", en: "You're in the café." },
      { speaker: "lena", de: "Hallo! Was möchtest du?", en: "Hi! What would you like?" },
      { speaker: "du", de: "Einen Kaffee, bitte.", en: "A coffee, please." },
      { speaker: "lena", de: "Gern. Das ist gut.", en: "Sure. That's good." },
    ],
  },
  checks: [
    { id: "c1", kind: "true-false", promptEn: "You order tea.", promptDe: "Du bestellst Tee.", options: ["Richtig", "Falsch"], answer: 1, explainEn: "You order coffee." },
    { id: "c2", kind: "choice", promptEn: "Who serves you?", promptDe: "Wer bedient dich?", options: ["Lena", "Ben"], answer: 0, explainEn: "Lena." },
  ],
  shadowLineIndices: [1, 2],
  construct: [{ promptEn: "A coffee, please.", targetDe: "Einen Kaffee, bitte.", alternatives: [], stage: 1 }],
  performance: {
    kind: "role-play",
    canDoEn: "I can order a coffee",
    situationEn: "Order.",
    lines: [
      { speaker: "lena", de: "Was möchtest du?", en: "What would you like?" },
      { speaker: "du", de: "Einen Kaffee, bitte.", en: "A coffee, please." },
    ],
    counterpart: "lena",
  },
  coach: { briefEn: "Listen for the article before Kaffee.", listenForEn: ["einen"], debriefEn: "Done." },
  minutes: 10,
};

function word(id: string, opts: { due?: boolean; lapsed?: boolean } = {}): WordState {
  const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));
  let card = createEmptyCard(new Date("2026-10-01T09:00:00Z"));
  card = scheduler.next(card, new Date("2026-10-01T09:00:00Z"), Rating.Good).card;
  card = scheduler.next(card, new Date("2026-10-03T09:00:00Z"), Rating.Good).card;
  if (opts.due) card = { ...card, due: new Date("2026-11-01T09:00:00Z") };
  return { lexemeId: id, card, successDays: [], introducedAt: "2026-10-01" };
}

function snapshot(partial: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return {
    userId: "u",
    now,
    words: [],
    skills: initialSkills(0.5),
    syntax: { stage: 1, evidence: {} },
    grammar: { bites: {} },
    ear: [],
    speakingRung: "shadowing",
    coverageTarget: 0.95,
    inputMinutes: 0,
    minutesPerSession: 12,
    placed: true,
    ...partial,
  };
}

describe("composeLesson", () => {
  it("plays the nine beats in order on a first visit", () => {
    const plan = composeLesson(station, snapshot(), index);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "arrive", "scene", "understand", "words", "grammar", "speak", "ear", "perform", "depart",
    ]);
    expect(plan.newLexemeIds).toEqual(["Kaffee:N"]);
    expect(plan.variation).toBe(false);
    const words = plan.steps.find((s) => s.kind === "words")!;
    expect(words.lexemeIds![0]).toBe("Kaffee:N");
  });

  it("credits due words the scene contains and taps the rest", () => {
    const snap = snapshot({ words: [word("gut:ADJ", { due: true }), word("Haus:N", { due: true }), word("Kaffee:N")] });
    const plan = composeLesson(station, snap, index);
    const scene = plan.steps.find((s) => s.kind === "scene")!;
    expect(scene.creditIds).toContain("gut:ADJ");
    const words = plan.steps.find((s) => s.kind === "words")!;
    expect(words.lexemeIds).toContain("Haus:N");
    expect(plan.newLexemeIds).toEqual([]);
  });

  it("serves a variation on replays and the station bite only when the staircase allows", () => {
    const plan = composeLesson(station, snapshot(), index, { visits: 2 });
    expect(plan.variation).toBe(true);
    const gated: Station = { ...station, grammarBiteId: "weil-dass" };
    const bite = composeLesson(gated, snapshot(), index).steps.find((s) => s.kind === "grammar");
    expect(bite?.biteId).not.toBe("weil-dass");
  });

  it("steps the Sprechen beat down a rung when predicted too hard", () => {
    const hard = snapshot({ speakingRung: "timed-recall", skills: initialSkills(0) });
    const real = composeLesson(station, hard, index);
    const speak = real.steps.find((s) => s.kind === "speak")!;
    expect(speak.speak).toBe("shadow");
    const strong = composeLesson(station, snapshot({ speakingRung: "scripted", skills: initialSkills(2.5) }), index);
    expect(strong.steps.find((s) => s.kind === "speak")!.speak).toBe("scripted");
  });

  it("detours reuse beats and never introduce new words", () => {
    const ear = composeLesson(station, snapshot(), index, { mode: "ear" });
    expect(ear.steps.map((s) => s.kind)).toEqual(["ear", "depart"]);
    expect(ear.steps[0].pairCount).toBe(18);
    const review = composeLesson(station, snapshot({ words: [word("gut:ADJ", { due: true })] }), index, { mode: "review" });
    expect(review.steps.map((s) => s.kind)).toEqual(["scene", "words", "depart"]);
  });

  it("trims optional beats for a short session but never core ones", () => {
    const plan = composeLesson(station, snapshot({ minutesPerSession: 5 }), index);
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds).not.toContain("ear");
    expect(kinds).toContain("perform");
  });

  it("finds the learner's lines and a starting station", () => {
    expect(duLineIndices(station)).toEqual([2]);
    const ids = [
      { id: "l1-a", lineNumber: 1 }, { id: "l2-a", lineNumber: 2 }, { id: "l3-a", lineNumber: 3 },
    ];
    expect(suggestStartStation(ids, { vocabEstimate: 0, stage: 1 })).toBe("l1-a");
    expect(suggestStartStation(ids, { vocabEstimate: 500, stage: 3 })).toBe("l3-a");
    expect(suggestStartStation(ids, { vocabEstimate: 500, stage: 1 })).toBe("l1-a");
  });
});
