"use client";

/**
 * Abfahrt — Jule's honest debrief (personalised when the tutor
 * answered, arithmetic over the beats otherwise), the numbers that
 * mean something (words met, words back, minutes of German), the
 * station's aside, the next station, and the PATCH that ends the
 * visit. The two-tone "Abfahrt" signal plays once.
 */

import { useEffect, useRef, useState } from "react";
import { lineOf, nextStation } from "@/lib/curriculum";
import { playDepart } from "@/lib/audio/sound";
import type { Debrief } from "@/lib/tutor/coach";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, Eyebrow, Spinner, Stat, StationSign, type StationStatus } from "@/components/ui";
import { tallyOutcomes, type BeatProps, type MilestoneLike } from "../lib";
import { BeatHeading, BottomBar, JuleMark, lineNumberOf } from "../parts";

type Phase = "pending" | "ready";

export function DepartBeat({ station, plan, mode, sessionId, results, performanceGrade, transcript, outcomes, finish, onMilestones }: BeatProps) {
  const t = useStrings();
  const line = lineOf(station);
  const next = nextStation(station.id);
  const [debrief, setDebrief] = useState<{ phase: Phase; text: Debrief }>(() => ({
    phase: "pending",
    text: { debriefEn: station.coach.debriefEn, nextTimeEn: "", mood: "matter-of-fact" },
  }));
  const [saved, setSaved] = useState(false);
  const startedRef = useRef(false);
  const tally = tallyOutcomes(outcomes, plan.newLexemeIds);
  const passed = mode === "station" && performanceGrade !== null && performanceGrade >= 2;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const frame = requestAnimationFrame(() => playDepart());

    const grade = mode === "station" ? performanceGrade : null;
    void fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: station.id, phase: "debrief", results: { steps: results, performanceGrade: grade, transcript } }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { debrief?: Debrief } | null) => {
        setDebrief((current) => ({ phase: "ready", text: data?.debrief ?? current.text }));
      })
      .catch(() => setDebrief((current) => ({ ...current, phase: "ready" })));

    void fetch("/api/lesson", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, stationId: station.id, mode, performanceGrade: grade }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { milestones?: MilestoneLike[] } | null) => {
        setSaved(true);
        if (data?.milestones && data.milestones.length > 0) onMilestones(data.milestones);
      })
      .catch(() => setSaved(true));

    return () => cancelAnimationFrame(frame);
  }, [mode, onMilestones, performanceGrade, results, sessionId, station.id, transcript]);

  // Only the next station on the same line is knowable here; the map decides the rest.
  const sameLine = next?.lineId === station.lineId;
  const nextStatus: StationStatus = !next ? "locked" : sameLine ? (passed ? "unseen" : "locked") : "unseen";
  const nextHref = next && sameLine && passed ? `/station/${next.id}` : undefined;

  return (
    <div className="flex flex-1 flex-col gap-5 stagger-children">
      <BeatHeading
        eyebrow={t.station.beats.depart}
        title={mode === "station" ? (passed ? t.station.depart.passed : station.title) : t.station.depart.detourDone}
        note={mode === "station" && !passed && performanceGrade !== null ? t.station.depart.notPassed : undefined}
      />

      <Card variant="raised" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <JuleMark line={line} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-display text-title text-ink">{t.station.jule.name}</span>
            <span className="text-caption text-ink-muted">{t.station.depart.mood[debrief.text.mood] ?? t.station.jule.role}</span>
          </div>
          {debrief.phase === "pending" && <Spinner size="sm" label={t.station.depart.grading} />}
        </div>
        <p className="text-body text-ink">{debrief.text.debriefEn}</p>
        {debrief.text.nextTimeEn && (
          <div className="flex flex-col gap-1">
            <Eyebrow>{t.station.depart.nextTime}</Eyebrow>
            <p className="text-body-sm text-ink">{debrief.text.nextTimeEn}</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3 px-1">
        <Stat size="sm" value={tally.wordsMet} label={t.station.depart.wordsMet} animate />
        <Stat size="sm" value={tally.wordsBack} label={t.station.depart.wordsBack} animate />
        <Stat size="sm" value={tally.minutes} label={t.station.depart.minutes} animate />
      </div>

      {station.coach.asideEn && (
        <Card variant="outline" className="flex flex-col gap-1 py-3">
          <Eyebrow>{t.station.depart.aside}</Eyebrow>
          <p className="text-body-sm text-ink">{station.coach.asideEn}</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Eyebrow>{t.station.depart.nextStation}</Eyebrow>
        {next ? (
          <StationSign
            name={next.name}
            subtitle={next.canDoEn}
            line={lineNumberOf(lineOf(next))}
            status={nextStatus}
            index={next.order}
            statusLabel={nextStatus === "locked" ? t.station.locked.eyebrow : undefined}
            href={nextHref}
          />
        ) : (
          <p className="text-body-sm text-ink-muted">{t.station.depart.endOfLine}</p>
        )}
      </div>

      <BottomBar>
        <Button size="lg" fullWidth loading={!saved} onClick={() => finish({ correct: true })}>
          {t.station.toLine}
        </Button>
      </BottomBar>
    </div>
  );
}
