"use client";

/**
 * Shadowing: listen, then say back lines from the dialogue just read.
 * The English meaning sits under every line — nobody is asked to
 * speak a sentence they can't place. Scored honestly at the word
 * level from the STT transcript; where recognition doesn't exist the
 * fallback is clearly-labelled self-assessment — never a fake score.
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

export function ShadowTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { status, episode } = useEpisode();
  const canListen = useMemo(() => ttsAvailable(), []);
  const canSpeak = useMemo(() => sttAvailable(), []);
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<ReturnType<typeof scoreSpeech> | null>(null);
  const [grades, setGrades] = useState<(1 | 2 | 3 | 4)[]>([]);
  const [busy, setBusy] = useState(false);

  const glosses = useMemo(() => glossMapOf(episode), [episode]);

  if (status === "loading") return <GeneratingCard />;
  if (status === "failed" || !episode || episode.shadow.length === 0) {
    return <FailedCard skip={skip} />;
  }

  const lines = episode.shadow;
  const line = lines[index];

  const record = async () => {
    setListening(true);
    setTranscript("");
    const recognizer = recognizeGerman(setTranscript);
    const heard = await recognizer.result;
    setListening(false);
    const result = scoreSpeech(heard, line.de);
    setScore(result);
    if (result.verdict === "retry") playWrong();
    else playCorrect();
  };

  const advance = async (grade: 1 | 2 | 3 | 4) => {
    const collected = [...grades, grade];
    if (index + 1 < lines.length) {
      setGrades(collected);
      setIndex(index + 1);
      setScore(null);
      setTranscript("");
    } else {
      setBusy(true);
      const mean = collected.reduce((sum, value) => sum + value, 0) / collected.length;
      const rounded = Math.round(mean) as 1 | 2 | 3 | 4;
      const targets = task.lexemeIds ?? [];
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
        intro={t.tasks.intro.shadow}
        title={t.tasks.shadow.title}
        note={t.tasks.shadow.note(index + 1, lines.length)}
      />
      <Card className="flex flex-col items-center gap-5 py-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[19px] font-medium leading-relaxed">
            <GlossText text={line.de} glosses={glosses} />
          </p>
          <p className="text-sm text-muted">{line.en}</p>
        </div>
        <div className="flex gap-2">
          {canListen && (
            <Button variant="outline" onClick={() => void speakGerman(line.de)}>
              {t.common.listen}
            </Button>
          )}
          {canSpeak && !score && (
            <Button onClick={record} disabled={listening}>
              {listening ? t.tasks.shadow.recording : t.tasks.shadow.record}
            </Button>
          )}
        </div>
        {listening && transcript && (
          <p className="text-sm italic text-muted">„{transcript}“</p>
        )}
        {score && (
          <div className="flex flex-col items-center gap-1 animate-fade-up">
            <p className="text-sm font-medium">
              {score.verdict === "great" && t.tasks.shadow.great}
              {score.verdict === "good" && t.tasks.shadow.good}
              {score.verdict === "retry" && t.tasks.shadow.retry}
            </p>
            {score.missedWords.length > 0 && (
              <p className="text-xs text-muted">
                {t.tasks.shadow.missed(score.missedWords.join(", "))}
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
                {t.common.again}
              </Button>
            )}
            <Button
              className={score.verdict === "retry" ? "" : "col-span-2"}
              disabled={busy}
              onClick={() => advance(score.grade)}
            >
              {t.common.continue}
            </Button>
          </div>
        ) : (
          !canSpeak && (
            <>
              <p className="text-center text-xs text-muted">
                {t.tasks.shadow.noStt}
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
          )
        )}
      </div>
    </>
  );
}
