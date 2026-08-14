import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Models routed through the Vercel AI Gateway, tiered by what the call
 * carries. The episode is ONE call per session and every task hangs
 * off it, so it gets a properly capable model; conversation turns are
 * small and latency-sensitive, so they ride the fast tier. Swap via
 * env without a deploy.
 */
export const EPISODE_MODEL = process.env.AI_MODEL ?? "google/gemini-2.5-flash";
export const CHAT_MODEL = process.env.AI_CHAT_MODEL ?? "google/gemini-2.5-flash-lite";

/**
 * Fallback models when the primary errors or is rate-limited. Both
 * defaults are AI-Gateway-free-tier accessible (verified live:
 * gemini-2.5-flash/-lite → 200; haiku-4.5 and gpt-5-nano are paid).
 * Note: gateway routing options only take effect with the `gateway()`
 * model wrapper — a plain model string ignores providerOptions.gateway
 * (current gateway docs: `sort`/`caching` are not options;
 * `models`/`order`/`only`/`user`/`tags`/`cacheControl` are).
 */
const FALLBACK_MODELS = ["google/gemini-2.5-flash-lite", "anthropic/claude-haiku-4.5"];

/** Gateway provider options: failover chain + per-learner attribution. */
export function gatewayOptions(userId?: string) {
  return {
    gateway: {
      models: FALLBACK_MODELS,
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
  model: string,
  kind: string,
  content: unknown,
): Promise<void> {
  remember(key, content);
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_response_cache").upsert({ key, model, kind, content });
  } catch {
    // Cache write is an optimisation, never a failure.
  }
}
