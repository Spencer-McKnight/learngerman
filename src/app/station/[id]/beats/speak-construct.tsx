"use client";

/**
 * Construct-before-reveal, shared by the Sprechen beat (construct and
 * timed recall) and the Leistung beat (say-it, write-it). An English
 * prompt; the learner types or says the German; the target and its
 * alternatives are revealed after. Timed recall shows an honest
 * eight-second ring — running out just reveals. Every production is
 * reported with its grade and the syntax evidence it carries.
 */

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { ConstructItem } from "@/lib/curriculum/types";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import type { PerformanceUtterance } from "@/lib/tutor/coach";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, Field, IconButton, cn } from "@/components/ui";
import { gradeSentence, stageEvidence, type Grade, type SentenceGrade } from "../lib";
import { BottomBar, Feedback, GlossLine, RecordButton, SelfAssess, useRecorder } from "../parts";

export const RECALL_SECONDS = 8;

export interface ProductionResult {
  grade: Grade;
  evidence: ReturnType<typeof stageEvidence>;
  utterance: PerformanceUtterance;
}

export interface ConstructDrillProps {
  items: ConstructItem[];
  /** "both": type or say; "speak": spoken only (self-check without STT); "type": typed only. */
  input: "both" | "speak" | "type";
  timed?: boolean;
  busy?: boolean;
  onItem: (result: ProductionResult) => void;
  onDone: (grades: Grade[], transcript: PerformanceUtterance[]) => void;
}

function TimerRing({ secondsLeft }: { secondsLeft: number }) {
  const t = useStrings();
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - secondsLeft / RECALL_SECONDS);
  return (
    <div className="flex items-center gap-2" role="timer" aria-live="off" aria-label={t.station.speak.secondsLeft(secondsLeft)}>
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={radius} className="fill-none stroke-hairline" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="fill-none stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="font-display text-title tabular text-ink">{secondsLeft}</span>
    </div>
  );
}

export function ConstructDrill({ items, input, timed = false, busy = false, onItem, onDone }: ConstructDrillProps) {
  const t = useStrings();
  const recorder = useRecorder();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<SentenceGrade | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [transcript, setTranscript] = useState<PerformanceUtterance[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(RECALL_SECONDS);
  const checkRef = useRef<(() => void) | null>(null);

  const item = items[index];
  const spokenOnly = input === "speak";
  const canType = input !== "speak";
  const canRecord = recorder.available && input !== "type";

  const settle = (given: string, grade: SentenceGrade) => {
    if (!item) return;
    setChecked(grade);
    if (grade.grade >= 3) playCorrect();
    else playWrong();
    onItem({
      grade: grade.grade,
      evidence: stageEvidence(given),
      utterance: { promptDe: undefined, saidDe: given, expectedDe: item.targetDe },
    });
  };

  const check = () => {
    if (!item || checked) return;
    settle(answer.trim(), gradeSentence(answer, [item.targetDe, ...item.alternatives]));
  };

  useEffect(() => {
    checkRef.current = check;
  });

  // Timed recall: one tick a second, and the deadline reveals whatever is there.
  useEffect(() => {
    if (!timed || checked) return;
    const tick = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const deadline = window.setTimeout(() => checkRef.current?.(), RECALL_SECONDS * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(deadline);
    };
  }, [index, timed, checked]);

  if (!item) return null;

  const record = async () => {
    const result = await recorder.record();
    const said = result.transcript;
    setAnswer(said);
    if (spokenOnly) {
      // Spoken performances are scored straight from the transcript.
      const best = [said, ...result.alternatives].reduce<SentenceGrade | null>((top, candidate) => {
        const grade = gradeSentence(candidate, [item.targetDe, ...item.alternatives]);
        return !top || grade.accuracy > top.accuracy ? grade : top;
      }, null);
      if (best) settle(said, best);
    }
  };

  const next = () => {
    if (!checked) return;
    const all = [...grades, checked.grade];
    const log = [...transcript, { saidDe: answer.trim(), expectedDe: item.targetDe }];
    if (index + 1 < items.length) {
      playTap();
      setGrades(all);
      setTranscript(log);
      setIndex(index + 1);
      setAnswer("");
      setChecked(null);
      setRevealed(false);
      setSecondsLeft(RECALL_SECONDS);
    } else onDone(all, log);
  };

  const feedback = !checked
    ? ""
    : checked.grade >= 3
      ? t.station.speak.exact
      : checked.grade === 2
        ? checked.orderIssue
          ? t.station.speak.orderIssue
          : t.station.speak.almost
        : t.station.speak.lookAgain;

  return (
    <>
      <Card key={index} className={cn("flex flex-col gap-3 animate-fade-up", checked && (checked.grade >= 3 ? "animate-correct" : "animate-wrong"))}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">{t.station.speak.sayInGerman}</p>
          {timed && !checked && <TimerRing secondsLeft={secondsLeft} />}
        </div>
        <p className="text-title font-semibold text-ink">{item.promptEn}</p>

        {!checked && !revealed && canType && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              check();
            }}
            className="flex items-end gap-2"
          >
            <Field
              className="flex-1"
              label={t.station.speak.typeOrSay}
              size="lg"
              lang="de"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder={t.station.speak.placeholder}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
            {canRecord && (
              <IconButton
                label={t.station.speak.micLabel}
                variant="secondary"
                size="lg"
                pressed={recorder.listening}
                disabled={recorder.listening}
                onClick={() => void record()}
              >
                <Mic />
              </IconButton>
            )}
          </form>
        )}

        {spokenOnly && !checked && (
          <p className="min-h-6 text-body-sm italic text-ink-muted" lang="de">
            {recorder.listening ? `„${recorder.interim}“` : answer ? `„${answer}“` : ""}
          </p>
        )}

        {(checked || revealed) && (
          <div className="flex flex-col gap-1 animate-fade-up">
            <p className="text-caption text-ink-muted">{t.station.speak.target}</p>
            <p className="text-title font-semibold">
              <GlossLine text={item.targetDe} />
            </p>
            {item.alternatives.length > 0 && (
              <p className="text-caption text-ink-muted">
                {t.station.speak.alternatives} <span lang="de">{item.alternatives.join(" · ")}</span>
              </p>
            )}
            {answer.trim() && <p className="text-body-sm italic text-ink-muted">{t.station.speak.heard(answer.trim())}</p>}
          </div>
        )}
      </Card>

      <BottomBar>
        <Feedback tone={!checked ? "neutral" : checked.grade >= 3 ? "success" : "error"}>
          {timed && !checked && secondsLeft === 0 ? t.station.speak.timeUp : feedback}
        </Feedback>
        {checked ? (
          <Button size="lg" fullWidth disabled={busy} onClick={next}>
            {t.station.continue}
          </Button>
        ) : spokenOnly ? (
          canRecord ? (
            <RecordButton listening={recorder.listening} onClick={() => void record()} />
          ) : revealed ? (
            <SelfAssess
              disabled={busy}
              onPick={(grade) => settle("", { grade, accuracy: grade >= 3 ? 1 : grade === 2 ? 0.7 : 0, orderIssue: false })}
            />
          ) : (
            <Button size="lg" fullWidth variant="secondary" onClick={() => setRevealed(true)}>
              {t.station.speak.reveal}
            </Button>
          )
        ) : (
          <Button size="lg" fullWidth disabled={!answer.trim()} onClick={check}>
            {t.station.speak.reveal}
          </Button>
        )}
      </BottomBar>
    </>
  );
}
