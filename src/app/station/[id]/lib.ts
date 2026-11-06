/**
 * Shared helpers of the station player: the lexicon index the beats
 * gloss and grade against, the voice of every speaker, retrieval
 * distractors, honest grading rules, outcome builders and the prop
 * contract every beat component receives. Pure where it can be.
 */

import type { SceneLine, SpeakerId, Station } from "@/lib/curriculum/types";
import { COURSE_LEXICON } from "@/lib/curriculum";
import type { Lexeme, LexiconIndex, ReviewOutcome, StageObservation, SyntaxStage } from "@/lib/engine";
import { analyzeProduction, buildIndex, resolveToken, scoreSentence, tokenize } from "@/lib/engine";
import type { LessonMode, LessonPlan, StepSpec } from "@/lib/engine/session/lesson";
import type { Gender } from "@/components/ui";
import type { Brief, PerformanceUtterance } from "@/lib/tutor/coach";
import type { KeyPerformance } from "@/lib/tutor/signals";

export type Grade = 1 | 2 | 3 | 4;

/** The whole course lexicon, indexed once per client. */
export const INDEX: LexiconIndex = buildIndex(COURSE_LEXICON);

/* ---------- Voices ---------- */

/** The learner's own lines are voiced by a neutral multilingual voice. */
const DU_VOICE = "florian";
const NARRATOR_VOICE = "katja";

/** Voice key for a speaker: cast member → their voice; narrator, Jule and "du" have defaults. */
export function voiceFor(station: Station, speaker: SpeakerId): string {
  const member = station.scene.cast.find((c) => c.id === speaker);
  if (member) return member.voice;
  if (speaker === "jule") return "jule";
  if (speaker === "du") return DU_VOICE;
  return NARRATOR_VOICE;
}

/** Display name for a speaker; `youLabel` is the chrome word for "Du". */
export function speakerName(station: Station, speaker: SpeakerId, youLabel: string): string {
  if (speaker === "du") return youLabel;
  const member = station.scene.cast.find((c) => c.id === speaker);
  if (member) return member.name;
  if (speaker === "jule") return "Jule";
  return "";
}

/** Slow first listen, then street speed. */
export const RATE_SLOW = 0.85;
export const RATE_STREET = 1.0;

/* ---------- Glosses ---------- */

export interface Gloss {
  lexemeId: string;
  lemma: string;
  english: string;
  gender?: Gender;
  /** True when the token is a compound whose head noun we know. */
  compound?: boolean;
}

function cleanToken(token: string): string {
  return token.replace(/[^\p{L}'’-]/gu, "").toLowerCase();
}

/** Resolve one surface token (as it appears in text) to its gloss, or null. */
export function glossFor(token: string): Gloss | null {
  const clean = cleanToken(token);
  if (!clean) return null;
  const direct = INDEX.byForm.get(clean);
  const id = direct?.[0];
  if (id) {
    const lexeme = INDEX.byId.get(id);
    if (lexeme) return { lexemeId: id, lemma: lexeme.lemma, english: lexeme.english, gender: lexeme.gender };
  }
  const { compoundOf } = resolveToken(clean, INDEX);
  if (compoundOf) {
    const head = INDEX.byId.get(compoundOf);
    if (head) return { lexemeId: compoundOf, lemma: head.lemma, english: `… ${head.english}`, gender: head.gender, compound: true };
  }
  return null;
}

/** "die Bäckerei — bakery" for nouns, "to pay" otherwise. */
export function glossText(gloss: Gloss): string {
  return gloss.gender ? `${gloss.gender} ${gloss.lemma} — ${gloss.english}` : gloss.english;
}

/** Every surface form of a lexeme, lowercased, for matching inside lines. */
export function formsOf(lexeme: Lexeme): Set<string> {
  return new Set([lexeme.lemma, ...(lexeme.plural ? [lexeme.plural] : []), ...lexeme.forms].map((f) => f.toLowerCase()));
}

/** The first scene line (of the lines in use) that carries a lexeme. */
export function sceneLineFor(lines: SceneLine[], lexemeId: string): SceneLine | null {
  const lexeme = INDEX.byId.get(lexemeId);
  if (!lexeme) return null;
  const forms = formsOf(lexeme);
  return lines.find((line) => tokenize(line.de).some((token) => forms.has(token))) ?? null;
}

/* ---------- Deterministic shuffles & distractors ---------- */

/** A tiny LCG so the same seed always yields the same order (render stays pure). */
export function seededOrder<T>(items: readonly T[], seed: number): T[] {
  let state = (Math.abs(Math.floor(seed)) % 2147483647) + 1;
  const next = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A stable hash of a string for seeding. */
export function hashSeed(text: string): number {
  let hash = 7;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
  return hash;
}

/**
 * Three English distractors for a lexeme: same part of speech, scanned
 * from a rank-based start, falling back to any part of speech. Every
 * scan is bounded by the pool's length — it never loops forever.
 */
export function distractorsFor(lexeme: Lexeme, count = 3): string[] {
  const picked: string[] = [];
  const same = INDEX.ordered.filter((c) => c.id !== lexeme.id && c.pos === lexeme.pos);
  const any = INDEX.ordered.filter((c) => c.id !== lexeme.id);
  for (const pool of [same, any]) {
    if (pool.length === 0) continue;
    const start = (lexeme.rank * 7 + hashSeed(lexeme.id)) % pool.length;
    for (let i = 0; i < pool.length && picked.length < count; i++) {
      const english = pool[(start + i) % pool.length].english;
      if (english !== lexeme.english && !picked.includes(english)) picked.push(english);
    }
    if (picked.length >= count) break;
  }
  return picked;
}

/* ---------- Grading ---------- */

export interface SentenceGrade {
  grade: Grade;
  accuracy: number;
  orderIssue: boolean;
}

/** Grade a produced sentence against a target and its alternatives (best match wins). */
export function gradeSentence(answer: string, targets: string[]): SentenceGrade {
  let best = { accuracy: 0, orderCorrect: false };
  for (const target of targets) {
    const score = scoreSentence(answer, target);
    if (score.accuracy > best.accuracy || (score.accuracy === best.accuracy && score.orderCorrect)) best = score;
  }
  const grade: Grade = best.accuracy >= 0.85 && best.orderCorrect ? 3 : best.accuracy >= 0.6 ? 2 : 1;
  return { grade, accuracy: best.accuracy, orderIssue: best.accuracy >= 0.6 && !best.orderCorrect };
}

/** Syntax evidence of a production: the highest stage attempted and whether it came out right. */
export function stageEvidence(sentence: string): Pick<ReviewOutcome, "stageAttempted" | "stageSuccess"> {
  const observations: StageObservation[] = analyzeProduction(sentence, INDEX);
  if (observations.length === 0) return {};
  const top = observations.reduce<number>((max, o) => Math.max(max, o.stage), 0) as SyntaxStage;
  return { stageAttempted: top, stageSuccess: observations.some((o) => o.stage === top && o.success) };
}

export function meanGrade(grades: Grade[]): Grade {
  if (grades.length === 0) return 2;
  const mean = grades.reduce((sum, g) => sum + g, 0) / grades.length;
  return Math.min(4, Math.max(1, Math.round(mean))) as Grade;
}

export function gradesFor(ids: string[], grade: Grade): ReviewOutcome["lexemeGrades"] {
  return Object.fromEntries(ids.map((id) => [id, grade]));
}

/** One graded interaction, shaped for POST /api/review. */
export function outcomeFor(
  step: StepSpec,
  taskKind: string,
  correct: boolean,
  lexemeGrades: ReviewOutcome["lexemeGrades"] = {},
  extra: Partial<ReviewOutcome> = {},
): ReviewOutcome {
  return { taskKind, skill: step.skill, correct, lexemeGrades, difficulty: step.difficulty, ...extra };
}

/* ---------- The beat contract ---------- */

export interface CoachState {
  status: "loading" | "ready";
  brief: Brief | null;
  keyPerformances: KeyPerformance[];
  source: "model" | "fallback" | "none";
}

export interface SceneState {
  status: "ready" | "loading";
  lines: SceneLine[];
  source: "scripted" | "model";
}

export interface BeatResult {
  stepKind: string;
  correct: boolean;
  detail?: string;
}

/** What a beat hands back when it finishes. */
export interface FinishInfo {
  correct: boolean;
  detail?: string;
  performanceGrade?: Grade;
  transcript?: PerformanceUtterance[];
}

export interface BeatProps {
  station: Station;
  step: StepSpec;
  plan: LessonPlan;
  /** The scene lines in use — scripted, or the model's variation. */
  lines: SceneLine[];
  scene: SceneState;
  coach: CoachState;
  visits: number;
  mode: LessonMode;
  sessionId: string;
  /** Beats finished so far (for the debrief). */
  results: BeatResult[];
  performanceGrade: Grade | null;
  transcript: PerformanceUtterance[];
  /** Everything submitted so far (for honest numbers at the end). */
  outcomes: ReviewOutcome[];
  /** True when the learner tapped something on a previous beat (audio may autoplay). */
  autoplay: boolean;
  submit: (outcome: ReviewOutcome) => void;
  finish: (info: FinishInfo) => void;
  /** depart only: milestones returned by PATCH /api/lesson. */
  onMilestones: (events: MilestoneLike[]) => void;
}

export interface MilestoneLike {
  kind: string;
  label: string;
  detail: string;
}

/** Honest numbers for the departure screen, from what was actually submitted. */
export function tallyOutcomes(outcomes: ReviewOutcome[], newIds: string[]) {
  const met = new Set<string>(newIds);
  const back = new Set<string>();
  let seconds = 0;
  for (const outcome of outcomes) {
    for (const [id, grade] of Object.entries(outcome.lexemeGrades)) {
      met.add(id);
      if (grade >= 3) back.add(id);
    }
    seconds += outcome.inputSeconds ?? 0;
  }
  return { wordsMet: met.size, wordsBack: back.size, minutes: Math.round(seconds / 60) };
}

/** Beats whose first screen needs no gesture before audio (none autoplay cold). */
export function beatLabel(kind: string, labels: Record<string, string>): string {
  return labels[kind] ?? kind;
}
