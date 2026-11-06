/**
 * The lesson composer — turns one hand-authored Station plus the
 * learner's state into a LessonPlan: the nine beats of the station
 * ritual (docs/v5-architecture.md), each sized and gated by the engine.
 *
 * The curriculum owns the content; this module owns the adaptation:
 *   - which due words the scene itself credits (reviews live inside content)
 *   - how many retrieval taps, and for which words
 *   - whether a grammar bite is served (and that the station's own bite
 *     is never served before the staircase says the learner is ready)
 *   - which speaking rung the Sprechen beat plays at
 *   - which ear contrast, blocked before interleaved
 *   - whether the performance runs scripted or as free conversation
 *   - trimming to the time budget without ever dropping a core beat
 *
 * Pure: no persistence, no model calls. Detour modes reuse the same
 * beats so the home screen's "small optional branches" stay honest.
 */

import type { Station } from "../../curriculum/types";
import type { LearnerSnapshot, SkillId, SpeakingRung, SyntaxStage } from "../types";
import type { LexiconIndex } from "../lexicon/coverage";
import { analyzeCoverage } from "../lexicon/coverage";
import { dueWords, isKnown, retrievability } from "../scheduler/scheduler";
import { itemDifficulty, pSuccess } from "../ability/elo";
import { CURRICULUM, nextGrammarBite } from "../grammar/curriculum";
import { CONTRASTS, nextContrast } from "../ear/hvpt";

export type StepKind =
  | "arrive"
  | "scene"
  | "understand"
  | "words"
  | "grammar"
  | "speak"
  | "ear"
  | "perform"
  | "depart";

/** How the Sprechen beat is played, by speaking rung. */
export type SpeakMode = "shadow" | "construct" | "scripted" | "timed-recall";

export interface StepSpec {
  kind: StepKind;
  /** Estimated seconds the step takes. */
  seconds: number;
  /** Skill credited/updated by the step. */
  skill: SkillId;
  /** Item difficulty (logit) for the ability update. */
  difficulty: number;
  /** words: lexeme ids to tap — new ones first, then shaky/due ones. */
  lexemeIds?: string[];
  /** words/scene: ids the learner meets for the first time. */
  newLexemeIds?: string[];
  /** scene: due lexeme ids the scene text contains — credited on completion. */
  creditIds?: string[];
  /** scene: replay — serve a model-written variation when available. */
  variation?: boolean;
  /** grammar: the bite to teach/drill. */
  biteId?: string;
  /** ear: contrast + pair count. */
  contrastId?: string;
  pairCount?: number;
  /** speak: rung-dependent sub-mode and the scene lines it uses. */
  speak?: SpeakMode;
  lineIndices?: number[];
  /** perform: free conversation with the tutor replaces the script. */
  free?: boolean;
  /** Human note ("4 words come back today"). */
  note?: string;
}

export type LessonMode = "station" | "review" | "ear" | "speak" | "talk";

export interface LessonPlan {
  stationId: string;
  mode: LessonMode;
  steps: StepSpec[];
  totalSeconds: number;
  newLexemeIds: string[];
  dueLexemeIds: string[];
  /** True when the scene step asks for a variation (a replay). */
  variation: boolean;
  /** Honest one-liners for the arrival screen. */
  briefing: string[];
}

const SECONDS = {
  arrive: 40,
  scene: 150,
  understandPerCheck: 25,
  wordPerTap: 18,
  grammar: 120,
  shadowPerLine: 25,
  constructPerItem: 45,
  scriptedPerLine: 30,
  earPerPair: 10,
  perform: 180,
  depart: 40,
};

/** Beats that are never trimmed for time in station mode. */
const CORE: ReadonlySet<StepKind> = new Set([
  "arrive",
  "scene",
  "understand",
  "words",
  "speak",
  "perform",
  "depart",
]);

export interface ComposeOptions {
  mode?: LessonMode;
  /** How many times the learner has visited this station before. */
  visits?: number;
  briefingLang?: "de" | "en";
}

export function composeLesson(
  station: Station,
  snapshot: LearnerSnapshot,
  index: LexiconIndex,
  opts: ComposeOptions = {},
): LessonPlan {
  const { now } = snapshot;
  const mode = opts.mode ?? "station";
  const visits = opts.visits ?? 0;
  const english = opts.briefingLang === "en";
  const budgetSeconds = snapshot.minutesPerSession * 60;

  const wordsById = new Map(snapshot.words.map((word) => [word.lexemeId, word]));
  const knownIds = new Set(
    snapshot.words.filter((word) => isKnown(word, now)).map((word) => word.lexemeId),
  );
  const due = dueWords(snapshot.words, now);
  const dueIds = due.map((word) => word.lexemeId);

  // --- What this station teaches that the learner doesn't yet have.
  const stationIds = station.vocabulary.map((lexeme) => lexeme.id);
  const newIds = stationIds.filter((id) => !wordsById.has(id));
  // Shaky station words on a replay: introduced but not yet solid.
  const shakyIds = stationIds.filter((id) => {
    const word = wordsById.get(id);
    return word !== undefined && !newIds.includes(id) && retrievability(word, now) < 0.8;
  });

  // --- Reviews live inside content: due words the scene already contains.
  const sceneText = station.scene.lines.map((line) => line.de).join(" ");
  const sceneReport = analyzeCoverage(sceneText, new Set(dueIds), index);
  const creditIds = sceneReport.knownAppeared;
  const uncreditedDue = dueIds.filter((id) => !creditIds.includes(id));

  // --- Retrieval taps: new → shaky → station reviewIds (known) → due not in scene.
  const reviewIds = (station.reviewIds ?? []).filter((id) => wordsById.has(id));
  const tapIds = uniq([
    ...newIds,
    ...shakyIds,
    ...reviewIds.slice(0, 3),
    ...uncreditedDue,
  ]).slice(0, mode === "review" ? 16 : 12);

  // --- The grammar bite: the station's own when the staircase allows,
  // else whatever the curriculum says is ready. "Settled" bites are done.
  const readyBite = nextGrammarBite(snapshot.grammar, snapshot.syntax.stage);
  const own = station.grammarBiteId ? CURRICULUM.find((b) => b.id === station.grammarBiteId) : null;
  const ownStatus = own ? snapshot.grammar.bites[own.id] : undefined;
  const ownReady =
    own !== null &&
    own !== undefined &&
    ownStatus !== "settled" &&
    own.stageRequired <= snapshot.syntax.stage &&
    own.deps.every((dep) => snapshot.grammar.bites[dep] !== undefined);
  const bite = ownReady ? own : readyBite;

  // --- Ear: the station's pinned contrast until mastered, else the engine's pick.
  const pinned = station.earContrastId
    ? CONTRASTS.find((contrast) => contrast.id === station.earContrastId) ?? null
    : null;
  const pinnedMastered = snapshot.ear.some(
    (state) => state.contrastId === pinned?.id && state.mastered,
  );
  const contrast = pinned && !pinnedMastered ? pinned : nextContrast(snapshot.ear);

  // --- Speaking: rung decides the Sprechen beat and whether the
  // performance may run as free conversation.
  const rung = snapshot.speakingRung;
  const speakMode = speakModeFor(rung, station);
  const free = rung === "free-conversation" && station.performance.kind === "role-play";

  const steps: StepSpec[] = [];
  const stage = station.stage;
  const learnerStage = snapshot.syntax.stage;

  const arrive = (): StepSpec => ({
    kind: "arrive",
    seconds: SECONDS.arrive,
    skill: "reading",
    difficulty: 0,
    note: station.canDoEn,
  });
  const scene = (): StepSpec => ({
    kind: "scene",
    seconds: SECONDS.scene,
    skill: "listening",
    difficulty: itemDifficulty({
      taskKind: "listen-clip",
      newLexemes: newIds.length,
      dueLexemes: creditIds.length,
      stageRequired: stage,
      learnerStage,
    }),
    newLexemeIds: newIds,
    creditIds,
    variation: visits > 0,
    note:
      creditIds.length > 0
        ? english
          ? `${creditIds.length} words come back inside the scene`
          : `${creditIds.length} Wörter kommen in der Szene zurück`
        : undefined,
  });
  const understand = (): StepSpec => ({
    kind: "understand",
    seconds: station.checks.length * SECONDS.understandPerCheck,
    skill: "reading",
    difficulty: itemDifficulty({ taskKind: "dialogue-read", newLexemes: newIds.length }),
  });
  const words = (ids: string[]): StepSpec => ({
    kind: "words",
    seconds: ids.length * SECONDS.wordPerTap,
    skill: "reading",
    difficulty: itemDifficulty({ taskKind: "retrieval-tap", newLexemes: ids.filter((id) => newIds.includes(id)).length }),
    lexemeIds: ids,
    newLexemeIds: ids.filter((id) => newIds.includes(id)),
    note:
      uncreditedDue.length > 0
        ? english
          ? `${Math.min(uncreditedDue.length, ids.length)} words are waiting`
          : `${Math.min(uncreditedDue.length, ids.length)} Wörter warten`
        : undefined,
  });
  const grammar = (): StepSpec | null =>
    bite
      ? {
          kind: "grammar",
          seconds: SECONDS.grammar,
          skill: "grammar",
          difficulty: itemDifficulty({ taskKind: "grammar-drill" }),
          biteId: bite.id,
          note: bite.title,
        }
      : null;
  const speak = (): StepSpec => {
    const lineIndices =
      speakMode === "shadow"
        ? station.shadowLineIndices
        : speakMode === "scripted"
          ? duLineIndices(station)
          : station.shadowLineIndices.slice(0, 2);
    const seconds =
      speakMode === "shadow"
        ? lineIndices.length * SECONDS.shadowPerLine
        : speakMode === "scripted"
          ? lineIndices.length * SECONDS.scriptedPerLine
          : 2 * SECONDS.shadowPerLine + station.construct.length * SECONDS.constructPerItem;
    return {
      kind: "speak",
      seconds,
      skill: "speaking",
      difficulty: itemDifficulty({
        taskKind:
          speakMode === "shadow"
            ? "shadowing"
            : speakMode === "scripted"
              ? "scripted-dialogue"
              : speakMode === "timed-recall"
                ? "timed-recall"
                : "construct-sentence",
        freeProduction: speakMode === "construct" || speakMode === "timed-recall",
        timed: speakMode === "timed-recall",
        stageRequired: stage,
        learnerStage,
      }),
      speak: speakMode,
      lineIndices,
    };
  };
  const ear = (pairs: number): StepSpec | null =>
    contrast
      ? {
          kind: "ear",
          seconds: pairs * SECONDS.earPerPair,
          skill: "listening",
          difficulty: itemDifficulty({ taskKind: "hvpt-pair" }),
          contrastId: contrast.id,
          pairCount: pairs,
          note: contrast.label,
        }
      : null;
  const perform = (): StepSpec => ({
    kind: "perform",
    seconds: SECONDS.perform,
    skill: station.performance.kind === "write-it" ? "writing" : "speaking",
    difficulty: itemDifficulty({
      taskKind: free ? "conversation-turn" : "scripted-dialogue",
      freeProduction: free || station.performance.kind !== "role-play",
      stageRequired: stage,
      learnerStage,
    }),
    free,
    note: station.performance.canDoEn,
  });
  const depart = (): StepSpec => ({
    kind: "depart",
    seconds: SECONDS.depart,
    skill: "reading",
    difficulty: 0,
  });

  const push = (step: StepSpec | null) => {
    if (step) steps.push(step);
  };

  switch (mode) {
    case "station":
      push(arrive());
      push(scene());
      push(understand());
      if (tapIds.length > 0) push(words(tapIds));
      push(grammar());
      push(speak());
      push(ear(6));
      push(perform());
      push(depart());
      break;
    case "review": {
      const ids = uniq([...shakyIds, ...dueIds, ...reviewIds]).slice(0, 16);
      push(scene());
      if (ids.length > 0) push(words(ids));
      push(depart());
      break;
    }
    case "ear":
      push(ear(18));
      push(depart());
      break;
    case "speak":
      push(speak());
      push(perform());
      push(depart());
      break;
    case "talk":
      // Free conversation only once the rung allows; below it, the
      // scripted performance is the honest substitute.
      push(perform());
      push(depart());
      break;
  }

  // --- Flow-channel guard on production beats: a Sprechen sub-mode
  // predicted too hard steps down a rung rather than vanishing.
  for (const step of steps) {
    if (step.kind !== "speak" || step.speak === "shadow") continue;
    const rating = snapshot.skills.speaking.rating;
    if (pSuccess(rating, step.difficulty) < 0.6) {
      step.speak = "shadow";
      step.lineIndices = station.shadowLineIndices;
      step.seconds = station.shadowLineIndices.length * SECONDS.shadowPerLine;
      step.difficulty = itemDifficulty({ taskKind: "shadowing" });
    }
  }

  // --- Trim optional beats when over budget (ear first, then grammar);
  // core beats are the lesson and are never cut.
  let total = steps.reduce((sum, step) => sum + step.seconds, 0);
  if (mode === "station") {
    for (const kind of ["ear", "grammar"] as const) {
      if (total <= budgetSeconds * 1.25) break;
      const i = steps.findIndex((step) => step.kind === kind);
      if (i >= 0) {
        total -= steps[i].seconds;
        steps.splice(i, 1);
      }
    }
  }

  const briefing: string[] = [];
  if (mode === "station") {
    if (newIds.length > 0)
      briefing.push(english ? `${newIds.length} new words` : `${newIds.length} neue Wörter`);
    if (dueIds.length > 0)
      briefing.push(
        english ? `${dueIds.length} words come back today` : `${dueIds.length} Wörter kommen heute zurück`,
      );
    if (steps.some((step) => step.kind === "grammar") && bite)
      briefing.push(english ? `Baustein: ${bite.title}` : `Baustein: ${bite.titleDe}`);
    if (visits > 0)
      briefing.push(english ? `Visit ${visits + 1} — a new scene` : `Besuch ${visits + 1} — eine neue Szene`);
  } else {
    briefing.push(
      mode === "review"
        ? english
          ? `Review — ${dueIds.length} words waiting`
          : `Wiederholen — ${dueIds.length} Wörter warten`
        : mode === "ear"
          ? english
            ? "Ear training"
            : "Ohrtraining"
          : mode === "speak"
            ? english
              ? "Speaking practice"
              : "Sprechrunde"
            : english
              ? "A conversation"
              : "Ein Gespräch",
    );
  }

  return {
    stationId: station.id,
    mode,
    steps,
    totalSeconds: total,
    newLexemeIds: newIds,
    dueLexemeIds: dueIds,
    variation: visits > 0 && steps.some((step) => step.kind === "scene"),
    briefing,
  };
}

/** Indices of the learner's own lines in the scene (for scripted role-play). */
export function duLineIndices(station: Station): number[] {
  const indices: number[] = [];
  station.scene.lines.forEach((line, i) => {
    if (line.speaker === "du") indices.push(i);
  });
  return indices.length > 0 ? indices : station.shadowLineIndices;
}

function speakModeFor(rung: SpeakingRung, station: Station): SpeakMode {
  switch (rung) {
    case "shadowing":
      return "shadow";
    case "construct":
      return station.construct.length > 0 ? "construct" : "shadow";
    case "scripted":
    case "free-conversation":
      return "scripted";
    case "timed-recall":
      return station.construct.length > 0 ? "timed-recall" : "scripted";
  }
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Where placement drops a learner into the course. Vocabulary estimate
 * and produced syntax stage both have to agree before anyone skips a
 * line — a false start costs more than a quick first line.
 */
export function suggestStartStation(
  stationIds: { id: string; lineNumber: number }[],
  placement: { vocabEstimate: number; stage: SyntaxStage },
): string {
  const line =
    placement.vocabEstimate >= 900 && placement.stage >= 4
      ? 4
      : placement.vocabEstimate >= 450 && placement.stage >= 3
        ? 3
        : placement.vocabEstimate >= 180 && placement.stage >= 2
          ? 2
          : 1;
  const first = stationIds.find((station) => station.lineNumber === line) ?? stationIds[0];
  return first.id;
}
