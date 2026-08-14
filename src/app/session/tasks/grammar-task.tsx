"use client";

/**
 * A grammar bite: one screen of English, delivered exactly when the
 * staircase says the learner is ready — garnish, not the meal. The
 * outcome advances the bite towards "settled" so the curriculum
 * moves on.
 */

import { useEffect, useState } from "react";
import { CURRICULUM } from "@/lib/engine";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import { baseOutcome, TaskHeading, type TaskProps } from "./shared";

export function GrammarTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const uiLang = useUiLang();
  const bite = CURRICULUM.find((candidate) => candidate.id === task.biteId);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!bite) skip();
  }, [bite, skip]);
  if (!bite) return null;
  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.grammar}
        title={uiLang === "de" ? bite.titleDe : bite.title}
        note={uiLang === "de" ? bite.title : bite.titleDe}
      />
      <Card className="flex flex-col gap-4">
        <p className="text-[16px] leading-relaxed">{bite.summary}</p>
        <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
          {t.tasks.grammar.fromNow(bite.drillFocus)}
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
          {t.tasks.grammar.gotIt}
        </Button>
      </div>
    </>
  );
}
