import { NextResponse } from "next/server";
import { z } from "zod";
import { getUiLang } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { buildIndex, composeLesson } from "@/lib/engine";
import type { LessonMode } from "@/lib/engine";
import {
  completeStation,
  loadSnapshot,
  loadStationProgress,
  touchStation,
} from "@/lib/engine/store";
import {
  COURSE_LEXICON,
  currentStation,
  lineById,
  lineCompletion,
  stationById,
  stationStatuses,
} from "@/lib/curriculum";

const index = buildIndex(COURSE_LEXICON);

const composeSchema = z.object({
  stationId: z.string().optional(),
  mode: z.enum(["station", "review", "ear", "speak", "talk"]).optional(),
});

/**
 * POST → compose the plan for one station visit (or a detour on the
 * learner's current station) and open a session row. The station's
 * content itself is static and reaches the client as a server-component
 * prop; this route only decides HOW it is played today.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = composeSchema.safeParse(await request.json().catch(() => ({})));
  const mode: LessonMode = body.success ? (body.data.mode ?? "station") : "station";

  const [snapshot, progress] = await Promise.all([
    loadSnapshot(supabase, data.user.id),
    loadStationProgress(supabase),
  ]);
  if (!snapshot.placed && snapshot.words.length === 0 && progress.length === 0) {
    return NextResponse.json({ needsPlacement: true }, { status: 200 });
  }

  const requested = body.success && body.data.stationId ? stationById(body.data.stationId) : null;
  const station = requested ?? currentStation(progress);
  const status = stationStatuses(progress).get(station.id);
  if (status === "locked") {
    return NextResponse.json({ error: "station locked" }, { status: 403 });
  }
  const current = progress.find((row) => row.stationId === station.id);
  const plan = composeLesson(station, snapshot, index, {
    mode,
    visits: current?.visits ?? 0,
    briefingLang: await getUiLang(),
  });

  const [{ data: session, error }] = await Promise.all([
    supabase
      .from("sessions")
      .insert({ user_id: data.user.id, plan, station_id: station.id, mode })
      .select("id")
      .single(),
    mode === "station"
      ? touchStation(supabase, data.user.id, station.id, current)
      : Promise.resolve(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session.id, stationId: station.id, plan });
}

const completeSchema = z.object({
  sessionId: z.uuid(),
  stationId: z.string(),
  mode: z.enum(["station", "review", "ear", "speak", "talk"]).default("station"),
  /** FSRS-style grade of the performance beat; null when the visit was a detour. */
  performanceGrade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
});

/**
 * PATCH → a visit ends: complete the session (feeds the streak), record
 * station progress, and report line-completion milestones.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = completeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });
  const { sessionId, stationId, mode, performanceGrade } = body.data;
  const station = stationById(stationId);
  if (!station) return NextResponse.json({ error: "unknown station" }, { status: 404 });

  const { error } = await supabase
    .from("sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (mode !== "station") return NextResponse.json({ ok: true, milestones: [] });

  const before = await loadStationProgress(supabase);
  const current = before.find((row) => row.stationId === stationId);
  const row = await completeStation(supabase, data.user.id, stationId, performanceGrade, current);
  const after = [...before.filter((r) => r.stationId !== stationId), row];

  // A whole line passed is a genuine arrival — the one new milestone
  // kind v5 adds to the Ortsschild list.
  const milestones: { kind: string; label: string; detail: string }[] = [];
  const line = lineById(station.lineId);
  if (line && lineCompletion(line, before) < 1 && lineCompletion(line, after) >= 1) {
    milestones.push({
      kind: "line-complete",
      label: `Linie ${line.number}`,
      detail: `${line.name} — ${line.nameEn}`,
    });
  }
  if (milestones.length > 0) {
    await supabase.from("milestone_events").insert(
      milestones.map((event) => ({ user_id: data.user.id, ...event })),
    );
  }
  return NextResponse.json({ ok: true, milestones, progress: row });
}
