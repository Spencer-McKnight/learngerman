"use client";

/**
 * The session player: fetches a composed plan, steps through its
 * tasks, posts every graded outcome, and celebrates only genuine
 * milestone crossings. Leaving early loses nothing — every task's
 * results are already saved.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MilestoneEvent, ReviewOutcome, SessionPlan, TaskSpec } from "@/lib/engine";
import { MilestoneOverlay } from "@/components/milestone-overlay";
import { Button } from "@/components/ui";
import { StoryTask } from "./tasks/story-task";
import { RetrievalTask } from "./tasks/retrieval-task";
import { ClozeTask } from "./tasks/cloze-task";
import { ShadowTask } from "./tasks/shadow-task";
import { GrammarTask } from "./tasks/grammar-task";
import { HvptTask } from "./tasks/hvpt-task";
import { ConstructTask } from "./tasks/construct-task";
import { ScriptedTask } from "./tasks/scripted-task";
import { ConversationTask } from "./tasks/conversation-task";
import type { TaskProps } from "./tasks/shared";

type Phase = "loading" | "briefing" | "task" | "done" | "error";

const MODE_TITLES: Record<string, string> = {
  review: "Nur wiederholen",
  ear: "Ohrtraining",
  speak: "Sprechrunde",
};

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
  const router = useRouter();
  const mode = useSearchParams().get("modus") ?? "full";

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [showMilestones, setShowMilestones] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const wordsTouched = useRef(new Set<string>());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: mode === "full" ? undefined : mode }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (data.needsPlacement) {
          router.replace("/willkommen");
          return;
        }
        setPlan(data.plan);
        setSessionId(data.sessionId);
        setPhase("briefing");
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
        <p className="text-sm text-muted">Stelle deine Runde zusammen …</p>
      </main>
    );
  }

  if (phase === "error" || !plan) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted">
          Die Runde lässt sich gerade nicht laden. Versuch es gleich noch einmal.
        </p>
        <Link href="/">
          <Button variant="outline">Zurück</Button>
        </Link>
      </main>
    );
  }

  if (phase === "briefing") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {MODE_TITLES[mode] ?? "Deine Runde"}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            ~{Math.max(1, Math.round(plan.totalSeconds / 60))} Minuten,{" "}
            {plan.tasks.length} {plan.tasks.length === 1 ? "Aufgabe" : "Aufgaben"}.
          </h1>
        </div>
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
          <Button className="py-3.5 text-base" onClick={() => setPhase("task")}>
            Los
          </Button>
          <Link href="/" className="text-center text-sm text-muted hover:underline">
            Doch nicht
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 text-center">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-success">
            Geschafft
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Das war deine Runde.
          </h1>
          <p className="text-[15px] text-muted">
            {wordCount > 0
              ? `${wordCount} Wörter geübt — die Serie ist sicher. Bis morgen!`
              : "Die Serie ist sicher. Bis morgen!"}
          </p>
        </div>
        <Button className="py-3.5 text-base" onClick={() => router.push("/")}>
          Fertig
        </Button>
      </main>
    );
  }

  const task: TaskSpec = plan.tasks[taskIndex];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
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
          aria-label="Runde beenden"
          className="text-2xl leading-none text-muted transition hover:text-foreground"
        >
          ×
        </Link>
        <div className="flex flex-1 gap-1">
          {plan.tasks.map((planned, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < taskIndex
                  ? "bg-success"
                  : i === taskIndex
                    ? "bg-accent-bright"
                    : "bg-line"
              }`}
            />
          ))}
        </div>
      </header>
      <div key={taskIndex} className="flex flex-1 flex-col gap-4 animate-fade-up">
        <TaskView task={task} submit={submit} finish={finish} skip={finish} />
      </div>
    </main>
  );
}
