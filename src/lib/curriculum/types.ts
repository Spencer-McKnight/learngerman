/**
 * Curriculum types — the hand-authored course.
 *
 * A Line is a chapter of the learner's new life in Erlangen; a Station is
 * one lesson on it. Every station ships complete: a scripted scene, the
 * vocabulary it introduces, comprehension checks, speaking material, a
 * performance that proves the can-do, and Jule's briefing/debrief. The
 * engine adapts how a station is played; the tutor personalises its
 * words. Nothing here calls the model or reads learner state.
 *
 * Authoring rules (enforced by src/lib/curriculum/__tests__):
 * - every German line of a scene is ≥ 95% covered by the lexicon known
 *   at that station (seed lexicon + every lexeme introduced by earlier
 *   stations + this station's own `vocabulary`);
 * - every `vocabulary` lexeme appears in the scene;
 * - construct targets and performance lines obey the same coverage;
 * - ids are unique course-wide; stations never require a syntax stage
 *   above the one their line declares.
 */

import type { Lexeme } from "../engine/lexicon/types";
import type { CefrBand, SyntaxStage } from "../engine/types";

/** Who speaks a line. "narrator" is Act-1 narration; "du" is the learner. */
export type SpeakerId = "narrator" | "du" | "jule" | (string & {});

export interface Character {
  id: SpeakerId;
  /** Display name as it appears in the scene ("Frau Weber"). */
  name: string;
  /** One English clause for the cast list ("your downstairs neighbour"). */
  roleEn: string;
  /** Voice key from src/lib/audio/voices.ts (e.g. "conrad", "katja"). */
  voice: string;
}

export interface SceneLine {
  speaker: SpeakerId;
  de: string;
  /** Natural English for exactly this line. */
  en: string;
  /** Optional one-line note shown on tap ("'passt scho' — Franconian for 'that's fine'"). */
  noteEn?: string;
}

export interface Scene {
  /** Short German title shown on the station card ("Ein Kaffee, bitte"). */
  title: string;
  titleEn: string;
  /** One English sentence that sets the scene before audio starts. */
  settingEn: string;
  /** Where in Erlangen (used for the map pin and the station sign). */
  place: string;
  cast: Character[];
  /** The scene in order; narration and dialogue interleave freely. */
  lines: SceneLine[];
}

export type CheckKind = "choice" | "true-false" | "order";

export interface ComprehensionCheck {
  id: string;
  kind: CheckKind;
  /** Asked in the interface language; German quotes stay German. */
  promptEn: string;
  promptDe: string;
  /** For "choice": 3–4 options; for "true-false": exactly ["Richtig","Falsch"]; for "order": the pieces in correct order. */
  options: string[];
  /** Index into options ("order": ignored — the order itself is the answer). */
  answer: number;
  /** One sentence shown after answering, in English. */
  explainEn: string;
}

export interface ConstructItem {
  /** English sentence the learner must say in German, continuing the scene as "Du". */
  promptEn: string;
  targetDe: string;
  alternatives: string[];
  /** Syntax stage this production evidences. */
  stage: SyntaxStage;
}

export type PerformanceKind = "role-play" | "say-it" | "write-it";

/**
 * The proof of the can-do. A role-play is a short scripted exchange where
 * the learner speaks every "du" line (STT-scored); "say-it" asks for 2–3
 * free productions from English prompts; "write-it" the same, typed.
 */
export interface Performance {
  kind: PerformanceKind;
  /** The can-do statement this proves, in English. */
  canDoEn: string;
  /** One English sentence framing the situation ("You're at the counter. Order a Brezn and a coffee."). */
  situationEn: string;
  /** role-play: the exchange; the learner speaks each "du" line. */
  lines?: SceneLine[];
  /** say-it / write-it: prompts with accepted answers. */
  prompts?: ConstructItem[];
  /** The character the tutor voices if free conversation replaces the script. */
  counterpart?: SpeakerId;
}

export interface CoachNotes {
  /** Jule's hand-written briefing, 2–3 sentences, English with German quotes. */
  briefEn: string;
  /** What to listen for in the scene, as 1–3 short bullets. */
  listenForEn: string[];
  /** Jule's hand-written debrief, 1–2 sentences. */
  debriefEn: string;
  /** Culture or register aside shown at the end, optional. */
  asideEn?: string;
}

export interface Station {
  /** Course-wide unique id, kebab-case, prefixed by line: "l1-bahnhof". */
  id: string;
  lineId: string;
  /** Position on the line, 1-based. */
  order: number;
  /** Station name as on a sign ("Hauptbahnhof"). */
  name: string;
  /** Lesson title (German) + English. */
  title: string;
  titleEn: string;
  /** The can-do this station teaches; shown as the objective. */
  canDoEn: string;
  /** Lexemes this station INTRODUCES (full Lexeme entries; ids unique course-wide). */
  vocabulary: Lexeme[];
  /** Lexeme ids this station re-uses from earlier that deserve a retrieval tap. */
  reviewIds?: string[];
  /** Grammar bite id from the engine curriculum this station teaches, if any. */
  grammarBiteId?: string;
  /** Minimal-pair contrast id this station pins for ear training, if any. */
  earContrastId?: string;
  /** Highest syntax stage the scene asks the learner to PRODUCE. */
  stage: SyntaxStage;
  scene: Scene;
  checks: ComprehensionCheck[];
  /** Line indices (into scene.lines) the learner shadows; 3–5 short ones. */
  shadowLineIndices: number[];
  construct: ConstructItem[];
  performance: Performance;
  coach: CoachNotes;
  /** Estimated minutes for a full first visit. */
  minutes: number;
}

export interface Line {
  /** "l1".."l5" */
  id: string;
  /** "Linie 1" */
  number: number;
  /** Line name ("Ankommen"). */
  name: string;
  nameEn: string;
  /** One-sentence arc in English. */
  arcEn: string;
  cefr: CefrBand;
  /** Hex colour for the line on the map (from the design system's line palette). */
  colour: string;
  /** Highest syntax stage any station on this line asks the learner to produce. */
  maxStage: SyntaxStage;
  stations: Station[];
  /**
   * True when the stations are fully authored. An outlined line has
   * objectives and vocabulary but its scenes are generated under the
   * coverage contract — shown honestly as "in Planung" on the map.
   */
  authored: boolean;
}

export type StationStatus = "locked" | "unseen" | "started" | "passed";

export interface StationProgress {
  stationId: string;
  status: Exclude<StationStatus, "locked">;
  /** Best performance grade 1–4 (FSRS-style), null until performed. */
  bestGrade: 1 | 2 | 3 | 4 | null;
  visits: number;
  lastVisitedAt: string | null;
  passedAt: string | null;
}
