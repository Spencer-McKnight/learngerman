/**
 * Memory scheduling via FSRS-6 (ts-fsrs), per agent-memory decision:
 * defaults with request_retention ≈ 0.9 until a learner has ~1,000
 * review logs, then per-user optimisation as a batch job.
 *
 * One FSRS card per lexeme per learner. Reviews mostly happen
 * invisibly inside generated content (a due word appearing in a story
 * the learner understood counts as a retrieval), with explicit
 * retrieval taps reserved for new and struggling words.
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Grade,
} from "ts-fsrs";
import type { WordState } from "../types";

const params = generatorParameters({ request_retention: 0.9 });
const scheduler = fsrs(params);

export function newWordState(lexemeId: string, now: Date): WordState {
  return {
    lexemeId,
    card: createEmptyCard(now),
    successDays: [],
    introducedAt: now.toISOString(),
  };
}

/** Apply one graded retrieval; returns the updated state (pure). */
export function reviewWord(
  state: WordState,
  grade: 1 | 2 | 3 | 4,
  now: Date,
): WordState {
  const { card } = scheduler.next(state.card, now, grade as Grade);
  const day = now.toISOString().slice(0, 10);
  const successDays =
    grade >= Rating.Good && !state.successDays.includes(day)
      ? [...state.successDays.slice(-59), day]
      : state.successDays;
  return { ...state, card, successDays };
}

/** Probability the learner still recalls this word right now. */
export function retrievability(state: WordState, now: Date): number {
  if (state.card.state === State.New) return 0;
  return scheduler.get_retrievability(state.card, now, false);
}

export function isDue(state: WordState, now: Date): boolean {
  return state.card.state !== State.New && new Date(state.card.due) <= now;
}

/**
 * "Known" for coverage purposes: the word has left the learning steps
 * or is currently likely retrievable. Deliberately generous — coverage
 * content re-exposes shaky words, which is the design.
 */
export function isKnown(state: WordState, now: Date): boolean {
  if (state.card.state === State.New) return false;
  if (state.card.state === State.Review) return true;
  return retrievability(state, now) >= 0.5;
}

/** Due words, weakest (lowest retrievability) first. */
export function dueWords(words: WordState[], now: Date): WordState[] {
  return words
    .filter((word) => isDue(word, now))
    .sort((a, b) => retrievability(a, now) - retrievability(b, now));
}

/**
 * How many brand-new words to introduce this session. Workload-aware:
 * a big due pile or recent lapses shrink the budget to zero before we
 * ever add more (desirable difficulties only when the learner can
 * succeed at them — methodology #10).
 */
export function newWordBudget(
  words: WordState[],
  now: Date,
  opts: { max?: number; recentLapseRate?: number } = {},
): number {
  const max = opts.max ?? 4;
  const due = dueWords(words, now).length;
  const lapsePenalty = Math.round((opts.recentLapseRate ?? 0) * 10);
  const duePenalty = Math.floor(due / 8);
  return Math.max(0, Math.min(max, max - duePenalty - lapsePenalty));
}
