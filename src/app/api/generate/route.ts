import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildGenerationPrompt,
  buildIndex,
  generatedClozeSchema,
  generatedConstructSchema,
  generatedDialogueSchema,
  generatedStorySchema,
  SEED_LEXICON,
  validateGenerated,
} from "@/lib/engine";
import type { GenerationSpec, TaskKind } from "@/lib/engine";
import {
  aiCacheKey,
  gatewayOptions,
  getCachedResponse,
  MODEL,
  putCachedResponse,
} from "@/lib/ai";

const index = buildIndex(SEED_LEXICON);

const SCHEMAS: Partial<Record<TaskKind, z.ZodTypeAny>> = {
  "story-read": generatedStorySchema,
  "listen-clip": generatedStorySchema,
  shadowing: generatedStorySchema,
  "dialogue-read": generatedDialogueSchema,
  "scripted-dialogue": generatedDialogueSchema,
  "cloze-type": generatedClozeSchema,
  "construct-sentence": generatedConstructSchema,
  "timed-recall": generatedConstructSchema,
};

const specSchema = z.object({
  kind: z.string(),
  allowedLemmas: z.array(z.string()),
  targetLemmas: z.array(z.string()),
  newLemmas: z.array(z.string()),
  stage: z.number().int().min(1).max(5),
  coverageTarget: z.number().min(0.85).max(0.99),
  register: z.enum(["colloquial", "neutral"]),
  topic: z.string().optional(),
  sentenceCount: z.number().int().optional(),
});

/** Pull every German string out of a generated object for validation. */
function germanTextOf(kind: TaskKind, content: unknown): string {
  const value = content as Record<string, unknown>;
  if (Array.isArray(value.sentences)) return (value.sentences as string[]).join(" ");
  if (Array.isArray(value.turns)) {
    return (value.turns as { de: string }[]).map((turn) => turn.de).join(" ");
  }
  if (Array.isArray(value.items)) {
    return (value.items as Record<string, string>[])
      .map((item) => item.sentence ?? item.targetDe ?? "")
      .join(" ");
  }
  return "";
}

/**
 * POST → generate content for one task spec from the session plan,
 * enforcing the coverage contract: validate, re-prompt once with the
 * issues, and refuse rather than serve incomprehensible content.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY not configured — content generation offline" },
      { status: 503 },
    );
  }
  const parsed = specSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const spec = parsed.data as GenerationSpec;
  const schema = SCHEMAS[spec.kind as TaskKind];
  if (!schema) {
    return NextResponse.json({ error: `kind "${spec.kind}" is not generated` }, { status: 400 });
  }

  const { system, prompt } = buildGenerationPrompt(spec, index);

  // Same spec → same prompt → the model is never asked twice.
  const key = aiCacheKey(MODEL, spec.kind, system, prompt);
  const cached = await getCachedResponse(key);
  if (cached) return NextResponse.json({ content: cached, attempt: 0, cached: true });

  let attemptPrompt = prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    let object: unknown;
    try {
      ({ object } = await generateObject({
        model: MODEL,
        system,
        prompt: attemptPrompt,
        schema,
        providerOptions: gatewayOptions(data.user.id),
      }));
    } catch (error) {
      // Gateway/model failures (rate limits, outages) are expected in
      // operation — surface the same honest "skip this task" contract
      // the client already handles instead of a raw 500.
      console.warn(`[generate] ${spec.kind} model call failed:`, error);
      return NextResponse.json(
        { error: "model call failed; task should be skipped" },
        { status: 502 },
      );
    }
    const issues = validateGenerated(germanTextOf(spec.kind as TaskKind, object), spec, index);
    if (issues.length === 0) {
      await putCachedResponse(key, spec.kind, object);
      return NextResponse.json({ content: object, attempt: attempt + 1 });
    }
    console.warn(
      `[generate] ${spec.kind} attempt ${attempt + 1} failed coverage contract (allowed=${spec.allowedLemmas.length}):`,
      issues.map((issue) => issue.detail).join(" | "),
    );
    attemptPrompt = `${prompt}\n\nYour previous attempt broke these rules — fix them:\n${issues
      .map((issue) => `- ${issue.detail}`)
      .join("\n")}`;
  }
  return NextResponse.json(
    { error: "generation failed the coverage contract twice; task should be skipped" },
    { status: 502 },
  );
}
