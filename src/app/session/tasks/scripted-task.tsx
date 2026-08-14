"use client";

/**
 * Scripted dialogue: the learner speaks their own "Du" turns of the
 * scene's dialogue — training wheels between construction and free
 * speech. The meaning of every line is visible before it's spoken;
 * nobody performs a sentence they can't place.
 */

import { useMemo, useState } from "react";
import { scoreSpeech } from "@/lib/engine";
import { speakGerman, ttsAvailable } from "@/lib/audio/tts";
import { recognizeGerman, sttAvailable } from "@/lib/audio/stt";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  GeneratingCard,
  glossMapOf,
  GlossText,
  TaskHeading,
  useEpisode,
  type TaskProps,
} from "./shared";

export function ScriptedTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { status, episode } = useEpisode();
  const canListen = useMemo(() => ttsAvailable(), []);
  const canSpeak = useMemo(() => sttAvailable(), []);
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [verdict, setVerdict] = useState<"great" | "good" | "retry" | null>(null);
  const [grades, setGrades] = useState<(1 | 2 | 3 | 4)[]>([]);
  const [busy, setBusy] = useState(false);

  const glosses = useMemo(() => glossMapOf(episode), [episode]);

  if (status === "loading") return <GeneratingCard />;
  if (status === "failed" || !episode || episode.dialogue.length === 0) {
    return <FailedCard skip={skip} />;
  }

  const turns = episode.dialogue;
  const hasDu = turns.some((turn) => turn.speaker === "Du");
  const partner = hasDu ? null : turns[0]?.speaker;
  const isMine = (speaker: string) =>
    hasDu ? speaker === "Du" : speaker !== partner;
  const turn = turns[index];
  const mine = isMine(turn.speaker);

  const record = async () => {
    setListening(true);
    const recognizer = recognizeGerman();
    const heard = await recognizer.result;
    setListening(false);
    const result = scoreSpeech(heard, turn.de);
    setVerdict(result.verdict);
    setGrades((all) => [...all, result.grade]);
    if (result.verdict === "retry") playWrong();
    else playCorrect();
  };

  const advance = async (extraGrade?: 1 | 2 | 3 | 4) => {
    const collected = extraGrade ? [...grades, extraGrade] : grades;
    if (index + 1 < turns.length) {
      setGrades(collected);
      setIndex(index + 1);
      setVerdict(null);
    } else {
      setBusy(true);
      const spoken = collected.length > 0 ? collected : [2 as const];
      const mean = spoken.reduce((sum, grade) => sum + grade, 0) / spoken.length;
      const targets = task.lexemeIds ?? [];
      await submit({
        ...baseOutcome(
          task,
          mean >= 2,
          Object.fromEntries(
            targets.map((id) => [id, Math.round(mean) as 1 | 2 | 3 | 4]),
          ) as Record<string, 1 | 2 | 3 | 4>,
        ),
        inputSeconds: task.seconds,
      });
      finish();
    }
  };

  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.dialogue}
        title={episode.title}
        note={
          mine ? t.tasks.scripted.yourLine : t.tasks.scripted.partnerLine(turn.speaker)
        }
      />
      <Card className="flex flex-col gap-3">
        {turns.slice(0, index + 1).map((line, i) => {
          const lineMine = isMine(line.speaker);
          return (
            <div
              key={i}
              className={`flex max-w-[85%] flex-col gap-0.5 rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                lineMine
                  ? "self-end rounded-br-md bg-accent text-white"
                  : "self-start rounded-bl-md bg-background"
              }`}
            >
              <span>
                {lineMine ? line.de : <GlossText text={line.de} glosses={glosses} />}
              </span>
              {i === index && (
                <span className={`text-xs ${lineMine ? "text-white/75" : "text-muted"}`}>
                  {line.en}
                </span>
              )}
            </div>
          );
        })}
        {verdict && (
          <p className="self-end text-xs text-muted animate-fade-up">
            {verdict === "great" && t.tasks.scripted.great}
            {verdict === "good" && t.tasks.scripted.good}
            {verdict === "retry" && t.tasks.scripted.retry}
          </p>
        )}
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        {!mine ? (
          <div className="grid grid-cols-2 gap-2">
            {canListen && (
              <Button variant="outline" onClick={() => void speakGerman(turn.de)}>
                {t.common.listen}
              </Button>
            )}
            <Button
              className={canListen ? "" : "col-span-2"}
              onClick={() => advance()}
            >
              {t.common.continue}
            </Button>
          </div>
        ) : verdict ? (
          <Button disabled={busy} onClick={() => advance()}>
            {t.common.continue}
          </Button>
        ) : canSpeak ? (
          <Button onClick={record} disabled={listening}>
            {listening ? t.tasks.scripted.recording : t.tasks.scripted.speakLine}
          </Button>
        ) : (
          <>
            <p className="text-center text-xs text-muted">
              {t.tasks.scripted.noStt}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="answer" disabled={busy} onClick={() => advance(1)}>
                {t.tasks.shadow.selfHard}
              </Button>
              <Button variant="answer" disabled={busy} onClick={() => advance(2)}>
                {t.tasks.shadow.selfSoso}
              </Button>
              <Button variant="answer" disabled={busy} onClick={() => advance(3)}>
                {t.tasks.shadow.selfEasy}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
