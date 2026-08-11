"use client";

/**
 * Shadowing: listen, then say it back. Scored honestly at the word
 * level from the STT transcript; where recognition doesn't exist the
 * fallback is clearly-labelled self-assessment — never a fake score.
 */

import { useMemo, useState } from "react";
import type { GeneratedStory } from "@/lib/engine";
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

export function ShadowTask({ task, submit, finish, skip }: TaskProps) {
  const generated = useGenerated<GeneratedStory>(task);
  const canListen = useMemo(() => ttsAvailable(), []);
  const canSpeak = useMemo(() => sttAvailable(), []);
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<ReturnType<typeof scoreSpeech> | null>(null);
  const [grades, setGrades] = useState<(1 | 2 | 3 | 4)[]>([]);
  const [busy, setBusy] = useState(false);

  if (generated.status === "loading") return <GeneratingCard />;
  if (generated.status === "failed" || !generated.content) return <FailedCard skip={skip} />;

  const sentences = generated.content.sentences;
  const sentence = sentences[index];

  const record = async () => {
    setListening(true);
    setTranscript("");
    const recognizer = recognizeGerman(setTranscript);
    const heard = await recognizer.result;
    setListening(false);
    const result = scoreSpeech(heard, sentence);
    setScore(result);
    if (result.verdict === "retry") playWrong();
    else playCorrect();
  };

  const advance = async (grade: 1 | 2 | 3 | 4) => {
    const collected = [...grades, grade];
    if (index + 1 < sentences.length) {
      setGrades(collected);
      setIndex(index + 1);
      setScore(null);
      setTranscript("");
    } else {
      setBusy(true);
      const mean = collected.reduce((sum, value) => sum + value, 0) / collected.length;
      const rounded = Math.round(mean) as 1 | 2 | 3 | 4;
      const targets = task.generation?.targetLemmas ?? [];
      await submit({
        ...baseOutcome(
          task,
          mean >= 2,
          Object.fromEntries(targets.map((id) => [id, rounded])) as Record<
            string,
            1 | 2 | 3 | 4
          >,
        ),
        inputSeconds: task.seconds,
      });
      finish();
    }
  };

  return (
    <>
      <TaskHeading
        title="Sprich nach"
        note={`Satz ${index + 1} von ${sentences.length} — erst hören, dann laut nachsprechen.`}
      />
      <Card className="flex flex-col items-center gap-5 py-8">
        <p className="text-center text-[19px] font-medium leading-relaxed">{sentence}</p>
        <div className="flex gap-2">
          {canListen && (
            <Button variant="outline" onClick={() => void speakGerman(sentence)}>
              ▶ Anhören
            </Button>
          )}
          {canSpeak && !score && (
            <Button onClick={record} disabled={listening}>
              {listening ? "● Höre zu …" : "🎙 Nachsprechen"}
            </Button>
          )}
        </div>
        {listening && transcript && (
          <p className="text-sm italic text-muted">„{transcript}“</p>
        )}
        {score && (
          <div className="flex flex-col items-center gap-1 animate-fade-up">
            <p className="text-sm font-medium">
              {score.verdict === "great" && "Sauber!"}
              {score.verdict === "good" && "Fast — ein paar Wörter fehlten."}
              {score.verdict === "retry" && "Noch einmal hören und probieren?"}
            </p>
            {score.missedWords.length > 0 && (
              <p className="text-xs text-muted">
                Nicht gehört: {score.missedWords.join(", ")}
              </p>
            )}
          </div>
        )}
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        {score ? (
          <div className="grid grid-cols-2 gap-2">
            {score.verdict === "retry" && (
              <Button variant="outline" onClick={record} disabled={listening}>
                Nochmal
              </Button>
            )}
            <Button
              className={score.verdict === "retry" ? "" : "col-span-2"}
              disabled={busy}
              onClick={() => advance(score.grade)}
            >
              Weiter
            </Button>
          </div>
        ) : (
          !canSpeak && (
            <>
              <p className="text-center text-xs text-muted">
                Keine Spracherkennung auf diesem Gerät — deine ehrliche
                Selbsteinschätzung:
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
          )
        )}
      </div>
    </>
  );
}
