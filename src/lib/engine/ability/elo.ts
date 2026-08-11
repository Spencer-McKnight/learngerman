/**
 * Birdbrain-lite ability model (milestones-in-progression.md §Discovering
 * the level): a per-skill logistic (Elo/Rasch-style) rating updated after
 * every interaction, used to serve tasks at ~80–90% predicted success.
 *
 * Ratings live in logit units on a shared scale:
 *   0 ≈ absolute beginner · ~1 ≈ A1 · ~2 ≈ A2 · ~2.8 ≈ B1 · ~3.6 ≈ B2 · ~4.4 ≈ C1
 * Item difficulty lives on the same scale, derived from features rather
 * than fitted per item (we have few users; feature-based difficulty
 * generalises to freshly generated content, which per-item fitting can't).
 */

import type { SkillId, SkillState, SyntaxStage } from "../types";

/** P(success) for a learner of `rating` on an item of `difficulty`. */
export function pSuccess(rating: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(rating - difficulty)));
}

/**
 * Update after one outcome. K decays with experience so early sessions
 * move fast (placement keeps refining itself) and later ones are stable.
 */
export function updateRating(state: SkillState, difficulty: number, correct: boolean): SkillState {
  const k = Math.max(0.06, 0.35 / Math.sqrt(1 + state.attempts / 12));
  const expected = pSuccess(state.rating, difficulty);
  const rating = state.rating + k * ((correct ? 1 : 0) - expected);
  return {
    skill: state.skill,
    rating: Math.max(-0.5, Math.min(5, rating)),
    attempts: state.attempts + 1,
  };
}

/** Target success band the composer aims for (flow channel). */
export const TARGET_SUCCESS = 0.85;

/**
 * The difficulty an item should have so this learner succeeds at the
 * target rate. logit(0.85) ≈ 1.73 below the learner's rating.
 */
export function targetDifficulty(rating: number, targetSuccess = TARGET_SUCCESS): number {
  return rating - Math.log(targetSuccess / (1 - targetSuccess));
}

export interface ItemFeatures {
  taskKind: string;
  /** Count of lexemes in the item the learner hasn't been taught. */
  newLexemes?: number;
  /** Count of due (shaky) lexemes the item retrieves. */
  dueLexemes?: number;
  /** Syntax stage of the hardest structure the item requires producing. */
  stageRequired?: SyntaxStage;
  /** Learner's current stabilised stage, to price structural stretch. */
  learnerStage?: SyntaxStage;
  /** Audio at native street speed (register track) vs. clear/slow. */
  nativeSpeed?: boolean;
  /** Production without a prompt to copy (recall beats recognition). */
  freeProduction?: boolean;
  /** Time pressure applied (Pimsleur-style timed recall). */
  timed?: boolean;
}

/** Base difficulty by task kind, on the shared logit scale. */
const TASK_BASE: Record<string, number> = {
  "story-read": 0.4,
  "dialogue-read": 0.4,
  "listen-clip": 0.8,
  "retrieval-tap": 0.2,
  "cloze-type": 0.9,
  "construct-sentence": 1.1,
  shadowing: 0.5,
  "hvpt-pair": 0.3,
  "grammar-drill": 0.8,
  "scripted-dialogue": 1.2,
  "timed-recall": 1.6,
  "conversation-turn": 2.0,
};

/**
 * Feature-based item difficulty. Weights encode the methodology:
 * new vocabulary and structural stretch are the two big levers, and
 * they should rarely be pulled together (#10 — dose one dimension).
 */
export function itemDifficulty(features: ItemFeatures): number {
  let difficulty = TASK_BASE[features.taskKind] ?? 0.8;
  difficulty += 0.18 * (features.newLexemes ?? 0);
  difficulty += 0.05 * (features.dueLexemes ?? 0);
  if (features.stageRequired && features.learnerStage) {
    difficulty += 0.45 * Math.max(0, features.stageRequired - features.learnerStage);
  }
  if (features.nativeSpeed) difficulty += 0.5;
  if (features.freeProduction) difficulty += 0.4;
  if (features.timed) difficulty += 0.3;
  return difficulty;
}

/**
 * Is this item inside the learner's flow channel? Used by the composer
 * to trim or enrich a candidate task before serving it.
 */
export function inFlowChannel(
  rating: number,
  difficulty: number,
  band: { min: number; max: number } = { min: 0.7, max: 0.94 },
): boolean {
  const p = pSuccess(rating, difficulty);
  return p >= band.min && p <= band.max;
}

/** Fresh skill states for a new learner, optionally seeded by placement. */
export function initialSkills(seedRating = 0): Record<SkillId, SkillState> {
  const make = (skill: SkillId): SkillState => ({
    skill,
    // Receptive skills start at the placed rating; productive skills
    // trail it (recognise-before-produce gap is real — Duolingo critique).
    rating: skill === "speaking" || skill === "writing" ? Math.max(0, seedRating - 0.6) : seedRating,
    attempts: 0,
  });
  return {
    reading: make("reading"),
    listening: make("listening"),
    writing: make("writing"),
    speaking: make("speaking"),
    grammar: make("grammar"),
  };
}
