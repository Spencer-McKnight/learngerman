/**
 * Honest scoring of typed German. Umlaut keyboard fallbacks (ae/oe/ue,
 * ss) are never errors; a single slip is a typo, not a failure —
 * punishing mistakes truncates exactly the practice that drives
 * learning (gamification-strategy.md).
 */

import { looseNormalize, tokenize } from "../lexicon/tokenize";

/** Damerau–Levenshtein distance (with transpositions). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

export type Verdict = "correct" | "typo" | "wrong";

export interface TextScore {
  verdict: Verdict;
  /** 0–1 similarity after normalisation. */
  similarity: number;
  /** FSRS grade this answer earns for the retrieved lexeme(s). */
  grade: 1 | 2 | 3 | 4;
}

/**
 * Grade a typed answer against the expected form(s).
 * `latencyMs` distinguishes fluent recall (Easy) from effortful (Good).
 */
export function scoreTyped(
  answer: string,
  expected: string | string[],
  opts: { latencyMs?: number; fluentMs?: number } = {},
): TextScore {
  const targets = Array.isArray(expected) ? expected : [expected];
  let best: { similarity: number; distance: number } = { similarity: 0, distance: Infinity };
  const given = looseNormalize(answer.trim());
  for (const target of targets) {
    const want = looseNormalize(target.trim());
    const distance = editDistance(given, want);
    const similarity = 1 - distance / Math.max(given.length, want.length, 1);
    if (similarity > best.similarity) best = { similarity, distance };
  }
  if (best.distance === 0) {
    const fluent =
      opts.latencyMs !== undefined && opts.latencyMs <= (opts.fluentMs ?? 6000);
    return { verdict: "correct", similarity: 1, grade: fluent ? 4 : 3 };
  }
  // One slip in a word of ≥4 letters (or ≥85% similar) reads as a typo:
  // the memory was there, the fingers weren't.
  if ((best.distance === 1 && given.length >= 4) || best.similarity >= 0.85) {
    return { verdict: "typo", similarity: best.similarity, grade: 2 };
  }
  return { verdict: "wrong", similarity: Math.max(0, best.similarity), grade: 1 };
}

export interface SentenceScore {
  /** 0–1: token-level correctness against the target sentence. */
  accuracy: number;
  /** Tokens in the target the answer missed. */
  missing: string[];
  /** Tokens the answer added that the target lacks. */
  extra: string[];
  /** Whether word ORDER matched where content did. */
  orderCorrect: boolean;
}

/**
 * Compare a constructed sentence to a target, tolerant of typos at the
 * token level. Used by construct-before-reveal and dictation tasks.
 */
export function scoreSentence(answer: string, target: string): SentenceScore {
  const got = tokenize(answer).map(looseNormalize);
  const want = tokenize(target).map(looseNormalize);
  const matchedWant = new Set<number>();
  const matchedGot = new Set<number>();
  // First pass: exact/typo alignment greedy in order.
  for (let i = 0; i < got.length; i++) {
    for (let j = 0; j < want.length; j++) {
      if (matchedWant.has(j)) continue;
      const distance = editDistance(got[i], want[j]);
      if (distance === 0 || (distance === 1 && want[j].length >= 4)) {
        matchedWant.add(j);
        matchedGot.add(i);
        break;
      }
    }
  }
  const missing = want.filter((_, j) => !matchedWant.has(j));
  const extra = got.filter((_, i) => !matchedGot.has(i));
  const accuracy = want.length === 0 ? 0 : matchedWant.size / want.length;
  // Order check: the sequence of matched target indices, in answer
  // order, must be ascending.
  const sequence: number[] = [];
  for (let i = 0; i < got.length; i++) {
    if (!matchedGot.has(i)) continue;
    for (let j = 0; j < want.length; j++) {
      if (matchedWant.has(j) && !sequence.includes(j)) {
        const distance = editDistance(got[i], want[j]);
        if (distance <= 1) {
          sequence.push(j);
          break;
        }
      }
    }
  }
  const orderCorrect = sequence.every((v, i) => i === 0 || v > sequence[i - 1]);
  return { accuracy, missing, extra, orderCorrect };
}
