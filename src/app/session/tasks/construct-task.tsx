"use client";

/**
 * Construct-before-reveal (and its timed-recall sibling): the learner
 * continues the scene themselves — each English prompt is the natural
 * next thing to say in the episode. Productions feed the syntax
 * staircase; the timer is mild pressure, not a heart to lose.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StageObservation } from "@/lib/engine";
import { analyzeProduction, scoreSentence } from "@/lib/engine";
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
  INDEX,
  TaskHeading,
  useEpisode,
  type TaskProps,
} from "./shared";

const RECALL_SECONDS = 25;

interface ItemResult {
  grade: 1 | 2 | 3 | 4;
  observations: StageObservation[];
}

export function ConstructTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { status, episode } = useEpisode();
  const timed = task.kind === "timed-recall";
  const canSpeak = useMemo(() => sttAvailable(), []);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [checked, setChecked] = useState<{
    grade: 1 | 2 | 3 | 4;
    orderIssue: boolean;
  } | null>(null);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(RECALL_SECONDS);
  const [busy, setBusy] = useState(false);
  const answerRef = useRef("");
  const checkedRef = useRef(false);

  const items = episode?.construct;
  const glosses = useMemo(() => glossMapOf(episode ?? null), [episode]);

  const check = useCallback(
    (given: string) => {
      if (!items || checkedRef.current) return;
      checkedRef.current = true;
      const item = items[index];
      const targets = [item.targetDe, ...item.alternatives];
      let best = { accuracy: 0, orderCorrect: false };
      for (const target of targets) {
        const score = scoreSentence(given, target);
        if (score.accuracy > best.accuracy) best = score;
      }
      const grade: 1 | 2 | 3 | 4 =
        best.accuracy >= 0.85 && best.orderCorrect ? 3 : best.accuracy >= 0.6 ? 2 : 1;
      if (grade >= 3) playCorrect();
      else playWrong();
      setChecked({ grade, orderIssue: best.accuracy >= 0.6 && !best.orderCorrect });
      setResults((all) => [
        ...all,
        { grade, observations: analyzeProduction(given, INDEX) },
      ]);
    },
    [items, index],
  );

  // Mild time pressure for timed recall — running out just reveals.
  useEffect(() => {
    if (!timed || !items) return;
    const tick = setInterval(
      () => setSecondsLeft((left) => Math.max(0, left - 1)),
      1000,
    );
    const expiry = setTimeout(() => check(answerRef.current), RECALL_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(expiry);
    };
  }, [index, timed, items, check]);

  if (status === "loading") return <GeneratingCard />;
  if (status === "failed" || !items || items.length === 0) return <FailedCard skip={skip} />;

  const item = items[index];

  const updateAnswer = (value: string) => {
    answerRef.current = value;
    setAnswer(value);
  };

  const record = async () => {
    setListening(true);
    const recognizer = recognizeGerman(updateAnswer);
    const heard = await recognizer.result;
    setListening(false);
    if (heard) updateAnswer(heard);
  };

  const next = async () => {
    if (index + 1 < items.length) {
      checkedRef.current = false;
      setIndex(index + 1);
      updateAnswer("");
      setChecked(null);
      setSecondsLeft(RECALL_SECONDS);
    } else {
      setBusy(true);
      const grades = results.map((result) => result.grade);
      const mean = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
      const observations = results.flatMap((result) => result.observations);
      const maxStage = observations.reduce(
        (top, observation) => Math.max(top, observation.stage),
        0,
      );
      const targets = task.lexemeIds ?? [];
      const rounded = Math.round(mean) as 1 | 2 | 3 | 4;
      await submit({
        ...baseOutcome(
          task,
          mean >= 2.5,
          Object.fromEntries(targets.map((id) => [id, rounded])) as Record<
            string,
            1 | 2 | 3 | 4
          >,
        ),
        ...(maxStage > 0
          ? {
              stageAttempted: maxStage as 1 | 2 | 3 | 4 | 5,
              stageSuccess: observations.some(
                (observation) => observation.stage === maxStage && observation.success,
              ),
            }
          : {}),
      });
      finish();
    }
  };

  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.construct}
        title={timed ? t.tasks.construct.titleTimed : t.tasks.construct.titleBuild}
        note={t.tasks.construct.note(index + 1, items.length)}
      />
      {timed && !checked && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent-bright transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / RECALL_SECONDS) * 100}%` }}
          />
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t.tasks.construct.sayInGerman}</p>
        <p className="text-[18px] font-medium leading-relaxed">{item.promptEn}</p>
        {!checked ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              check(answer);
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={answer}
                onChange={(event) => updateAnswer(event.target.value)}
                autoCapitalize="sentences"
                autoComplete="off"
                spellCheck={false}
                placeholder={t.common.inGermanPlaceholder}
                className="flex-1 rounded-lg border border-line bg-background px-3 py-2.5 text-[15px] outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
              />
              {canSpeak && (
                <Button type="button" variant="outline" onClick={record} disabled={listening}>
                  {listening ? "●" : "🎙"}
                </Button>
              )}
            </div>
            <Button type="submit" disabled={!answer.trim()}>
              {t.tasks.construct.reveal}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-1.5 animate-fade-up">
            <p className="text-[17px] font-semibold">
              <GlossText text={item.targetDe} glosses={glosses} />
            </p>
            <p className="text-sm text-muted">
              {checked.grade >= 3 && t.tasks.construct.exact}
              {checked.grade === 2 &&
                (checked.orderIssue
                  ? t.tasks.construct.orderIssue
                  : t.tasks.construct.almost)}
              {checked.grade === 1 && t.tasks.construct.lookAgain}
            </p>
            {answer.trim() && (
              <p className="text-sm italic text-muted">{t.tasks.construct.you(answer.trim())}</p>
            )}
          </div>
        )}
      </Card>
      {checked && (
        <div className="mt-auto">
          <Button className="w-full" disabled={busy} onClick={next}>
            {t.common.continue}
          </Button>
        </div>
      )}
    </>
  );
}
