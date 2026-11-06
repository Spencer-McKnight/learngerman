import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProgressBundle, type MilestoneRow } from "@/lib/progress";
import { SPEAKING_RUNGS, type CefrBand } from "@/lib/engine";
import { getUiStrings } from "@/lib/i18n/server";
import type { UiStrings } from "@/lib/i18n/strings";
import { LINES, type Line, type StationProgress } from "@/lib/curriculum";
import {
  Card,
  Chip,
  Eyebrow,
  LineBadge,
  Ortsschild,
  ProgressBar,
  SectionLabel,
  Stat,
  cn,
  type LineNumber,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const BANDS: CefrBand[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

const confidenceLabel = (confidence: number, t: UiStrings) =>
  confidence >= 0.9
    ? t.weg.confidenceHigh
    : confidence >= 0.65
      ? t.weg.confidenceMid
      : t.weg.confidenceLow;

const lineNumber = (line: Line): LineNumber => Math.min(5, Math.max(1, line.number)) as LineNumber;

export default async function Weg() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [bundle, { t, lang }] = await Promise.all([
    getProgressBundle(supabase, data.user.id),
    getUiStrings(),
  ]);
  const { progress, milestones, canDo, vocabMilestones, stations } = bundle;
  const numberFormat = new Intl.NumberFormat(t.weg.dateLocale);
  const dateFormat = new Intl.DateTimeFormat(t.weg.dateLocale, { day: "numeric", month: "short", year: "numeric" });

  const meaningFor = (milestone: { count: number; meaning: string }) =>
    t.weg.vocabMeanings[milestone.count] ?? milestone.meaning;

  const nextVocab = vocabMilestones.find((m) => m.count > progress.knownWords);
  const prevCount =
    [...vocabMilestones].reverse().find((m) => m.count <= progress.knownWords)?.count ?? 0;
  const towardNext = nextVocab
    ? (progress.knownWords - prevCount) / (nextVocab.count - prevCount)
    : 1;

  const rangeLow = BANDS.indexOf(progress.cefr.range[0]);
  const rangeHigh = BANDS.indexOf(progress.cefr.range[1]);
  const currentRung = SPEAKING_RUNGS.indexOf(progress.speakingRung);
  const progressByStation = new Map(stations.map((row) => [row.stationId, row]));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-gutter pt-10 pb-6 stagger-children">
      <header className="flex flex-col gap-3">
        <Eyebrow tone="accent">{t.weg.eyebrow}</Eyebrow>
        <Stat
          size="lg"
          value={numberFormat.format(progress.knownWords)}
          label={t.weg.coverage(Math.round(progress.speechCoverage * 100))}
          unit={t.weg.wordsUnit}
          animate
        />
      </header>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.whereYouStand}</SectionLabel>
        <ol className="flex items-center justify-between gap-1">
          {BANDS.map((band, i) => {
            const inRange = i >= rangeLow && i <= rangeHigh;
            const isCurrent = band === progress.cefr.band;
            return (
              <li key={band} className="flex flex-1 justify-center">
                <span
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "rounded-sm px-2 py-1 font-display text-body font-semibold tabular",
                    isCurrent
                      ? "bg-accent text-accent-ink"
                      : inRange
                        ? "border border-accent text-accent"
                        : "text-ink-muted",
                  )}
                >
                  {band}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-ink-muted">
          {t.weg.cefrNote(confidenceLabel(progress.cefr.confidence, t))}
          {progress.cefr.range[0] !== progress.cefr.range[1] &&
            ` (${progress.cefr.range[0]}–${progress.cefr.range[1]})`}
          .
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.vocabJourney}</SectionLabel>
        {nextVocab && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar value={towardNext} label={t.weg.nextSign(nextVocab.count, meaningFor(nextVocab))} />
            <p className="text-caption text-ink-muted">
              {t.weg.nextSign(nextVocab.count, meaningFor(nextVocab))}
            </p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {vocabMilestones.map((milestone) => {
            const reached = progress.knownWords >= milestone.count;
            return (
              <li key={milestone.count} className="flex items-start gap-2.5 text-body-sm">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill border-2",
                    reached ? "border-accent bg-accent text-accent-ink" : "border-hairline",
                  )}
                >
                  {reached && <Check className="size-2.5" strokeWidth={3.5} />}
                </span>
                <span className={reached ? "text-ink" : "text-ink-muted"}>
                  <span className="font-display font-semibold tabular">{numberFormat.format(milestone.count)}</span>
                  {" — "}
                  {meaningFor(milestone)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionLabel>{t.weg.skills}</SectionLabel>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body-sm">
            <span className="font-medium text-ink">{t.weg.syntax}</span>
            <span className="text-ink-muted">
              {t.weg.stageLine(progress.syntaxStage, progress.syntaxStageName)}
            </span>
          </div>
          <ProgressBar value={progress.syntaxStage} max={5} label={`${t.weg.syntax}: ${progress.syntaxStage} ${t.weg.stageUnit}`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body-sm">
            <span className="font-medium text-ink">{t.weg.speaking}</span>
            <span className="text-ink-muted">{t.weg.rungs[progress.speakingRung]}</span>
          </div>
          <ProgressBar
            value={currentRung + 1}
            max={SPEAKING_RUNGS.length}
            label={`${t.weg.speaking}: ${t.weg.rungs[progress.speakingRung]}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <Stat size="sm" value={progress.contrastsMastered} unit={t.weg.contrastsUnit} label={`${t.weg.ears} · ${t.weg.contrastsLabel}`} />
          <Stat size="sm" value={numberFormat.format(progress.inputMinutes)} label={`${t.weg.heardUnderstood} · ${t.weg.minutesLabel}`} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionLabel>{t.weg.course}</SectionLabel>
        <ul className="flex flex-col gap-5">
          {LINES.map((line) => (
            <CourseLine
              key={line.id}
              line={line}
              completion={bundle.lines[line.id] ?? 0}
              progressByStation={progressByStation}
              t={t}
              lang={lang}
              dateFormat={dateFormat}
            />
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.canDoLabel}</SectionLabel>
        <ul className="flex flex-col gap-1.5 text-body-sm text-ink">
          {canDo.map((statement) => (
            <li key={statement} className="flex gap-2">
              <span aria-hidden className="text-accent">&rarr;</span>
              {statement}
            </li>
          ))}
        </ul>
      </Card>

      {milestones.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionLabel>{t.weg.reachedSigns}</SectionLabel>
          <ul className="flex flex-col gap-3">
            {milestones.map((event) => (
              <ReachedSign key={`${event.kind}-${event.label}-${event.achieved_at}`} event={event} dateFormat={dateFormat} />
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}

function CourseLine({
  line,
  completion,
  progressByStation,
  t,
  lang,
  dateFormat,
}: {
  line: Line;
  completion: number;
  progressByStation: Map<string, StationProgress>;
  t: UiStrings;
  lang: "de" | "en";
  dateFormat: Intl.DateTimeFormat;
}) {
  const total = line.stations.length;
  const passed = line.stations.filter((station) => progressByStation.get(station.id)?.status === "passed");
  const name = (lang === "de" ? line.name : line.nameEn) || t.home.lineLabel(line.number);
  const planned = !line.authored || total === 0;
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <LineBadge line={lineNumber(line)} size="sm" aria-label={t.home.lineLabel(line.number)} />
        <span className="min-w-0 flex-1 truncate font-display text-title font-semibold text-ink">
          {name}
          {planned && <span className="ml-2 text-body-sm font-normal text-ink-muted">· {t.weg.linePlanned}</span>}
        </span>
        <span className="shrink-0 text-body-sm tabular text-ink-muted">
          {t.weg.stationsPassed(passed.length, total)}
        </span>
      </div>
      <ProgressBar value={completion} label={t.weg.lineProgress(name)} />
      {passed.length > 0 && (
        <ol className="mt-1 flex flex-col divide-y divide-hairline">
          {passed.map((station) => {
            const row = progressByStation.get(station.id);
            const grade = row?.bestGrade ?? null;
            const date = row?.passedAt ? dateFormat.format(new Date(row.passedAt)) : null;
            return (
              <li key={station.id} className="flex items-center gap-3 py-2 text-body-sm">
                <span className="w-5 shrink-0 font-display font-semibold tabular text-ink-muted">{station.order}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{station.name}</span>
                {grade !== null && (
                  <Chip size="sm" variant="accent">
                    <span className="tabular">{t.weg.noteChip(grade)}</span>
                    <span aria-hidden>·</span>
                    {t.weg.grade[grade]}
                  </Chip>
                )}
                {date && <span className="shrink-0 text-caption tabular text-ink-muted">{date}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function ReachedSign({ event, dateFormat }: { event: MilestoneRow; dateFormat: Intl.DateTimeFormat }) {
  const date = dateFormat.format(new Date(event.achieved_at));
  if (event.kind === "line-complete") {
    return (
      <li className="flex flex-col items-start gap-1">
        <Ortsschild size="sm" label={event.label} detail={event.detail} />
        <span className="text-caption tabular text-ink-muted">{date}</span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-1 size-3 shrink-0 rounded-xs border-2 border-milestone-ink bg-milestone" />
      <div className="min-w-0 text-body-sm">
        <p className="font-semibold text-ink">{event.label}</p>
        <p className="text-caption text-ink-muted">
          {event.detail}
          {" · "}
          <span className="tabular">{date}</span>
        </p>
      </div>
    </li>
  );
}
