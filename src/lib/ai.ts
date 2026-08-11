import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Model routed through the Vercel AI Gateway. Language tasks here are
 * simple enough for the cheapest capable tier — gemini-2.5-flash-lite
 * is $0.10/M in, $0.40/M out (vs $0.30/$2.50 for plain flash). Swap
 * via env without a deploy.
 */
export const MODEL = process.env.AI_MODEL ?? "google/gemini-2.5-flash-lite";

/**
 * Gateway provider options: route to the cheapest provider first, let
 * providers prompt-cache our large repeated system/word-list prefixes,
 * and fall back to the next-cheapest models if the primary is down.
 * `user` ties spend and rate limits to the learner in the dashboard.
 */
export function gatewayOptions(userId?: string) {
  return {
    gateway: {
      sort: "cost",
      caching: "auto",
      models: ["openai/gpt-5-nano", "google/gemini-2.5-flash"],
      tags: ["app:learngerman"],
      ...(userId ? { user: userId } : {}),
    },
  };
}

/** Stable cache key over everything that determines a model response. */
export function aiCacheKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/** Warm-instance fast path in front of the Supabase cache. */
const memory = new Map<string, unknown>();
const MEMORY_MAX = 500;

function remember(key: string, content: unknown) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, content);
}

/**
 * Look up a previously validated response. Cache failures are never
 * fatal — worst case we pay for one more model call.
 */
export async function getCachedResponse(key: string): Promise<unknown | null> {
  const warm = memory.get(key);
  if (warm !== undefined) return warm;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ai_response_cache")
      .select("content")
      .eq("key", key)
      .maybeSingle();
    if (!data) return null;
    remember(key, data.content);
    void supabase.rpc("touch_ai_cache", { cache_key: key });
    return data.content;
  } catch {
    return null;
  }
}

/** Store a response that passed validation. Best-effort. */
export async function putCachedResponse(
  key: string,
  kind: string,
  content: unknown,
): Promise<void> {
  remember(key, content);
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_response_cache").upsert({ key, model: MODEL, kind, content });
  } catch {
    // Cache write is an optimisation, never a failure.
  }
}
