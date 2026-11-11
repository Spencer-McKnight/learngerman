/**
 * Mapping spoken word boundaries back onto the text on screen. Edge
 * reports each word stripped of punctuation ("Brötchen" for
 * "Brötchen."), occasionally splits compounds on hyphens, and never
 * counts a lone dash as a word — so the match is by content, with the
 * boundary's index only breaking ties. Pure, so it is testable.
 */

import type { WordBoundary } from "./tts-shared";

export interface TextToken {
  text: string;
  /** Character offset into the original text. */
  start: number;
  /** Index among word tokens, or -1 for whitespace and bare punctuation. */
  wordIndex: number;
}

const HAS_LETTER = /[\p{L}\p{N}]/u;

/** Split text into words and the whitespace between them, keeping both. */
export function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let wordIndex = 0;
  const pattern = /\S+|\s+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const isWord = HAS_LETTER.test(match[0]);
    tokens.push({ text: match[0], start: match.index, wordIndex: isWord ? wordIndex++ : -1 });
  }
  return tokens;
}

export function normaliseWord(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Which token a boundary refers to: the matching word nearest to the
 * boundary's own index; failing a match, the word at that index.
 */
export function activeTokenIndex(tokens: TextToken[], boundary: WordBoundary | null): number {
  if (!boundary) return -1;
  const spoken = normaliseWord(boundary.word);
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  tokens.forEach((token, i) => {
    if (token.wordIndex < 0) return;
    const written = normaliseWord(token.text);
    const matches =
      spoken.length > 0 && (written === spoken || written.includes(spoken) || spoken.includes(written));
    if (!matches) return;
    const distance = Math.abs(token.wordIndex - boundary.index);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  if (best >= 0) return best;
  return tokens.findIndex((token) => token.wordIndex === boundary.index);
}

/** The word token containing a character offset (speechSynthesis boundaries). */
export function wordIndexAtChar(tokens: TextToken[], charIndex: number): number {
  let found = -1;
  for (const token of tokens) {
    if (token.start > charIndex) break;
    if (token.wordIndex >= 0) found = token.wordIndex;
  }
  return found;
}
