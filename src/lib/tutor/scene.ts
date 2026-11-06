/**
 * Scene variations — "a second visit".
 *
 * A station's first visit always plays the scripted scene. On replays
 * the tutor may serve a variation: same place, same cast, same
 * objective, DIFFERENT events, inside the same coverage contract the
 * curriculum tests enforce on the authored scene (≥ coverageTarget
 * − 0.05 strict, − 0.10 lenient; every station lexeme present;
 * speakers from the cast; 10–18 lines; stage ceiling in the prompt).
 * Anything that fails both floors is replaced by the scripted scene.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { SceneLine, Station } from "../curriculum/types";
import type { LexiconIndex } from "../engine/lexicon/coverage";
import { analyzeCoverage } from "../engine/lexicon/coverage";
import { tokenize } from "../engine/lexicon/tokenize";
import { stageConstraints } from "../engine/syntax/stages";

export const MIN_LINES = 10;
export const MAX_LINES = 18;

export const sceneVariationSchema = z.object({
  lines: z
    .array(
      z.object({
        speaker: z.string().describe("Cast id exactly as listed, or 'narrator' or 'du'"),
        de: z.string().describe("The German line"),
        en: z.string().describe("Natural English for exactly this line"),
        noteEn: z.string().optional().describe("Optional one-line culture/register note"),
      }),
    )
    .describe("The whole scene in order, 10–18 lines, narration and dialogue interleaved"),
});
export type SceneVariation = z.infer<typeof sceneVariationSchema>;

const SYSTEM_PROMPT = `You write a scene variation for a German learner: the same place, the same characters and the same objective as the scripted scene, but different events — a second visit, not a retelling.
Every German word MUST come from the allowed list (any inflected form). First names and place names are the only exception.
Speakers use the cast ids given. "narrator" sets the scene in short sentences; "du" is the learner and speaks several lines.
English translations render meaning naturally, never word-for-word.`;

/**
 * Build the variation prompt. The sorted allowed-word list leads as a
 * stable prefix so provider prompt caching applies; the seed sits last
 * so two replays with the same vocabulary still get different scenes.
 */
export function buildVariationPrompt(
  station: Station,
  allowedIds: ReadonlySet<string>,
  index: LexiconIndex,
  seed: string,
): { system: string; prompt: string } {
  const allowed = [...allowedIds]
    .map((id) => index.byId.get(id)?.lemma)
    .filter((lemma): lemma is string => Boolean(lemma))
    .sort((a, b) => a.localeCompare(b, "de"));
  const must = station.vocabulary
    .map((lexeme) => `${lexeme.gender ? `${lexeme.gender} ` : ""}${lexeme.lemma} (${lexeme.english})`)
    .join("; ");
  const cast = station.scene.cast.map((c) => `${c.id} = ${c.name}, ${c.roleEn}`).join("; ");
  const original = station.scene.lines.map((line) => `${line.speaker}: ${line.de}`).join("\n");
  const lines = [
    `Allowed words: ${allowed.join(", ")}`,
    "",
    `Scene title: "${station.scene.title}" (${station.scene.titleEn}). Place: ${station.scene.place}.`,
    `Setting: ${station.scene.settingEn}`,
    `Objective the scene must serve: ${station.canDoEn}`,
    `Cast ids: ${cast}; plus "narrator" and "du" (the learner).`,
    `Must appear (any form): ${must || "nothing beyond the allowed list"}`,
    stageConstraints(station.stage).promptDescription,
    `Length: ${MIN_LINES}–${MAX_LINES} lines.`,
    `The scripted first visit, for reference — do NOT reuse its lines or its events:\n${original}`,
    `Variation seed: ${seed}`,
  ];
  return { system: SYSTEM_PROMPT, prompt: lines.join("\n") };
}

export interface VariationIssue {
  kind: "coverage" | "missing-vocabulary" | "structure";
  detail: string;
}

/**
 * The coverage contract for a variation. Strict is the repair target;
 * lenient is the acceptance floor after the last attempt. The
 * vocabulary rule holds on both floors: a replay that drops the words
 * the station teaches would leave the Wörter beat without its scene.
 */
export function validateVariation(
  lines: SceneLine[],
  station: Station,
  allowedIds: ReadonlySet<string>,
  index: LexiconIndex,
  opts: { strict?: boolean; coverageTarget?: number } = {},
): VariationIssue[] {
  const strict = opts.strict ?? true;
  const target = opts.coverageTarget ?? 0.95;
  const tolerance = strict ? 0.05 : 0.1;
  const issues: VariationIssue[] = [];

  if (lines.length < MIN_LINES || lines.length > MAX_LINES) {
    issues.push({ kind: "structure", detail: `${lines.length} lines; the scene needs ${MIN_LINES}–${MAX_LINES}.` });
  }

  const speakers = new Set(["narrator", "du", ...station.scene.cast.map((c) => c.id)]);
  const badSpeakers = [...new Set(lines.map((line) => line.speaker).filter((s) => !speakers.has(s)))];
  if (badSpeakers.length > 0) {
    issues.push({ kind: "structure", detail: `Unknown speakers: ${badSpeakers.join(", ")}. Use only: ${[...speakers].join(", ")}.` });
  }
  if (!lines.some((line) => line.speaker === "du")) {
    issues.push({ kind: "structure", detail: 'The learner ("du") never speaks.' });
  }

  const text = lines.map((line) => line.de).join(" ");
  const known = new Set([...allowedIds, ...station.vocabulary.map((lexeme) => lexeme.id)]);
  const report = analyzeCoverage(text, known, index);
  // Proper nouns are free: the 2-token/2% slack the episode route uses.
  const slack = Math.max(2, Math.ceil(report.tokens * 0.02));
  const effective = (report.knownTokens + Math.min(report.outOfLexicon.length, slack)) / Math.max(report.tokens, 1);
  if (effective < target - tolerance) {
    const offenders = [...report.unknownInLexicon, ...report.outOfLexicon].slice(0, 12);
    issues.push({
      kind: "coverage",
      detail: `Coverage ${(effective * 100).toFixed(0)}% is below ${((target - tolerance) * 100).toFixed(0)}%. Replace or remove: ${offenders.join(", ")}`,
    });
  }

  const tokens = new Set(tokenize(text));
  for (const lexeme of station.vocabulary) {
    const forms = [lexeme.lemma, ...(lexeme.plural ? [lexeme.plural] : []), ...lexeme.forms].map((f) => f.toLowerCase());
    if (!forms.some((form) => tokens.has(form))) {
      issues.push({ kind: "missing-vocabulary", detail: `Station word "${lexeme.lemma}" never appears.` });
    }
  }

  // "Different events": a variation that copies most of the script
  // is not a second visit. Strict only — a near-copy that passed
  // everything else still beats nothing on the last attempt.
  if (strict && lines.length > 0) {
    const original = new Set(station.scene.lines.map((line) => line.de.trim().toLowerCase()));
    const copied = lines.filter((line) => original.has(line.de.trim().toLowerCase())).length;
    if (copied / lines.length > 0.5) {
      issues.push({ kind: "structure", detail: `${copied} of ${lines.length} lines are copied from the scripted scene; tell new events.` });
    }
  }

  return issues;
}

/**
 * Cache key: model + station + the allowed vocabulary (a learner who
 * learns a word should get a scene that may use it) + seed. Allowed
 * ids are sorted and hashed so the key stays short and order-free.
 */
export function variationCacheKey(
  model: string,
  stationId: string,
  allowedIds: ReadonlySet<string>,
  seed: string,
): string {
  const vocab = createHash("sha256").update([...allowedIds].sort().join(",")).digest("hex").slice(0, 16);
  return createHash("sha256").update(["scene-variation", model, stationId, vocab, seed].join("\u0000")).digest("hex");
}
