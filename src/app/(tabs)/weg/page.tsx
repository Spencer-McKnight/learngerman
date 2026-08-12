import { createClient } from "@/lib/supabase/server";
import { getProgressBundle } from "@/lib/progress";
import { SPEAKING_RUNGS, type CefrBand } from "@/lib/engine";
import { getUiStrings } from "@/lib/i18n/server";
import type { UiStrings } from "@/lib/i18n/strings";
import { Card, SectionLabel, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

const BANDS: CefrBand[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

const confidenceLabel = (confidence: number, t: UiStrings) =>
  confidence >= 0.9
    ? t.weg.confidenceHigh
    : confidence >= 0.65
      ? t.weg.confidenceMid
      : t.weg.confidenceLow;

export default async function Weg() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [bundle, { t }] = await Promise.all([
    getProgressBundle(supabase, data.user.id),
    getUiStrings(),
  ]);
  const { progress, milestones, canDo, vocabMilestones } = bundle;

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-10 stagger-children">
      <header className="flex flex-col gap-1">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {t.weg.eyebrow}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          <span className="animate-count-up inline-block">{progress.knownWords}</span>{" "}
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
                  className={`transition-all duration-300 ${
                    isCurrent
                      ? "rounded-md border-2 border-[#1b1f24] bg-[#f7c600] px-2 py-1 font-display text-sm font-bold text-[#1b1f24] scale-110"
                      : `px-2 py-1 font-display text-sm font-semibold ${
                          inRange ? "text-foreground" : "text-line"
                        }`
                  }`}
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
            <ProgressBar value={towardNext} />
            <p className="text-xs text-muted">
              {t.weg.nextSign(nextVocab.count, meaningFor(nextVocab))}
            </p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {vocabMilestones.map((milestone) => {
            const reached = progress.knownWords >= milestone.count;
            return (
              <li key={milestone.count} className="flex items-start gap-2.5 text-sm group">
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-2 transition-all duration-300 ${
                    reached
                      ? "border-[#1b1f24] bg-[#f7c600] text-[9px] font-bold text-[#1b1f24] scale-110"
                      : "border-line group-hover:border-accent-bright/50"
                  }`}
                >
                  {reached ? "✓" : ""}
                </span>
                <span className={reached ? "" : "text-muted"}>
                  <span className="font-semibold">{milestone.count}</span>{" — "}
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
            <span className="flex items-center gap-2 font-medium">
              <SkillIcon type="syntax" />
              {t.weg.syntax}
            </span>
            <span className="text-muted">
              {t.weg.stageLine(progress.syntaxStage, progress.syntaxStageName)}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((stage) => (
              <div
                key={stage}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  stage <= progress.syntaxStage
                    ? "bg-gradient-to-r from-accent to-accent-bright"
                    : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <SkillIcon type="speaking" />
              {t.weg.speaking}
            </span>
            <span className="text-muted">{t.weg.rungs[progress.speakingRung]}</span>
          </div>
          <div className="flex gap-1">
            {SPEAKING_RUNGS.map((rung, i) => (
              <div
                key={rung}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  i <= currentRung
                    ? "bg-gradient-to-r from-accent to-accent-bright"
                    : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <SkillIcon type="ear" />
            {t.weg.ears}
          </span>
          <span className="text-muted">{t.weg.contrastsLine(progress.contrastsMastered)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <SkillIcon type="time" />
            {t.weg.heardUnderstood}
          </span>
          <span className="text-muted">{t.weg.inputMinutes(progress.inputMinutes)}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{t.weg.canDoLabel}</SectionLabel>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {canDo.map((statement) => (
            <li key={statement} className="flex gap-2">
              <span aria-hidden className="text-accent-bright">&rarr;</span>
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
                    {event.detail}{" · "}
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

function SkillIcon({ type }: { type: "syntax" | "speaking" | "ear" | "time" }) {
  const cls = "size-4 text-accent-bright shrink-0";
  if (type === "syntax")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h6" />
      </svg>
    );
  if (type === "speaking")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
