import { NextResponse } from "next/server";
import { gateway, generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { stationById } from "@/lib/curriculum";
import { EPISODE_MODEL, gatewayOptions, getCachedResponse, putCachedResponse } from "@/lib/ai";
import {
  buildVariationPrompt,
  sceneVariationSchema,
  validateVariation,
  variationCacheKey,
  type SceneVariation,
} from "@/lib/tutor/scene";
import { allowedAtStation, loadTutorContext, TUTOR_INDEX } from "@/lib/tutor/load";

const requestSchema = z.object({
  stationId: z.string(),
  /** Anything that distinguishes this replay (visit number, date); same seed → same scene. */
  seed: z.string().max(64).optional(),
});

/**
 * POST → a scene variation for a replay: same ladder as the old
 * episode route (strict → repair → lenient → scripted). The scripted
 * scene is returned, never an error, so the player always has lines.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const station = stationById(parsed.data.stationId);
  if (!station) return NextResponse.json({ error: "unknown station" }, { status: 404 });
  const seed = parsed.data.seed ?? "1";
  const scripted = { lines: station.scene.lines, source: "scripted" as const };

  if (!process.env.AI_GATEWAY_API_KEY) return NextResponse.json(scripted);

  let allowed: Set<string>;
  let coverageTarget = 0.95;
  try {
    const { snapshot } = await loadTutorContext(supabase, data.user.id);
    allowed = allowedAtStation(station, snapshot);
    coverageTarget = snapshot.coverageTarget;
  } catch (error) {
    console.warn("[scene] learner context failed; serving the scripted scene:", error);
    return NextResponse.json(scripted);
  }

  const key = variationCacheKey(EPISODE_MODEL, station.id, allowed, seed);
  const cached = sceneVariationSchema.safeParse(await getCachedResponse(key));
  if (cached.success) return NextResponse.json({ lines: cached.data.lines, source: "model", cached: true });

  const { system, prompt } = buildVariationPrompt(station, allowed, TUTOR_INDEX, seed);
  const validate = (v: SceneVariation, strict: boolean) =>
    validateVariation(v.lines, station, allowed, TUTOR_INDEX, { strict, coverageTarget });

  let attemptPrompt = prompt;
  let lenient: SceneVariation | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let variation: SceneVariation;
    try {
      ({ object: variation } = await generateObject({
        model: gateway(EPISODE_MODEL),
        system,
        prompt: attemptPrompt,
        schema: sceneVariationSchema,
        providerOptions: gatewayOptions(data.user.id),
      }));
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(`[scene] attempt ${attempt + 1} missed the schema:`, error.text?.slice(0, 300));
        continue;
      }
      console.warn("[scene] model call failed:", error);
      break;
    }
    const issues = validate(variation, true);
    if (issues.length === 0) {
      await putCachedResponse(key, EPISODE_MODEL, "scene-variation", variation);
      return NextResponse.json({ lines: variation.lines, source: "model" });
    }
    if (validate(variation, false).length === 0) lenient = variation;
    console.warn(`[scene] attempt ${attempt + 1} failed the contract (allowed=${allowed.size}):`, issues.map((i) => i.detail).join(" | "));
    attemptPrompt = `${prompt}\n\nYour previous attempt broke these rules — fix them and return the whole scene again:\n${issues
      .map((i) => `- ${i.detail}`)
      .join("\n")}`;
  }
  if (lenient) {
    await putCachedResponse(key, EPISODE_MODEL, "scene-variation", lenient);
    return NextResponse.json({ lines: lenient.lines, source: "model", lenient: true });
  }
  return NextResponse.json(scripted);
}
