"use client";

import { useEffect, useState } from "react";
import type { GenerationSpec, ReviewOutcome, TaskSpec } from "@/lib/engine";
import { buildIndex, SEED_LEXICON } from "@/lib/engine";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";

export const INDEX = buildIndex(SEED_LEXICON);

export interface TaskProps {
  task: TaskSpec;
  submit: (outcome: ReviewOutcome) => Promise<void>;
  finish: () => void;
  skip: () => void;
  sparkle?: (x: number, y: number) => void;
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

type CacheEntry = { promise: Promise<unknown>; resolved: boolean; content: unknown | null };
const generationCache = new Map<string, CacheEntry>();

function cacheKey(spec: GenerationSpec): string {
  return JSON.stringify(spec);
}

function fetchGeneration(spec: GenerationSpec): CacheEntry {
  const key = cacheKey(spec);
  const existing = generationCache.get(key);
  if (existing) return existing;

  const entry: CacheEntry = { promise: null!, resolved: false, content: null };
  entry.promise = fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      entry.resolved = true;
      entry.content = data.content;
      return data.content;
    })
    .catch(() => {
      entry.resolved = true;
      entry.content = null;
      return null;
    });
  generationCache.set(key, entry);
  return entry;
}

export function prefetchTasks(tasks: TaskSpec[], fromIndex: number) {
  const LOOKAHEAD = 2;
  for (let i = fromIndex; i < Math.min(fromIndex + LOOKAHEAD, tasks.length); i++) {
    const spec = tasks[i].generation;
    if (spec) fetchGeneration(spec);
  }
}

export function useGenerated<T>(task: TaskSpec): Generated<T> {
  const [state, setState] = useState<Generated<T>>(() => {
    if (!task.generation) return { status: "failed", content: null };
    const entry = generationCache.get(cacheKey(task.generation));
    if (entry?.resolved && entry.content) return { status: "ready", content: entry.content as T };
    return { status: "loading", content: null };
  });
  useEffect(() => {
    if (!task.generation) return;
    let cancelled = false;
    const entry = fetchGeneration(task.generation);
    if (entry.resolved) {
      setState(
        entry.content
          ? { status: "ready", content: entry.content as T }
          : { status: "failed", content: null },
      );
      return;
    }
    entry.promise.then(() => {
      if (cancelled) return;
      setState(
        entry.content
          ? { status: "ready", content: entry.content as T }
          : { status: "failed", content: null },
      );
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
