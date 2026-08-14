import { NextResponse } from "next/server";
import { gateway, generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildEpisodePrompt,
  buildIndex,
  episodeSchema,
  fallbackEpisode,
  SEED_LEXICON,
  validateEpisode,
} from "@/lib/engine";
import type { Episode, EpisodeSpec } from "@/lib/engine";
import {
  aiCacheKey,
  EPISODE_MODEL,
  gatewayOptions,
  getCachedResponse,
  putCachedResponse,
} from "@/lib/ai";

const index = buildIndex(SEED_LEXICON);

const specSchema = z.object({
  allowedLemmas: z.array(z.string()),
  targetLemmas: z.array(z.string()),
  newLemmas: z.array(z.string()),
  clozeLemmas: z.array(z.string()),
  stage: z.number().int().min(1).max(5),
  coverageTarget: z.number().min(0.85).max(0.99),
  register: z.enum(["colloquial", "neutral"]),
  topic: z.string(),
  storySentences: z.number().int().min(3).max(10),
  dialogueTurns: z.number().int().min(4).max(12),
  constructCount: z.number().int().min(0).max(5),
  grammarFocus: z.string().optional(),
});

/**
 * POST → generate the session's whole episode from its EpisodeSpec.
 * One model call carries the entire session, so this route works
 * harder than the old per-task route ever did to return something:
 * strict validation with a repair prompt, a lenient acceptance floor
 * on the final attempt, and a curated fallback episode rather than an
 * error — the session must never open on "no usable text".
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = specSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const spec = parsed.data as EpisodeSpec;

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ episode: fallbackEpisode(spec), fallback: true });
  }

  const { system, prompt } = buildEpisodePrompt(spec, index);

  // Same spec → same prompt → the model is never asked twice.
  const key = aiCacheKey(EPISODE_MODEL, "episode", system, prompt);
  const cached = await getCachedResponse(key);
  if (cached) return NextResponse.json({ episode: cached, attempt: 0, cached: true });

  let attemptPrompt = prompt;
  let lenientCandidate: Episode | null = null;
  // Two attempts bound the briefing-screen wait; the lenient floor
  // catches near-misses, and the curated scene catches everything else.
  const ATTEMPTS = 2;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let episode: Episode;
    try {
      ({ object: episode } = await generateObject({
        model: gateway(EPISODE_MODEL),
        system,
        prompt: attemptPrompt,
        schema: episodeSchema,
        providerOptions: gatewayOptions(data.user.id),
      }));
    } catch (error) {
      // A schema miss is a re-rollable model wobble; gateway failures
      // (rate limits, outages) are terminal for this request — the
      // curated scene keeps the session alive either way.
      if (NoObjectGeneratedError.isInstance(error)) {
        console.warn(
          `[episode] attempt ${attempt + 1} missed the schema:`,
          error.text?.slice(0, 300),
        );
        continue;
      }
      console.warn("[episode] model call failed:", error);
      break;
    }
    const issues = validateEpisode(episode, spec, index, { strict: true });
    if (issues.length === 0) {
      await putCachedResponse(key, EPISODE_MODEL, "episode", episode);
      return NextResponse.json({ episode, attempt: attempt + 1 });
    }
    if (validateEpisode(episode, spec, index, { strict: false }).length === 0) {
      lenientCandidate = episode;
    }
    console.warn(
      `[episode] attempt ${attempt + 1} failed the contract (allowed=${spec.allowedLemmas.length}):`,
      issues.map((issue) => issue.detail).join(" | "),
    );
    attemptPrompt = `${prompt}\n\nYour previous attempt broke these rules — fix them and return the full episode again:\n${issues
      .map((issue) => `- ${issue.detail}`)
      .join("\n")}`;
  }

  // An imperfect scene beats no scene: accept the best near-miss.
  if (lenientCandidate) {
    await putCachedResponse(key, EPISODE_MODEL, "episode", lenientCandidate);
    return NextResponse.json({ episode: lenientCandidate, attempt: ATTEMPTS, lenient: true });
  }
  return NextResponse.json({ episode: fallbackEpisode(spec), fallback: true });
}
