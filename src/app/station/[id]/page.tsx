import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadStationProgress } from "@/lib/engine/store";
import type { LessonMode } from "@/lib/engine/session/lesson";
import { lineOf, stationById, stationStatuses } from "@/lib/curriculum";
import { getUiStrings } from "@/lib/i18n/server";
import { Button, Eyebrow, Spinner, StationSign } from "@/components/ui";
import { StationPlayer } from "./player";

export const dynamic = "force-dynamic";

interface StationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const MODES: LessonMode[] = ["station", "review", "ear", "speak", "talk"];

function parseMode(value: string | string[] | undefined): LessonMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return MODES.find((mode) => mode === candidate) ?? "station";
}

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const { id } = await params;
  const station = stationById(id);
  return { title: station?.title ?? "Station" };
}

/** `/station/[id]` — one station of the line: the nine-beat ritual. */
export default async function StationPage({ params, searchParams }: StationPageProps) {
  const { id } = await params;
  const station = stationById(id);
  if (!station) notFound();
  const query = await searchParams;
  const mode = parseMode(query.modus);

  const supabase = await createClient();
  const [{ data }, progress, { t }] = await Promise.all([
    supabase.auth.getUser(),
    loadStationProgress(supabase),
    getUiStrings(),
  ]);
  if (!data.user) redirect("/login");

  const line = lineOf(station);
  const status = stationStatuses(progress).get(station.id) ?? "locked";
  if (status === "locked") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-gutter py-10">
        <div className="flex flex-col gap-2">
          <Eyebrow tone="accent">{t.station.locked.eyebrow}</Eyebrow>
          <h1 className="font-display text-display-l text-ink">{t.station.locked.title}</h1>
          <p className="text-body text-ink-muted">{t.station.locked.body}</p>
        </div>
        <StationSign
          name={station.name}
          subtitle={station.title}
          line={Math.min(5, Math.max(1, line.number)) as 1 | 2 | 3 | 4 | 5}
          status="locked"
          index={station.order}
          statusLabel={t.station.locked.eyebrow}
        />
        <Link href="/" className="self-start">
          <Button variant="primary">{t.station.toLine}</Button>
        </Link>
      </main>
    );
  }

  const visits = progress.find((row) => row.stationId === station.id)?.visits ?? 0;

  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <Spinner size="lg" label={t.station.composing} className="text-accent" />
        </main>
      }
    >
      <StationPlayer station={station} line={line} visits={visits} mode={mode} />
    </Suspense>
  );
}
