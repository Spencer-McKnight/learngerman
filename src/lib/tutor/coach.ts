/**
 * Jule's briefing and debrief — prompts, schemas and the no-AI fallbacks.
 *
 * The hand-written `station.coach.*` is always the base. Without a
 * key the UI shows `fallbackBrief`/`fallbackDebrief`, which splice the
 * deterministic key performances into Jule's authored words. With a
 * key the model is asked to rewrite the same material around the same
 * key performances — it may choose among them or echo them, never add
 * its own. Length limits live in the schema `describe`s and in the
 * lenient `validateBrief`/`validateDebrief` checks (a 75-word brief is
 * fine; a 150-word one is a contract miss worth one repair).
 */

import { z } from "zod";
import type { Station } from "../curriculum/types";
import { JULE } from "./persona";
import type { KeyPerformance, LearnerSignals } from "./signals";

export type CoachLang = "de" | "en";

/* ---------- Results (what the lesson player reports back) ---------- */

export interface LessonStepResult {
  /** The beat kind ("understand", "words", "speak", "perform" …) or task kind. */
  stepKind: string;
  correct: boolean;
  /** Short human detail ("3/4 checks", "missed 'Brezn'"). */
  detail?: string;
}

export interface PerformanceUtterance {
  promptDe?: string;
  saidDe: string;
  expectedDe: string;
}

export interface LessonResult {
  steps: LessonStepResult[];
  /** 1=Again 2=Hard 3=Good 4=Easy, null when the performance was skipped. */
  performanceGrade: 1 | 2 | 3 | 4 | null;
  transcript?: PerformanceUtterance[];
}

/* ---------- Schemas ---------- */

export const briefSchema = z.object({
  briefEn: z
    .string()
    .describe("Jule's briefing for this station, at most 70 words, in the interface language"),
  listenForEn: z
    .array(z.string())
    .describe("2–3 short things to listen for in the scene, each quoting the German"),
  keyPerformances: z
    .array(z.object({ focusDe: z.string(), whyEn: z.string() }))
    .describe(
      "At most 2, chosen from the key performances you were given (echo focusDe exactly; you may rephrase whyEn in Jule's voice)",
    ),
});
export type Brief = z.infer<typeof briefSchema>;

export const debriefSchema = z.object({
  debriefEn: z
    .string()
    .describe(
      "Jule's honest debrief, at most 60 words: name what went well and the one thing to fix, in the interface language",
    ),
  nextTimeEn: z.string().describe("One sentence: what to watch next time"),
  mood: z.enum(["warm", "proud", "matter-of-fact"]),
});
export type Debrief = z.infer<typeof debriefSchema>;

/* ---------- Shared prompt pieces ---------- */

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The station block is byte-identical for every learner at this
 * station and leads the prompt, so provider prompt caching discounts
 * it; everything learner-specific follows.
 */
function stationBlock(station: Station): string {
  const cast = station.scene.cast.map((c) => `${c.name} (${c.roleEn})`).join("; ");
  const lines = station.scene.lines
    .map((line, i) => `${i + 1}. ${speakerName(station, line.speaker)}: ${line.de}`)
    .join("\n");
  return [
    `Station: ${station.name} — "${station.scene.title}" (${station.scene.titleEn})`,
    `Objective: ${station.canDoEn}`,
    `Setting: ${station.scene.settingEn} Place: ${station.scene.place}.`,
    `Cast: ${cast}`,
    `Scene:\n${lines}`,
    `Jule's hand-written briefing: ${station.coach.briefEn}`,
    `Hand-written listen-for: ${station.coach.listenForEn.join(" | ")}`,
    `Hand-written debrief: ${station.coach.debriefEn}`,
    `Performance (${station.performance.kind}): ${station.performance.situationEn}`,
  ].join("\n");
}

function speakerName(station: Station, speaker: string): string {
  if (speaker === "du") return "Du";
  if (speaker === "narrator") return "Narrator";
  return station.scene.cast.find((c) => c.id === speaker)?.name ?? speaker;
}

function signalsBlock(signals: LearnerSignals): string {
  const lapsing = signals.lapsingWords.map((w) => `${w.lemma} (${w.english}, slipped ${w.lapses}×)`).join("; ");
  return [
    "Learner data (the ONLY facts you may use about the learner):",
    `- lapsing words: ${lapsing || "none"}`,
    `- weak stage: ${
      signals.weakStage
        ? `${signals.weakStage.name}, ${Math.round(signals.weakStage.successRate * 100)}% over ${signals.weakStage.attempts} attempts`
        : "none"
    }`,
    `- weak ear contrast: ${
      signals.weakContrast ? `${signals.weakContrast.label} at ${Math.round(signals.weakContrast.accuracy * 100)}%` : "none"
    }`,
    `- grammar bite in progress: ${signals.biteInProgress?.title ?? "none"}`,
    `- speaking rung: ${signals.rung}`,
    `- strengths: ${signals.strengths.join("; ") || "nothing stands out yet"}`,
    `- active days this week: ${signals.sessionsThisWeek}`,
  ].join("\n");
}

const langLine = (lang: CoachLang) =>
  lang === "de"
    ? "Interface language: German. Write briefEn/listenForEn/debriefEn/nextTimeEn in simple A2-level German, keep the scene quotes unchanged, and keep whyEn in German too."
    : "Interface language: English.";

/* ---------- Prompts ---------- */

export function buildBriefPrompt(
  station: Station,
  signals: LearnerSignals,
  keyPerformances: KeyPerformance[],
  lang: CoachLang,
): { system: string; prompt: string } {
  const kps = keyPerformances.map((kp, i) => `${i + 1}. [${kp.kind}] ${kp.focusDe} — ${kp.whyEn}`).join("\n");
  const prompt = [
    stationBlock(station),
    "",
    signalsBlock(signals),
    "",
    `Key performances the engine picked for this learner (choose at most 2 of these, never others):\n${kps || "none — then return an empty keyPerformances array"}`,
    "",
    langLine(lang),
    `Write Jule's briefing for "${station.scene.title}": rewrite the hand-written briefing around the learner data and the key performances. Lead with the objective in your own words, name the key performances concretely, mention a strength only if the data lists one.`,
  ].join("\n");
  return { system: JULE.systemPrompt, prompt };
}

function resultsBlock(results: LessonResult): string {
  const steps = results.steps.map((s) => `- ${s.stepKind}: ${s.correct ? "ok" : "missed"}${s.detail ? ` (${s.detail})` : ""}`).join("\n");
  const grade = results.performanceGrade === null ? "skipped" : ["", "Again", "Hard", "Good", "Easy"][results.performanceGrade];
  const transcript = (results.transcript ?? [])
    .slice(0, 8)
    .map((u) => `- expected "${u.expectedDe}", said "${u.saidDe}"${u.promptDe ? ` (prompt: ${u.promptDe})` : ""}`)
    .join("\n");
  return [
    "What happened in this visit:",
    steps || "- no steps reported",
    `Performance grade: ${grade}`,
    transcript ? `Performance transcript:\n${transcript}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildDebriefPrompt(
  station: Station,
  results: LessonResult,
  signals: LearnerSignals,
  lang: CoachLang,
): { system: string; prompt: string } {
  const prompt = [
    stationBlock(station),
    "",
    signalsBlock(signals),
    "",
    resultsBlock(results),
    "",
    langLine(lang),
    `Write Jule's debrief for "${station.scene.title}": honest, specific, name what went well and the ONE thing to fix (quote the German where the transcript shows it). mood is "proud" only for a Good/Easy performance with few misses, "matter-of-fact" when most steps were missed or the performance was skipped, otherwise "warm".`,
  ].join("\n");
  return { system: JULE.systemPrompt, prompt };
}

/* ---------- Lenient validation (drives one repair, then fallback) ---------- */

export interface CoachIssue {
  detail: string;
}

/**
 * Soft contract: generous word limits (schema says 70, we accept up to
 * ~1.6×), no "fluent", no run of exclamation marks, and key
 * performances must come from the offered set.
 */
export function validateBrief(brief: Brief, offered: KeyPerformance[]): CoachIssue[] {
  const issues: CoachIssue[] = [];
  if (wordCount(brief.briefEn) > 110) issues.push({ detail: `briefEn is ${wordCount(brief.briefEn)} words; keep it under 70.` });
  if (brief.listenForEn.length < 1 || brief.listenForEn.length > 4) issues.push({ detail: "listenForEn needs 2–3 items." });
  issues.push(...voiceIssues(brief.briefEn));
  const allowed = new Set(offered.map((kp) => kp.focusDe.trim().toLowerCase()));
  for (const kp of brief.keyPerformances) {
    if (!allowed.has(kp.focusDe.trim().toLowerCase())) {
      issues.push({ detail: `keyPerformances.focusDe "${kp.focusDe}" was not one of the offered focuses.` });
    }
  }
  if (brief.keyPerformances.length > 2) issues.push({ detail: "At most 2 key performances." });
  return issues;
}

export function validateDebrief(debrief: Debrief): CoachIssue[] {
  const issues: CoachIssue[] = [];
  if (wordCount(debrief.debriefEn) > 95) issues.push({ detail: `debriefEn is ${wordCount(debrief.debriefEn)} words; keep it under 60.` });
  if (wordCount(debrief.nextTimeEn) > 40) issues.push({ detail: "nextTimeEn must be one sentence." });
  issues.push(...voiceIssues(debrief.debriefEn), ...voiceIssues(debrief.nextTimeEn));
  return issues;
}

function voiceIssues(text: string): CoachIssue[] {
  const issues: CoachIssue[] = [];
  if (/\bfluent\b/i.test(text)) issues.push({ detail: 'Never use the word "fluent".' });
  if (/!{2,}/.test(text)) issues.push({ detail: "No runs of exclamation marks." });
  return issues;
}

/* ---------- Fallbacks (what the UI shows with no key) ---------- */

/** Capitalise the first letter of a sentence fragment. */
const sentence = (fragment: string): string => fragment.charAt(0).toUpperCase() + fragment.slice(1).replace(/\.?$/, ".");

/**
 * Jule's authored briefing plus the deterministic key performances,
 * composed into one or two extra sentences. English only: the
 * hand-written material is English by the authoring contract.
 */
export function fallbackBrief(station: Station, keyPerformances: KeyPerformance[]): Brief {
  const extras = keyPerformances.map((kp) => sentence(kp.whyEn));
  const lead = extras.length === 2 ? "Two things for you today. " : extras.length === 1 ? "One thing for you today. " : "";
  return {
    briefEn: [station.coach.briefEn.trim(), lead + extras.join(" ")].filter(Boolean).join(" ").trim(),
    listenForEn: station.coach.listenForEn.slice(0, 3),
    keyPerformances: keyPerformances.slice(0, 2).map(({ focusDe, whyEn }) => ({ focusDe, whyEn })),
  };
}

const STEP_LABELS: Record<string, string> = {
  understand: "the comprehension checks",
  words: "the retrieval taps",
  grammar: "the Baustein drill",
  speak: "the speaking rung",
  ear: "the ear drill",
  perform: "the Leistung",
  scene: "the scene",
};

const stepLabel = (kind: string): string => STEP_LABELS[kind] ?? kind.replace(/-/g, " ");

/**
 * Honest arithmetic over the results: what landed, the one thing to
 * fix (the first missed step, or the first transcript miss), and a
 * mood the numbers support.
 */
export function fallbackDebrief(station: Station, results: LessonResult): Debrief {
  const total = results.steps.length;
  const landed = results.steps.filter((s) => s.correct).length;
  const firstMiss = results.steps.find((s) => !s.correct);
  const transcriptMiss = results.transcript?.find((u) => u.saidDe.trim().toLowerCase() !== u.expectedDe.trim().toLowerCase());
  const grade = results.performanceGrade;

  const mood: Debrief["mood"] =
    grade !== null && grade >= 3 && (total === 0 || landed / total >= 0.7)
      ? grade === 4 && landed === total
        ? "proud"
        : "warm"
      : grade === null || (total > 0 && landed / total < 0.5)
        ? "matter-of-fact"
        : "warm";

  const tally = total > 0 ? `${landed} of ${total} steps landed.` : "";
  const performance =
    grade === null
      ? "You skipped the Leistung, so I cannot tell you how it went."
      : grade >= 3
        ? `The Leistung was ${grade === 4 ? "easy for you" : "good"}.`
        : "The Leistung was shaky.";
  const fix = transcriptMiss
    ? `The one thing to fix: you said "${transcriptMiss.saidDe}" where the line was "${transcriptMiss.expectedDe}".`
    : firstMiss
      ? `The one thing to fix: ${stepLabel(firstMiss.stepKind)}${firstMiss.detail ? ` (${firstMiss.detail})` : ""}.`
      : total > 0
        ? "Nothing to fix this time. Passt scho."
        : "";

  const debriefEn = [station.coach.debriefEn.trim(), tally, performance, fix].filter(Boolean).join(" ");
  const nextTimeEn = transcriptMiss
    ? `Next time, say "${transcriptMiss.expectedDe}" out loud once before the Leistung starts.`
    : firstMiss
      ? `Next time, give ${stepLabel(firstMiss.stepKind)} one slow pass before you move on.`
      : grade === null
        ? `Next time, do the Leistung — it is the proof of "${station.scene.title}".`
        : `Next time, replay "${station.scene.title}" at street speed and see what still catches you.`;

  return { debriefEn, nextTimeEn, mood };
}
