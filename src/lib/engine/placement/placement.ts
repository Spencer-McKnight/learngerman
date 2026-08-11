/**
 * Placement (milestones-in-progression.md): never ask "what's your
 * level?". A three-minute yes/no vocabulary probe (LexTALE-style),
 * an optional C-test refinement, and syntax probes give an honest
 * starting state — then continuous re-estimation takes over forever.
 */

import { createEmptyCard, State } from "ts-fsrs";
import type { LexiconIndex } from "../lexicon/coverage";
import type { SyntaxStage, WordState } from "../types";

/** German-plausible pseudowords (violate no phonotactics, exist not). */
export const PSEUDOWORDS = [
  "Plauke", "Tranig", "Vollmen", "Gerstel", "Klabern", "Schnurfe",
  "Bratzen", "Melkung", "Fensich", "Trauke",
  "Splirren", "Nachteln", "Grolde", "Wispeln",
  "Zumpfen", "Kellig", "Brasten", "Flirne", "Stauneln", "Prillig",
];

export interface VocabProbeItem {
  word: string;
  real: boolean;
  /** Frequency rank if real (drives the estimate). */
  rank?: number;
}

/**
 * Build a probe: real words sampled evenly across the lexicon's rank
 * range plus pseudowords, deterministically shuffled by seed.
 */
export function buildVocabProbe(
  index: LexiconIndex,
  opts: { realCount?: number; pseudoCount?: number; seed?: number } = {},
): VocabProbeItem[] {
  const realCount = opts.realCount ?? 30;
  const pseudoCount = opts.pseudoCount ?? 15;
  const seed = opts.seed ?? 7;
  const pool = index.ordered;
  const items: VocabProbeItem[] = [];
  const step = Math.max(1, Math.floor(pool.length / realCount));
  for (let i = 0; i < realCount && i * step < pool.length; i++) {
    const lexeme = pool[i * step];
    items.push({ word: lexeme.lemma, real: true, rank: lexeme.rank });
  }
  for (let i = 0; i < pseudoCount; i++) {
    items.push({ word: PSEUDOWORDS[(seed + i) % PSEUDOWORDS.length], real: false });
  }
  // Deterministic shuffle.
  for (let i = items.length - 1; i > 0; i--) {
    const j = (seed * 31 + i * 17) % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export interface VocabProbeResult {
  /** LexTALE-style guessing-corrected accuracy, 0–1. */
  accuracy: number;
  hitRate: number;
  falseAlarmRate: number;
  /** Estimated known-lemma count in the frequency dictionary. */
  vocabEstimate: number;
  /** Deepest rank at which ≥ 2/3 of claimed real words were known. */
  knownUntilRank: number;
}

/** Rank-band granularity for the known-until estimate. */
const BAND_WIDTH = 100;

export function scoreVocabProbe(
  items: VocabProbeItem[],
  saidYes: boolean[],
): VocabProbeResult {
  let hits = 0;
  let realTotal = 0;
  let falseAlarms = 0;
  let pseudoTotal = 0;
  const bandHits = new Map<number, { yes: number; total: number }>();
  items.forEach((item, i) => {
    if (item.real) {
      realTotal++;
      if (saidYes[i]) hits++;
      const band = Math.floor((item.rank ?? 0) / BAND_WIDTH) * BAND_WIDTH;
      const entry = bandHits.get(band) ?? { yes: 0, total: 0 };
      entry.total++;
      if (saidYes[i]) entry.yes++;
      bandHits.set(band, entry);
    } else {
      pseudoTotal++;
      if (saidYes[i]) falseAlarms++;
    }
  });
  const hitRate = realTotal ? hits / realTotal : 0;
  const falseAlarmRate = pseudoTotal ? falseAlarms / pseudoTotal : 0;
  // LexTALE scoring: average of correct-yes and correct-no rates —
  // punishes yes-to-everything without punishing honest reaching.
  const accuracy = (hitRate + (1 - falseAlarmRate)) / 2;
  // Deepest frequency band still ≥ 2/3 claimed known.
  let knownUntilRank = 0;
  const bands = [...bandHits.entries()].sort((a, b) => a[0] - b[0]);
  for (const [band, { yes, total }] of bands) {
    if (total > 0 && yes / total >= 2 / 3) knownUntilRank = band + BAND_WIDTH;
    else break;
  }
  // Discount the band estimate by the false-alarm rate (overclaimers
  // get pulled back toward what the pseudowords revealed).
  const vocabEstimate = Math.round(knownUntilRank * (1 - falseAlarmRate) * accuracy * 2) / 2;
  return {
    accuracy,
    hitRate,
    falseAlarmRate,
    vocabEstimate: Math.round(Math.max(0, Math.min(vocabEstimate, 6000))),
    knownUntilRank,
  };
}

/** C-test passages: every second word of sentences 2+ half-gapped. */
export interface CTestPassage {
  id: string;
  cefr: "A1" | "A2" | "B1";
  /** Text with gaps as {answer} — learner sees first half of the word. */
  text: string;
}

export const CTEST_PASSAGES: CTestPassage[] = [
  {
    id: "morgen",
    cefr: "A1",
    text: "Ich wohne in Erlangen. Am Mor{gen} trinke i{ch} einen Kaf{fee} und e{sse} ein Br{ot}. Dann ge{he} ich z{ur} Arbeit.",
  },
  {
    id: "einkaufen",
    cefr: "A2",
    text: "Heute muss ich einkaufen. Der Su{permarkt} ist ni{cht} weit v{on} meiner Woh{nung}. Ich kau{fe} Obst, Gem{üse} und natür{lich} auch Scho{kolade}.",
  },
  {
    id: "wochenende",
    cefr: "B1",
    text: "Am Wochenende treffe ich meine Freunde. Wir wol{len} zusammen ko{chen}, weil d{as} Wetter schl{echt} sein so{ll}. Vielle{icht} sehen w{ir} danach no{ch} einen Fi{lm}.",
  },
];

export function parseCTest(passage: CTestPassage): {
  display: string;
  answers: string[];
} {
  const answers: string[] = [];
  const display = passage.text.replace(/\{([^}]+)\}/g, (_, answer: string) => {
    answers.push(answer);
    return "_".repeat(answer.length);
  });
  return { display, answers };
}

export function scoreCTest(answers: string[], given: string[]): number {
  if (answers.length === 0) return 0;
  let correct = 0;
  answers.forEach((answer, i) => {
    const a = (given[i] ?? "").trim().toLowerCase();
    if (a === answer.toLowerCase()) correct++;
  });
  return correct / answers.length;
}

export interface PlacementResult {
  vocabEstimate: number;
  knownUntilRank: number;
  /** Seed ability rating in logit units for the Elo model. */
  seedRating: number;
  /** Starting stabilised syntax stage. */
  stage: SyntaxStage;
}

/**
 * Blend the probes into a starting state. C-test and syntax probes are
 * optional — absent, we stay conservative (better to start slightly
 * too easy than too hard: early sessions re-estimate fast anyway).
 */
export function combinePlacement(
  vocab: VocabProbeResult,
  ctestScore?: number,
  observedStage?: SyntaxStage,
): PlacementResult {
  // Vocab size → rating: log curve anchored to the vocabulary track
  // milestones (500→A1≈1, 1500→A2≈2, 3000→B1≈2.8).
  const v = vocab.vocabEstimate;
  let seedRating = v <= 0 ? 0 : Math.min(4, 1.05 * Math.log(1 + v / 350));
  if (ctestScore !== undefined) {
    // C-test refines: blend toward its CEFR-ish signal (0–1 → 0–3.5).
    seedRating = 0.7 * seedRating + 0.3 * (ctestScore * 3.5);
  }
  const stage: SyntaxStage =
    observedStage ?? (v >= 1500 ? 3 : v >= 500 ? 2 : 1);
  return {
    vocabEstimate: v,
    knownUntilRank: vocab.knownUntilRank,
    seedRating: Math.round(seedRating * 100) / 100,
    stage,
  };
}

/**
 * Seed FSRS word states for a placed learner: everything above the
 * known-rank line starts as a Review-state card whose stability grows
 * with frequency (very frequent words are very stable). Real reviews
 * recalibrate each card within days — placement is a prior, not a verdict.
 */
export function seedWordStates(
  index: LexiconIndex,
  knownUntilRank: number,
  now: Date,
): WordState[] {
  const out: WordState[] = [];
  for (const lexeme of index.ordered) {
    if (lexeme.rank > knownUntilRank) break;
    const closeness = 1 - lexeme.rank / Math.max(knownUntilRank, 1);
    const stability = 4 + Math.round(26 * closeness); // 4–30 days
    const due = new Date(now.getTime() + stability * 24 * 3600 * 1000);
    out.push({
      lexemeId: lexeme.id,
      card: {
        ...createEmptyCard(now),
        state: State.Review,
        stability,
        difficulty: 5,
        reps: 1,
        due,
        last_review: now,
      },
      successDays: [now.toISOString().slice(0, 10)],
      introducedAt: now.toISOString(),
    });
  }
  return out;
}
