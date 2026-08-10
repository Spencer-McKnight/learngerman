import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only admin client. Bypasses RLS — for background jobs like TTS
 * caching, content pre-generation and FSRS batch optimisation. Never import
 * from client code.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
