/**
 * The episode — one coherent scene from a newcomer's life in Erlangen
 * that every task in a session draws from. Instead of generating each
 * task's content separately (disconnected texts, mid-session loading,
 * per-task failure), the whole session's content is ONE generation:
 *
 *   story (Act 1, sets the scene) → dialogue (Act 2, the conversation
 *   in the scene) → cloze/construct/shadow items lifted from or
 *   continuing the scene → the tutor's conversation opener about it.
 *
 * This is the "reviews live inside content" principle applied to the
 * session itself: one narrative spine, generated up front while the
 * learner reads the briefing, validated as a whole under the coverage
 * contract, cached as a whole.
 */

import { z } from "zod";
import type { LexiconIndex } from "../lexicon/coverage";
import { analyzeCoverage } from "../lexicon/coverage";
import { tokenize } from "../lexicon/tokenize";
import { stageConstraints } from "../syntax/stages";
import type { SyntaxStage } from "../types";

/* ---------- Schema (what the model produces) ---------- */

const lineSchema = z.object({
  de: z.string().describe("German line"),
  en: z.string().describe("Natural English translation of exactly this line"),
});

const turnSchema = z.object({
  speaker: z.string().describe("Speaker name; the learner's character is always 'Du'"),
  de: z.string(),
  en: z.string().describe("Natural English translation of exactly this line"),
});

export const episodeSchema = z.object({
  title: z.string().describe("Short German episode title"),
  titleEn: z.string().describe("English translation of the title"),
  settingEn: z
    .string()
    .describe("One English sentence that sets the scene, shown before the episode starts"),
  story: z
    .array(lineSchema)
    .min(3)
    .describe("Act 1 — short narration that sets up the scene, one sentence per element"),
  dialogue: z
    .array(turnSchema)
    .min(3)
    .describe("Act 2 — the conversation inside the same scene; 'Du' speaks roughly half the turns"),
  glosses: z
    .array(z.object({ de: z.string(), en: z.string() }))
    .describe("Word→meaning pairs for every NEW word, in the exact surface form used"),
  cloze: z
    .array(
      z.object({
        sentence: z.string().describe("A sentence COPIED from the story or dialogue with ___ replacing the target word"),
        answer: z.string().describe("The exact missing word form"),
        lexemeId: z.string().describe("Id of the target lexeme, copied from the request"),
        hintEn: z.string().describe("Short English hint"),
      }),
    )
    .describe("Recall items that rebuild lines of the scene"),
  construct: z
    .array(
      z.object({
        promptEn: z.string().describe("English sentence the learner must say in German — it CONTINUES the scene in the learner's voice"),
        targetDe: z.string().describe("The expected German sentence"),
        alternatives: z.array(z.string()).describe("Other fully correct German renderings"),
      }),
    )
    .describe("Act 3 — the learner continues the scene themselves"),
  shadow: z
    .array(lineSchema)
    .min(1)
    .describe("2–4 short, speakable lines COPIED from the dialogue, for repeat-after-audio"),
  opener: lineSchema.describe(
    "The tutor's first conversation turn about the scene — a warm, simple question the learner can answer",
  ),
  recapEn: z
    .string()
    .describe("One warm English sentence recapping what happened in the scene, shown when the session ends"),
});

export type Episode = z.infer<typeof episodeSchema>;
export type EpisodeSection = "story" | "dialogue" | "cloze" | "construct" | "shadow" | "conversation";

/* ---------- Spec (what the composer requests) ---------- */

export interface EpisodeSpec {
  /** Lexeme ids the learner knows — the only words the model may use. */
  allowedLemmas: string[];
  /** Due lexeme ids that MUST appear in the scene (reviews live inside). */
  targetLemmas: string[];
  /** New lexeme ids: must appear AND be glossed. */
  newLemmas: string[];
  /** Lexeme ids to blank in cloze items (subset of targets/new). */
  clozeLemmas: string[];
  stage: SyntaxStage;
  coverageTarget: number;
  register: "colloquial" | "neutral";
  topic: string;
  storySentences: number;
  dialogueTurns: number;
  constructCount: number;
  /** Today's grammar bite focus, so the scene quietly exemplifies it. */
  grammarFocus?: string;
}

const SYSTEM_PROMPT = `You write one coherent episode of everyday life in Erlangen for a German learner.
Every German word MUST come from the allowed list (any inflected form). First names (Anna, Ben, Lena) and place names are the only exception — avoid titles like Herr/Frau unless listed.
Every section is part of ONE scene: the story sets it up, the dialogue happens inside it, cloze sentences are copied from it, construct items continue it in the learner's voice.
English translations render meaning naturally, never word-for-word glosses.`;

/**
 * Build the one prompt for a whole episode. The sorted allowed-word
 * list leads as a stable prefix so provider prompt caching applies
 * (identical spec → byte-identical prompt).
 */
export function buildEpisodePrompt(
  spec: EpisodeSpec,
  index: LexiconIndex,
): { system: string; prompt: string } {
  const allowed = spec.allowedLemmas
    .map((id) => index.byId.get(id)?.lemma)
    .filter((lemma): lemma is string => Boolean(lemma))
    .sort((a, b) => a.localeCompare(b, "de"));
  const describeLexeme = (id: string, suffix = "") => {
    const lexeme = index.byId.get(id);
    if (!lexeme) return null;
    const article = lexeme.gender ? `${lexeme.gender} ` : "";
    return `${article}${lexeme.lemma} (${lexeme.english})${suffix}`;
  };
  const targets = spec.targetLemmas
    .map((id) => describeLexeme(id))
    .filter((entry): entry is string => Boolean(entry));
  const news = spec.newLemmas
    .map((id) => describeLexeme(id, " [NEW — gloss it]"))
    .filter((entry): entry is string => Boolean(entry));
  const clozes = spec.clozeLemmas
    .map((id) => {
      const lexeme = index.byId.get(id);
      return lexeme ? `${lexeme.lemma} → id "${id}"` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  const constraints = stageConstraints(spec.stage);
  const lines = [
    `Allowed words: ${allowed.join(", ")}`,
    "",
    `Scene: ${spec.topic}. The learner's character is "Du".`,
    `Story: ~${spec.storySentences} sentences. Dialogue: ~${spec.dialogueTurns} turns, "Du" speaks about half.`,
    constraints.promptDescription,
    `Register: ${spec.register === "colloquial" ? "casual spoken German, modal particles welcome" : "neutral, friendly"}.`,
    targets.length > 0 ? `Must appear in story or dialogue: ${targets.join("; ")}` : null,
    targets.length > 0
      ? "If a required word cannot fit naturally within the allowed sentence structures, prefer natural German over forcing it in."
      : null,
    news.length > 0 ? `New words — appear in the scene AND in glosses: ${news.join("; ")}` : null,
    clozes.length > 0
      ? `Cloze items: one per word, sentence copied from the scene, blank the word: ${clozes.join("; ")}`
      : "Cloze items: none — return an empty array.",
    spec.constructCount > 0
      ? `Construct items: ${spec.constructCount}, each a natural next thing "Du" could say in this scene.`
      : "Construct items: none — return an empty array.",
    spec.grammarFocus ? `Today's grammar focus — let the scene show it naturally: ${spec.grammarFocus}.` : null,
  ].filter((line): line is string => line !== null);
  return { system: SYSTEM_PROMPT, prompt: lines.join("\n") };
}

/* ---------- Validation (the coverage contract, per section) ---------- */

export interface EpisodeIssue {
  section: EpisodeSection | "glosses" | "opener";
  kind: "coverage" | "missing-target" | "structure";
  detail: string;
}

const flatten = (episode: Episode): string =>
  [
    ...episode.story.map((line) => line.de),
    ...episode.dialogue.map((turn) => turn.de),
  ].join(" ");

function coverageIssue(
  text: string,
  spec: EpisodeSpec,
  index: LexiconIndex,
  section: EpisodeIssue["section"],
  tolerance: number,
): EpisodeIssue | null {
  const known = new Set([...spec.allowedLemmas, ...spec.targetLemmas, ...spec.newLemmas]);
  const report = analyzeCoverage(text, known, index);
  // Proper nouns and small numbers are free; grant a 2-token/2% slack
  // before out-of-lexicon tokens count against coverage.
  const slack = Math.max(2, Math.ceil(report.tokens * 0.02));
  const effective =
    (report.knownTokens + Math.min(report.outOfLexicon.length, slack)) /
    Math.max(report.tokens, 1);
  if (effective < spec.coverageTarget - tolerance) {
    const offenders = [...report.unknownInLexicon, ...report.outOfLexicon].slice(0, 12);
    return {
      section,
      kind: "coverage",
      detail: `${section}: coverage ${(effective * 100).toFixed(0)}% is below ${(
        (spec.coverageTarget - tolerance) * 100
      ).toFixed(0)}%. Replace or remove: ${offenders.join(", ")}`,
    };
  }
  return null;
}

/**
 * Validate a whole episode against its spec. `strict` is the repair
 * target; the lenient pass (wider coverage tolerance, targets may sit
 * anywhere in the scene) is the acceptance floor after the last
 * attempt — an imperfect scene beats a skipped session.
 */
export function validateEpisode(
  episode: Episode,
  spec: EpisodeSpec,
  index: LexiconIndex,
  opts: { strict?: boolean } = {},
): EpisodeIssue[] {
  const strict = opts.strict ?? true;
  const issues: EpisodeIssue[] = [];
  const tolerance = strict ? 0.05 : 0.1;
  const sceneText = flatten(episode);
  const sceneTokens = new Set(tokenize(sceneText));

  const storyIssue = coverageIssue(sceneText, spec, index, "story", tolerance);
  if (storyIssue) issues.push(storyIssue);

  // Every required word appears somewhere in the scene. Only strict:
  // a due word that didn't fit simply isn't reviewed today — that
  // never justifies discarding an otherwise comprehensible scene
  // (some due words, like subordinating conjunctions below their
  // stage, can be impossible to place naturally).
  if (strict) {
    for (const id of [...spec.targetLemmas, ...spec.newLemmas]) {
      const lexeme = index.byId.get(id);
      if (!lexeme) continue;
      const appears =
        sceneTokens.has(lexeme.lemma.toLowerCase()) ||
        lexeme.forms.some((form) => sceneTokens.has(form.toLowerCase())) ||
        (lexeme.plural ? sceneTokens.has(lexeme.plural.toLowerCase()) : false);
      if (!appears) {
        issues.push({
          section: "story",
          kind: "missing-target",
          detail: `Required word "${lexeme.lemma}" never appears in the scene.`,
        });
      }
    }
  }

  // New words must carry a gloss.
  if (strict) {
    const glossed = new Set(episode.glosses.map((gloss) => tokenize(gloss.de)[0]));
    for (const id of spec.newLemmas) {
      const lexeme = index.byId.get(id);
      if (!lexeme) continue;
      const hasGloss =
        glossed.has(lexeme.lemma.toLowerCase()) ||
        lexeme.forms.some((form) => glossed.has(form.toLowerCase()));
      if (!hasGloss) {
        issues.push({
          section: "glosses",
          kind: "structure",
          detail: `New word "${lexeme.lemma}" has no gloss entry.`,
        });
      }
    }
  }

  // Cloze items: well-formed, answer matches the named lexeme.
  for (const item of episode.cloze) {
    if (!item.sentence.includes("___")) {
      issues.push({
        section: "cloze",
        kind: "structure",
        detail: `Cloze sentence "${item.sentence.slice(0, 40)}…" has no ___ blank.`,
      });
      continue;
    }
    const answerToken = tokenize(item.answer)[0];
    const ids = answerToken ? (index.byForm.get(answerToken) ?? []) : [];
    if (item.lexemeId && ids.length > 0 && !ids.includes(item.lexemeId)) {
      issues.push({
        section: "cloze",
        kind: "structure",
        detail: `Cloze answer "${item.answer}" is not a form of ${item.lexemeId}.`,
      });
    }
  }

  // Construct targets and the opener stay inside the learner's
  // vocabulary too — but only strictly. These are single short
  // sentences where one stray word costs 10–20% coverage, and every
  // word is tappable with its translation, so the lenient floor
  // judges only the scene itself.
  if (strict) {
    for (const item of episode.construct) {
      const issue = coverageIssue(
        [item.targetDe, ...item.alternatives].join(" "),
        spec,
        index,
        "construct",
        tolerance + 0.02,
      );
      if (issue) issues.push(issue);
    }
    const openerIssue = coverageIssue(episode.opener.de, spec, index, "opener", tolerance + 0.02);
    if (openerIssue) issues.push(openerIssue);
  }

  return issues;
}

/**
 * Filter an episode's cloze items down to the ones a plan actually
 * scheduled (the model may return extras or misattributed ids).
 */
export function usableClozeItems(
  episode: Episode,
  wanted: string[],
  index: LexiconIndex,
): Episode["cloze"] {
  const wantedSet = new Set(wanted);
  return episode.cloze.filter((item) => {
    if (!item.sentence.includes("___")) return false;
    const answerToken = tokenize(item.answer)[0];
    const ids = answerToken ? (index.byForm.get(answerToken) ?? []) : [];
    const id = ids.includes(item.lexemeId) ? item.lexemeId : ids[0];
    return id !== undefined && (wantedSet.size === 0 || wantedSet.has(id) || wantedSet.has(item.lexemeId));
  });
}

/**
 * Find the first scene line containing a form of a lexeme — used to
 * show new words in their scene context after a retrieval answer.
 */
export function sceneLineFor(
  episode: Episode,
  lexemeId: string,
  index: LexiconIndex,
): { de: string; en: string } | null {
  const lexeme = index.byId.get(lexemeId);
  if (!lexeme) return null;
  const forms = new Set(
    [lexeme.lemma, ...(lexeme.plural ? [lexeme.plural] : []), ...lexeme.forms].map((form) =>
      form.toLowerCase(),
    ),
  );
  const lines = [
    ...episode.story,
    ...episode.dialogue.map((turn) => ({ de: turn.de, en: turn.en })),
  ];
  for (const line of lines) {
    if (tokenize(line.de).some((token) => forms.has(token))) return line;
  }
  return null;
}
