import Link from "next/link";
import { Ear, Lock, MessageCircle, Mic, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProgressBundle } from "@/lib/progress";
import { isoDay, recentDays } from "@/lib/streak";
import { getUiStrings } from "@/lib/i18n/server";
import { LINES, stationById, type Line } from "@/lib/curriculum";
import { Button, Card, Eyebrow, SectionLabel, StationSign, type LineNumber } from "@/components/ui";
import { LineMap, type MapLine } from "@/components/line-map";
import { Streak } from "@/components/streak";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

/** Only what the map needs crosses to the client — never a scene. */
function toMapLine(line: Line): MapLine {
  return {
    id: line.id,
    number: Math.min(5, Math.max(1, line.number)) as LineNumber,
    name: line.name,
    nameEn: line.nameEn,
    colour: line.colour,
    authored: line.authored,
    stations: line.stations.map((station) => ({
      id: station.id,
      name: station.name,
      title: station.title,
      titleEn: station.titleEn,
      canDoEn: station.canDoEn,
      minutes: station.minutes,
      order: station.order,
    })),
  };
}

export default async function Linie() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 8);

  const [bundle, profile, dueCount, recentSessions, { t, lang }] = await Promise.all([
    getProgressBundle(supabase, userId),
    supabase.from("learner_profiles").select("prefs").maybeSingle(),
    supabase
      .from("word_states")
      .select("lexeme_id", { count: "exact", head: true })
      .lte("due", now.toISOString()),
    supabase
      .from("sessions")
      .select("completed_at")
      .not("completed_at", "is", null)
      .gte("completed_at", weekAgo.toISOString()),
    getUiStrings(),
  ]);

  const displayName = (claims?.claims?.user_metadata?.display_name as string | undefined) ?? null;
  const plan = (profile.data?.prefs as { plan?: string } | null)?.plan ?? null;
  const due = dueCount.count ?? 0;
  const { streak, placed } = bundle;

  const activeDays = (recentSessions.data ?? [])
    .map((row) => (row.completed_at as string | null)?.slice(0, 10))
    .filter((day): day is string => Boolean(day));
  const days = recentDays(activeDays, new Date(`${isoDay(now)}T12:00:00Z`));

  const current = stationById(bundle.currentStationId);
  const currentLine = current ? LINES.find((line) => line.id === current.lineId) : undefined;
  const currentHref = current ? `/station/${current.id}` : "/";
  const talkUnlocked = bundle.progress.speakingRung === "free-conversation";
  const grades = Object.fromEntries(bundle.stations.map((row) => [row.stationId, row.bestGrade]));

  const detours = [
    { mode: "review", label: t.home.detourReview, Icon: RefreshCw, locked: false },
    { mode: "ear", label: t.home.detourEar, Icon: Ear, locked: false },
    { mode: "speak", label: t.home.detourSpeak, Icon: Mic, locked: false },
    { mode: "talk", label: t.home.detourTalk, Icon: MessageCircle, locked: !talkUnlocked },
  ] as const;

  return (
    <HomeClient>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter pt-10 pb-6 stagger-children">
        <header className="flex flex-col gap-3">
          <Eyebrow tone="accent">{t.home.eyebrow}</Eyebrow>
          <h1 className="font-display text-display-xl text-ink">
            {streak.returning
              ? t.home.welcomeBack
              : displayName
                ? t.home.hello(displayName)
                : t.home.helloPlain}
          </h1>
          {streak.length > 0 ? (
            <Streak
              days={days}
              length={streak.length}
              activeToday={streak.activeToday}
              frozeYesterday={streak.frozeYesterday}
            />
          ) : streak.returning ? (
            <p className="text-body-sm text-ink-muted">{t.home.returningNote}</p>
          ) : null}
        </header>

        {!placed ? (
          <Card variant="raised" className="flex flex-col gap-4">
            <SectionLabel>{t.home.startLabel}</SectionLabel>
            <p className="text-body text-ink">{t.home.startBody}</p>
            <Link href="/willkommen" className="block rounded-md">
              <Button fullWidth size="lg" tabIndex={-1}>
                {t.home.letsGo}
              </Button>
            </Link>
          </Card>
        ) : (
          <>
            {current && currentLine ? (
              <Card variant="raised" className="flex flex-col gap-4">
                <SectionLabel>{t.home.nextStation}</SectionLabel>
                <StationSign
                  name={current.name}
                  subtitle={lang === "de" ? current.title : current.titleEn}
                  line={Math.min(5, Math.max(1, currentLine.number)) as LineNumber}
                  status="current"
                  index={current.order}
                  statusLabel={t.home.status.current}
                />
                <p className="text-body text-ink">
                  {current.canDoEn}
                  <span className="text-ink-muted">
                    {" · "}
                    <span className="tabular">{t.home.minutes(current.minutes)}</span>
                  </span>
                </p>
                <div className="flex flex-col gap-2">
                  <Link href={currentHref} className="block rounded-md">
                    <Button fullWidth size="lg" tabIndex={-1}>
                      {t.home.board}
                    </Button>
                  </Link>
                  {due > 0 && (
                    <Link href={`${currentHref}?modus=review`} className="block rounded-md">
                      <Button variant="secondary" fullWidth tabIndex={-1} icon={<RefreshCw className="size-4" aria-hidden />}>
                        {t.home.reviewDue(due)}
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ) : (
              <Card variant="raised">
                <p className="text-body text-ink">{t.home.courseEmpty}</p>
              </Card>
            )}

            <Card flush className="flex flex-col gap-1 py-4">
              <div className="flex items-baseline justify-between px-5">
                <SectionLabel>{t.home.mapTitle}</SectionLabel>
                <span className="text-caption text-ink-muted">{t.home.mapHint}</span>
              </div>
              <LineMap
                lines={LINES.map(toMapLine)}
                statuses={bundle.statuses}
                currentStationId={current?.id ?? null}
                grades={grades}
                talkUnlocked={talkUnlocked}
              />
            </Card>

            {current && (
              <section className="flex flex-col gap-2">
                <SectionLabel>{t.home.detoursLabel}</SectionLabel>
                <ul className="grid grid-cols-2 gap-2">
                  {detours.map(({ mode, label, Icon, locked }) => (
                    <li key={mode}>
                      <Link
                        href={`${currentHref}?modus=${mode}`}
                        className="flex min-h-14 items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 shadow-flat transition-[border-color,box-shadow,transform] hover:border-accent hover:shadow-raised active:scale-[0.99]"
                      >
                        <Icon className="size-5 shrink-0 text-accent" aria-hidden />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-body-sm font-semibold text-ink">{label}</span>
                          {locked && (
                            <span className="flex items-center gap-1 text-caption text-ink-muted">
                              <Lock className="size-3" aria-hidden />
                              {t.home.talkLocked}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {plan && (
          <p className="text-center text-body-sm italic text-ink-muted">
            &bdquo;{plan}&ldquo;
          </p>
        )}
      </main>
    </HomeClient>
  );
}
