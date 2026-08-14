"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Episode,
  MilestoneEvent,
  ReviewOutcome,
  SessionPlan,
  TaskSpec,
} from "@/lib/engine";
import { MilestoneOverlay } from "@/components/milestone-overlay";
import { useStrings } from "@/components/i18n-provider";
import type { UiStrings } from "@/lib/i18n/strings";
import { Button } from "@/components/ui";
import { useSparkle } from "@/components/particles";
import { StoryTask } from "./tasks/story-task";
import { RetrievalTask } from "./tasks/retrieval-task";
import { ClozeTask } from "./tasks/cloze-task";
import { ShadowTask } from "./tasks/shadow-task";
import { GrammarTask } from "./tasks/grammar-task";
import { HvptTask } from "./tasks/hvpt-task";
import { ConstructTask } from "./tasks/construct-task";
import { ScriptedTask } from "./tasks/scripted-task";
import { ConversationTask } from "./tasks/conversation-task";
import { EpisodeProvider, type EpisodeState, type TaskProps } from "./tasks/shared";

type Phase = "loading" | "briefing" | "task" | "done" | "error";

const modeTitle = (mode: string, t: UiStrings) =>
  mode === "review"
    ? t.player.modeReview
    : mode === "ear"
      ? t.player.modeEar
      : mode === "speak"
        ? t.player.modeSpeak
        : t.player.modeDefault;

function TaskView(props: TaskProps) {
  switch (props.task.kind) {
    case "story-read":
    case "dialogue-read":
    case "listen-clip":
      return <StoryTask {...props} />;
    case "retrieval-tap":
      return <RetrievalTask {...props} />;
    case "cloze-type":
      return <ClozeTask {...props} />;
    case "shadowing":
      return <ShadowTask {...props} />;
    case "grammar-bite":
      return <GrammarTask {...props} />;
    case "hvpt-pair":
      return <HvptTask {...props} />;
    case "construct-sentence":
    case "timed-recall":
      return <ConstructTask {...props} />;
    case "scripted-dialogue":
      return <ScriptedTask {...props} />;
    case "conversation-turn":
      return <ConversationTask {...props} />;
    default:
      return null;
  }
}

export function SessionPlayer() {
  const t = useStrings();
  const router = useRouter();
  const mode = useSearchParams().get("modus") ?? "full";
  const { fire, SparkCanvas } = useSparkle();

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [episodeState, setEpisodeState] = useState<EpisodeState>({
    status: "loading",
    episode: null,
    spec: null,
    fallback: false,
  });
  const [taskIndex, setTaskIndex] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [showMilestones, setShowMilestones] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const wordsTouched = useRef(new Set<string>());
  const started = useRef(false);

  // The whole session's content is ONE generation, requested the
  // moment the plan lands — it resolves while the learner reads the
  // briefing, so no task ever waits on a spinner.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: mode === "full" ? undefined : mode }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { needsPlacement?: boolean; plan: SessionPlan; sessionId: string }) => {
        if (data.needsPlacement) {
          router.replace("/willkommen");
          return;
        }
        setPlan(data.plan);
        setSessionId(data.sessionId);
        setPhase("briefing");
        const spec = data.plan.episodeSpec;
        if (!spec) {
          setEpisodeState({ status: "ready", episode: null, spec: null, fallback: false });
          return;
        }
        fetch("/api/episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(spec),
        })
          .then((response) => (response.ok ? response.json() : Promise.reject()))
          .then((result: { episode: Episode; fallback?: boolean }) => {
            setEpisodeState({
              status: "ready",
              episode: result.episode,
              spec,
              fallback: Boolean(result.fallback),
            });
          })
          .catch(() => {
            setEpisodeState({ status: "failed", episode: null, spec, fallback: false });
          });
      })
      .catch(() => setPhase("error"));
  }, [mode, router]);

  const submit = useCallback(async (outcome: ReviewOutcome) => {
    for (const id of Object.keys(outcome.lexemeGrades)) wordsTouched.current.add(id);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcome),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.milestones) && data.milestones.length > 0) {
          setMilestones((queue) => [...queue, ...data.milestones]);
        }
      }
    } catch {
      // A lost review is one lost datapoint — never block the session on it.
    }
  }, []);

  const advance = useCallback(() => {
    if (!plan) return;
    if (taskIndex + 1 < plan.tasks.length) {
      setTaskIndex(taskIndex + 1);
    } else {
      setWordCount(wordsTouched.current.size);
      setPhase("done");
      if (sessionId) {
        void fetch("/api/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }
    }
  }, [plan, taskIndex, sessionId]);

  const finish = useCallback(() => {
    if (milestones.length > 0) setShowMilestones(true);
    else advance();
  }, [milestones, advance]);

  if (phase === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <span
          aria-hidden
          className="size-7 animate-spin rounded-full border-2 border-line border-t-accent-bright"
        />
        <p className="text-sm text-muted">{t.player.composing}</p>
      </main>
    );
  }

  if (phase === "error" || !plan) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted">{t.player.loadError}</p>
        <Link href="/">
          <Button variant="outline">{t.common.back}</Button>
        </Link>
      </main>
    );
  }

  if (phase === "briefing") {
    const episodePending = plan.episodeSpec !== null && episodeState.status === "loading";
    const scene = episodeState.episode;
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 stagger-children">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {modeTitle(mode, t)}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t.player.briefingTitle(
              Math.max(1, Math.round(plan.totalSeconds / 60)),
              plan.tasks.length,
            )}
          </h1>
        </div>
        {plan.episodeSpec !== null && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-background/60 px-4 py-3.5">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {t.player.sceneEyebrow}
            </p>
            {scene ? (
              <div className="flex flex-col gap-1 animate-fade-up">
                <p className="font-display text-lg font-bold tracking-tight">
                  {scene.title}
                  <span className="ml-2 text-sm font-medium text-muted">{scene.titleEn}</span>
                </p>
                <p className="text-sm text-muted">{scene.settingEn}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-line border-t-accent-bright"
                />
                <p className="text-sm text-muted">{t.player.scenePreparing}</p>
              </div>
            )}
          </div>
        )}
        {plan.briefing.length > 0 && (
          <ul className="flex flex-col gap-2">
            {plan.briefing.map((line) => (
              <li key={line} className="flex items-center gap-2.5 text-[15px]">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-bright" />
                {line}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <Button
            className="py-3.5 text-base"
            disabled={episodePending}
            onClick={() => setPhase("task")}
          >
            {episodePending ? t.common.oneMoment : t.common.go}
          </Button>
          <Link href="/" className="text-center text-sm text-muted hover:underline">
            {t.player.notNow}
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const recap = episodeState.episode?.recapEn;
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 text-center stagger-children">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-success">
            {t.player.doneEyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t.player.doneTitle}
          </h1>
          {recap && <p className="text-[15px]">{recap}</p>}
          <p className="text-[15px] text-muted">
            {wordCount > 0 ? t.player.donePracticed(wordCount) : t.player.doneStreakSafe}
          </p>
        </div>
        <Button className="py-3.5 text-base" onClick={() => router.push("/")}>
          {t.common.done}
        </Button>
      </main>
    );
  }

  const task: TaskSpec = plan.tasks[taskIndex];
  const progressPct = ((taskIndex + 1) / plan.tasks.length) * 100;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
      {SparkCanvas}
      {showMilestones && (
        <MilestoneOverlay
          events={milestones}
          onDone={() => {
            setMilestones([]);
            setShowMilestones(false);
            advance();
          }}
        />
      )}
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label={t.player.endRound}
          className="text-2xl leading-none text-muted transition-all duration-200 hover:text-foreground hover:scale-110"
        >
          &times;
        </Link>
        <div className="relative flex-1 h-2 rounded-full bg-line overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted tabular-nums">
          {taskIndex + 1}/{plan.tasks.length}
        </span>
      </header>
      <EpisodeProvider value={episodeState}>
        <div key={taskIndex} className="flex flex-1 flex-col gap-4 animate-fade-up">
          <TaskView task={task} submit={submit} finish={finish} skip={finish} sparkle={fire} />
        </div>
      </EpisodeProvider>
    </main>
  );
}
