"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getStrings, parseUiLang, UI_LANG_COOKIE } from "@/lib/i18n/strings";
import { getUiStrings } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { saved: boolean; error: string | null };

/** Challenge maps to the engine's coverage target: how much of every
 *  text is guaranteed known. Lower = braver. */
const CHALLENGE_COVERAGE = { sanft: 0.97, standard: 0.95, mutig: 0.93 } as const;

const settingsSchema = z.object({
  minutes: z.coerce.number().pipe(z.union([z.literal(5), z.literal(8), z.literal(12), z.literal(15)])),
  challenge: z.enum(["sanft", "standard", "mutig"]),
  uiLang: z.enum(["de", "en"]),
  plan: z.string().trim().max(140).optional(),
});

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { t } = await getUiStrings();
  const parsed = settingsSchema.safeParse({
    minutes: formData.get("minutes"),
    challenge: formData.get("challenge"),
    uiLang: formData.get("uiLang"),
    plan: formData.get("plan") ?? undefined,
  });
  if (!parsed.success) {
    return { saved: false, error: t.settings.errorPlanTooLong };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { saved: false, error: t.settings.errorNotSignedIn };

  const { data: existing } = await supabase
    .from("learner_profiles")
    .select("prefs")
    .maybeSingle();
  const prefs = {
    ...((existing?.prefs as Record<string, unknown>) ?? {}),
    plan: parsed.data.plan || null,
    uiLang: parsed.data.uiLang,
  };
  const { error } = await supabase.from("learner_profiles").upsert({
    user_id: data.user.id,
    minutes_per_session: parsed.data.minutes,
    coverage_target: CHALLENGE_COVERAGE[parsed.data.challenge],
    prefs,
  });
  if (error) {
    // Report in the language just chosen, not the one being left.
    return {
      saved: false,
      error: getStrings(parsed.data.uiLang).settings.errorSaveFailed,
    };
  }
  const store = await cookies();
  store.set(UI_LANG_COOKIE, parsed.data.uiLang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { saved: true, error: null };
}

/** After sign-in on a fresh device, restore the saved interface
 *  language so the cookie matches the profile. */
export async function syncUiLangFromProfile(): Promise<void> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("prefs")
    .maybeSingle();
  const uiLang = (profile?.prefs as { uiLang?: string } | null)?.uiLang;
  if (!uiLang) return;
  const store = await cookies();
  store.set(UI_LANG_COOKIE, parseUiLang(uiLang), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** Store the onboarding if-then plan without touching other settings. */
export async function savePlan(plan: string): Promise<void> {
  const trimmed = plan.trim().slice(0, 140);
  if (!trimmed) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: existing } = await supabase
    .from("learner_profiles")
    .select("prefs")
    .maybeSingle();
  await supabase.from("learner_profiles").upsert({
    user_id: data.user.id,
    prefs: { ...((existing?.prefs as Record<string, unknown>) ?? {}), plan: trimmed },
  });
  revalidatePath("/");
}
