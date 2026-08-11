/**
 * Honest progress (milestones-in-progression.md): only numbers that
 * mean something outside the app — known words and what they buy,
 * a CEFR range with confidence (never false precision), syntax stages,
 * contrasts mastered, minutes of real German understood.
 * Never "you are 87% fluent". Never bars that fill because time passed.
 */

import type { CefrBand, LearnerSnapshot } from "../types";
import { isKnown } from "../scheduler/scheduler";
import { STAGE_NAMES } from "../syntax/stages";

/**
 * Known-lemma count → share of everyday speech covered. Piecewise
 * curve anchored to Nation (2006) and OpenSubtitles-German counts:
 * ~3,000 word families ≈ 95% of conversation/TV.
 */
const COVERAGE_CURVE: [number, number][] = [
  [0, 0],
  [100, 0.45],
  [250, 0.6],
  [500, 0.72],
  [1000, 0.8],
  [2000, 0.89],
  [3000, 0.95],
  [4000, 0.965],
  [5000, 0.975],
  [7000, 0.98],
];

export function speechCoverageForVocab(knownLemmas: number): number {
  const curve = COVERAGE_CURVE;
  if (knownLemmas <= 0) return 0;
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i - 1];
    const [x2, y2] = curve[i];
    if (knownLemmas <= x2) {
      return y1 + ((knownLemmas - x1) / (x2 - x1)) * (y2 - y1);
    }
  }
  return curve[curve.length - 1][1];
}

/** Vocabulary-track milestones with what each one buys, verbatim from research. */
export const VOCAB_MILESTONES: { count: number; meaning: string }[] = [
  { count: 500, meaning: "Du überlebst Höflichkeit, Einkaufen und Vorstellungen" },
  { count: 1000, meaning: "Die meisten einfachen Gespräche werden möglich" },
  { count: 2000, meaning: "Echte Inhalte öffnen sich" },
  { count: 3000, meaning: "~95% der Alltagssprache — die Konversationsschwelle" },
  { count: 5000, meaning: "Das ganze Frequenzwörterbuch — die meisten Texte" },
];

export interface CefrEstimate {
  band: CefrBand;
  /** The honest range: [low, high] adjacent bands. */
  range: [CefrBand, CefrBand];
  /** 0–1 agreement between the signals. */
  confidence: number;
}

const BANDS: CefrBand[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

function vocabBand(known: number): number {
  if (known < 300) return 0;
  if (known < 900) return 1;
  if (known < 2000) return 2;
  if (known < 3500) return 3;
  if (known < 5000) return 4;
  return 5;
}

function ratingBand(rating: number): number {
  if (rating < 0.5) return 0;
  if (rating < 1.5) return 1;
  if (rating < 2.4) return 2;
  if (rating < 3.2) return 3;
  if (rating < 4.0) return 4;
  return 5;
}

function stageBand(stage: number): number {
  // Stage 5 (verb-final) production is a strong B1 signal.
  return [0, 1, 1, 2, 3, 3][stage] ?? 0;
}

/**
 * CEFR from three independent signals — vocabulary size, mean ability
 * rating, syntax stage. Agreement between them sets the confidence;
 * the shown range always spans what the signals span.
 */
export function estimateCefr(snapshot: LearnerSnapshot): CefrEstimate {
  const known = snapshot.words.filter((word) => isKnown(word, snapshot.now)).length;
  const meanRating =
    (snapshot.skills.reading.rating +
      snapshot.skills.listening.rating +
      snapshot.skills.speaking.rating +
      snapshot.skills.writing.rating) /
    4;
  const signals = [
    vocabBand(known),
    ratingBand(meanRating),
    stageBand(snapshot.syntax.stage),
  ];
  const low = Math.min(...signals);
  const high = Math.max(...signals);
  const mid = Math.round(signals.reduce((sum, signal) => sum + signal, 0) / signals.length);
  const spread = high - low;
  return {
    band: BANDS[mid],
    range: [BANDS[low], BANDS[high]],
    confidence: spread === 0 ? 0.9 : spread === 1 ? 0.65 : 0.4,
  };
}

/** CEFR can-do statements as checkable milestones (the CEFR is built from these). */
export const CAN_DO: Record<CefrBand, string[]> = {
  A0: ["I can greet someone and introduce myself"],
  A1: [
    "I can order food and drinks",
    "I can say where I live and what I do",
    "I can understand slow, clear questions about myself",
  ],
  A2: [
    "I can handle small talk while shopping",
    "I can describe my day in the past tense",
    "I can follow the gist of a short everyday conversation",
  ],
  B1: [
    "I can explain why I think something",
    "I can handle most situations while travelling",
    "I can follow a street-speed conversation about a familiar topic",
  ],
  B2: [
    "I can converse comfortably with native speakers",
    "I can follow most films and shows",
  ],
  C1: ["I can express myself flexibly, with nuance, on almost anything"],
};

export interface MilestoneEvent {
  kind:
    | "vocab-threshold"
    | "syntax-stage"
    | "contrast-mastered"
    | "cefr-band"
    | "first-conversation"
    | "streak-week";
  label: string;
  detail: string;
}

/**
 * Detect genuine milestone crossings between two snapshots of derived
 * state. These — and only these — get the Ortsschild-yellow celebration.
 */
export function detectMilestones(
  before: {
    knownCount: number;
    stage: number;
    masteredContrasts: string[];
    band: CefrBand;
  },
  after: {
    knownCount: number;
    stage: number;
    masteredContrasts: string[];
    band: CefrBand;
  },
): MilestoneEvent[] {
  const events: MilestoneEvent[] = [];
  for (const milestone of VOCAB_MILESTONES) {
    if (before.knownCount < milestone.count && after.knownCount >= milestone.count) {
      events.push({
        kind: "vocab-threshold",
        label: `${milestone.count} Wörter`,
        detail: milestone.meaning,
      });
    }
  }
  if (after.stage > before.stage) {
    events.push({
      kind: "syntax-stage",
      label: `Stufe ${after.stage}`,
      detail: STAGE_NAMES[after.stage as 1 | 2 | 3 | 4 | 5],
    });
  }
  for (const contrast of after.masteredContrasts) {
    if (!before.masteredContrasts.includes(contrast)) {
      events.push({
        kind: "contrast-mastered",
        label: contrast,
        detail: "Du hörst den Unterschied jetzt zuverlässig",
      });
    }
  }
  if (after.band !== before.band && BANDS.indexOf(after.band) > BANDS.indexOf(before.band)) {
    events.push({
      kind: "cefr-band",
      label: after.band,
      detail: "Willkommen in der nächsten Stadt",
    });
  }
  return events;
}

/** The progress panel's numbers — every one meaningful outside the app. */
export function progressSummary(snapshot: LearnerSnapshot) {
  const knownCount = snapshot.words.filter((word) => isKnown(word, snapshot.now)).length;
  const coverage = speechCoverageForVocab(knownCount);
  const cefr = estimateCefr(snapshot);
  return {
    knownWords: knownCount,
    speechCoverage: coverage,
    speechCoverageLabel: `Deine Wörter decken ~${Math.round(coverage * 100)}% der Alltagssprache ab`,
    cefr,
    syntaxStage: snapshot.syntax.stage,
    syntaxStageName: STAGE_NAMES[snapshot.syntax.stage],
    contrastsMastered: snapshot.ear.filter((contrast) => contrast.mastered).length,
    inputMinutes: Math.round(snapshot.inputMinutes),
    speakingRung: snapshot.speakingRung,
  };
}
