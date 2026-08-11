import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildIndex, composeSession, progressSummary, SEED_LEXICON } from "@/lib/engine";
import type { SessionMode } from "@/lib/engine";
import { loadSnapshot } from "@/lib/engine/store";

const index = buildIndex(SEED_LEXICON);

const requestSchema = z.object({
  mode: z.enum(["full", "review", "ear", "speak"]).optional(),
});

/**
 * POST → compose the next session for the signed-in learner and
 * persist the plan. The client renders directly-servable tasks
 * (retrieval taps, HVPT, grammar bites) from the plan and calls
 * /api/generate for each task carrying a GenerationSpec.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => ({})));
  const mode: SessionMode = body.success ? (body.data.mode ?? "full") : "full";

  const snapshot = await loadSnapshot(supabase, data.user.id);
  const plan = composeSession(snapshot, index, { mode });
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ user_id: data.user.id, plan })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sessionId: session.id,
    plan,
    progress: progressSummary(snapshot),
    needsPlacement: !snapshot.placed && snapshot.words.length === 0,
  });
}

const completeSchema = z.object({ sessionId: z.uuid() });

/** PATCH → mark a session completed (this is what feeds the streak). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = completeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const { error } = await supabase
    .from("sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", body.data.sessionId)
    .eq("user_id", data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
