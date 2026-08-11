/**
 * applyOutcome — the single state transition for the whole engine.
 * Every graded interaction (a tap, a typed cloze, a shadowed clip, a
 * conversation turn) reduces to one ReviewOutcome, and this function
 * folds it into the learner state: FSRS cards, ability ratings, syntax
 * evidence, ear mastery, input minutes. Pure — persistence happens in
 * the store layer, milestone detection in the API route around it.
 */

import type { LearnerSnapshot, ReviewOutcome, WordState } from "./types";
import { newWordState, reviewWord } from "./scheduler/scheduler";
import { updateRating } from "./ability/elo";
import { recordStageOutcome } from "./syntax/stages";
import { emptyContrastState, recordEarOutcome } from "./ear/hvpt";

export function applyOutcome(
  snapshot: LearnerSnapshot,
  outcome: ReviewOutcome,
): LearnerSnapshot {
  const { now } = snapshot;

  // 1. FSRS updates for every lexeme the task touched. Unseen lexemes
  // get a fresh card first (introduction counts as the first review).
  const wordsById = new Map(snapshot.words.map((word) => [word.lexemeId, word]));
  for (const [lexemeId, grade] of Object.entries(outcome.lexemeGrades)) {
    const existing = wordsById.get(lexemeId) ?? newWordState(lexemeId, now);
    wordsById.set(lexemeId, reviewWord(existing, grade, now));
  }
  const words: WordState[] = [...wordsById.values()];

  // 2. Ability update on the credited skill.
  const skills = {
    ...snapshot.skills,
    [outcome.skill]: updateRating(
      snapshot.skills[outcome.skill],
      outcome.difficulty,
      outcome.correct,
    ),
  };

  // 3. Syntax evidence, if this was a production evidencing a stage.
  let syntax = snapshot.syntax;
  if (outcome.stageAttempted !== undefined && outcome.stageSuccess !== undefined) {
    syntax = recordStageOutcome(syntax, outcome.stageAttempted, outcome.stageSuccess, now);
  }

  // 4. Ear contrast, if this was an HVPT identification.
  let ear = snapshot.ear;
  if (outcome.earContrastId) {
    const index = ear.findIndex((state) => state.contrastId === outcome.earContrastId);
    const current = index >= 0 ? ear[index] : emptyContrastState(outcome.earContrastId);
    const updated = recordEarOutcome(current, outcome.correct);
    ear = index >= 0 ? ear.map((state, i) => (i === index ? updated : state)) : [...ear, updated];
  }

  // 5. Grammar bite progression: first encounter → practising, a later
  // correct drill → settled (nextGrammarBite then moves on).
  let grammar = snapshot.grammar;
  if (outcome.biteId) {
    const current = grammar.bites[outcome.biteId];
    const next =
      current === "settled"
        ? "settled"
        : current === "practising" && outcome.correct
          ? "settled"
          : "practising";
    grammar = { bites: { ...grammar.bites, [outcome.biteId]: next } };
  }

  // 6. Input-hours track.
  const inputMinutes = snapshot.inputMinutes + (outcome.inputSeconds ?? 0) / 60;

  return { ...snapshot, words, skills, syntax, ear, grammar, inputMinutes };
}
