/**
 * What every tutor route needs about the learner: the engine snapshot,
 * the last ~200 graded events (the recent story the snapshot's rolled
 * state no longer tells), and the course lexicon index. Reads run
 * under the caller's RLS; the `user_id` filter is belt and braces.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSE_LEXICON, knownAtStation, type Station } from "@/lib/curriculum";
import { buildIndex, isKnown, type LexiconIndex } from "@/lib/engine";
import { loadSnapshot } from "@/lib/engine/store";
import type { LearnerSnapshot } from "@/lib/engine/types";
import type { ReviewEventRow } from "./signals";

/** Built once per instance: the seed plus every lexeme the course introduces. */
export const TUTOR_INDEX: LexiconIndex = buildIndex(COURSE_LEXICON);

export const RECENT_EVENTS = 200;

export async function loadRecentEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReviewEventRow[]> {
  const { data, error } = await supabase
    .from("review_events")
    .select("task_kind, skill, correct, difficulty, lexeme_grades, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_EVENTS);
  if (error) {
    // Signals degrade to the snapshot alone; Jule just has less to say.
    console.warn("[tutor] review_events read failed:", error.message);
    return [];
  }
  return (data ?? []) as ReviewEventRow[];
}

export async function loadTutorContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ snapshot: LearnerSnapshot; recent: ReviewEventRow[] }> {
  const [snapshot, recent] = await Promise.all([
    loadSnapshot(supabase, userId),
    loadRecentEvents(supabase, userId),
  ]);
  return { snapshot, recent };
}

/**
 * The vocabulary generated content at a station may use: everything
 * the course expects known on arrival ∪ what the learner actually
 * knows (placement may have seeded far ahead) ∪ the station's own words.
 */
export function allowedAtStation(station: Station, snapshot: LearnerSnapshot): Set<string> {
  const allowed = knownAtStation(station.id);
  for (const word of snapshot.words) {
    if (isKnown(word, snapshot.now) && TUTOR_INDEX.byId.has(word.lexemeId)) allowed.add(word.lexemeId);
  }
  for (const lexeme of station.vocabulary) allowed.add(lexeme.id);
  return allowed;
}
