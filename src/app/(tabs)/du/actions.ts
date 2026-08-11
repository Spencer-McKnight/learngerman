"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { saved: boolean; error: string | null };

/** Challenge maps to the engine's coverage target: how much of every
 *  text is guaranteed known. Lower = braver. */
const CHALLENGE_COVERAGE = { sanft: 0.97, standard: 0.95, mutig: 0.93 } as const;

const settingsSchema = z.object({
  minutes: z.coerce.number().pipe(z.union([z.literal(5), z.literal(8), z.literal(12), z.literal(15)])),
  challenge: z.enum(["sanft", "standard", "mutig"]),
  plan: z.string().trim().max(140, "Der Plan ist zu lang.").optional(),
});

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = settingsSchema.safeParse({
    minutes: formData.get("minutes"),
    challenge: formData.get("challenge"),
    plan: formData.get("plan") ?? undefined,
  });
  if (!parsed.success) {
    return { saved: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { saved: false, error: "Nicht angemeldet." };

  const { data: existing } = await supabase
    .from("learner_profiles")
    .select("prefs")
    .maybeSingle();
  const prefs = {
    ...((existing?.prefs as Record<string, unknown>) ?? {}),
    plan: parsed.data.plan || null,
  };
  const { error } = await supabase.from("learner_profiles").upsert({
    user_id: data.user.id,
    minutes_per_session: parsed.data.minutes,
    coverage_target: CHALLENGE_COVERAGE[parsed.data.challenge],
    prefs,
  });
  if (error) return { saved: false, error: "Speichern hat nicht geklappt." };
  revalidatePath("/");
  revalidatePath("/du");
  return { saved: true, error: null };
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
