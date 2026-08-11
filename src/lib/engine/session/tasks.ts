/**
 * Task types the app can serve, with Zod schemas for LLM structured
 * generation (Vercel AI SDK `generateObject`) and a validator that
 * holds generated content to the coverage contract. The engine never
 * calls the LLM itself — it produces a GenerationRequest the API layer
 * executes, keeping the whole engine pure and testable.
 */

import { z } from "zod";
import type { LexiconIndex } from "../lexicon/coverage";
import { analyzeCoverage } from "../lexicon/coverage";
import { tokenize } from "../lexicon/tokenize";
import { stageConstraints } from "../syntax/stages";
import type { SyntaxStage } from "../types";

/** Every kind of task a session can contain. */
export type TaskKind =
  | "story-read" // micro-story at coverage target (reviews live inside)
  | "dialogue-read"
  | "listen-clip" // same content, audio-first
  | "retrieval-tap" // fast form–meaning taps for new words
  | "cloze-type" // type the missing word inside a sentence
  | "construct-sentence" // Language-Transfer-style: build before reveal
  | "shadowing" // repeat-after-audio, STT-scored
  | "hvpt-pair" // which word did you hear?
  | "grammar-bite" // one-screen explanation + drill
  | "scripted-dialogue" // learner speaks fixed turns of a dialogue
  | "timed-recall" // Pimsleur-style recall under mild time pressure
  | "conversation-turn"; // free AI conversation within known vocab

/* ---------- Zod schemas for generated content ---------- */

export const generatedStorySchema = z.object({
  title: z.string().describe("Short German title"),
  sentences: z
    .array(z.string())
    .min(3)
    .max(12)
    .describe("The story, one German sentence per element"),
  englishGist: z.string().describe("One-sentence English gist, shown only on request"),
  glosses: z
    .array(z.object({ de: z.string(), en: z.string() }))
    .describe("English gloss for each NEW word used (tap-to-reveal)"),
});
export type GeneratedStory = z.infer<typeof generatedStorySchema>;

export const generatedDialogueSchema = z.object({
  title: z.string(),
  turns: z
    .array(z.object({ speaker: z.string(), de: z.string() }))
    .min(4)
    .max(14),
  englishGist: z.string(),
  glosses: z.array(z.object({ de: z.string(), en: z.string() })),
});
export type GeneratedDialogue = z.infer<typeof generatedDialogueSchema>;

export const generatedClozeSchema = z.object({
  items: z
    .array(
      z.object({
        sentence: z.string().describe("German sentence with ___ where the target word goes"),
        answer: z.string().describe("The exact missing word form"),
        lexemeId: z.string().describe("Id of the target lexeme, copied from the request"),
        hintEn: z.string().describe("Short English hint"),
      }),
    )
    .min(1)
    .max(8),
});
export type GeneratedCloze = z.infer<typeof generatedClozeSchema>;

export const generatedConstructSchema = z.object({
  items: z
    .array(
      z.object({
        promptEn: z.string().describe("English sentence the learner must say in German"),
        targetDe: z.string().describe("The expected German sentence"),
        acceptableAlternatives: z.array(z.string()).describe("Other fully correct German renderings"),
      }),
    )
    .min(1)
    .max(6),
});
export type GeneratedConstruct = z.infer<typeof generatedConstructSchema>;

export const conversationReplySchema = z.object({
  replyDe: z.string().describe("Your next German turn, inside the allowed vocabulary"),
  correction: z
    .object({
      original: z.string(),
      corrected: z.string(),
      noteEn: z.string().describe("One gentle English sentence explaining the fix"),
    })
    .nullable()
    .describe("Gentle inline correction of the learner's last turn, or null if it was fine"),
  newWordsUsed: z.array(z.string()).describe("Lexeme ids of any due words you wove in"),
});
export type ConversationReply = z.infer<typeof conversationReplySchema>;

/* ---------- Generation requests ---------- */

export interface GenerationSpec {
  kind: TaskKind;
  /** Lexeme ids the learner knows — the only words the LLM may use. */
  allowedLemmas: string[];
  /** Due/new lexeme ids that MUST appear (reviews live inside content). */
  targetLemmas: string[];
  newLemmas: string[];
  stage: SyntaxStage;
  coverageTarget: number;
  register: "colloquial" | "neutral";
  topic?: string;
  sentenceCount?: number;
}

const SYSTEM_PROMPT = `Write German learning content for one learner.
Use ONLY allowed-list words (any inflected form), plus names and numbers.
Every target word must appear. Natural spoken German, worth reading.`;

export function buildGenerationPrompt(
  spec: GenerationSpec,
  index: LexiconIndex,
): { system: string; prompt: string } {
  // Sorted so the list is byte-identical across a session's calls —
  // it leads the prompt as a stable prefix that providers can
  // prompt-cache (allowedLemmas arrives in Set-iteration order).
  const allowed = spec.allowedLemmas
    .map((id) => index.byId.get(id)?.lemma)
    .filter((lemma): lemma is string => Boolean(lemma))
    .sort((a, b) => a.localeCompare(b, "de"));
  const targets = spec.targetLemmas
    .map((id) => {
      const lexeme = index.byId.get(id);
      if (!lexeme) return null;
      const article = lexeme.gender ? `${lexeme.gender} ` : "";
      return `${article}${lexeme.lemma} (${lexeme.english})${
        spec.newLemmas.includes(id) ? " [NEW — gloss it]" : ""
      }`;
    })
    .filter((entry): entry is string => Boolean(entry));
  const constraints = stageConstraints(spec.stage);
  const lines = [
    `Allowed words: ${allowed.join(", ")}`,
    `Kind: ${spec.kind}.`,
    spec.topic ? `Topic: ${spec.topic}.` : null,
    `~${spec.sentenceCount ?? 6} sentences.`,
    constraints.promptDescription,
    `Register: ${spec.register === "colloquial" ? "casual spoken, modal particles welcome" : "neutral friendly"}.`,
    `Must include: ${targets.join("; ")}`,
  ].filter((line): line is string => Boolean(line));
  return { system: SYSTEM_PROMPT, prompt: lines.join("\n") };
}

/* ---------- Post-generation validation (the coverage contract) ---------- */

export interface ValidationIssue {
  kind: "coverage" | "missing-target" | "structure";
  detail: string;
}

/**
 * Validate generated German against the spec. The API layer re-prompts
 * once with the issues appended; content failing twice is discarded —
 * never serve content that breaks the comprehensibility promise.
 */
export function validateGenerated(
  germanText: string,
  spec: GenerationSpec,
  index: LexiconIndex,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set([...spec.allowedLemmas, ...spec.targetLemmas]);
  const report = analyzeCoverage(germanText, known, index);
  // Out-of-lexicon tokens may be proper nouns; only flag if plentiful.
  const effectiveCoverage =
    (report.knownTokens + Math.min(report.outOfLexicon.length, report.tokens * 0.02)) /
    Math.max(report.tokens, 1);
  if (effectiveCoverage < spec.coverageTarget - 0.05) {
    issues.push({
      kind: "coverage",
      detail: `Only ${(effectiveCoverage * 100).toFixed(0)}% of tokens are known to the learner (target ${(spec.coverageTarget * 100).toFixed(0)}%). Unknown words used: ${[...report.unknownInLexicon, ...report.outOfLexicon].slice(0, 12).join(", ")}`,
    });
  }
  const tokens = new Set(tokenize(germanText));
  for (const id of spec.targetLemmas) {
    const lexeme = index.byId.get(id);
    if (!lexeme) continue;
    const appears =
      tokens.has(lexeme.lemma.toLowerCase()) ||
      lexeme.forms.some((form) => tokens.has(form)) ||
      (lexeme.plural ? tokens.has(lexeme.plural.toLowerCase()) : false);
    if (!appears) {
      issues.push({
        kind: "missing-target",
        detail: `Required word "${lexeme.lemma}" never appears.`,
      });
    }
  }
  return issues;
}

/* ---------- Task specs (what the composer emits) ---------- */

export interface TaskSpec {
  kind: TaskKind;
  /** Estimated seconds this task takes. */
  seconds: number;
  /** Skill credited/updated by this task. */
  skill: "reading" | "listening" | "writing" | "speaking" | "grammar";
  /** Item difficulty (logit) for the ability update. */
  difficulty: number;
  /** For generated kinds. */
  generation?: GenerationSpec;
  /** For lexicon-local kinds (retrieval taps): the lexemes involved. */
  lexemeIds?: string[];
  /** For grammar bites. */
  biteId?: string;
  /** For HVPT. */
  contrastId?: string;
  /** Human note shown to the learner ("3 words are back for review"). */
  note?: string;
}
