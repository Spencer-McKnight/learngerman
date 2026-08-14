"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Gender, Lexeme } from "@/lib/engine";
import { sceneLineFor } from "@/lib/engine";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { GenderedNoun } from "@/components/gender";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  glossMapOf,
  GlossText,
  INDEX,
  TaskHeading,
  useEpisode,
  type TaskProps,
} from "./shared";

const GENDERS: Gender[] = ["der", "die", "das"];

function distractorsFor(lexeme: Lexeme): string[] {
  const pool = INDEX.ordered.filter(
    (candidate) => candidate.id !== lexeme.id && candidate.pos === lexeme.pos,
  );
  const fallback = INDEX.ordered.filter((candidate) => candidate.id !== lexeme.id);
  const picked: string[] = [];
  for (const source of [pool, fallback]) {
    if (source.length === 0) continue;
    const start = (lexeme.rank * 7) % source.length;
    for (let i = 0; i < source.length && picked.length < 3; i++) {
      const english = source[(start + i) % source.length].english;
      if (english !== lexeme.english && !picked.includes(english)) picked.push(english);
    }
  }
  return picked;
}

export function RetrievalTask({ task, submit, finish, sparkle }: TaskProps) {
  const t = useStrings();
  const { episode } = useEpisode();
  const glosses = useMemo(() => glossMapOf(episode), [episode]);
  const lexemes = useMemo(
    () =>
      (task.lexemeIds ?? [])
        .map((id) => INDEX.byId.get(id))
        .filter((lexeme): lexeme is Lexeme => Boolean(lexeme)),
    [task],
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"meaning" | "gender" | "feedback">("meaning");
  const [meaningPick, setMeaningPick] = useState<string | null>(null);
  const [genderPick, setGenderPick] = useState<Gender | null>(null);
  const [feedbackAnim, setFeedbackAnim] = useState<"correct" | "wrong" | null>(null);
  const grades = useRef<Record<string, 1 | 2 | 3 | 4>>({});
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const lexeme = lexemes[index];
  const options = useMemo(() => {
    if (!lexeme) return [];
    const all = [lexeme.english, ...distractorsFor(lexeme)];
    return all
      .map((english, i) => ({ english, sort: (lexeme.rank * 13 + i * 7) % 17 }))
      .sort((a, b) => a.sort - b.sort)
      .map((option) => option.english);
  }, [lexeme]);

  const fireSparkle = useCallback(
    (e: React.MouseEvent) => {
      if (sparkle) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        sparkle(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    },
    [sparkle],
  );

  if (!lexeme) return null;

  const meaningCorrect = meaningPick === lexeme.english;
  const genderCorrect = !lexeme.gender || genderPick === lexeme.gender;

  const handleMeaning = (english: string, e: React.MouseEvent) => {
    setMeaningPick(english);
    const correct = english === lexeme.english;
    if (correct) {
      playCorrect();
      fireSparkle(e);
      setFeedbackAnim("correct");
    } else {
      playWrong();
      setFeedbackAnim("wrong");
    }
    setPhase(lexeme.gender ? "gender" : "feedback");
  };

  const handleGender = (gender: Gender, e: React.MouseEvent) => {
    setGenderPick(gender);
    const correct = gender === lexeme.gender;
    if (correct) {
      playCorrect();
      fireSparkle(e);
      setFeedbackAnim("correct");
    } else {
      playWrong();
      setFeedbackAnim("wrong");
    }
    setPhase("feedback");
  };

  const next = async () => {
    grades.current[lexeme.id] = meaningCorrect ? (genderCorrect ? 3 : 2) : 1;
    if (index + 1 < lexemes.length) {
      setIndex(index + 1);
      setPhase("meaning");
      setMeaningPick(null);
      setGenderPick(null);
      setFeedbackAnim(null);
    } else {
      setBusy(true);
      const values = Object.values(grades.current);
      const correct = values.filter((grade) => grade >= 3).length >= values.length / 2;
      await submit(baseOutcome(task, correct, { ...grades.current }));
      finish();
    }
  };

  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.retrieval}
        title={t.tasks.retrieval.title}
        note={t.tasks.retrieval.note(index + 1, lexemes.length)}
      />
      <Card
        className={`flex flex-col items-center gap-2 py-8 ${
          feedbackAnim === "correct"
            ? "animate-correct"
            : feedbackAnim === "wrong"
              ? "animate-wrong animate-shake"
              : ""
        }`}
      >
        <div ref={cardRef}>
          {phase === "feedback" && lexeme.gender ? (
            <GenderedNoun
              gender={lexeme.gender}
              lemma={lexeme.lemma}
              className="animate-fade-up font-display text-4xl tracking-tight"
            />
          ) : (
            <p className="font-display text-4xl font-bold tracking-tight">
              {lexeme.lemma}
            </p>
          )}
        </div>
        {phase === "feedback" && (
          <p className="animate-fade-up text-sm text-muted">{lexeme.english}</p>
        )}
      </Card>

      {phase === "meaning" && (
        <div className="grid grid-cols-1 gap-2">
          {options.map((english) => (
            <Button
              key={english}
              variant="answer"
              className="py-3.5"
              onClick={(e) => handleMeaning(english, e)}
            >
              {english}
            </Button>
          ))}
        </div>
      )}

      {phase === "gender" && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-muted">
            {meaningCorrect
              ? t.tasks.retrieval.rightPrefix
              : t.tasks.retrieval.wrongPrefix(lexeme.english)}
            {t.tasks.retrieval.whichArticle}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {GENDERS.map((gender) => (
              <Button
                key={gender}
                variant="answer"
                className="py-3.5"
                onClick={(e) => handleGender(gender, e)}
              >
                {gender}
              </Button>
            ))}
          </div>
        </div>
      )}

      {phase === "feedback" && (
        <div className="mt-auto flex flex-col gap-2 animate-fade-up">
          {(() => {
            const context = episode ? sceneLineFor(episode, lexeme.id, INDEX) : null;
            return (
              context && (
                <div className="rounded-lg border border-line bg-background/60 px-3 py-2 text-sm">
                  <span className="mr-1 font-medium text-muted">{t.tasks.fromScene}</span>
                  <GlossText text={context.de} glosses={glosses} />
                </div>
              )
            );
          })()}
          {!(meaningCorrect && genderCorrect) && (
            <p className="text-center text-sm text-muted">
              {t.tasks.retrieval.comesBack}
            </p>
          )}
          <Button disabled={busy} onClick={next}>
            {t.common.continue}
          </Button>
        </div>
      )}
    </>
  );
}
