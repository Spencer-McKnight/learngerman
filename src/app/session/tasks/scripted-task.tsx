"use client";

/**
 * Scripted dialogue: the learner speaks fixed turns of a two-person
 * dialogue — training wheels between construction and free speech.
 */

import { useMemo, useState } from "react";
import type { GeneratedDialogue } from "@/lib/engine";
import { scoreSpeech } from "@/lib/engine";
import { speakGerman, ttsAvailable } from "@/lib/audio/tts";
import { recognizeGerman, sttAvailable } from "@/lib/audio/stt";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  GeneratingCard,
  TaskHeading,
  useGenerated,
  type TaskProps,
} from "./shared";

export function ScriptedTask({ task, submit, finish, skip }: TaskProps) {
  const generated = useGenerated<GeneratedDialogue>(task);
  const canListen = useMemo(() => ttsAvailable(), []);
  const canSpeak = useMemo(() => sttAvailable(), []);
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [verdict, setVerdict] = useState<"great" | "good" | "retry" | null>(null);
  const [grades, setGrades] = useState<(1 | 2 | 3 | 4)[]>([]);
  const [busy, setBusy] = useState(false);

  if (generated.status === "loading") return <GeneratingCard />;
  if (generated.status === "failed" || !generated.content) return <FailedCard skip={skip} />;

  const turns = generated.content.turns;
  const partner = turns[0]?.speaker;
  const turn = turns[index];
  const mine = turn.speaker !== partner;

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
      const targets = task.generation?.targetLemmas ?? [];
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
        title={generated.content.title}
        note={
          mine
            ? "Deine Zeile — sprich sie laut."
            : `${turn.speaker} spricht — hör zu.`
        }
      />
      <Card className="flex flex-col gap-3">
        {turns.slice(0, index + 1).map((line, i) => {
          const isMine = line.speaker !== partner;
          return (
            <p
              key={i}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                isMine
                  ? "self-end rounded-br-md bg-accent text-white"
                  : "self-start rounded-bl-md bg-background"
              }`}
            >
              {line.de}
            </p>
          );
        })}
        {verdict && (
          <p className="self-end text-xs text-muted animate-fade-up">
            {verdict === "great" && "Sauber!"}
            {verdict === "good" && "Fast alles da."}
            {verdict === "retry" && "Beim nächsten Mal lockerer — weiter geht's."}
          </p>
        )}
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        {!mine ? (
          <div className="grid grid-cols-2 gap-2">
            {canListen && (
              <Button variant="outline" onClick={() => void speakGerman(turn.de)}>
                ▶ Anhören
              </Button>
            )}
            <Button
              className={canListen ? "" : "col-span-2"}
              onClick={() => advance()}
            >
              Weiter
            </Button>
          </div>
        ) : verdict ? (
          <Button disabled={busy} onClick={() => advance()}>
            Weiter
          </Button>
        ) : canSpeak ? (
          <Button onClick={record} disabled={listening}>
            {listening ? "● Höre zu …" : "🎙 Sprich deine Zeile"}
          </Button>
        ) : (
          <>
            <p className="text-center text-xs text-muted">
              Keine Spracherkennung — lies laut und schätz dich ehrlich ein:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="answer" disabled={busy} onClick={() => advance(1)}>
                Schwer
              </Button>
              <Button variant="answer" disabled={busy} onClick={() => advance(2)}>
                Ging so
              </Button>
              <Button variant="answer" disabled={busy} onClick={() => advance(3)}>
                Locker
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
