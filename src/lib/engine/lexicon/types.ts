/**
 * Lexicon types. The lexicon is precomputed data shipped as TypeScript
 * (technology.md: "runtime stays pure TypeScript reading precomputed
 * data") — frequency-ordered per HermitDave's OpenSubtitles de ranks,
 * CEFR-tagged per Goethe word lists, gender/forms per standard German
 * morphology. The seed covers the richest-scaffolding zone; the full
 * 5k pipeline (spaCy + CharSplit) can extend it without changing shape.
 */

export type Pos =
  | "N" // noun
  | "V" // verb
  | "ADJ"
  | "ADV"
  | "PRON"
  | "PREP"
  | "CONJ"
  | "DET"
  | "NUM"
  | "PART" // modal/other particle
  | "INTJ";

export type Gender = "der" | "die" | "das";

export interface Lexeme {
  /** Stable id: `${lemma}:${pos}` (e.g. "trinken:V", "Haus:N"). */
  id: string;
  lemma: string;
  pos: Pos;
  /** Nouns only. Taught as one unit with the article, colour-coded. */
  gender?: Gender;
  /** Nouns only, plural surface form. */
  plural?: string;
  english: string;
  /** Frequency rank, ~OpenSubtitles de (1 = most frequent). */
  rank: number;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1";
  /**
   * Inflected surface forms that should resolve to this lexeme during
   * coverage analysis (lowercased; the lemma itself is implicit).
   */
  forms: string[];
  /**
   * Flags: "separable" (verb), "particle" (modal particle),
   * "colloquial" (register thread), "subordinating" (conjunction),
   * "finite-aux" etc. Used by the syntax detectors and the composer.
   */
  tags?: string[];
}
