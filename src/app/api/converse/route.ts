import { NextResponse } from "next/server";
import { gateway, generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { stationById } from "@/lib/curriculum";
import { validateGenerated, type GenerationSpec, type SyntaxStage } from "@/lib/engine";
import { aiCacheKey, CHAT_MODEL, gatewayOptions, getCachedResponse, putCachedResponse } from "@/lib/ai";
import { buildConversePrompt, converseReplySchema, type ConverseReply } from "@/lib/tutor/converse";
import { allowedAtStation, loadTutorContext, TUTOR_INDEX } from "@/lib/tutor/load";

const requestSchema = z.object({
  stationId: z.string(),
  history: z.array(z.object({ role: z.enum(["tutor", "learner"]), text: z.string().max(500) })).max(30),
  /** Cast id from the station the tutor should play; defaults to Jule. */
  counterpart: z.string().optional(),
});

/**
 * POST → one turn of free conversation inside a station's situation,
 * held to the coverage contract (one repair attempt, then an honest
 * 502 the client already renders as "skip"). 503 without a key: there
 * is no scripted stand-in for a live conversation partner.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "AI_GATEWAY_API_KEY not configured — conversation offline" }, { status: 503 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { stationId, history, counterpart } = parsed.data;
  const station = stationById(stationId);
  if (!station) return NextResponse.json({ error: "unknown station" }, { status: 404 });

  let allowed: Set<string>;
  let stage: SyntaxStage;
  let coverageTarget: number;
  try {
    const { snapshot } = await loadTutorContext(supabase, data.user.id);
    allowed = allowedAtStation(station, snapshot);
    // Receptive ceiling: the lower of what the station asks and what
    // the learner has stabilised (stageConstraints adds the +1 itself).
    stage = Math.min(station.stage, snapshot.syntax.stage) as SyntaxStage;
    coverageTarget = snapshot.coverageTarget;
  } catch (error) {
    console.warn("[converse] learner context failed:", error);
    return NextResponse.json({ error: "learner state unavailable" }, { status: 502 });
  }

  const { system, prompt: basePrompt, counterpart: who } = buildConversePrompt(
    station, allowed, TUTOR_INDEX, stage, counterpart, history,
  );
  const spec: GenerationSpec = {
    kind: "conversation-turn",
    allowedLemmas: [...allowed],
    targetLemmas: [],
    newLemmas: [],
    stage,
    coverageTarget,
    register: "colloquial",
  };

  // Identical transcript + vocabulary → identical reply; in practice
  // this dedupes openers.
  const key = aiCacheKey(CHAT_MODEL, "converse", system, basePrompt);
  const cached = converseReplySchema.safeParse(await getCachedResponse(key));
  if (cached.success) return NextResponse.json({ ...cached.data, counterpart: who.id, cached: true });

  let prompt = basePrompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply: ConverseReply;
    try {
      ({ object: reply } = await generateObject({
        model: gateway(CHAT_MODEL),
        system,
        prompt,
        schema: converseReplySchema,
        providerOptions: gatewayOptions(data.user.id),
      }));
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(`[converse] attempt ${attempt + 1} missed the schema:`, error.text?.slice(0, 200));
        continue;
      }
      console.warn("[converse] model call failed:", error);
      return NextResponse.json({ error: "model call failed; conversation unavailable" }, { status: 502 });
    }
    const issues = validateGenerated(reply.replyDe, spec, TUTOR_INDEX);
    if (issues.length === 0) {
      await putCachedResponse(key, CHAT_MODEL, "converse", reply);
      return NextResponse.json({ ...reply, counterpart: who.id });
    }
    console.warn(`[converse] attempt ${attempt + 1} failed the coverage contract:`, issues.map((i) => i.detail).join(" | "));
    prompt = `${basePrompt}\n\nYour previous reply broke these rules — fix them:\n${issues.map((i) => `- ${i.detail}`).join("\n")}`;
  }
  return NextResponse.json({ error: "reply failed the coverage contract twice" }, { status: 502 });
}
