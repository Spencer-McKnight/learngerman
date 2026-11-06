/**
 * Free conversation inside a station — the tutor plays a cast member
 * (Jule by default) continuing the scene's situation, under the same
 * vocabulary and stage ceiling as everything else served. Pure: the
 * route owns auth, cache and the model call.
 */

import { z } from "zod";
import type { SpeakerId, Station } from "../curriculum/types";
import type { LexiconIndex } from "../engine/lexicon/coverage";
import { stageConstraints } from "../engine/syntax/stages";
import type { SyntaxStage } from "../engine/types";
import { JULE } from "./persona";

export const converseReplySchema = z.object({
  replyDe: z.string().describe("Your next German turn in character, 1–2 short sentences, inside the allowed vocabulary"),
  replyEn: z.string().describe("Natural English translation of your turn"),
  correction: z
    .object({
      original: z.string(),
      corrected: z.string(),
      noteEn: z.string().describe("One gentle English sentence explaining the fix"),
    })
    .nullable()
    .describe("At most one gentle correction of the learner's last turn, or null if it was fine or there was no learner turn"),
  endsScene: z.boolean().describe("True when the situation has reached a natural end (goodbye, order complete, door closed)"),
});
export type ConverseReply = z.infer<typeof converseReplySchema>;

export interface ConverseTurn {
  role: "tutor" | "learner";
  text: string;
}

const SYSTEM = `You play one character in a scene from a German learner's life in Erlangen and keep the situation going.
Use ONLY allowed-list words (any inflected form), plus names and numbers. 1–2 short sentences per turn; end with something the learner can answer.
Stay in character and in the situation; never explain grammar in German. Corrections go only in the correction field, gently, at most one.`;

/** Resolve the counterpart: a cast member of this station, else Jule. */
export function resolveCounterpart(
  station: Station,
  counterpart: SpeakerId | undefined,
): { id: SpeakerId; name: string; roleEn: string } {
  const member = counterpart ? station.scene.cast.find((c) => c.id === counterpart) : undefined;
  if (member) return { id: member.id, name: member.name, roleEn: member.roleEn };
  return { id: "jule", name: JULE.name, roleEn: "your German teacher, dropping by the scene" };
}

/**
 * Cache-shaped: sorted allowed list first, then the (stable) station
 * block, then the per-turn transcript. Only the last 12 turns travel.
 */
export function buildConversePrompt(
  station: Station,
  allowedIds: ReadonlySet<string>,
  index: LexiconIndex,
  stage: SyntaxStage,
  counterpart: SpeakerId | undefined,
  history: ConverseTurn[],
): { system: string; prompt: string; counterpart: ReturnType<typeof resolveCounterpart> } {
  const allowed = [...allowedIds]
    .map((id) => index.byId.get(id)?.lemma)
    .filter((lemma): lemma is string => Boolean(lemma))
    .sort((a, b) => a.localeCompare(b, "de"));
  const who = resolveCounterpart(station, counterpart);
  const transcript = history
    .slice(-12)
    .map((turn) => `${turn.role === "tutor" ? who.name : "Lernende:r"}: ${turn.text}`)
    .join("\n");
  const prompt = [
    `Allowed words: ${allowed.join(", ")}`,
    "",
    `Scene: "${station.scene.title}" at ${station.scene.place}. ${station.scene.settingEn}`,
    `Objective for the learner: ${station.canDoEn}`,
    `You are ${who.name} (${who.roleEn}). The learner is "du".`,
    stageConstraints(stage).promptDescription,
    "",
    history.length === 0
      ? "Open the conversation in character with one short line the learner can answer."
      : `Conversation so far:\n${transcript}\n\nReply to the last turn.`,
  ].join("\n");
  return { system: SYSTEM, prompt, counterpart: who };
}
