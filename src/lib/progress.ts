/**
 * The progress bundle: everything the Weg screen and the session end
 * screen show. One shape, built server-side, honest by construction —
 * only numbers that mean something outside the app.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CAN_DO, progressSummary, VOCAB_MILESTONES } from "@/lib/engine";
import { loadSnapshot } from "@/lib/engine/store";
import { computeStreak, type Streak } from "@/lib/streak";

export interface MilestoneRow {
  kind: string;
  label: string;
  detail: string;
  achieved_at: string;
}

export interface ProgressBundle {
  progress: ReturnType<typeof progressSummary>;
  streak: Streak;
  milestones: MilestoneRow[];
  canDo: string[];
  vocabMilestones: typeof VOCAB_MILESTONES;
  placed: boolean;
}

export async function getProgressBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProgressBundle> {
  const [snapshot, sessions, milestones] = await Promise.all([
    loadSnapshot(supabase, userId),
    supabase
      .from("sessions")
      .select("completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(400),
    supabase
      .from("milestone_events")
      .select("kind, label, detail, achieved_at")
      .order("achieved_at", { ascending: false })
      .limit(12),
  ]);
  const activeDays = [
    ...new Set(
      (sessions.data ?? [])
        .map((row) => (row.completed_at as string | null)?.slice(0, 10))
        .filter((day): day is string => Boolean(day)),
    ),
  ];
  const progress = progressSummary(snapshot);
  return {
    progress,
    streak: computeStreak(activeDays, snapshot.now),
    milestones: (milestones.data ?? []) as MilestoneRow[],
    canDo: CAN_DO[progress.cefr.band],
    vocabMilestones: VOCAB_MILESTONES,
    placed: snapshot.placed,
  };
}
