/**
 * Learn German — the learning engine.
 *
 * Pure-TypeScript algorithmic core; see learning-engine.md at the repo
 * root for the full design and journey. Modules:
 *
 *   lexicon/    frequency-ordered German lexicon, tokeniser, the
 *               coverage engine (~95% known-token content targeting)
 *   scheduler/  FSRS-6 memory scheduling + new-word introduction policy
 *   ability/    Birdbrain-lite per-skill Elo ratings & item difficulty
 *   syntax/     Processability-Theory word-order staircase + detectors
 *   grammar/    one-screen grammar bites, developmentally gated
 *   ear/        HVPT minimal-pair training with per-contrast mastery
 *   placement/  LexTALE-style probe, C-test, initial state seeding
 *   scoring/    typed-answer, sentence and speech (WER) scoring
 *   session/    task specs, LLM generation contracts, session composer
 *   progress/   honest metrics, CEFR estimation, milestone detection
 *   apply.ts    the single pure state transition for graded outcomes
 */

export * from "./types";
export * from "./apply";
export * from "./lexicon/types";
export * from "./lexicon/tokenize";
export * from "./lexicon/coverage";
export * from "./lexicon/seed";
export * from "./scheduler/scheduler";
export * from "./ability/elo";
export * from "./syntax/stages";
export * from "./grammar/curriculum";
export * from "./ear/hvpt";
export * from "./placement/placement";
export * from "./scoring/text";
export * from "./scoring/speech";
export * from "./session/tasks";
export * from "./session/episode";
export * from "./session/fallback-episodes";
export * from "./session/composer";
export * from "./progress/milestones";
