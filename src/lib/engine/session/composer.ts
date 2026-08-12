/**
 * The session composer — turns a LearnerSnapshot into one ~10–15
 * minute session plan ("What a session feels like", methodology):
 *
 *   warm story/dialogue carrying today's due words → retrieval taps on
 *   new words → shadowing → grammar bite when developmentally ready →
 *   HVPT ear pairs → speaking task at the learner's current rung.
 *
 * Composition rules encode the research directly:
 *  - reviews live INSIDE content (due words become story targets)
 *  - one new difficulty dimension at a time (#10): a session that
 *    introduces a grammar bite halves its new-word budget
 *  - every task lands in the flow channel (~80–90% predicted success)
 *  - nobody is pushed up a speaking rung before the one below is easy
 */

import type { LearnerSnapshot, SpeakingRung, SkillId } from "../types";
import { SPEAKING_RUNGS } from "../types";
import type { LexiconIndex } from "../lexicon/coverage";
import { nextNewLexemes } from "../lexicon/coverage";
import { dueWords, isKnown, newWordBudget } from "../scheduler/scheduler";
import { itemDifficulty, pSuccess } from "../ability/elo";
import { nextGrammarBite } from "../grammar/curriculum";
import { nextContrast } from "../ear/hvpt";
import type { GenerationSpec, TaskSpec } from "./tasks";

export interface SessionPlan {
  tasks: TaskSpec[];
  totalSeconds: number;
  newLexemeIds: string[];
  dueLexemeIds: string[];
  /** Honest one-liners for the session start screen. */
  briefing: string[];
}

const SECONDS = {
  story: 180,
  retrievalTapPerWord: 20,
  clozePerItem: 30,
  shadowing: 90,
  grammarBite: 120,
  hvptPerPair: 10,
  construct: 150,
  scripted: 180,
  timedRecall: 120,
  conversation: 240,
};

/** Topics rotated for the narrative frame: a newcomer's life in Erlangen. */
const TOPICS = [
  "morgens in der Bäckerei",
  "an der Bushaltestelle",
  "im Supermarkt",
  "ein Nachbar im Treppenhaus",
  "auf dem Wochenmarkt",
  "im Café mit einem Freund",
  "eine Nachricht auf dem Handy",
  "der erste Tag im Sprachkurs",
  "am Bahnhof",
  "das Wetter heute",
  "in der Kneipe",
  "beim Bergkirchweih",
];

/**
 * Optional session branches ("autonomy on a mostly-linear path",
 * gamification #6): the full daily session is the main path; the other
 * modes are small deliberate detours that reuse the same machinery.
 */
export type SessionMode = "full" | "review" | "ear" | "speak";

const MODE_KINDS: Record<Exclude<SessionMode, "full">, Set<string>> = {
  review: new Set(["story-read", "dialogue-read", "cloze-type", "shadowing"]),
  ear: new Set(["hvpt-pair"]),
  speak: new Set([
    "shadowing",
    "construct-sentence",
    "scripted-dialogue",
    "timed-recall",
    "conversation-turn",
  ]),
};

export function composeSession(
  snapshot: LearnerSnapshot,
  index: LexiconIndex,
  opts: { seed?: number; mode?: SessionMode; briefingLang?: "de" | "en" } = {},
): SessionPlan {
  const { now } = snapshot;
  const mode = opts.mode ?? "full";
  const english = opts.briefingLang === "en";
  const seed = opts.seed ?? now.getDate() + now.getMonth() * 31;
  const budgetSeconds = snapshot.minutesPerSession * 60;
  const tasks: TaskSpec[] = [];
  const briefing: string[] = [];

  const knownIds = new Set(
    snapshot.words.filter((word) => isKnown(word, now)).map((word) => word.lexemeId),
  );
  const due = dueWords(snapshot.words, now);
  const recentLapseRate = 0; // refined later from review_events aggregates

  // --- 1. Grammar bite first in PLANNING order (it gates the budget),
  // though it is served mid-session.
  const bite =
    mode === "full" ? nextGrammarBite(snapshot.grammar, snapshot.syntax.stage) : null;

  // --- 2. New-word budget, halved when a new structure arrives (#10).
  // Detour modes introduce nothing new — they revisit and consolidate.
  let newBudget = mode === "full" ? newWordBudget(snapshot.words, now, { recentLapseRate }) : 0;
  if (bite) newBudget = Math.floor(newBudget / 2);
  if (!snapshot.placed && mode === "full") newBudget = Math.max(newBudget, 3); // day one: something to learn
  const newLexemes = nextNewLexemes(knownIds, index, newBudget);
  const newIds = newLexemes.map((lexeme) => lexeme.id);

  // --- 3. Warm-up content: a story or dialogue at the coverage target,
  // quietly carrying the weakest due words plus today's new words.
  const storyTargets = [...due.slice(0, 6).map((word) => word.lexemeId), ...newIds];
  const readingRating = snapshot.skills.reading.rating;
  const asDialogue = seed % 2 === 1;
  const storyKind = asDialogue ? "dialogue-read" : "story-read";
  const sentenceCount = Math.max(4, Math.min(12, 4 + Math.round(readingRating * 2)));
  const allowed = expandAllowed(knownIds, storyTargets, index);
  const storySpec: GenerationSpec = {
    kind: storyKind,
    allowedLemmas: allowed,
    targetLemmas: storyTargets,
    newLemmas: newIds,
    stage: snapshot.syntax.stage,
    coverageTarget: snapshot.coverageTarget,
    register: readingRating >= 1.2 ? "colloquial" : "neutral",
    topic: TOPICS[seed % TOPICS.length],
    sentenceCount,
  };
  tasks.push({
    kind: storyKind,
    seconds: SECONDS.story,
    skill: "reading",
    difficulty: itemDifficulty({
      taskKind: storyKind,
      newLexemes: newIds.length,
      dueLexemes: Math.min(due.length, 6),
    }),
    generation: storySpec,
    note:
      due.length > 0
        ? `${Math.min(due.length, 6)} Wörter kommen heute zurück`
        : undefined,
  });

  // --- 4. Retrieval taps for the new words (fast form–meaning mapping
  // before they reappear in context — methodology #5).
  if (newIds.length > 0) {
    tasks.push({
      kind: "retrieval-tap",
      seconds: newIds.length * SECONDS.retrievalTapPerWord,
      skill: "reading",
      difficulty: itemDifficulty({ taskKind: "retrieval-tap", newLexemes: newIds.length }),
      lexemeIds: newIds,
    });
  }

  // --- 5. Typed cloze retrieval for the shakiest due words that did
  // not fit in the story (production beats recognition).
  const overflowDue = due.slice(6, 6 + 4).map((word) => word.lexemeId);
  if (overflowDue.length > 0) {
    tasks.push({
      kind: "cloze-type",
      seconds: overflowDue.length * SECONDS.clozePerItem,
      skill: "writing",
      difficulty: itemDifficulty({ taskKind: "cloze-type", dueLexemes: overflowDue.length }),
      generation: {
        kind: "cloze-type",
        allowedLemmas: expandAllowed(knownIds, overflowDue, index),
        targetLemmas: overflowDue,
        newLemmas: [],
        stage: snapshot.syntax.stage,
        coverageTarget: snapshot.coverageTarget,
        register: "neutral",
      },
      lexemeIds: overflowDue,
    });
  }

  // --- 6. Shadowing: 60–90s of audio at the listening ability's speed
  // (native street speed once listening rating clears ~2).
  const listeningRating = snapshot.skills.listening.rating;
  tasks.push({
    kind: "shadowing",
    seconds: SECONDS.shadowing,
    skill: "speaking",
    difficulty: itemDifficulty({
      taskKind: "shadowing",
      nativeSpeed: listeningRating >= 2,
    }),
    generation: {
      kind: "shadowing",
      allowedLemmas: expandAllowed(knownIds, due.slice(0, 2).map((word) => word.lexemeId), index),
      targetLemmas: due.slice(0, 2).map((word) => word.lexemeId),
      newLemmas: [],
      stage: snapshot.syntax.stage,
      coverageTarget: Math.min(0.98, snapshot.coverageTarget + 0.02),
      register: listeningRating >= 1.5 ? "colloquial" : "neutral",
      sentenceCount: 3,
    },
  });

  // --- 7. The grammar bite, when one is developmentally ready.
  if (bite) {
    tasks.push({
      kind: "grammar-bite",
      seconds: SECONDS.grammarBite,
      skill: "grammar",
      difficulty: itemDifficulty({ taskKind: "grammar-drill" }),
      biteId: bite.id,
      note: bite.title,
    });
    briefing.push(english ? `New today: ${bite.title}` : `Neu heute: ${bite.titleDe}`);
  }

  // --- 8. HVPT ear pairs when a contrast needs work.
  const contrast = nextContrast(snapshot.ear);
  if (contrast) {
    const pairCount = mode === "ear" ? 18 : 6;
    tasks.push({
      kind: "hvpt-pair",
      seconds: pairCount * SECONDS.hvptPerPair,
      skill: "listening",
      difficulty: itemDifficulty({ taskKind: "hvpt-pair" }),
      contrastId: contrast.id,
      note: contrast.label,
    });
  }

  // --- 9. Speaking task at the current rung (shadowing already served
  // above; higher rungs add their own task).
  const speakingTask = speakingTaskForRung(snapshot, knownIds, due.slice(0, 3).map((w) => w.lexemeId), index);
  if (speakingTask) tasks.push(speakingTask);

  // --- 10. Flow-channel check: production extras predicted too hard
  // are dropped (input, taps, bites and ear pairs stay — their
  // difficulty is already controlled at the source), then trim to the
  // time budget (core content first, extras last).
  const PRODUCTION_KINDS = new Set([
    "cloze-type",
    "construct-sentence",
    "scripted-dialogue",
    "timed-recall",
    "conversation-turn",
  ]);
  const modeTasks =
    mode === "full" ? tasks : tasks.filter((task) => MODE_KINDS[mode].has(task.kind));
  const kept = modeTasks.filter((task) => {
    if (!PRODUCTION_KINDS.has(task.kind)) return true;
    const rating = snapshot.skills[task.skill as SkillId].rating;
    return pSuccess(rating, task.difficulty) >= 0.6;
  });
  const trimmed: TaskSpec[] = [];
  let total = 0;
  for (const task of kept) {
    if (total + task.seconds > budgetSeconds && trimmed.length >= 3) break;
    trimmed.push(task);
    total += task.seconds;
  }

  if (mode === "full") {
    if (due.length > 0)
      briefing.unshift(
        english
          ? `${due.length} words are waiting for you`
          : `${due.length} Wörter warten auf dich`,
      );
    if (newIds.length > 0)
      briefing.push(
        english ? `${newIds.length} new words today` : `${newIds.length} neue Wörter heute`,
      );
  } else {
    briefing.length = 0;
    briefing.push(
      mode === "review"
        ? english
          ? `Review only — ${due.length} words waiting`
          : `Nur wiederholen — ${due.length} Wörter warten`
        : mode === "ear"
          ? english
            ? "Ear training"
            : "Ohrtraining"
          : english
            ? "Speaking practice"
            : "Sprechrunde",
    );
  }

  return {
    tasks: trimmed,
    totalSeconds: total,
    newLexemeIds: newIds,
    dueLexemeIds: due.map((word) => word.lexemeId),
    briefing,
  };
}

const MIN_ALLOWED = 30;

function expandAllowed(
  knownIds: ReadonlySet<string>,
  targetIds: string[],
  index: LexiconIndex,
): string[] {
  const combined = new Set(knownIds);
  for (const id of targetIds) combined.add(id);
  if (combined.size >= MIN_ALLOWED) return [...combined];
  for (const lexeme of index.ordered) {
    combined.add(lexeme.id);
    if (combined.size >= MIN_ALLOWED) break;
  }
  return [...combined];
}

function speakingTaskForRung(
  snapshot: LearnerSnapshot,
  knownIds: Set<string>,
  dueIds: string[],
  index: LexiconIndex,
): TaskSpec | null {
  const rung = snapshot.speakingRung;
  const base: Omit<GenerationSpec, "kind"> = {
    allowedLemmas: expandAllowed(knownIds, dueIds, index),
    targetLemmas: dueIds,
    newLemmas: [],
    stage: snapshot.syntax.stage,
    coverageTarget: snapshot.coverageTarget,
    register: "neutral",
  };
  switch (rung) {
    case "shadowing":
      return null; // already in every session
    case "construct":
      return {
        kind: "construct-sentence",
        seconds: SECONDS.construct,
        skill: "speaking",
        difficulty: itemDifficulty({
          taskKind: "construct-sentence",
          freeProduction: true,
          stageRequired: snapshot.syntax.stage,
          learnerStage: snapshot.syntax.stage,
        }),
        generation: { ...base, kind: "construct-sentence", sentenceCount: 4 },
      };
    case "scripted":
      return {
        kind: "scripted-dialogue",
        seconds: SECONDS.scripted,
        skill: "speaking",
        difficulty: itemDifficulty({ taskKind: "scripted-dialogue" }),
        generation: { ...base, kind: "scripted-dialogue", register: "colloquial", sentenceCount: 8 },
      };
    case "timed-recall":
      return {
        kind: "timed-recall",
        seconds: SECONDS.timedRecall,
        skill: "speaking",
        difficulty: itemDifficulty({ taskKind: "timed-recall", timed: true, freeProduction: true }),
        generation: { ...base, kind: "timed-recall", sentenceCount: 5 },
      };
    case "free-conversation":
      return {
        kind: "conversation-turn",
        seconds: SECONDS.conversation,
        skill: "speaking",
        difficulty: itemDifficulty({ taskKind: "conversation-turn", freeProduction: true }),
        generation: { ...base, kind: "conversation-turn", register: "colloquial" },
      };
  }
}

/**
 * Should the learner move up a speaking rung? Requires ≥ 10 attempts
 * at the current rung with ≥ 80% recent success AND a speaking rating
 * clear of the rung's ability floor — "nobody is pushed up a rung
 * before the one below feels easy".
 */
export function nextSpeakingRung(
  current: SpeakingRung,
  recentOutcomes: boolean[],
  speakingRating: number,
): SpeakingRung {
  const floors: Record<SpeakingRung, number> = {
    shadowing: 0,
    construct: 0.4,
    scripted: 1.0,
    "timed-recall": 1.6,
    "free-conversation": 2.2,
  };
  const index = SPEAKING_RUNGS.indexOf(current);
  const next = SPEAKING_RUNGS[index + 1];
  if (!next) return current;
  const recent = recentOutcomes.slice(-10);
  const successRate = recent.length ? recent.filter(Boolean).length / recent.length : 0;
  if (recent.length >= 10 && successRate >= 0.8 && speakingRating >= floors[next]) {
    return next;
  }
  return current;
}
