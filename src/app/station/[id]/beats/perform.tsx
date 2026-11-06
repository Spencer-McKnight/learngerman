"use client";

/**
 * Leistung — the proof of the can-do. A role-play (scripted, or free
 * conversation with the tutor when the rung allows and the route is
 * up), "say it" (spoken prompts) or "write it" (typed). The grade
 * 1–4 is the mean verdict over the learner's lines and travels to
 * PATCH /api/lesson with the departure.
 */

import { useState } from "react";
import { duLineIndices } from "@/lib/engine/session/lesson";
import { useStrings } from "@/components/i18n-provider";
import { Card, Eyebrow } from "@/components/ui";
import { meanGrade, outcomeFor, type BeatProps, type Grade } from "../lib";
import { BeatHeading } from "../parts";
import { ConstructDrill } from "./speak-construct";
import { FreeConversation } from "./perform-free";
import { ScriptedPlay } from "./speak-scripted";

export function PerformBeat({ station, step, lines, submit, finish }: BeatProps) {
  const t = useStrings();
  const performance = station.performance;
  const [offline, setOffline] = useState(false);
  const free = Boolean(step.free) && performance.kind === "role-play" && !offline;

  const done = (taskKind: string, grades: Grade[], transcript: BeatProps["transcript"], summary: boolean) => {
    const grade = meanGrade(grades);
    if (summary) submit(outcomeFor(step, taskKind, grade >= 2, {}, { inputSeconds: step.seconds }));
    finish({
      correct: grade >= 2,
      performanceGrade: grade,
      transcript,
      detail: `${t.station.perform.grade[grade]} (${grades.filter((g) => g >= 2).length}/${grades.length})`,
    });
  };

  const script =
    performance.lines && performance.lines.length > 0
      ? performance.lines
      : duLineIndices(station).length > 0
        ? lines.filter((line) => line.speaker !== "narrator")
        : [];
  const counterpart = performance.counterpart ?? script.find((line) => line.speaker !== "du")?.speaker ?? "jule";
  const opener = script[0] && script[0].speaker !== "du" ? script[0] : undefined;
  const prompts = performance.prompts ?? [];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.perform} title={t.station.perform.title} note={performance.canDoEn} />
      <Card variant="outline" className="flex flex-col gap-1 py-3">
        <Eyebrow>{free ? t.station.perform.free : t.station.perform.situation}</Eyebrow>
        <p className="text-body text-ink">{performance.situationEn}</p>
        {offline && <p className="text-caption text-ink-muted">{t.station.perform.offline}</p>}
      </Card>

      {performance.kind === "role-play" && free && (
        <FreeConversation
          station={station}
          counterpart={counterpart}
          opener={opener}
          onTurn={(_text, correct, evidence) => submit(outcomeFor(step, "conversation-turn", correct, {}, evidence))}
          onDone={(grades, transcript) => done("conversation-turn", grades, transcript, false)}
          onOffline={() => setOffline(true)}
        />
      )}
      {performance.kind === "role-play" && !free && (
        <ScriptedPlay station={station} lines={script} onDone={(grades, transcript) => done("scripted-dialogue", grades, transcript, true)} />
      )}
      {performance.kind !== "role-play" && (
        <ConstructDrill
          items={prompts}
          input={performance.kind === "say-it" ? "speak" : "type"}
          onItem={({ grade, evidence }) =>
            submit(outcomeFor(step, performance.kind, grade >= 3, {}, evidence))
          }
          onDone={(grades, transcript) => done(performance.kind, grades, transcript, false)}
        />
      )}
    </div>
  );
}
