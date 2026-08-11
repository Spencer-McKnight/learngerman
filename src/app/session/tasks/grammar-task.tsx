"use client";

/**
 * A grammar bite: one screen of English, delivered exactly when the
 * staircase says the learner is ready — garnish, not the meal. The
 * outcome advances the bite towards "settled" so the curriculum
 * moves on.
 */

import { useEffect, useState } from "react";
import { CURRICULUM } from "@/lib/engine";
import { Button, Card } from "@/components/ui";
import { baseOutcome, TaskHeading, type TaskProps } from "./shared";

export function GrammarTask({ task, submit, finish, skip }: TaskProps) {
  const bite = CURRICULUM.find((candidate) => candidate.id === task.biteId);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!bite) skip();
  }, [bite, skip]);
  if (!bite) return null;
  return (
    <>
      <TaskHeading title={bite.titleDe} note={bite.title} />
      <Card className="flex flex-col gap-4">
        <p className="text-[16px] leading-relaxed">{bite.summary}</p>
        <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
          Ab jetzt in deinen Aufgaben: {bite.drillFocus}.
        </p>
      </Card>
      <div className="mt-auto">
        <Button
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await submit({ ...baseOutcome(task, true), biteId: bite.id });
            finish();
          }}
        >
          Verstanden — weiter
        </Button>
      </div>
    </>
  );
}
