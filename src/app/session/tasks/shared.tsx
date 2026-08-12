"use client";

/**
 * Shared plumbing for task renderers. Every task reduces to one or
 * more ReviewOutcomes (the engine's atom); scoring runs client-side
 * with the same pure engine functions the tests cover.
 */

import { useEffect, useState } from "react";
import type { ReviewOutcome, TaskSpec } from "@/lib/engine";
import { buildIndex, SEED_LEXICON } from "@/lib/engine";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";

/** The lexicon ships as TypeScript, so the client indexes it locally. */
export const INDEX = buildIndex(SEED_LEXICON);

export interface TaskProps {
  task: TaskSpec;
  /** Post one graded outcome (player collects milestones). */
  submit: (outcome: ReviewOutcome) => Promise<void>;
  /** Advance to the next task. */
  finish: () => void;
  /** Skip without grading (generation failed, nothing to show). */
  skip: () => void;
}

export function baseOutcome(
  task: TaskSpec,
  correct: boolean,
  lexemeGrades: ReviewOutcome["lexemeGrades"] = {},
): ReviewOutcome {
  return {
    taskKind: task.kind,
    skill: task.skill,
    correct,
    lexemeGrades,
    difficulty: task.difficulty,
  };
}

export function gradesFor(
  lexemeIds: string[],
  grade: 1 | 2 | 3 | 4,
): ReviewOutcome["lexemeGrades"] {
  return Object.fromEntries(lexemeIds.map((id) => [id, grade]));
}

type Generated<T> =
  | { status: "loading"; content: null }
  | { status: "ready"; content: T }
  | { status: "failed"; content: null };

/** Fetch generated content for a task; the API enforces the coverage
 *  contract and 502s rather than serving incomprehensible German. */
export function useGenerated<T>(task: TaskSpec): Generated<T> {
  const [state, setState] = useState<Generated<T>>(() =>
    task.generation
      ? { status: "loading", content: null }
      : { status: "failed", content: null },
  );
  useEffect(() => {
    if (!task.generation) return;
    let cancelled = false;
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task.generation),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setState({ status: "ready", content: data.content as T });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed", content: null });
      });
    return () => {
      cancelled = true;
    };
  }, [task]);
  return state;
}

export function GeneratingCard() {
  const t = useStrings();
  return (
    <Card className="flex flex-col items-center gap-3 py-10">
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-line border-t-accent-bright"
      />
      <p className="text-sm text-muted">{t.tasks.generating}</p>
    </Card>
  );
}

/** Honest failure state: never serve broken content, never fake it. */
export function FailedCard({ skip }: { skip: () => void }) {
  const t = useStrings();
  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-muted">{t.tasks.failedBody}</p>
      <Button variant="outline" onClick={skip}>
        {t.common.continue}
      </Button>
    </Card>
  );
}

export function TaskHeading({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}
