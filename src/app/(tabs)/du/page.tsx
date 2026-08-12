import { checkServices } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { getUiStrings } from "@/lib/i18n/server";
import { parseUiLang } from "@/lib/i18n/strings";
import { Card, SectionLabel } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Du() {
  const supabase = await createClient();
  const [{ data: claims }, profile, checks, { lang, t }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("learner_profiles")
      .select("minutes_per_session, coverage_target, prefs")
      .maybeSingle(),
    checkServices(),
    getUiStrings(),
  ]);

  const email = (claims?.claims?.email as string | undefined) ?? null;
  const minutes = (profile.data?.minutes_per_session ?? 12) as 5 | 8 | 12 | 15;
  const coverage = profile.data?.coverage_target ?? 0.95;
  const challenge = coverage >= 0.965 ? "sanft" : coverage <= 0.94 ? "mutig" : "standard";
  const prefs = profile.data?.prefs as { plan?: string; uiLang?: string } | null;
  const plan = prefs?.plan ?? "";
  const uiLang = prefs?.uiLang ? parseUiLang(prefs.uiLang) : lang;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-10 stagger-children">
      <header className="flex flex-col gap-1">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {t.du.eyebrow}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {t.du.title}
        </h1>
      </header>

      <Card>
        <SettingsForm
          initialMinutes={[5, 8, 12, 15].includes(minutes) ? minutes : 12}
          initialChallenge={challenge}
          initialPlan={plan}
          initialUiLang={uiLang}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.du.services}</SectionLabel>
        <ul className="flex flex-col gap-2">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden
                className={`size-2.5 shrink-0 rounded-full transition-colors ${
                  check.ok ? "bg-success" : check.required ? "bg-error animate-pulse-soft" : "bg-muted"
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
            <span>{t.du.signedInAs(email)}</span>
            <span aria-hidden>&middot;</span>
            <button type="submit" className="font-medium text-accent-bright hover:underline transition-colors">
              {t.du.signOut}
            </button>
          </form>
        )}
      </footer>
    </main>
  );
}
