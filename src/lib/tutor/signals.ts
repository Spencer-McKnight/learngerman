/**
 * Learner signals → key performances.
 *
 * The tutor never gets to pick what to talk about. This module reads
 * the learner's real evidence (FSRS word states, the syntax ledger,
 * ear mastery, grammar-bite status, the last ~200 review_events) and
 * reduces it to a handful of honest, nameable facts (`LearnerSignals`).
 * `keyPerformances` then finds the moments in THIS station where those
 * facts will be tested. Both are pure and deterministic: the same data
 * always yields the same focuses, so the no-AI fallback and the model
 * speak about the same things, and the cache key can be built from a
 * compact signature of the signals rather than the whole snapshot.
 */

import type { Station } from "../curriculum/types";
import { CONTRASTS } from "../engine/ear/hvpt";
import { CURRICULUM } from "../engine/grammar/curriculum";
import type { LexiconIndex } from "../engine/lexicon/coverage";
import { tokenize } from "../engine/lexicon/tokenize";
import { retrievability } from "../engine/scheduler/scheduler";
import { STAGE_NAMES } from "../engine/syntax/stages";
import type { LearnerSnapshot, SpeakingRung, SyntaxStage } from "../engine/types";

/** One `review_events` row as the coach route reads it (see store.ts). */
export interface ReviewEventRow {
  task_kind: string;
  skill: string;
  correct: boolean;
  difficulty: number;
  /** lexeme id → 1..4 FSRS grade. */
  lexeme_grades: Record<string, number> | null;
  payload: {
    stageAttempted?: number;
    stageSuccess?: boolean;
    earContrastId?: string;
    biteId?: string;
  } | null;
  created_at: string;
}

export interface LapsingWord {
  id: string;
  lemma: string;
  english: string;
  /** Again grades in the recent events window. */
  lapses: number;
}

export interface LearnerSignals {
  /** ≤ 5: words graded Again recently, or sitting at low retrievability. */
  lapsingWords: LapsingWord[];
  /** The stage the learner attempts and fails most, or null if nothing stands out. */
  weakStage: { stage: SyntaxStage; name: string; successRate: number; attempts: number } | null;
  weakContrast: { id: string; label: string; accuracy: number } | null;
  biteInProgress: { id: string; title: string } | null;
  rung: SpeakingRung;
  /** ≤ 2 honest English phrases ("retrieval taps are solid: 9/10 this week"). */
  strengths: string[];
  /** Distinct days with graded activity in the last 7 days. */
  sessionsThisWeek: number;
}

export interface KeyPerformance {
  kind: "word" | "stage" | "ear" | "bite" | "performance";
  /** The German the learner should watch for or produce. */
  focusDe: string;
  /** Why it matters for this learner, one English sentence fragment. */
  whyEn: string;
  /** Index into station.scene.lines when the focus lives in a scene line. */
  lineIndex?: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** A word counts as shaky when FSRS puts recall below this. */
const SHAKY_RETRIEVABILITY = 0.7;
/** Minimum attempts before we call a stage or contrast "weak". */
const MIN_ATTEMPTS = 3;
const WEAK_STAGE_RATE = 0.75;
const WEAK_CONTRAST_ACCURACY = 0.8;

/** Human labels for task kinds the strengths line may name. */
const TASK_LABELS: Record<string, string> = {
  "retrieval-tap": "retrieval taps",
  "cloze-type": "cloze lines",
  "construct-sentence": "construct sentences",
  shadowing: "shadowing",
  "hvpt-pair": "ear drills",
  "grammar-bite": "grammar drills",
  "scripted-dialogue": "scripted role-plays",
  "timed-recall": "timed recall",
  "conversation-turn": "conversation turns",
  "story-read": "scene reading",
  "dialogue-read": "scene reading",
  "listen-clip": "listening",
  check: "comprehension checks",
  words: "retrieval taps",
  speak: "speaking",
  perform: "performances",
};

function taskLabel(kind: string): string {
  return TASK_LABELS[kind] ?? kind.replace(/-/g, " ");
}

function withArticle(index: LexiconIndex, id: string): string | null {
  const lexeme = index.byId.get(id);
  if (!lexeme) return null;
  return lexeme.gender ? `${lexeme.gender} ${lexeme.lemma}` : lexeme.lemma;
}

/**
 * Reduce a snapshot plus recent events to the facts Jule may mention.
 * Only words in the lexicon index are ever named (an unknown id is a
 * data glitch, not a teaching point).
 */
export function learnerSignals(
  snapshot: LearnerSnapshot,
  recent: ReviewEventRow[],
  index: LexiconIndex,
): LearnerSignals {
  const now = snapshot.now.getTime();
  const weekAgo = now - WEEK_MS;

  // Lapsing words: Again grades in the window, then low-retrievability
  // words the FSRS cards themselves flag. Lapses dominate the order so
  // a word the learner actually failed outranks one that is merely old.
  const lapses = new Map<string, number>();
  for (const event of recent) {
    for (const [id, grade] of Object.entries(event.lexeme_grades ?? {})) {
      if (grade === 1) lapses.set(id, (lapses.get(id) ?? 0) + 1);
    }
  }
  const shaky = new Map<string, number>();
  for (const word of snapshot.words) {
    const r = retrievability(word, snapshot.now);
    // retrievability() is 0 for New cards, so `r > 0` skips untaught words.
    if (r > 0 && r < SHAKY_RETRIEVABILITY) shaky.set(word.lexemeId, r);
  }
  const candidateIds = new Set([...lapses.keys(), ...shaky.keys()]);
  const lapsingWords: LapsingWord[] = [...candidateIds]
    .filter((id) => index.byId.has(id))
    .map((id) => ({ id, lapses: lapses.get(id) ?? 0, r: shaky.get(id) ?? 1 }))
    .sort((a, b) => b.lapses - a.lapses || a.r - b.r || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map(({ id, lapses }) => {
      const lexeme = index.byId.get(id)!;
      return { id, lemma: lexeme.lemma, english: lexeme.english, lapses };
    });

  // Weak stage: events first (they carry the recent story), the syntax
  // ledger's rolling windows as the fallback for learners whose events
  // predate stage tracking.
  const stageTally = new Map<SyntaxStage, { attempts: number; successes: number }>();
  for (const event of recent) {
    const stage = event.payload?.stageAttempted;
    if (!isStage(stage)) continue;
    const tally = stageTally.get(stage) ?? { attempts: 0, successes: 0 };
    tally.attempts += 1;
    if (event.payload?.stageSuccess) tally.successes += 1;
    stageTally.set(stage, tally);
  }
  if (stageTally.size === 0) {
    for (const [key, evidence] of Object.entries(snapshot.syntax.evidence)) {
      const stage = Number(key);
      if (!isStage(stage) || !evidence) continue;
      const window = evidence.window.slice(-10);
      stageTally.set(stage, {
        attempts: window.length,
        successes: window.filter(Boolean).length,
      });
    }
  }
  let weakStage: LearnerSignals["weakStage"] = null;
  for (const [stage, tally] of [...stageTally.entries()].sort((a, b) => a[0] - b[0])) {
    if (tally.attempts < MIN_ATTEMPTS) continue;
    const successRate = tally.successes / tally.attempts;
    if (successRate >= WEAK_STAGE_RATE) continue;
    if (
      !weakStage ||
      successRate < weakStage.successRate ||
      (successRate === weakStage.successRate && tally.attempts > weakStage.attempts)
    ) {
      weakStage = { stage, name: STAGE_NAMES[stage], successRate, attempts: tally.attempts };
    }
  }

  // Weak contrast: the unmastered contrast with the lowest accuracy.
  let weakContrast: LearnerSignals["weakContrast"] = null;
  for (const state of snapshot.ear) {
    if (state.mastered || state.seen < MIN_ATTEMPTS) continue;
    const accuracy = state.correct / state.seen;
    if (accuracy >= WEAK_CONTRAST_ACCURACY) continue;
    if (!weakContrast || accuracy < weakContrast.accuracy) {
      const contrast = CONTRASTS.find((c) => c.id === state.contrastId);
      if (contrast) weakContrast = { id: contrast.id, label: contrast.label, accuracy };
    }
  }

  // Bite in progress: the first curriculum bite that is seen or
  // practising — curriculum order, so it is the one the composer serves.
  let biteInProgress: LearnerSignals["biteInProgress"] = null;
  for (const bite of CURRICULUM) {
    const status = snapshot.grammar.bites[bite.id];
    if (status === "seen" || status === "practising") {
      biteInProgress = { id: bite.id, title: bite.title };
      break;
    }
  }

  // Strengths: only what the week's numbers support. A kind needs five
  // attempts before 4/5 counts as "solid"; mastered contrasts and a
  // stabilised stage above 1 are the other honest claims.
  const weekEvents = recent.filter((event) => Date.parse(event.created_at) >= weekAgo);
  const kindTally = new Map<string, { attempts: number; correct: number }>();
  for (const event of weekEvents) {
    const tally = kindTally.get(event.task_kind) ?? { attempts: 0, correct: 0 };
    tally.attempts += 1;
    if (event.correct) tally.correct += 1;
    kindTally.set(event.task_kind, tally);
  }
  const strengths: string[] = [];
  const solidKinds = [...kindTally.entries()]
    .filter(([, tally]) => tally.attempts >= 5 && tally.correct / tally.attempts >= 0.8)
    .sort((a, b) => b[1].correct / b[1].attempts - a[1].correct / a[1].attempts || a[0].localeCompare(b[0]));
  for (const [kind, tally] of solidKinds.slice(0, 2)) {
    strengths.push(`${taskLabel(kind)} are solid: ${tally.correct}/${tally.attempts} this week`);
  }
  if (strengths.length < 2) {
    const mastered = snapshot.ear.find((state) => state.mastered);
    const contrast = mastered ? CONTRASTS.find((c) => c.id === mastered.contrastId) : undefined;
    if (contrast) strengths.push(`you hear ${contrast.label} reliably now`);
  }
  if (strengths.length < 2 && snapshot.syntax.stage > 1) {
    strengths.push(`${STAGE_NAMES[snapshot.syntax.stage].toLowerCase()} come out in order now`);
  }

  const activeDays = new Set(weekEvents.map((event) => event.created_at.slice(0, 10)));

  return {
    lapsingWords,
    weakStage,
    weakContrast,
    biteInProgress,
    rung: snapshot.speakingRung,
    strengths: strengths.slice(0, 2),
    sessionsThisWeek: activeDays.size,
  };
}

function isStage(value: unknown): value is SyntaxStage {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Compact, order-stable signature of the signals for cache keys: the
 * same weakness pattern should reuse the same words, whatever else
 * changed in the snapshot since.
 */
export function signalsSignature(signals: LearnerSignals): string {
  return [
    signals.lapsingWords.map((word) => word.id).join(","),
    signals.weakStage ? `s${signals.weakStage.stage}` : "s-",
    signals.weakContrast ? `e:${signals.weakContrast.id}` : "e-",
    signals.biteInProgress ? `b:${signals.biteInProgress.id}` : "b-",
    signals.rung,
    signals.strengths.join("|"),
    `d${Math.min(signals.sessionsThisWeek, 7)}`,
  ].join(";");
}

/* ---------- Key performances ---------- */

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

function lexemeForms(index: LexiconIndex, id: string): Set<string> {
  const lexeme = index.byId.get(id);
  if (!lexeme) return new Set();
  return new Set(
    [lexeme.lemma, ...(lexeme.plural ? [lexeme.plural] : []), ...lexeme.forms].map((form) =>
      form.toLowerCase(),
    ),
  );
}

/** "Herr Yilmaz's second line" / "your third line" / "the narrator's first line". */
function describeLine(station: Station, lineIndex: number): string {
  const line = station.scene.lines[lineIndex];
  const nth = station.scene.lines.slice(0, lineIndex + 1).filter((l) => l.speaker === line.speaker).length;
  if (line.speaker === "du") return `your ${ordinal(nth)} line`;
  if (line.speaker === "narrator") return `the narrator's ${ordinal(nth)} line`;
  const name = station.scene.cast.find((c) => c.id === line.speaker)?.name ?? line.speaker;
  return `${name}'s ${ordinal(nth)} line`;
}

/**
 * Find the ≤ 2 moments in this station where the learner's weak spots
 * get tested. Deterministic priority: a lapsing word in a scene line,
 * then a construct item at the weak stage, then the pinned contrast,
 * then the bite, then the performance. A brand-new learner with no
 * signals still gets one item — the performance itself, which is the
 * can-do the station proves.
 */
export function keyPerformances(
  station: Station,
  signals: LearnerSignals,
  index: LexiconIndex,
): KeyPerformance[] {
  const out: KeyPerformance[] = [];
  const lineTokens = station.scene.lines.map((line) => new Set(tokenize(line.de)));

  for (const word of signals.lapsingWords) {
    if (out.length >= 2) break;
    const forms = lexemeForms(index, word.id);
    const lineIndex = lineTokens.findIndex((tokens) => [...forms].some((form) => tokens.has(form)));
    if (lineIndex < 0) continue;
    const focusDe = withArticle(index, word.id) ?? word.lemma;
    const slipped = word.lapses > 0 ? `it slipped ${word.lapses === 1 ? "once" : `${word.lapses} times`} recently` : "it is due a refresh";
    out.push({
      kind: "word",
      focusDe,
      whyEn: `watch for '${focusDe}' in ${describeLine(station, lineIndex)} — ${slipped}`,
      lineIndex,
    });
  }

  if (out.length < 2 && signals.weakStage) {
    const stage = signals.weakStage;
    const itemIndex = station.construct.findIndex((item) => item.stage === stage.stage);
    if (itemIndex >= 0) {
      const item = station.construct[itemIndex];
      const fronted = item.targetDe.split(/\s+/)[0] ?? item.targetDe;
      const landed = `${Math.round(stage.successRate * stage.attempts)} of ${stage.attempts}`;
      out.push({
        kind: "stage",
        focusDe: item.targetDe,
        whyEn: `the ${ordinal(itemIndex + 1)} construct asks you to start with '${fronted}' — ${stage.name.toLowerCase()} has landed ${landed} times lately`,
      });
    }
  }

  if (out.length < 2 && signals.weakContrast) {
    const contrast = CONTRASTS.find((c) => c.id === signals.weakContrast?.id);
    const pinned = station.earContrastId === signals.weakContrast.id;
    const pairWords = new Set(contrast?.pairs.flatMap((pair) => [pair.a.toLowerCase(), pair.b.toLowerCase()]) ?? []);
    const lineIndex = lineTokens.findIndex((tokens) => [...pairWords].some((word) => tokens.has(word)));
    if (pinned || lineIndex >= 0) {
      const accuracy = `${Math.round(signals.weakContrast.accuracy * 100)}%`;
      out.push({
        kind: "ear",
        focusDe: signals.weakContrast.label,
        whyEn:
          lineIndex >= 0
            ? `listen for ${signals.weakContrast.label} in ${describeLine(station, lineIndex)} — you are at ${accuracy} on that contrast`
            : `the Ohr drill here is ${signals.weakContrast.label} — you are at ${accuracy} on it`,
        ...(lineIndex >= 0 ? { lineIndex } : {}),
      });
    }
  }

  if (out.length < 2 && signals.biteInProgress && station.grammarBiteId === signals.biteInProgress.id) {
    const bite = CURRICULUM.find((b) => b.id === signals.biteInProgress?.id);
    out.push({
      kind: "bite",
      focusDe: bite?.titleDe ?? signals.biteInProgress.title,
      whyEn: `the Baustein here is '${signals.biteInProgress.title}', which you are still practising — the drill will show whether it has settled`,
    });
  }

  if (out.length < 2) {
    const performance = station.performance;
    const duLine = performance.lines?.find((line) => line.speaker === "du");
    const prompt = performance.prompts?.[0];
    const focusDe = duLine?.de ?? prompt?.targetDe ?? station.scene.title;
    // Prefer naming a lapsing word that the performance itself uses.
    const perfTokens = new Set(tokenize([...(performance.lines ?? []).map((l) => l.de), ...(performance.prompts ?? []).map((p) => p.targetDe)].join(" ")));
    const tested = signals.lapsingWords.find((word) => [...lexemeForms(index, word.id)].some((form) => perfTokens.has(form)));
    const alreadyNamed = tested ? out.some((item) => item.kind === "word" && item.focusDe.endsWith(tested.lemma)) : false;
    out.push({
      kind: "performance",
      focusDe,
      whyEn:
        tested && !alreadyNamed
          ? `the Leistung needs '${withArticle(index, tested.id) ?? tested.lemma}' from you — ${performance.situationEn}`
          : `the Leistung is the proof of this station — ${performance.situationEn}`,
    });
  }

  return out.slice(0, 2);
}
