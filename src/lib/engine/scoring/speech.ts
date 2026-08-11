/**
 * Speech scoring from STT transcripts (Web Speech API / Groq Whisper).
 * Honesty rule from the research: we score at the WORD level only —
 * what the recogniser actually heard — and never invent phoneme-level
 * pronunciation scores. (Real phoneme scoring arrives only if Azure
 * Pronunciation Assessment is wired in; one dishonest score costs all
 * trust.)
 */

import { looseNormalize, tokenize } from "../lexicon/tokenize";
import { editDistance } from "./text";

export interface SpeechScore {
  /** 1 − word error rate, clamped to 0–1. */
  wordAccuracy: number;
  /** Target words the transcript missed (lowercased). */
  missedWords: string[];
  verdict: "great" | "good" | "retry";
  /** FSRS grade for lexemes this utterance retrieved. */
  grade: 1 | 2 | 3 | 4;
}

/**
 * Compare an STT transcript against the target utterance (shadowing,
 * read-aloud, timed recall). Token-level Levenshtein = standard WER.
 */
export function scoreSpeech(transcript: string, target: string): SpeechScore {
  const got = tokenize(transcript).map(looseNormalize);
  const want = tokenize(target).map(looseNormalize);
  if (want.length === 0) {
    return { wordAccuracy: 0, missedWords: [], verdict: "retry", grade: 1 };
  }
  // Token-level edit distance with per-token typo tolerance.
  const m = got.length;
  const n = want.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const tokenDistance = editDistance(got[i - 1], want[j - 1]);
      const same = tokenDistance === 0 || (tokenDistance === 1 && want[j - 1].length >= 4);
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (same ? 0 : 1),
      );
    }
  }
  const wer = d[m][n] / n;
  const wordAccuracy = Math.max(0, 1 - wer);
  const gotSet = new Set(got);
  const missedWords = want.filter(
    (word) =>
      !gotSet.has(word) &&
      ![...gotSet].some((g) => editDistance(g, word) === 1 && word.length >= 4),
  );
  const verdict = wordAccuracy >= 0.9 ? "great" : wordAccuracy >= 0.75 ? "good" : "retry";
  const grade = wordAccuracy >= 0.9 ? 3 : wordAccuracy >= 0.75 ? 2 : 1;
  return { wordAccuracy, missedWords, verdict, grade };
}
