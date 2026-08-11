/**
 * The German word-order staircase (Pienemann's Processability Theory —
 * methodology #6): five stages acquired in a fixed, unskippable order.
 * The learner's stabilised stage gates which grammar is taught and
 * which structures generated content may require them to produce.
 *
 * Detection is heuristic but honest: we only record evidence from the
 * learner's own productions, and stabilisation needs repeated success
 * across separate days — matching "mastery-gated, never time-gated".
 */

import type { StageEvidence, SyntaxStage, SyntaxState } from "../types";
import type { LexiconIndex } from "../lexicon/coverage";
import { resolveToken } from "../lexicon/coverage";
import { tokenize } from "../lexicon/tokenize";

export const STAGE_NAMES: Record<SyntaxStage, string> = {
  1: "Basic sentences (SVO)",
  2: "Fronting (adverb first)",
  3: "Separable verbs",
  4: "Verb-second inversion",
  5: "Verb-final subordinate clauses",
};

const SUBJECT_PRONOUNS = new Set([
  "ich", "du", "er", "sie", "es", "wir", "ihr", "man", "das", "der", "die",
]);

const FRONTABLE_ADVERBS = new Set([
  "heute", "morgen", "gestern", "jetzt", "dann", "danach", "später",
  "leider", "vielleicht", "hier", "da", "dort", "manchmal", "oft",
  "immer", "zuerst", "abends", "morgens", "natürlich", "eigentlich",
]);

const SUBORDINATING = new Set([
  "weil", "dass", "wenn", "ob", "obwohl", "als", "damit", "bevor", "nachdem",
]);

const SEPARABLE_PARTICLES = new Set([
  "ab", "an", "auf", "aus", "ein", "fern", "los", "mit", "nach",
  "vor", "weg", "weiter", "zu", "zurück",
]);

function isVerbToken(token: string, index: LexiconIndex): boolean {
  const { lexemeId } = resolveToken(token, index);
  if (!lexemeId) return false;
  return index.byId.get(lexemeId)?.pos === "V";
}

export interface StageObservation {
  stage: SyntaxStage;
  success: boolean;
}

/**
 * Inspect one learner-produced sentence and report which staircase
 * structures it attempts and whether each came out in target order.
 * A sentence can evidence several stages at once.
 */
export function analyzeProduction(
  sentence: string,
  index: LexiconIndex,
): StageObservation[] {
  const tokens = tokenize(sentence);
  if (tokens.length < 2) return [];
  const observations: StageObservation[] = [];
  const verbAt = (from: number, to: number) => {
    for (let i = from; i < Math.min(to, tokens.length); i++) {
      if (isVerbToken(tokens[i], index)) return i;
    }
    return -1;
  };

  // Stage 5 — subordinate clause: finite verb must be clause-final.
  const subAt = tokens.findIndex((token) => SUBORDINATING.has(token));
  if (subAt >= 0 && subAt < tokens.length - 2) {
    const clause = tokens.slice(subAt + 1);
    const lastVerb = [...clause].reverse().findIndex((token) => isVerbToken(token, index));
    const hasVerb = clause.some((token) => isVerbToken(token, index));
    if (hasVerb) {
      observations.push({ stage: 5, success: lastVerb === 0 });
    }
  }
  const main = subAt >= 0 ? tokens.slice(0, subAt) : tokens;

  // Stage 3 — separable verb: particle stranded at clause end, or a
  // joined separable form used in a subordinate clause.
  const lastMain = main[main.length - 1];
  if (SEPARABLE_PARTICLES.has(lastMain) && verbAt(0, main.length - 1) >= 0) {
    const stemAt = verbAt(0, main.length - 1);
    const { lexemeId } = resolveToken(main[stemAt], index);
    const stemLemma = lexemeId ? index.byId.get(lexemeId)?.lemma : null;
    const joined = stemLemma ? index.byForm.get(lastMain + stemLemma) : undefined;
    observations.push({ stage: 3, success: joined !== undefined || stemLemma !== null });
  }

  // Stages 2 and 4 — fronted adverb: with inversion (verb before
  // subject) it evidences stage 4; without, it is still stage 2.
  if (FRONTABLE_ADVERBS.has(main[0])) {
    const verbIndex = verbAt(1, main.length);
    const subjectIndex = main.findIndex(
      (token, i) => i > 0 && SUBJECT_PRONOUNS.has(token),
    );
    if (verbIndex > 0 && subjectIndex > 0) {
      const inverted = verbIndex < subjectIndex;
      observations.push({ stage: 2, success: true });
      observations.push({ stage: 4, success: inverted });
    }
  } else if (SUBJECT_PRONOUNS.has(main[0]) || main.length >= 2) {
    // Stage 1 — canonical SVO: subject first, finite verb adjacent.
    const verbIndex = verbAt(1, 4);
    if (SUBJECT_PRONOUNS.has(main[0]) && verbIndex >= 1) {
      observations.push({ stage: 1, success: verbIndex <= 2 });
    }
  }

  return observations;
}

const WINDOW = 10;
const NEEDED_SUCCESSES = 8;
const NEEDED_DAYS = 3;

/** Record one observation into the evidence ledger (pure). */
export function recordStageOutcome(
  state: SyntaxState,
  stage: SyntaxStage,
  success: boolean,
  now: Date,
): SyntaxState {
  const day = now.toISOString().slice(0, 10);
  const prev: StageEvidence = state.evidence[stage] ?? { window: [], successDays: [] };
  const evidence: StageEvidence = {
    window: [...prev.window.slice(-(WINDOW * 2 - 1)), success],
    successDays:
      success && !prev.successDays.includes(day)
        ? [...prev.successDays.slice(-29), day]
        : prev.successDays,
  };
  const next: SyntaxState = {
    stage: state.stage,
    evidence: { ...state.evidence, [stage]: evidence },
  };
  // Stabilisation check — stages must be climbed strictly in order.
  const candidate = (state.stage + 1) as SyntaxStage;
  if (stage === candidate && candidate <= 5 && isStabilised(evidence)) {
    next.stage = candidate;
  }
  return next;
}

export function isStabilised(evidence: StageEvidence): boolean {
  const recent = evidence.window.slice(-WINDOW);
  const successes = recent.filter(Boolean).length;
  return (
    recent.length >= WINDOW &&
    successes >= NEEDED_SUCCESSES &&
    evidence.successDays.length >= NEEDED_DAYS
  );
}

/**
 * Constraints for content generation: structures the learner can be
 * ASKED TO PRODUCE (≤ stage) vs. shown receptively (≤ stage + 1 — the
 * next rung appears in input before it is ever demanded in output).
 */
export function stageConstraints(stage: SyntaxStage): {
  produce: SyntaxStage;
  comprehend: SyntaxStage;
  promptDescription: string;
} {
  const comprehend = Math.min(5, stage + 1) as SyntaxStage;
  const rules: Record<SyntaxStage, string> = {
    1: "only simple subject-verb-object main clauses",
    2: "main clauses; time adverbs may open a sentence",
    3: "main clauses incl. separable verbs (particle at the end); fronted adverbs allowed",
    4: "verb-second main clauses incl. inversion after fronted elements; separable verbs",
    5: "all word orders incl. subordinate clauses with verb-final order (weil, dass, wenn)",
  };
  return {
    produce: stage,
    comprehend,
    promptDescription: `Sentence structures: ${rules[comprehend]} — nothing beyond this.`,
  };
}
