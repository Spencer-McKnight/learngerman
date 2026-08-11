/**
 * The coverage engine — the most load-bearing mechanic in the app
 * (custom-teaching-methodology.md #2): every piece of served content
 * should sit at ~90–97% known-token coverage, the computable form of
 * "just beyond current ability".
 */

import type { Lexeme } from "./types";
import { tokenize } from "./tokenize";

export interface LexiconIndex {
  byId: Map<string, Lexeme>;
  /** surface form (lowercased) → lexeme ids that can produce it. */
  byForm: Map<string, string[]>;
  /** Lexemes ordered by frequency rank. */
  ordered: Lexeme[];
}

export function buildIndex(lexicon: Lexeme[]): LexiconIndex {
  const byId = new Map<string, Lexeme>();
  const byForm = new Map<string, string[]>();
  const add = (form: string, id: string) => {
    const key = form.toLowerCase();
    const ids = byForm.get(key);
    if (ids) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      byForm.set(key, [id]);
    }
  };
  for (const lexeme of lexicon) {
    byId.set(lexeme.id, lexeme);
    add(lexeme.lemma, lexeme.id);
    if (lexeme.plural) add(lexeme.plural, lexeme.id);
    for (const form of lexeme.forms) add(form, lexeme.id);
  }
  const ordered = [...lexicon].sort((a, b) => a.rank - b.rank);
  return { byId, byForm, ordered };
}

/**
 * Resolve one token to a lexeme id. Falls back to a compound-suffix
 * heuristic (poor man's CharSplit): a German compound takes its final
 * noun's meaning-anchor, so an unknown token whose tail (≥4 chars,
 * after a plausible linking element) is a known noun form counts as
 * half-known rather than opaque.
 */
export function resolveToken(
  token: string,
  index: LexiconIndex,
): { lexemeId: string | null; compoundOf?: string } {
  const direct = index.byForm.get(token);
  if (direct) return { lexemeId: direct[0] };
  if (token.length >= 7) {
    for (let cut = 1; cut <= token.length - 4; cut++) {
      for (const link of ["", "s", "n", "es", "en"]) {
        const tail = token.slice(cut + link.length);
        if (tail.length < 4 || !token.slice(cut).startsWith(link)) continue;
        const ids = index.byForm.get(tail);
        const nounId = ids?.find((id) => index.byId.get(id)?.pos === "N");
        if (nounId) return { lexemeId: null, compoundOf: nounId };
      }
    }
  }
  return { lexemeId: null };
}

export interface CoverageReport {
  tokens: number;
  knownTokens: number;
  /** Tokens resolved to a known lexeme ∕ all resolvable-or-not tokens. */
  coverage: number;
  /** Distinct unknown lexeme ids that ARE in the lexicon (learnable now). */
  unknownInLexicon: string[];
  /** Distinct surface tokens outside the lexicon entirely. */
  outOfLexicon: string[];
  /** Distinct known lexeme ids that appeared (for crediting reviews). */
  knownAppeared: string[];
}

/**
 * Analyse a text against the learner's known set. `known` holds lexeme
 * ids the learner has been taught (any FSRS state past `New`).
 * Compound tokens whose head noun is known count as half a known token.
 */
export function analyzeCoverage(
  text: string,
  known: ReadonlySet<string>,
  index: LexiconIndex,
): CoverageReport {
  const tokens = tokenize(text);
  let knownTokens = 0;
  const unknownInLexicon = new Set<string>();
  const outOfLexicon = new Set<string>();
  const knownAppeared = new Set<string>();
  for (const token of tokens) {
    const { lexemeId, compoundOf } = resolveToken(token, index);
    if (lexemeId) {
      if (known.has(lexemeId)) {
        knownTokens += 1;
        knownAppeared.add(lexemeId);
      } else {
        unknownInLexicon.add(lexemeId);
      }
    } else if (compoundOf && known.has(compoundOf)) {
      knownTokens += 0.5;
    } else {
      outOfLexicon.add(token);
    }
  }
  const total = tokens.length || 1;
  return {
    tokens: tokens.length,
    knownTokens,
    coverage: knownTokens / total,
    unknownInLexicon: [...unknownInLexicon],
    outOfLexicon: [...outOfLexicon],
    knownAppeared: [...knownAppeared],
  };
}

/**
 * Is a generated text inside the learner's comprehensibility band?
 * Listening content may run slightly bolder than reading (Nation 2006:
 * 95% listening ≈ 98% reading in difficulty terms), so callers pass
 * the target from the learner profile and we allow a small tolerance.
 */
export function inCoverageBand(
  report: CoverageReport,
  target: number,
  tolerance = 0.03,
): boolean {
  return (
    report.coverage >= target - tolerance &&
    // 100% coverage with no new material is allowed only for pure
    // review texts; normal content should carry at least one new item.
    (report.coverage < 1 || report.unknownInLexicon.length === 0)
  );
}

/**
 * Pick the next new lexemes to introduce: lowest-rank items the learner
 * doesn't know yet, i.e. straight down the frequency dictionary
 * (Tschirner & Möhring ordering), skipping anything excluded.
 */
export function nextNewLexemes(
  known: ReadonlySet<string>,
  index: LexiconIndex,
  count: number,
  exclude: ReadonlySet<string> = new Set(),
): Lexeme[] {
  const out: Lexeme[] = [];
  if (count <= 0) return out;
  for (const lexeme of index.ordered) {
    if (known.has(lexeme.id) || exclude.has(lexeme.id)) continue;
    out.push(lexeme);
    if (out.length >= count) break;
  }
  return out;
}
