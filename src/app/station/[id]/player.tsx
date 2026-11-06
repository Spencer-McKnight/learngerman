"use client";

/**
 * The station player: composes the visit (POST /api/lesson), asks Jule
 * for her briefing and, on replays, the tutor for a scene variation —
 * all in parallel — then plays the plan's beats in order under one
 * calm top bar. Every outcome goes to /api/review; milestones queue
 * up and arrive as the Ortsschild at the end of the current beat.
 * Nothing here blocks on a lost request.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Line, SceneLine, Station } from "@/lib/curriculum/types";
import type { MilestoneEvent, ReviewOutcome } from "@/lib/engine";
import type { LessonMode, LessonPlan, StepSpec } from "@/lib/engine/session/lesson";
import { playStep } from "@/lib/audio/sound";
import { preload, stopSpeaking } from "@/lib/audio/tts";
import type { Brief, PerformanceUtterance } from "@/lib/tutor/coach";
import type { KeyPerformance } from "@/lib/tutor/signals";
import { MilestoneOverlay } from "@/components/milestone-overlay";
import { useStrings } from "@/components/i18n-provider";
import { Button, IconButton, ProgressBar, Sheet, Spinner, StationSign } from "@/components/ui";
import { RATE_SLOW, voiceFor, type BeatProps, type BeatResult, type CoachState, type FinishInfo, type Grade, type MilestoneLike, type SceneState } from "./lib";
import { lineNumberOf } from "./parts";
import { ArriveBeat } from "./beats/arrive";
import { SceneBeat } from "./beats/scene";
import { UnderstandBeat } from "./beats/understand";
import { WordsBeat } from "./beats/words";
import { GrammarBeat } from "./beats/grammar";
import { SpeakBeat } from "./beats/speak";
import { EarBeat } from "./beats/ear";
import { PerformBeat } from "./beats/perform";
import { DepartBeat } from "./beats/depart";

type Status = "loading" | "ready" | "error";

/** The tutor gets this long to write a variation before the scripted scene plays. */
const SCENE_DEADLINE_MS = 15000;

interface Session {
  sessionId: string;
  plan: LessonPlan;
}

function Beat(props: BeatProps) {
  switch (props.step.kind) {
    case "arrive":
      return <ArriveBeat {...props} />;
    case "scene":
      return <SceneBeat {...props} />;
    case "understand":
      return <UnderstandBeat {...props} />;
    case "words":
      return <WordsBeat {...props} />;
    case "grammar":
      return <GrammarBeat {...props} />;
    case "speak":
      return <SpeakBeat {...props} />;
    case "ear":
      return <EarBeat {...props} />;
    case "perform":
      return <PerformBeat {...props} />;
    case "depart":
      return <DepartBeat {...props} />;
  }
}

function warmScene(station: Station, lines: SceneLine[]) {
  for (const line of lines.slice(0, 3)) void preload(line.de, voiceFor(station, line.speaker), RATE_SLOW);
}

export function StationPlayer({ station, line, visits, mode }: { station: Station; line: Line; visits: number; mode: LessonMode }) {
  const t = useStrings();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [coach, setCoach] = useState<CoachState>({ status: "loading", brief: null, keyPerformances: [], source: "none" });
  const [scene, setScene] = useState<SceneState>({ status: "ready", lines: station.scene.lines, source: "scripted" });
  const [at, setAt] = useState(0);
  const [results, setResults] = useState<BeatResult[]>([]);
  const [outcomes, setOutcomes] = useState<ReviewOutcome[]>([]);
  const [performanceGrade, setPerformanceGrade] = useState<Grade | null>(null);
  const [transcript, setTranscript] = useState<PerformanceUtterance[]>([]);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [overlay, setOverlay] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const startedRef = useRef(false);

  const compose = useCallback(() => {
    setStatus("loading");
    fetch("/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: station.id, mode }),
    })
      .then(async (response) => {
        if (response.status === 403) {
          router.replace("/");
          return null;
        }
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as { needsPlacement?: boolean; sessionId?: string; plan?: LessonPlan };
      })
      .then((data) => {
        if (!data) return;
        if (data.needsPlacement) {
          router.replace("/willkommen");
          return;
        }
        if (!data.sessionId || !data.plan) throw new Error("bad plan");
        setSession({ sessionId: data.sessionId, plan: data.plan });
        setStatus("ready");
        warmScene(station, station.scene.lines);

        void fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId: station.id, phase: "brief" }),
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((brief: { brief?: Brief; keyPerformances?: KeyPerformance[]; source?: "model" | "fallback" } | null) => {
            setCoach({
              status: "ready",
              brief: brief?.brief ?? null,
              keyPerformances: brief?.keyPerformances ?? [],
              source: brief?.source ?? "none",
            });
          })
          .catch(() => setCoach((current) => ({ ...current, status: "ready" })));

        if (data.plan.variation) {
          setScene({ status: "loading", lines: station.scene.lines, source: "scripted" });
          const variation = fetch("/api/scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stationId: station.id, seed: String(visits) }),
          })
            .then((response) => (response.ok ? response.json() : null))
            .then((result: { lines?: SceneLine[]; source?: "model" | "scripted" } | null) =>
              result?.source === "model" && result.lines && result.lines.length > 0 ? result.lines : null,
            )
            .catch(() => null);
          const deadline = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SCENE_DEADLINE_MS));
          void Promise.race([variation, deadline]).then((lines) => {
            setScene({ status: "ready", lines: lines ?? station.scene.lines, source: lines ? "model" : "scripted" });
            if (lines) warmScene(station, lines);
          });
        }
      })
      .catch(() => setStatus("error"));
  }, [mode, router, station, visits]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    compose();
  }, [compose]);

  const submit = useCallback((outcome: ReviewOutcome) => {
    setOutcomes((all) => [...all, outcome]);
    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { milestones?: MilestoneEvent[] } | null) => {
        const events = data?.milestones ?? [];
        if (events.length > 0) setMilestones((queue) => [...queue, ...events]);
      })
      .catch(() => {
        // A lost review is one lost datapoint — never block the lesson on it.
      });
  }, []);

  const onMilestones = useCallback((events: MilestoneLike[]) => {
    setMilestones((queue) => [...queue, ...(events as MilestoneEvent[])]);
    setOverlay(true);
  }, []);

  const steps: StepSpec[] = session?.plan.steps ?? [];
  const step = steps[at];
  const last = at >= steps.length - 1;

  const advance = useCallback(() => {
    stopSpeaking();
    if (last) {
      router.push("/");
      return;
    }
    playStep();
    setAt((i) => i + 1);
    window.scrollTo({ top: 0 });
  }, [last, router]);

  const finish = useCallback(
    (info: FinishInfo) => {
      if (!step) return;
      stopSpeaking();
      setResults((all) => [...all, { stepKind: step.kind, correct: info.correct, detail: info.detail }]);
      if (info.performanceGrade) setPerformanceGrade(info.performanceGrade);
      if (info.transcript) setTranscript(info.transcript);
      if (milestones.length > 0 && !last) setOverlay(true);
      else advance();
    },
    [advance, last, milestones.length, step],
  );

  const leave = () => {
    stopSpeaking();
    router.push("/");
  };

  if (status === "loading" || !session || !step) {
    if (status === "error") {
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-gutter py-10 text-center">
          <p className="text-body text-ink-muted">{t.station.loadError}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={compose}>
              {t.station.retry}
            </Button>
            <Link href="/">
              <Button variant="quiet">{t.station.toLine}</Button>
            </Link>
          </div>
        </main>
      );
    }
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-gutter py-10">
        <Spinner size="lg" label={t.station.composing} className="text-accent" />
        <p className="text-body-sm text-ink-muted">{t.station.composing}</p>
      </main>
    );
  }

  const midLesson = at > 0 && !last;
  const beatName = t.station.beats[step.kind] ?? step.kind;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-gutter pt-safe pb-4">
      {overlay && milestones.length > 0 && (
        <MilestoneOverlay
          events={milestones}
          onDone={() => {
            setMilestones([]);
            setOverlay(false);
            if (!last) advance();
          }}
        />
      )}

      <header className="flex flex-col gap-2 pt-3">
        <div className="flex items-center gap-2">
          <IconButton label={t.station.close} onClick={() => (midLesson ? setConfirmLeave(true) : leave())}>
            <X />
          </IconButton>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <ProgressBar segments={steps.length} current={at} label={t.station.progressLabel(at + 1, steps.length)} />
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-label font-semibold uppercase text-accent">{beatName}</span>
              <span className="text-caption tabular text-ink-muted">{t.station.progressLabel(at + 1, steps.length)}</span>
            </div>
          </div>
        </div>
        {step.kind !== "arrive" && (
          <StationSign
            name={station.name}
            subtitle={station.scene.title}
            line={lineNumberOf(line)}
            status="current"
            index={station.order}
            statusLabel={t.station.stationStatus}
            className="[&_.text-title]:text-body [&_.py-3]:py-1.5"
          />
        )}
      </header>

      <div key={`${at}-${step.kind}`} className="flex flex-1 flex-col animate-fade-up">
        <Beat
          station={station}
          step={step}
          plan={session.plan}
          lines={scene.lines}
          scene={scene}
          coach={coach}
          visits={visits}
          mode={mode}
          sessionId={session.sessionId}
          results={results}
          performanceGrade={performanceGrade}
          transcript={transcript}
          outcomes={outcomes}
          autoplay={at > 0}
          submit={submit}
          finish={finish}
          onMilestones={onMilestones}
        />
      </div>

      <Sheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t.station.leaveTitle}
        closeLabel={t.station.closeSheet}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
              {t.station.leaveStay}
            </Button>
            <Button variant="danger" onClick={leave}>
              {t.station.leaveConfirm}
            </Button>
          </div>
        }
      >
        <p className="text-body text-ink-muted">{t.station.leaveBody}</p>
      </Sheet>
    </main>
  );
}
