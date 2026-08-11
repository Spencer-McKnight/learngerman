"use client";

/**
 * Typed cloze for the shakiest due words. Scored with the engine's
 * honest typed-answer grader: umlaut fallbacks are free, one slip is
 * a typo ("zählt trotzdem"), never a failure.
 */

import { useEffect, useRef, useState } from "react";
import type { GeneratedCloze } from "@/lib/engine";
import { scoreTyped } from "@/lib/engine";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { GenderedNoun } from "@/components/gender";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  GeneratingCard,
  INDEX,
  TaskHeading,
  useGenerated,
  type TaskProps,
} from "./shared";

export function ClozeTask({ task, submit, finish, skip }: TaskProps) {
  const generated = useGenerated<GeneratedCloze>(task);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<ReturnType<typeof scoreTyped> | null>(null);
  const grades = useRef<Record<string, 1 | 2 | 3 | 4>>({});
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  if (generated.status === "loading") return <GeneratingCard />;
  if (generated.status === "failed" || !generated.content) return <FailedCard skip={skip} />;

  const items = generated.content.items;
  const item = items[index];
  const lexeme = INDEX.byId.get(item.lexemeId);

  const check = () => {
    if (!answer.trim()) return;
    const score = scoreTyped(answer, item.answer, {
      latencyMs: Date.now() - shownAt.current,
    });
    setChecked(score);
    grades.current[item.lexemeId] = score.grade;
    if (score.verdict === "wrong") playWrong();
    else playCorrect();
  };

  const next = async () => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setAnswer("");
      setChecked(null);
    } else {
      setBusy(true);
      const values = Object.values(grades.current);
      const correct = values.filter((grade) => grade >= 2).length >= values.length / 2;
      await submit(baseOutcome(task, correct, { ...grades.current }));
      finish();
    }
  };

  return (
    <>
      <TaskHeading
        title="Tipp das fehlende Wort"
        note={`${index + 1} von ${items.length} · Hinweis: ${item.hintEn}`}
      />
      <Card className="flex flex-col gap-4">
        <p className="text-[17px] leading-relaxed">
          {item.sentence.split("___").map((part, i, parts) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span
                  className={`mx-1 inline-block min-w-16 rounded-md border-b-2 px-1 text-center font-semibold ${
                    checked
                      ? checked.verdict === "wrong"
                        ? "border-error text-error"
                        : "border-success text-success"
                      : "border-accent-bright"
                  }`}
                >
                  {checked ? item.answer : answer || "…"}
                </span>
              )}
            </span>
          ))}
        </p>
        {!checked ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              check();
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              placeholder="Deine Antwort …"
              className="flex-1 rounded-lg border border-line bg-background px-3 py-2.5 text-[15px] outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
            />
            <Button type="submit">Prüfen</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-1.5 animate-fade-up">
            <p className="text-sm font-medium">
              {checked.verdict === "correct" && "Richtig!"}
              {checked.verdict === "typo" && "Kleiner Tippfehler — zählt trotzdem."}
              {checked.verdict === "wrong" && (
                <>
                  Es heißt: <span className="font-semibold">{item.answer}</span>
                </>
              )}
            </p>
            {lexeme?.gender && (
              <p className="text-sm">
                Merk dir:{" "}
                <GenderedNoun gender={lexeme.gender} lemma={lexeme.lemma} />
              </p>
            )}
          </div>
        )}
      </Card>
      {checked && (
        <div className="mt-auto">
          <Button className="w-full" disabled={busy} onClick={next}>
            Weiter
          </Button>
        </div>
      )}
    </>
  );
}
