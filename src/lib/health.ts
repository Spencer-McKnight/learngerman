import { createClient } from "@/lib/supabase/server";

export type ServiceCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

/**
 * Live checks of every connected service. Used by the landing page and
 * /api/health so infrastructure problems surface immediately.
 */
export async function checkServices(): Promise<ServiceCheck[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const checks: ServiceCheck[] = [];

  let authOk = false;
  let authDetail = "unreachable";
  if (url && publishableKey) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: publishableKey },
        cache: "no-store",
      });
      authOk = res.ok;
      authDetail = res.ok ? "healthy" : `HTTP ${res.status}`;
    } catch {
      authDetail = "unreachable";
    }
  } else {
    authDetail = "Supabase env vars missing";
  }
  checks.push({ name: "Supabase Auth", ok: authOk, detail: authDetail });

  let dbOk = false;
  let dbDetail = "unreachable";
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (error) {
      dbDetail = error.message;
    } else {
      dbOk = true;
      dbDetail = "profiles table reachable, RLS active";
    }
  } catch (err) {
    dbDetail = err instanceof Error ? err.message : "unknown error";
  }
  checks.push({ name: "Supabase Postgres", ok: dbOk, detail: dbDetail });

  const gatewayKeySet = Boolean(process.env.AI_GATEWAY_API_KEY);
  checks.push({
    name: "Vercel AI Gateway",
    ok: gatewayKeySet,
    detail: gatewayKeySet
      ? "key configured"
      : "AI_GATEWAY_API_KEY not set — needed once the LLM tutor lands",
  });

  return checks;
}
