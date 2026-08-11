/**
 * Shared types for the learning engine.
 *
 * The engine is pure TypeScript: every module in src/lib/engine takes
 * plain state in and returns plain state out, so it is testable without
 * a database and runs identically on server or client. Persistence
 * lives in store.ts; LLM calls live in the API routes.
 *
 * Research grounding: custom-teaching-methodology.md (coverage engine,
 * FSRS, syntax staircase), milestones-in-progression.md (tracks).
 */

import type { Card } from "ts-fsrs";

/** The four macro-skills plus grammar, each with its own ability rating. */
export type SkillId = "reading" | "listening" | "writing" | "speaking" | "grammar";

export const SKILLS: SkillId[] = [
  "reading",
  "listening",
  "writing",
  "speaking",
  "grammar",
];

/** Pienemann's fixed German word-order acquisition stages (unskippable). */
export type SyntaxStage = 1 | 2 | 3 | 4 | 5;

/**
 * The speaking ramp from custom-teaching-methodology.md: each rung is
 * only offered once the one below feels easy.
 */
export type SpeakingRung =
  | "shadowing"
  | "construct"
  | "scripted"
  | "timed-recall"
  | "free-conversation";

export const SPEAKING_RUNGS: SpeakingRung[] = [
  "shadowing",
  "construct",
  "scripted",
  "timed-recall",
  "free-conversation",
];

export type CefrBand = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";

/** FSRS card state for one lexeme, as stored per user. */
export interface WordState {
  lexemeId: string;
  card: Card;
  /** ISO date strings of days this word was successfully retrieved. */
  successDays: string[];
  introducedAt: string;
}

/** Per-skill ability in logit units (0 ≈ absolute beginner, ~4 ≈ C1). */
export interface SkillState {
  skill: SkillId;
  rating: number;
  attempts: number;
}

/** Rolling evidence that one syntax stage is being produced correctly. */
export interface StageEvidence {
  /** Outcomes of the most recent attempts, newest last (max 20 kept). */
  window: boolean[];
  /** Distinct ISO days on which a successful production occurred. */
  successDays: string[];
}

export interface SyntaxState {
  /** Highest stabilised stage; the learner is working on stage + 1. */
  stage: SyntaxStage;
  evidence: Partial<Record<SyntaxStage, StageEvidence>>;
}

export interface EarContrastState {
  contrastId: string;
  seen: number;
  correct: number;
  /** Outcomes of the most recent attempts, newest last (max 20 kept). */
  window: boolean[];
  mastered: boolean;
}

export type GrammarBiteStatus = "ready" | "seen" | "practising" | "settled";

export interface GrammarState {
  /** biteId → status for every bite the learner has met. */
  bites: Record<string, GrammarBiteStatus>;
}

/**
 * Everything the composer needs to plan one session. Assembled by
 * store.loadSnapshot from the per-user tables.
 */
export interface LearnerSnapshot {
  userId: string;
  now: Date;
  words: WordState[];
  skills: Record<SkillId, SkillState>;
  syntax: SyntaxState;
  grammar: GrammarState;
  ear: EarContrastState[];
  speakingRung: SpeakingRung;
  /** Personal known-token coverage target for served content (0.90–0.97). */
  coverageTarget: number;
  /** Total minutes of German audio/text understood, for the input-hours track. */
  inputMinutes: number;
  /** Session length preference in minutes. */
  minutesPerSession: number;
  placed: boolean;
}

/** One graded interaction, the atom every scoring path reduces to. */
export interface ReviewOutcome {
  taskKind: string;
  skill: SkillId;
  correct: boolean;
  /** 1=Again 2=Hard 3=Good 4=Easy — FSRS grades for touched lexemes. */
  lexemeGrades: Record<string, 1 | 2 | 3 | 4>;
  /** Item difficulty in logit units, for the ability update. */
  difficulty: number;
  /** Syntax stage this production evidences, if it was a production task. */
  stageAttempted?: SyntaxStage;
  stageSuccess?: boolean;
  earContrastId?: string;
  /** Grammar bite this outcome practised (advances seen → practising → settled). */
  biteId?: string;
  /** Seconds of comprehensible German consumed (input-hours track). */
  inputSeconds?: number;
}
