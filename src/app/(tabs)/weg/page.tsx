import { createClient } from "@/lib/supabase/server";
import { getProgressBundle } from "@/lib/progress";
import { SPEAKING_RUNGS, type CefrBand } from "@/lib/engine";
import { getUiStrings } from "@/lib/i18n/server";
import type { UiStrings } from "@/lib/i18n/strings";
import { Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const BANDS: CefrBand[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

const confidenceLabel = (confidence: number, t: UiStrings) =>
  confidence >= 0.9
    ? t.weg.confidenceHigh
    : confidence >= 0.65
      ? t.weg.confidenceMid
      : t.weg.confidenceLow;

/**
 * Der Weg — progress as a journey deeper into Germany. Every number
 * here means something outside the app; there is no percent-fluent bar
 * and nothing fills because time passed.
 */
export default async function Weg() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null; // proxy gates this route already
  const [bundle, { t }] = await Promise.all([
    getProgressBundle(supabase, data.user.id),
    getUiStrings(),
  ]);
  const { progress, milestones, canDo, vocabMilestones } = bundle;

  // The German meanings live on the milestone data itself; other
  // languages override by word-count key.
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-10">
      <header className="flex flex-col gap-1">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {t.weg.eyebrow}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {progress.knownWords}{" "}
          <span className="text-2xl font-semibold text-muted">{t.weg.wordsUnit}</span>
        </h1>
        <p className="text-sm text-muted">
          {t.weg.coverage(Math.round(progress.speechCoverage * 100))}
        </p>
      </header>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.whereYouStand}</SectionLabel>
        <div className="flex items-end justify-between gap-1">
          {BANDS.map((band, i) => {
            const inRange = i >= rangeLow && i <= rangeHigh;
            const isCurrent = band === progress.cefr.band;
            return (
              <div key={band} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={
                    isCurrent
                      ? "rounded-md border-2 border-[#1b1f24] bg-[#f7c600] px-2 py-1 font-display text-sm font-bold text-[#1b1f24]"
                      : `px-2 py-1 font-display text-sm font-semibold ${
                          inRange ? "text-foreground" : "text-line"
                        }`
                  }
                >
                  {band}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">
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
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent-bright transition-all"
                style={{ width: `${Math.round(Math.max(0.02, towardNext) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {t.weg.nextSign(nextVocab.count, meaningFor(nextVocab))}
            </p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {vocabMilestones.map((milestone) => {
            const reached = progress.knownWords >= milestone.count;
            return (
              <li key={milestone.count} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-2 ${
                    reached
                      ? "border-[#1b1f24] bg-[#f7c600] text-[9px] font-bold text-[#1b1f24]"
                      : "border-line"
                  }`}
                >
                  {reached ? "✓" : ""}
                </span>
                <span className={reached ? "" : "text-muted"}>
                  <span className="font-semibold">{milestone.count}</span> —{" "}
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
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t.weg.syntax}</span>
            <span className="text-muted">
              {t.weg.stageLine(progress.syntaxStage, progress.syntaxStageName)}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((stage) => (
              <div
                key={stage}
                className={`h-1.5 flex-1 rounded-full ${
                  stage <= progress.syntaxStage ? "bg-accent-bright" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t.weg.speaking}</span>
            <span className="text-muted">{t.weg.rungs[progress.speakingRung]}</span>
          </div>
          <div className="flex gap-1">
            {SPEAKING_RUNGS.map((rung, i) => (
              <div
                key={rung}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= currentRung ? "bg-accent-bright" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t.weg.ears}</span>
          <span className="text-muted">{t.weg.contrastsLine(progress.contrastsMastered)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t.weg.heardUnderstood}</span>
          <span className="text-muted">{t.weg.inputMinutes(progress.inputMinutes)}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.canDoLabel}</SectionLabel>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {canDo.map((statement) => (
            <li key={statement} className="flex gap-2">
              <span aria-hidden className="text-accent-bright">→</span>
              {statement}
            </li>
          ))}
        </ul>
      </Card>

      {milestones.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionLabel>{t.weg.reachedSigns}</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {milestones.map((event) => (
              <li key={`${event.kind}-${event.label}-${event.achieved_at}`} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1 size-3 shrink-0 rounded-[3px] border-2 border-[#1b1f24] bg-[#f7c600]"
                />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{event.label}</p>
                  <p className="text-xs text-muted">
                    {event.detail} ·{" "}
                    {new Date(event.achieved_at).toLocaleDateString(t.weg.dateLocale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
