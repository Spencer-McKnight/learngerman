/**
 * Task types the app can serve. Content for generated kinds no longer
 * lives per-task: the whole session draws from one Episode (see
 * episode.ts), so a TaskSpec names the episode section it plays plus
 * everything needed for grading. The engine never calls the LLM
 * itself — it produces an EpisodeSpec the API layer executes, keeping
 * the whole engine pure and testable.
 */

import { z } from "zod";
import type { LexiconIndex } from "../lexicon/coverage";
import { analyzeCoverage } from "../lexicon/coverage";
import { tokenize } from "../lexicon/tokenize";
import type { SyntaxStage } from "../types";
import type { EpisodeSection } from "./episode";

/** Every kind of task a session can contain. */
export type TaskKind =
  | "story-read" // Act 1 — the scene's narration (reviews live inside)
  | "dialogue-read" // Act 2 — the scene's conversation
  | "listen-clip" // same content, audio-first
  | "retrieval-tap" // fast form–meaning taps for new words
  | "cloze-type" // rebuild a line of the scene from memory
  | "construct-sentence" // Language-Transfer-style: build before reveal
  | "shadowing" // repeat-after-audio, STT-scored
  | "hvpt-pair" // which word did you hear?
  | "grammar-bite" // one-screen explanation + drill
  | "scripted-dialogue" // learner speaks their turns of the scene's dialogue
  | "timed-recall" // Pimsleur-style recall under mild time pressure
  | "conversation-turn"; // free AI conversation about the scene

/* ---------- Conversation (the one remaining per-turn generation) ---------- */

export const conversationReplySchema = z.object({
  replyDe: z.string().describe("Your next German turn, inside the allowed vocabulary"),
  replyEn: z.string().describe("Natural English translation of your turn"),
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

/** Parameters a single-text generation (conversation turns) runs under. */
export interface GenerationSpec {
  kind: TaskKind;
  /** Lexeme ids the learner knows — the only words the LLM may use. */
  allowedLemmas: string[];
  /** Due/new lexeme ids that MUST appear. */
  targetLemmas: string[];
  newLemmas: string[];
  stage: SyntaxStage;
  coverageTarget: number;
  register: "colloquial" | "neutral";
  topic?: string;
  sentenceCount?: number;
}

/* ---------- Post-generation validation (the coverage contract) ---------- */

export interface ValidationIssue {
  kind: "coverage" | "missing-target" | "structure";
  detail: string;
}

/**
 * Validate generated German against its spec. The API layer re-prompts
 * once with the issues; content failing twice is discarded — we never
 * serve content that breaks the comprehensibility promise.
 */
export function validateGenerated(
  germanText: string,
  spec: GenerationSpec,
  index: LexiconIndex,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set([...spec.allowedLemmas, ...spec.targetLemmas]);
  const report = analyzeCoverage(germanText, known, index);

  // Out-of-lexicon tokens get a 2-token/2% slack (names, numbers).
  const effective =
    (report.knownTokens + Math.min(report.outOfLexicon.length, Math.max(2, report.tokens * 0.02))) /
    Math.max(report.tokens, 1);
  if (effective < spec.coverageTarget - 0.05) {
    issues.push({
      kind: "coverage",
      detail: `Known-word coverage ${(effective * 100).toFixed(0)}% is below the target (${(spec.coverageTarget * 100).toFixed(0)}%). Replace or remove: ${[...report.unknownInLexicon, ...report.outOfLexicon].slice(0, 12).join(", ")}`,
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
  /** Estimated seconds the task takes. */
  seconds: number;
  /** Skill credited/updated by the task. */
  skill: "reading" | "listening" | "writing" | "speaking" | "grammar";
  /** Item difficulty (logit) for the ability update. */
  difficulty: number;
  /** Which part of the session's episode this task plays. */
  section?: EpisodeSection;
  /** Lexemes graded by this task (retrieval taps, cloze, scene targets). */
  lexemeIds?: string[];
  /** For grammar bites. */
  biteId?: string;
  /** For HVPT. */
  contrastId?: string;
  /** Human note shown to the learner ("3 words are back for review"). */
  note?: string;
}
