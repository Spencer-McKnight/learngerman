"use client";

/**
 * Retrieval taps: fast form→meaning mapping for today's new words,
 * and for nouns an article retrieval right after — gender colour
 * arrives only as feedback, never as a pre-highlighted answer.
 */

import { useMemo, useRef, useState } from "react";
import type { Gender, Lexeme } from "@/lib/engine";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { GenderedNoun } from "@/components/gender";
import { Button, Card } from "@/components/ui";
import { baseOutcome, INDEX, TaskHeading, type TaskProps } from "./shared";

const GENDERS: Gender[] = ["der", "die", "das"];

function distractorsFor(lexeme: Lexeme): string[] {
  // Same-POS distractors first, topped up from the whole lexicon when
  // the pool is small (e.g. particles). Bounded scans — a stride that
  // shares a factor with the pool size must never spin forever.
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

export function RetrievalTask({ task, submit, finish }: TaskProps) {
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
  const grades = useRef<Record<string, 1 | 2 | 3 | 4>>({});
  const [busy, setBusy] = useState(false);

  const lexeme = lexemes[index];
  const options = useMemo(() => {
    if (!lexeme) return [];
    const all = [lexeme.english, ...distractorsFor(lexeme)];
    // Deterministic shuffle by rank so options don't jump on re-render.
    return all
      .map((english, i) => ({ english, sort: (lexeme.rank * 13 + i * 7) % 17 }))
      .sort((a, b) => a.sort - b.sort)
      .map((option) => option.english);
  }, [lexeme]);

  if (!lexeme) return null;

  const meaningCorrect = meaningPick === lexeme.english;
  const genderCorrect = !lexeme.gender || genderPick === lexeme.gender;

  const next = async () => {
    grades.current[lexeme.id] = meaningCorrect ? (genderCorrect ? 3 : 2) : 1;
    if (index + 1 < lexemes.length) {
      setIndex(index + 1);
      setPhase("meaning");
      setMeaningPick(null);
      setGenderPick(null);
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
        title="Was heißt das?"
        note={`Neues Wort ${index + 1} von ${lexemes.length}`}
      />
      <Card className="flex flex-col items-center gap-2 py-8">
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
              onClick={() => {
                setMeaningPick(english);
                if (english === lexeme.english) playCorrect();
                else playWrong();
                setPhase(lexeme.gender ? "gender" : "feedback");
              }}
            >
              {english}
            </Button>
          ))}
        </div>
      )}

      {phase === "gender" && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-muted">
            {meaningCorrect ? "Genau — " : `Es heißt „${lexeme.english}“ — `}
            und welcher Artikel?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {GENDERS.map((gender) => (
              <Button
                key={gender}
                variant="answer"
                className="py-3.5"
                onClick={() => {
                  setGenderPick(gender);
                  if (gender === lexeme.gender) playCorrect();
                  else playWrong();
                  setPhase("feedback");
                }}
              >
                {gender}
              </Button>
            ))}
          </div>
        </div>
      )}

      {phase === "feedback" && (
        <div className="mt-auto flex flex-col gap-2">
          {!(meaningCorrect && genderCorrect) && (
            <p className="text-center text-sm text-muted">
              Kommt wieder — genau dafür ist die Wiederholung da.
            </p>
          )}
          <Button disabled={busy} onClick={next}>
            Weiter
          </Button>
        </div>
      )}
    </>
  );
}
