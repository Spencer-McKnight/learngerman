/**
 * Persistence for the learning engine: LearnerSnapshot ↔ Supabase rows.
 * All reads/writes run under the caller's RLS via the per-request
 * server client. The engine itself never touches the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "ts-fsrs";
import type {
  EarContrastState,
  LearnerSnapshot,
  ReviewOutcome,
  SkillId,
  SkillState,
  SpeakingRung,
  SyntaxStage,
  WordState,
} from "./types";
import { SKILLS } from "./types";
import { initialSkills } from "./ability/elo";
import type { StationProgress } from "../curriculum/types";

function parseCard(raw: Record<string, unknown>): Card {
  return {
    ...raw,
    due: new Date(raw.due as string),
    last_review: raw.last_review ? new Date(raw.last_review as string) : undefined,
  } as Card;
}

export async function loadSnapshot(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<LearnerSnapshot> {
  const [words, skills, syntax, ear, grammar, profile] = await Promise.all([
    supabase.from("word_states").select("lexeme_id, card, success_days, introduced_at"),
    supabase.from("skill_states").select("skill, rating, attempts"),
    supabase.from("syntax_states").select("stage, evidence").maybeSingle(),
    supabase.from("ear_states").select("contrast_id, seen, correct, outcome_window, mastered"),
    supabase.from("grammar_states").select("bite_id, status"),
    supabase.from("learner_profiles").select("*").maybeSingle(),
  ]);

  const skillMap = initialSkills();
  for (const row of skills.data ?? []) {
    const skill = row.skill as SkillId;
    if (SKILLS.includes(skill)) {
      skillMap[skill] = { skill, rating: row.rating, attempts: row.attempts };
    }
  }

  return {
    userId,
    now,
    words: (words.data ?? []).map(
      (row): WordState => ({
        lexemeId: row.lexeme_id,
        card: parseCard(row.card),
        successDays: row.success_days ?? [],
        introducedAt: row.introduced_at,
      }),
    ),
    skills: skillMap,
    syntax: {
      stage: (syntax.data?.stage ?? 1) as SyntaxStage,
      evidence: syntax.data?.evidence ?? {},
    },
    grammar: {
      bites: Object.fromEntries(
        (grammar.data ?? []).map((row) => [row.bite_id, row.status]),
      ),
    },
    ear: (ear.data ?? []).map(
      (row): EarContrastState => ({
        contrastId: row.contrast_id,
        seen: row.seen,
        correct: row.correct,
        window: row.outcome_window ?? [],
        mastered: row.mastered,
      }),
    ),
    speakingRung: (profile.data?.speaking_rung ?? "shadowing") as SpeakingRung,
    speakingOutcomes: (profile.data?.speaking_outcomes ?? []) as boolean[],
    coverageTarget: profile.data?.coverage_target ?? 0.95,
    inputMinutes: profile.data?.input_minutes ?? 0,
    minutesPerSession: profile.data?.minutes_per_session ?? 12,
    placed: profile.data?.placed ?? false,
  };
}

/** Upsert only what an outcome can change (words touched, one skill…). */
export async function saveOutcome(
  supabase: SupabaseClient,
  snapshot: LearnerSnapshot,
  outcome: ReviewOutcome,
  touchedWords: WordState[],
): Promise<void> {
  const userId = snapshot.userId;
  const writes: PromiseLike<unknown>[] = [];

  if (touchedWords.length > 0) {
    writes.push(
      supabase.from("word_states").upsert(
        touchedWords.map((word) => ({
          user_id: userId,
          lexeme_id: word.lexemeId,
          card: word.card,
          due: new Date(word.card.due).toISOString(),
          success_days: word.successDays,
          introduced_at: word.introducedAt,
        })),
      ),
    );
  }

  const skill: SkillState = snapshot.skills[outcome.skill];
  writes.push(
    supabase.from("skill_states").upsert({
      user_id: userId,
      skill: skill.skill,
      rating: skill.rating,
      attempts: skill.attempts,
    }),
  );

  if (outcome.stageAttempted !== undefined) {
    writes.push(
      supabase.from("syntax_states").upsert({
        user_id: userId,
        stage: snapshot.syntax.stage,
        evidence: snapshot.syntax.evidence,
      }),
    );
  }

  if (outcome.earContrastId) {
    const state = snapshot.ear.find(
      (contrast) => contrast.contrastId === outcome.earContrastId,
    );
    if (state) {
      writes.push(
        supabase.from("ear_states").upsert({
          user_id: userId,
          contrast_id: state.contrastId,
          seen: state.seen,
          correct: state.correct,
          outcome_window: state.window,
          mastered: state.mastered,
        }),
      );
    }
  }

  if (outcome.biteId && snapshot.grammar.bites[outcome.biteId]) {
    writes.push(
      supabase.from("grammar_states").upsert({
        user_id: userId,
        bite_id: outcome.biteId,
        status: snapshot.grammar.bites[outcome.biteId],
      }),
    );
  }

  if (outcome.inputSeconds || outcome.skill === "speaking") {
    writes.push(
      supabase.from("learner_profiles").upsert({
        user_id: userId,
        input_minutes: snapshot.inputMinutes,
        speaking_rung: snapshot.speakingRung,
        speaking_outcomes: snapshot.speakingOutcomes ?? [],
      }),
    );
  }

  writes.push(
    supabase.from("review_events").insert({
      user_id: userId,
      task_kind: outcome.taskKind,
      skill: outcome.skill,
      correct: outcome.correct,
      difficulty: outcome.difficulty,
      lexeme_grades: outcome.lexemeGrades,
      payload: {
        stageAttempted: outcome.stageAttempted,
        stageSuccess: outcome.stageSuccess,
        earContrastId: outcome.earContrastId,
        biteId: outcome.biteId,
        inputSeconds: outcome.inputSeconds,
      },
    }),
  );

  await Promise.all(writes);
}

export async function savePlacement(
  supabase: SupabaseClient,
  userId: string,
  words: WordState[],
  skills: Record<SkillId, SkillState>,
  stage: SyntaxStage,
  placement: Record<string, unknown>,
): Promise<void> {
  const chunks: PromiseLike<unknown>[] = [];
  // Seeded word states arrive in bulk; chunk to stay under body limits.
  for (let i = 0; i < words.length; i += 500) {
    chunks.push(
      supabase.from("word_states").upsert(
        words.slice(i, i + 500).map((word) => ({
          user_id: userId,
          lexeme_id: word.lexemeId,
          card: word.card,
          due: new Date(word.card.due).toISOString(),
          success_days: word.successDays,
          introduced_at: word.introducedAt,
        })),
      ),
    );
  }
  chunks.push(
    supabase.from("skill_states").upsert(
      SKILLS.map((skill) => ({
        user_id: userId,
        skill,
        rating: skills[skill].rating,
        attempts: skills[skill].attempts,
      })),
    ),
  );
  chunks.push(
    supabase.from("syntax_states").upsert({ user_id: userId, stage, evidence: {} }),
  );
  chunks.push(
    supabase
      .from("learner_profiles")
      .upsert({ user_id: userId, placed: true, placement }),
  );
  await Promise.all(chunks);
}

/* ---------- Course progress (v5.5 "Linie") ---------- */


export async function loadStationProgress(
  supabase: SupabaseClient,
): Promise<StationProgress[]> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("station_id, status, best_grade, visits, last_visited_at, passed_at");
  return (data ?? []).map(
    (row): StationProgress => ({
      stationId: row.station_id,
      status: row.status,
      bestGrade: row.best_grade ?? null,
      visits: row.visits,
      lastVisitedAt: row.last_visited_at ?? null,
      passedAt: row.passed_at ?? null,
    }),
  );
}

/** A visit begins: status at least "started", visits + 1. */
export async function touchStation(
  supabase: SupabaseClient,
  userId: string,
  stationId: string,
  current: StationProgress | undefined,
): Promise<void> {
  await supabase.from("lesson_progress").upsert({
    user_id: userId,
    station_id: stationId,
    status: current?.status === "passed" ? "passed" : "started",
    best_grade: current?.bestGrade ?? null,
    visits: (current?.visits ?? 0) + 1,
    last_visited_at: new Date().toISOString(),
    passed_at: current?.passedAt ?? null,
  });
}

/** A visit ends with a performance grade; ≥ 2 (Hard) passes the station. */
export async function completeStation(
  supabase: SupabaseClient,
  userId: string,
  stationId: string,
  grade: 1 | 2 | 3 | 4 | null,
  current: StationProgress | undefined,
): Promise<StationProgress> {
  const passedNow = grade !== null && grade >= 2;
  const passed = passedNow || current?.status === "passed";
  const best = Math.max(grade ?? 0, current?.bestGrade ?? 0);
  const row: StationProgress = {
    stationId,
    status: passed ? "passed" : "started",
    bestGrade: best === 0 ? null : (best as 1 | 2 | 3 | 4),
    visits: Math.max(1, current?.visits ?? 1),
    lastVisitedAt: new Date().toISOString(),
    passedAt: current?.passedAt ?? (passedNow ? new Date().toISOString() : null),
  };
  await supabase.from("lesson_progress").upsert({
    user_id: userId,
    station_id: row.stationId,
    status: row.status,
    best_grade: row.bestGrade,
    visits: row.visits,
    last_visited_at: row.lastVisitedAt,
    passed_at: row.passedAt,
  });
  return row;
}

/** Placement past a line: its stations count as passed, honestly ungraded. */
export async function placeThroughStations(
  supabase: SupabaseClient,
  userId: string,
  stationIds: string[],
): Promise<void> {
  if (stationIds.length === 0) return;
  const now = new Date().toISOString();
  await supabase.from("lesson_progress").upsert(
    stationIds.map((stationId) => ({
      user_id: userId,
      station_id: stationId,
      status: "passed",
      best_grade: null,
      visits: 0,
      last_visited_at: null,
      passed_at: now,
    })),
  );
}
