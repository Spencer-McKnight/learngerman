import { NextResponse } from "next/server";
import { gateway, generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUiLang } from "@/lib/i18n/server";
import { stationById } from "@/lib/curriculum";
import { aiCacheKey, COACH_MODEL, gatewayOptions, getCachedResponse, putCachedResponse } from "@/lib/ai";
import {
  briefSchema,
  debriefSchema,
  buildBriefPrompt,
  buildDebriefPrompt,
  fallbackBrief,
  fallbackDebrief,
  validateBrief,
  validateDebrief,
  type Brief,
  type Debrief,
  type LessonResult,
} from "@/lib/tutor/coach";
import { keyPerformances, learnerSignals, signalsSignature, type LearnerSignals } from "@/lib/tutor/signals";
import { initialSkills } from "@/lib/engine";
import { loadTutorContext, TUTOR_INDEX } from "@/lib/tutor/load";

const resultsSchema = z.object({
  steps: z.array(z.object({ stepKind: z.string(), correct: z.boolean(), detail: z.string().optional() })).max(40),
  performanceGrade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  transcript: z
    .array(z.object({ promptDe: z.string().optional(), saidDe: z.string(), expectedDe: z.string() }))
    .max(20)
    .optional(),
});

const requestSchema = z.discriminatedUnion("phase", [
  z.object({ stationId: z.string(), phase: z.literal("brief"), lang: z.enum(["de", "en"]).optional() }),
  z.object({ stationId: z.string(), phase: z.literal("debrief"), results: resultsSchema, lang: z.enum(["de", "en"]).optional() }),
]);

/**
 * POST → Jule's briefing or debrief for one station, personalised from
 * the learner's real signals when a key is configured, hand-written
 * plus deterministic key performances otherwise. The fallback is the
 * answer, not an error: the route never returns a 5xx for model trouble.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.data;
  const station = stationById(body.stationId);
  if (!station) return NextResponse.json({ error: "unknown station" }, { status: 404 });
  const lang = body.lang ?? (await getUiLang());

  let signals: LearnerSignals;
  try {
    const { snapshot, recent } = await loadTutorContext(supabase, data.user.id);
    signals = learnerSignals(snapshot, recent, TUTOR_INDEX);
  } catch (error) {
    console.warn("[coach] learner context failed; briefing without signals:", error);
    signals = learnerSignals(
      {
        userId: data.user.id, now: new Date(), words: [], skills: initialSkills(), syntax: { stage: 1, evidence: {} },
        grammar: { bites: {} }, ear: [], speakingRung: "shadowing", coverageTarget: 0.95, inputMinutes: 0,
        minutesPerSession: 12, placed: false,
      },
      [],
      TUTOR_INDEX,
    );
  }
  const kps = keyPerformances(station, signals, TUTOR_INDEX);

  if (body.phase === "brief") {
    const fallback = fallbackBrief(station, kps);
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json({ brief: fallback, keyPerformances: kps, signals, source: "fallback" });
    }
    // Keyed over the weakness pattern, not the snapshot: the same
    // pattern at the same station reuses the same words.
    const key = aiCacheKey(COACH_MODEL, "coach-brief", station.id, lang, signalsSignature(signals), kps.map((kp) => kp.focusDe).join("|"));
    const { system, prompt } = buildBriefPrompt(station, signals, kps, lang);
    const brief = await generateWithRepair<Brief>(key, system, prompt, briefSchema, (b) => validateBrief(b, kps).map((i) => i.detail), data.user.id, "brief");
    return NextResponse.json({
      brief: brief ?? fallback,
      keyPerformances: kps,
      signals,
      source: brief ? "model" : "fallback",
    });
  }

  const results: LessonResult = body.results;
  const fallback = fallbackDebrief(station, results);
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ debrief: fallback, keyPerformances: kps, signals, source: "fallback" });
  }
  const resultsHash = aiCacheKey(JSON.stringify(results));
  const key = aiCacheKey(COACH_MODEL, "coach-debrief", station.id, lang, signalsSignature(signals), resultsHash);
  const { system, prompt } = buildDebriefPrompt(station, results, signals, lang);
  const debrief = await generateWithRepair<Debrief>(key, system, prompt, debriefSchema, (d) => validateDebrief(d).map((i) => i.detail), data.user.id, "debrief");
  return NextResponse.json({
    debrief: debrief ?? fallback,
    keyPerformances: kps,
    signals,
    source: debrief ? "model" : "fallback",
  });
}

/**
 * Cache → generate → validate → one repair → null. Null means "use the
 * fallback"; every failure mode is logged, none is thrown.
 */
async function generateWithRepair<T>(
  key: string,
  system: string,
  basePrompt: string,
  schema: z.ZodType<T>,
  validate: (value: T) => string[],
  userId: string,
  phase: "brief" | "debrief",
): Promise<T | null> {
  const cached = await getCachedResponse(key);
  if (cached) {
    const check = schema.safeParse(cached);
    if (check.success) return check.data;
  }
  let prompt = basePrompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    let object: T;
    try {
      ({ object } = await generateObject({
        model: gateway(COACH_MODEL),
        system,
        prompt,
        schema,
        providerOptions: gatewayOptions(userId),
      }));
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(`[coach] ${phase} attempt ${attempt + 1} missed the schema:`, error.text?.slice(0, 200));
        continue;
      }
      console.warn(`[coach] ${phase} model call failed:`, error);
      return null;
    }
    const issues = validate(object);
    if (issues.length === 0) {
      await putCachedResponse(key, COACH_MODEL, `coach-${phase}`, object);
      return object;
    }
    console.warn(`[coach] ${phase} attempt ${attempt + 1} broke the contract:`, issues.join(" | "));
    prompt = `${basePrompt}\n\nYour previous answer broke these rules — fix them and answer again:\n${issues.map((i) => `- ${i}`).join("\n")}`;
  }
  return null;
}
