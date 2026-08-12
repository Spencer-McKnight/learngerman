import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeStreak, isoDay } from "@/lib/streak";
import { getUiStrings } from "@/lib/i18n/server";
import { Button, Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Heute — the start surface. One clear main path (today's round), the
 * humane streak stated calmly, and three small optional detours.
 * No countdowns, no guilt, nothing to lose.
 */
export default async function Heute() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: claims }, profile, sessions, dueCount, { t }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("learner_profiles")
      .select("placed, prefs, minutes_per_session")
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(120),
    supabase
      .from("word_states")
      .select("lexeme_id", { count: "exact", head: true })
      .lte("due", nowIso),
    getUiStrings(),
  ]);

  const displayName =
    (claims?.claims?.user_metadata?.display_name as string | undefined) ?? null;
  const placed = profile.data?.placed ?? false;
  const minutes = profile.data?.minutes_per_session ?? 12;
  const plan = (profile.data?.prefs as { plan?: string } | null)?.plan ?? null;
  const due = dueCount.count ?? 0;

  const activeDays = [
    ...new Set(
      (sessions.data ?? [])
        .map((row) => (row.completed_at as string | null)?.slice(0, 10))
        .filter((day): day is string => Boolean(day)),
    ),
  ];
  const streak = computeStreak(activeDays, new Date(`${isoDay(new Date())}T12:00:00Z`));

  const detours = [
    { mode: "review", label: t.home.detourReview, hint: t.home.detourReviewHint },
    { mode: "ear", label: t.home.detourEar, hint: t.home.detourEarHint },
    { mode: "speak", label: t.home.detourSpeak, hint: t.home.detourSpeakHint },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Learn German
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {streak.returning
            ? t.home.welcomeBack
            : displayName
              ? t.home.hello(displayName)
              : t.home.helloPlain}
        </h1>
        {streak.length > 0 ? (
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {t.home.streakDays(streak.length)}
            </span>
            {streak.frozeYesterday && t.home.streakFroze}
            {streak.activeToday && t.home.streakToday}
          </p>
        ) : streak.returning ? (
          <p className="text-sm text-muted">{t.home.returningNote}</p>
        ) : null}
      </header>

      {!placed ? (
        <Card className="flex flex-col gap-4">
          <SectionLabel>{t.home.startLabel}</SectionLabel>
          <p className="text-[15px] leading-relaxed">{t.home.startBody}</p>
          <Link href="/willkommen">
            <Button className="w-full">{t.home.letsGo}</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <SectionLabel>{t.home.todayRound}</SectionLabel>
            <p className="text-[15px] leading-relaxed">
              {t.home.aboutMinutes(minutes)}
              {due > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold">{t.home.wordsWaiting(due)}</span>
                </>
              )}
              {streak.activeToday && t.home.streakSafeBonus}
              .
            </p>
            <Link href="/session">
              <Button className="w-full py-3.5 text-base">
                {streak.activeToday ? t.home.anotherRound : t.home.startRound}
              </Button>
            </Link>
          </Card>

          <div className="flex flex-col gap-2">
            <SectionLabel>{t.home.detoursLabel}</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {detours.map((detour) => (
                <Link
                  key={detour.mode}
                  href={`/session?modus=${detour.mode}`}
                  className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 transition hover:border-accent-bright"
                >
                  <span className="text-sm font-semibold">{detour.label}</span>
                  <span className="text-[11px] leading-tight text-muted">
                    {detour.hint}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {plan && (
        <p className="text-center text-sm text-muted">
          {t.home.yourAnchor}: <span className="italic">„{plan}“</span>
        </p>
      )}
    </main>
  );
}
