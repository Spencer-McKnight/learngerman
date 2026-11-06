import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { checkServices } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";
import { loadStationProgress } from "@/lib/engine/store";
import { currentStation, lineOf, STATIONS } from "@/lib/curriculum";
import { logout } from "@/app/login/actions";
import { getUiStrings } from "@/lib/i18n/server";
import { parseUiLang } from "@/lib/i18n/strings";
import { Card, Eyebrow, SectionLabel, StationSign, cn, type LineNumber } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Du() {
  const supabase = await createClient();
  const [{ data: claims }, profile, checks, stationRows, { lang, t }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("learner_profiles")
      .select("minutes_per_session, coverage_target, prefs, placed")
      .maybeSingle(),
    checkServices(),
    loadStationProgress(supabase),
    getUiStrings(),
  ]);

  const email = (claims?.claims?.email as string | undefined) ?? null;
  const minutes = (profile.data?.minutes_per_session ?? 12) as 5 | 8 | 12 | 15;
  const coverage = profile.data?.coverage_target ?? 0.95;
  const challenge = coverage >= 0.965 ? "sanft" : coverage <= 0.94 ? "mutig" : "standard";
  const prefs = profile.data?.prefs as { plan?: string; uiLang?: string } | null;
  const plan = prefs?.plan ?? "";
  const uiLang = prefs?.uiLang ? parseUiLang(prefs.uiLang) : lang;
  const placed = profile.data?.placed ?? false;

  const current = STATIONS.length > 0 ? currentStation(stationRows) : null;
  const currentLine = current ? lineOf(current) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-gutter pt-10 pb-6 stagger-children">
      <header className="flex flex-col gap-3">
        <Eyebrow tone="accent">{t.du.eyebrow}</Eyebrow>
        <h1 className="font-display text-display-xl text-ink">{t.du.title}</h1>
      </header>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.du.course}</SectionLabel>
        {current && currentLine && placed ? (
          <>
            <p className="text-body-sm text-ink-muted">{t.du.currentStation}</p>
            <StationSign
              name={current.name}
              subtitle={lang === "de" ? current.title : current.titleEn}
              line={Math.min(5, Math.max(1, currentLine.number)) as LineNumber}
              status="current"
              index={current.order}
              statusLabel={t.home.status.current}
              href={`/station/${current.id}`}
            />
          </>
        ) : (
          <p className="text-body-sm text-ink-muted">{placed ? t.du.courseEmpty : t.home.startBody}</p>
        )}
        <Link
          href={placed ? "/" : "/willkommen"}
          className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-accent hover:underline"
        >
          {placed ? t.du.toMap : t.home.letsGo}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Card>

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
            <li key={check.name} className="flex items-center gap-2.5 text-body-sm">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-pill",
                  check.ok ? "bg-success-fill" : check.required ? "bg-error-fill" : "bg-ink-faint",
                )}
              />
              <span className="font-medium text-ink">{check.name}</span>
              <span className="ml-auto truncate text-caption text-ink-muted" title={check.detail}>
                {check.detail}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <footer className="flex flex-col items-center gap-1 pb-2 text-caption text-ink-muted">
        {email && (
          <form action={logout} className="flex items-center gap-2">
            <span>{t.du.signedInAs(email)}</span>
            <span aria-hidden>&middot;</span>
            <button type="submit" className="min-h-11 font-medium text-accent hover:underline">
              {t.du.signOut}
            </button>
          </form>
        )}
      </footer>
    </main>
  );
}
