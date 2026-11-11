"use client";

/**
 * Scripted role-play, shared by the Sprechen beat (the scene's "Du"
 * lines) and the Leistung beat (the performance script). Counterpart
 * lines play in their own voice; the learner speaks every "du" line
 * with its meaning in view and is scored at the word level from the
 * transcript — or rates themselves, clearly labelled, where no
 * recogniser exists. The caller receives the grades and a transcript.
 */

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { SceneLine, Station } from "@/lib/curriculum/types";
import { scoreSpeech, type SpeechScore } from "@/lib/engine";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import type { PerformanceUtterance } from "@/lib/tutor/coach";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, cn } from "@/components/ui";
import { RATE_SLOW, speakerName, voiceFor, type Grade } from "../lib";
import { BottomBar, Feedback, LineWithMeaning, RecordButton, SelfAssess, useRecorder } from "../parts";

export interface ScriptedPlayProps {
  station: Station;
  lines: SceneLine[];
  /** Rendered above the bottom bar's feedback when the stakes are framed (the performance). */
  busy?: boolean;
  onDone: (grades: Grade[], transcript: PerformanceUtterance[]) => void;
}

/** The best score over the recogniser's hypotheses: "Brötchen" may arrive as "Brot chen". */
export function bestSpeechScore(heard: { transcript: string; alternatives: string[] }, target: string): SpeechScore {
  const candidates = [heard.transcript, ...heard.alternatives];
  let best = scoreSpeech(heard.transcript, target);
  for (const candidate of candidates.slice(1)) {
    const score = scoreSpeech(candidate, target);
    if (score.wordAccuracy > best.wordAccuracy) best = score;
  }
  return best;
}

export function ScriptedPlay({ station, lines, busy = false, onDone }: ScriptedPlayProps) {
  const t = useStrings();
  const speech = useSpeech();
  const recorder = useRecorder();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<SpeechScore | null>(null);
  const [heard, setHeard] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [transcript, setTranscript] = useState<PerformanceUtterance[]>([]);
  const speakRef = useRef<((line: SceneLine) => void) | null>(null);

  const line = lines[index];
  const mine = line?.speaker === "du";
  const previous = index > 0 ? lines[index - 1] : undefined;

  useEffect(() => {
    speakRef.current = (l: SceneLine) => void speech.speak(l.de, { voice: voiceFor(station, l.speaker), rate: RATE_SLOW });
  });

  // Counterpart lines read themselves as they arrive (the tap that got us here was the gesture).
  useEffect(() => {
    const current = lines[index];
    if (!current || current.speaker === "du") return;
    const frame = requestAnimationFrame(() => speakRef.current?.(current));
    return () => cancelAnimationFrame(frame);
  }, [index, lines]);

  if (!line) return null;

  const record = async () => {
    speech.stop();
    const result = await recorder.record();
    setHeard(result.transcript);
    const scored = bestSpeechScore(result, line.de);
    setScore(scored);
    if (scored.verdict === "retry") playWrong();
    else playCorrect();
  };

  const advance = (grade?: Grade, said?: string) => {
    speech.stop();
    const nextGrades = grade ? [...grades, grade] : grades;
    const nextTranscript =
      grade && mine
        ? [...transcript, { promptDe: previous?.speaker !== "du" ? previous?.de : undefined, saidDe: said ?? "", expectedDe: line.de }]
        : transcript;
    if (index + 1 < lines.length) {
      playTap();
      setGrades(nextGrades);
      setTranscript(nextTranscript);
      setIndex(index + 1);
      setScore(null);
      setHeard("");
    } else onDone(nextGrades, nextTranscript);
  };

  return (
    <>
      <ol className="flex flex-col gap-3" aria-live="polite">
        {lines.slice(0, index + 1).map((l, i) => {
          const own = l.speaker === "du";
          const active = i === index;
          return (
            <li key={`${i}-${l.de}`} className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
              <span className={cn("px-1 font-display text-caption font-semibold uppercase tracking-[0.14em]", own ? "text-accent" : "text-ink-muted")}>
                {speakerName(station, l.speaker, t.station.scene.you)}
              </span>
              <div
                className={cn(
                  "max-w-[92%] rounded-lg border px-3.5 py-2.5",
                  own ? "rounded-tr-xs border-accent-soft bg-accent-soft" : "rounded-tl-xs border-hairline bg-surface",
                  active && "border-accent shadow-raised",
                )}
              >
                <LineWithMeaning de={l.de} en={l.en} open={active} currentWord={active ? speech.currentWord : null} />
              </div>
            </li>
          );
        })}
      </ol>

      {mine && recorder.listening && recorder.interim && (
        <p className="text-body-sm italic text-ink-muted" lang="de">
          „{recorder.interim}“
        </p>
      )}

      <BottomBar>
        <Feedback tone={!score ? "neutral" : score.verdict === "retry" ? "error" : "success"}>
          {!score
            ? mine
              ? t.station.speak.yourLine
              : t.station.speak.partnerLine(speakerName(station, line.speaker, t.station.scene.you))
            : `${score.verdict === "great" ? t.station.speak.great : score.verdict === "good" ? t.station.speak.good : t.station.speak.retry}${
                score.missedWords.length > 0 ? ` ${t.station.speak.missed(score.missedWords.join(", "))}` : ""
              }`}
        </Feedback>
        {!mine ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              variant="secondary"
              size="lg"
              icon={<Volume2 aria-hidden className="size-5" />}
              onClick={() => speakRef.current?.(line)}
            >
              {t.station.speak.listen}
            </Button>
            <Button size="lg" disabled={busy} onClick={() => advance()}>
              {t.station.continue}
            </Button>
          </div>
        ) : score ? (
          <div className="grid grid-cols-2 gap-2">
            {score.verdict === "retry" ? (
              <Button variant="secondary" size="lg" disabled={recorder.listening} onClick={() => void record()}>
                {t.common.again}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                icon={<Volume2 aria-hidden className="size-5" />}
                onClick={() => speakRef.current?.(line)}
              >
                {t.station.speak.listen}
              </Button>
            )}
            <Button size="lg" disabled={busy} onClick={() => advance(score.grade, heard)}>
              {t.station.continue}
            </Button>
          </div>
        ) : recorder.available ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              variant="secondary"
              size="lg"
              icon={<Volume2 aria-hidden className="size-5" />}
              onClick={() => speakRef.current?.(line)}
            >
              {t.station.speak.listen}
            </Button>
            <RecordButton listening={recorder.listening} onClick={() => void record()} />
          </div>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<Volume2 aria-hidden className="size-4" />}
              onClick={() => speakRef.current?.(line)}
            >
              {t.station.speak.listen}
            </Button>
            <SelfAssess disabled={busy} onPick={(grade) => advance(grade, "")} />
          </>
        )}
      </BottomBar>
    </>
  );
}
