import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildIndex,
  conversationReplySchema,
  SEED_LEXICON,
  validateGenerated,
} from "@/lib/engine";
import type { GenerationSpec } from "@/lib/engine";
import {
  aiCacheKey,
  gatewayOptions,
  getCachedResponse,
  MODEL,
  putCachedResponse,
} from "@/lib/ai";

const index = buildIndex(SEED_LEXICON);

const requestSchema = z.object({
  allowedLemmas: z.array(z.string()),
  /** Due lexemes the tutor should try to weave in. */
  targetLemmas: z.array(z.string()),
  stage: z.number().int().min(1).max(5),
  coverageTarget: z.number().min(0.85).max(0.99),
  history: z
    .array(z.object({ role: z.enum(["tutor", "learner"]), text: z.string() }))
    .max(30),
});

const SYSTEM = `You are a friendly German conversation partner for one learner.
Use ONLY allowed-list words (any inflected form), plus names and numbers.
1–2 short casual sentences per turn; end with something the learner can answer.
Warm and curious, never teacherly.`;

/**
 * POST → one tutor turn of free conversation, held to the coverage
 * contract like all generated content (one repair attempt, then 502).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY not configured — conversation offline" },
      { status: 503 },
    );
  }
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { allowedLemmas, targetLemmas, stage, coverageTarget, history } = parsed.data;

  const spec: GenerationSpec = {
    kind: "conversation-turn",
    allowedLemmas,
    targetLemmas: [],
    newLemmas: [],
    stage: stage as GenerationSpec["stage"],
    coverageTarget,
    register: "colloquial",
  };
  // Sorted allowed list leads the prompt as a stable prefix providers
  // can prompt-cache; everything that changes per turn comes after.
  const allowed = allowedLemmas
    .map((id) => index.byId.get(id)?.lemma)
    .filter((lemma): lemma is string => Boolean(lemma))
    .sort((a, b) => a.localeCompare(b, "de"))
    .join(", ");
  const dueWords = targetLemmas
    .map((id) => index.byId.get(id)?.lemma)
    .filter(Boolean)
    .join(", ");
  // The tutor only needs recent context to reply; older turns just
  // cost tokens.
  const transcript = history
    .slice(-12)
    .map((turn) => `${turn.role === "tutor" ? "Du" : "Lernende:r"}: ${turn.text}`)
    .join("\n");
  const basePrompt = [
    `Allowed words: ${allowed}`,
    dueWords ? `Weave in when natural: ${dueWords}` : null,
    history.length === 0
      ? "Open with a warm, simple question."
      : `Conversation:\n${transcript}\n\nReply to the last turn.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Identical transcript + word lists → identical reply is fine; in
  // practice this mostly dedupes conversation openers.
  const key = aiCacheKey(MODEL, "conversation-turn", SYSTEM, basePrompt);
  const cached = await getCachedResponse(key);
  if (cached) return NextResponse.json({ reply: cached, attempt: 0, cached: true });

  let prompt = basePrompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { object } = await generateObject({
      model: MODEL,
      system: SYSTEM,
      prompt,
      schema: conversationReplySchema,
      providerOptions: gatewayOptions(data.user.id),
    });
    const issues = validateGenerated(object.replyDe, spec, index);
    if (issues.length === 0) {
      await putCachedResponse(key, "conversation-turn", object);
      return NextResponse.json({ reply: object, attempt: attempt + 1 });
    }
    prompt = `${basePrompt}\n\nYour previous reply broke these rules — fix them:\n${issues
      .map((issue) => `- ${issue.detail}`)
      .join("\n")}`;
  }
  return NextResponse.json(
    { error: "reply failed the coverage contract twice" },
    { status: 502 },
  );
}
