"use client";

/**
 * Typed cloze that rebuilds lines of the scene the learner just read —
 * recall inside a context they already understand, not an isolated
 * drill sentence. Scored with the engine's honest typed-answer grader:
 * umlaut fallbacks are free, one slip is a typo ("zählt trotzdem"),
 * never a failure.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { scoreTyped, usableClozeItems } from "@/lib/engine";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { GenderedNoun } from "@/components/gender";
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

/** The lexeme a cloze item actually grades (trusting forms over ids). */
function resolvedLexemeId(answer: string, claimed: string): string | null {
  const token = answer.trim().toLowerCase().replace(/[^\p{L}'’-]/gu, "");
  const ids = INDEX.byForm.get(token) ?? [];
  if (ids.includes(claimed)) return claimed;
  return ids[0] ?? (INDEX.byId.has(claimed) ? claimed : null);
}

export function ClozeTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { status, episode } = useEpisode();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<ReturnType<typeof scoreTyped> | null>(null);
  const grades = useRef<Record<string, 1 | 2 | 3 | 4>>({});
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);

  const items = useMemo(
    () => (episode ? usableClozeItems(episode, task.lexemeIds ?? [], INDEX) : []),
    [episode, task.lexemeIds],
  );
  const glosses = useMemo(() => glossMapOf(episode), [episode]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  if (status === "loading") return <GeneratingCard />;
  if (status === "failed" || !episode || items.length === 0) return <FailedCard skip={skip} />;

  const item = items[index];
  const lexemeId = resolvedLexemeId(item.answer, item.lexemeId);
  const lexeme = lexemeId ? INDEX.byId.get(lexemeId) : undefined;

  const check = () => {
    if (!answer.trim()) return;
    const score = scoreTyped(answer, item.answer, {
      latencyMs: Date.now() - shownAt.current,
    });
    setChecked(score);
    if (lexemeId) grades.current[lexemeId] = score.grade;
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
        intro={t.tasks.intro.cloze}
        title={t.tasks.cloze.title}
        note={`${t.common.nOfM(index + 1, items.length)} · ${t.tasks.cloze.hintLabel(item.hintEn)}`}
      />
      <Card className="flex flex-col gap-4">
        <p className="text-[17px] leading-relaxed">
          {item.sentence.split("___").map((part, i, parts) => (
            <span key={i}>
              <GlossText text={part} glosses={glosses} />
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
              placeholder={t.tasks.cloze.placeholder}
              className="flex-1 rounded-lg border border-line bg-background px-3 py-2.5 text-[15px] outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
            />
            <Button type="submit">{t.common.check}</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-1.5 animate-fade-up">
            <p className="text-sm font-medium">
              {checked.verdict === "correct" && t.tasks.cloze.correct}
              {checked.verdict === "typo" && t.tasks.cloze.typo}
              {checked.verdict === "wrong" && (
                <>
                  {t.tasks.cloze.itIs} <span className="font-semibold">{item.answer}</span>
                </>
              )}
            </p>
            {lexeme?.gender && (
              <p className="text-sm">
                {t.tasks.cloze.remember}{" "}
                <GenderedNoun gender={lexeme.gender} lemma={lexeme.lemma} />
              </p>
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
