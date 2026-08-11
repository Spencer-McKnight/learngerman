import { checkServices } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Card, SectionLabel } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

/** Du — how you learn: session length, challenge, your habit anchor,
 *  device preferences, account, and service health. */
export default async function Du() {
  const supabase = await createClient();
  const [{ data: claims }, profile, checks] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("learner_profiles")
      .select("minutes_per_session, coverage_target, prefs")
      .maybeSingle(),
    checkServices(),
  ]);

  const email = (claims?.claims?.email as string | undefined) ?? null;
  const minutes = (profile.data?.minutes_per_session ?? 12) as 5 | 8 | 12 | 15;
  const coverage = profile.data?.coverage_target ?? 0.95;
  const challenge = coverage >= 0.965 ? "sanft" : coverage <= 0.94 ? "mutig" : "standard";
  const plan = (profile.data?.prefs as { plan?: string } | null)?.plan ?? "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-10">
      <header className="flex flex-col gap-1">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Du
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          So lernst du.
        </h1>
      </header>

      <Card>
        <SettingsForm
          initialMinutes={[5, 8, 12, 15].includes(minutes) ? minutes : 12}
          initialChallenge={challenge}
          initialPlan={plan}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Dienste</SectionLabel>
        <ul className="flex flex-col gap-2">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${
                  check.ok ? "bg-success" : check.required ? "bg-error" : "bg-muted"
                }`}
              />
              <span className="font-medium">{check.name}</span>
              <span className="ml-auto truncate text-xs text-muted" title={check.detail}>
                {check.detail}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <footer className="flex flex-col items-center gap-1 pb-2 text-xs text-muted">
        {email && (
          <form action={logout} className="flex items-center gap-2">
            <span>Angemeldet als {email}</span>
            <span aria-hidden>·</span>
            <button type="submit" className="font-medium text-accent-bright hover:underline">
              Abmelden
            </button>
          </form>
        )}
      </footer>
    </main>
  );
}
