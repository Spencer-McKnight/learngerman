import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeStreak, isoDay } from "@/lib/streak";
import { getUiStrings } from "@/lib/i18n/server";
import { Button, Card, SectionLabel } from "@/components/ui";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

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
    { mode: "review", label: t.home.detourReview, icon: "refresh" as const },
    { mode: "ear", label: t.home.detourEar, icon: "ear" as const },
    { mode: "speak", label: t.home.detourSpeak, icon: "mic" as const },
  ];

  return (
    <HomeClient>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10 stagger-children">
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
            <StreakDisplay
              length={streak.length}
              frozeYesterday={streak.frozeYesterday}
              activeToday={streak.activeToday}
              t={t}
            />
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
            <Card lifted className="flex flex-col gap-4">
              <SectionLabel>{t.home.todayRound}</SectionLabel>
              <p className="text-[15px] leading-relaxed">
                {t.home.aboutMinutes(minutes)}
                {due > 0 && (
                  <>
                    {" · "}
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <DueIcon />
                      {t.home.wordsWaiting(due)}
                    </span>
                  </>
                )}
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
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 transition-all duration-200 hover:border-accent-bright hover:shadow-md hover:-translate-y-0.5"
                  >
                    <DetourIcon type={detour.icon} />
                    <span className="text-sm font-semibold">{detour.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {plan && (
          <p className="text-center text-sm italic text-muted">
            &bdquo;{plan}&ldquo;
          </p>
        )}
      </main>
    </HomeClient>
  );
}

function StreakDisplay({
  length,
  frozeYesterday,
  activeToday,
  t,
}: {
  length: number;
  frozeYesterday: boolean;
  activeToday: boolean;
  t: Awaited<ReturnType<typeof getUiStrings>>["t"];
}) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <svg
        viewBox="0 0 24 24"
        className={`size-4 ${activeToday ? "animate-pulse-soft text-streak-warm" : "text-muted"}`}
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 2c.5 3.5 4 6.5 4 10a4 4 0 1 1-8 0c0-3.5 3.5-6.5 4-10Z" />
      </svg>
      <span className="font-semibold text-foreground animate-count-up">
        {t.home.streakDays(length)}
      </span>
      {frozeYesterday && t.home.streakFroze}
      {activeToday && t.home.streakToday}
    </p>
  );
}

function DueIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-accent-bright" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 3v4M8 3v4M2 11h20" />
    </svg>
  );
}

function DetourIcon({ type }: { type: "refresh" | "ear" | "mic" }) {
  const cls = "size-4 text-accent-bright shrink-0";
  if (type === "refresh")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    );
  if (type === "ear")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6.5-6 14.5" />
        <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
