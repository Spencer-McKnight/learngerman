/**
 * German-aware tokenisation and normalisation.
 *
 * Handles the spoken register the app teaches (technology.md /
 * custom-teaching-methodology.md #12): apostrophe contractions
 * (hab', gibt's, 'ne), preposition+article fusions (im, zum, ans)
 * and umlaut ASCII fallbacks typed on foreign keyboards (ae → ä).
 */

/** Spoken contractions expanded to their full citation forms. */
const CONTRACTIONS: Record<string, string[]> = {
  "gibt's": ["gibt", "es"],
  "geht's": ["geht", "es"],
  "wie's": ["wie", "es"],
  "wenn's": ["wenn", "es"],
  "hab'": ["habe"],
  hab: ["habe"],
  "ich's": ["ich", "es"],
  "'ne": ["eine"],
  ne: ["eine"],
  "'nen": ["einen"],
  nen: ["einen"],
  "'n": ["ein"],
  "ist's": ["ist", "es"],
  "war's": ["war", "es"],
  "auf'm": ["auf", "dem"],
};

/** Preposition + article fusions, expanded so both lexemes get credit. */
const FUSIONS: Record<string, string[]> = {
  im: ["in", "dem"],
  ins: ["in", "das"],
  am: ["an", "dem"],
  ans: ["an", "das"],
  zum: ["zu", "dem"],
  zur: ["zu", "der"],
  vom: ["von", "dem"],
  beim: ["bei", "dem"],
  aufs: ["auf", "das"],
  fürs: ["für", "das"],
  durchs: ["durch", "das"],
  übers: ["über", "das"],
  unterm: ["unter", "dem"],
  hinterm: ["hinter", "dem"],
};

const WORD_RE = /[a-zA-ZäöüÄÖÜß]+(?:['’][a-zA-ZäöüÄÖÜß]+)?['’]?/g;

/** Lowercase and fold typing variants: ss stays, ae/oe/ue NOT folded
 * here (too lossy for German); ß → ss only in `looseNormalize`. */
export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/’/g, "'");
}

/**
 * Loose form used when comparing learner-typed answers: umlauts may be
 * typed as ae/oe/ue and ß as ss without counting as an error.
 */
export function looseNormalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Split German text into normalised word tokens, expanding spoken
 * contractions and preposition–article fusions. Punctuation and
 * numerals are dropped; sentence order is preserved.
 */
export function tokenize(text: string): string[] {
  const matches = text.match(WORD_RE) ?? [];
  const out: string[] = [];
  for (const raw of matches) {
    const token = normalizeToken(raw);
    const expanded =
      CONTRACTIONS[token] ?? FUSIONS[token] ?? [token.replace(/'$/, "")];
    out.push(...expanded);
  }
  return out.filter((token) => token.length > 0);
}

/** Split text into sentences (rough; enough for syntax detection). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
