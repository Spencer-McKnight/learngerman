"use client";

/**
 * Verstehen — the comprehension checks, one at a time. Choice and
 * true/false are answer buttons; "order" is tap-to-order chips. Every
 * check is its own outcome; feedback is instant, spoken by the
 * instrument and explained in one sentence.
 */

import { useState } from "react";
import type { ComprehensionCheck } from "@/lib/curriculum/types";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { Button, Card, Chip, Eyebrow, cn } from "@/components/ui";
import { hashSeed, outcomeFor, seededOrder, type BeatProps } from "../lib";
import { BeatHeading, BottomBar, Feedback } from "../parts";

/** Pieces shuffled per check, never in their correct order by accident. */
function shuffledPieces(check: ComprehensionCheck): number[] {
  const indices = check.options.map((_, i) => i);
  const order = seededOrder(indices, hashSeed(check.id));
  const identity = order.every((v, i) => v === i);
  return identity && order.length > 1 ? [...order.slice(1), order[0]] : order;
}

export function UnderstandBeat({ station, step, submit, finish }: BeatProps) {
  const t = useStrings();
  const lang = useUiLang();
  const checks = station.checks;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);

  const check = checks[index];
  if (!check) {
    return (
      <BottomBar>
        <Button size="lg" fullWidth onClick={() => finish({ correct: true, detail: "no checks" })}>
          {t.station.continue}
        </Button>
      </BottomBar>
    );
  }
  const isOrder = check.kind === "order";
  const pool = isOrder ? shuffledPieces(check) : [];

  const settle = (correct: boolean) => {
    setChecked(correct);
    if (correct) {
      playCorrect();
      setRight((n) => n + 1);
    } else playWrong();
    submit(outcomeFor(step, "understand", correct));
  };

  const pick = (option: number) => {
    if (checked !== null) return;
    setPicked(option);
    settle(option === check.answer);
  };

  const checkOrder = () => {
    if (checked !== null || built.length !== check.options.length) return;
    settle(built.every((v, i) => v === i));
  };

  const next = () => {
    const total = right;
    if (index + 1 < checks.length) {
      playTap();
      setIndex(index + 1);
      setPicked(null);
      setBuilt([]);
      setChecked(null);
    } else {
      finish({ correct: total >= Math.ceil(checks.length / 2), detail: `${total}/${checks.length} checks` });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.understand} title={t.station.understand.title} note={t.station.understand.nOfM(index + 1, checks.length)} />

      <Card
        key={check.id}
        className={cn("flex flex-col gap-2 animate-fade-up", checked === true && "animate-correct", checked === false && "animate-wrong")}
      >
        <p className="text-title font-semibold text-ink" lang={lang === "de" ? "de" : undefined}>
          {lang === "de" ? check.promptDe : check.promptEn}
        </p>
        <p className="text-body-sm text-ink-muted" lang={lang === "de" ? undefined : "de"}>
          {lang === "de" ? check.promptEn : check.promptDe}
        </p>
      </Card>

      {!isOrder ? (
        <div className="flex flex-col gap-2" role="group" aria-label={t.station.understand.title}>
          {check.options.map((option, i) => {
            const state =
              checked === null ? null : i === check.answer ? "right" : i === picked ? "wrong" : null;
            return (
              <Button
                key={option}
                variant="answer"
                disabled={checked !== null && state === null}
                aria-pressed={picked === i}
                className={cn(
                  state === "right" && "border-success text-success",
                  state === "wrong" && "border-error text-error",
                )}
                onClick={() => pick(i)}
              >
                <span lang={check.kind === "true-false" ? "de" : undefined}>{option}</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-ink-muted">{t.station.understand.orderHint}</p>
          <div className="flex flex-col gap-1.5">
            <Eyebrow>{t.station.understand.yourOrder}</Eyebrow>
            <ol className="flex min-h-12 flex-wrap gap-2 rounded-md border border-dashed border-hairline p-2" aria-live="polite">
              {built.map((piece, position) => (
                <li key={piece}>
                  <Chip
                    variant="accent"
                    selected={checked === null ? undefined : piece === position}
                    className={cn(checked === false && piece !== position && "border-error text-error")}
                    onClick={() => {
                      if (checked !== null) return;
                      playTap();
                      setBuilt((list) => list.filter((v) => v !== piece));
                    }}
                  >
                    <span lang="de">{check.options[piece]}</span>
                  </Chip>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-1.5">
            <Eyebrow>{t.station.understand.pieces}</Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {pool.map((piece) => (
                <li key={piece}>
                  <Chip
                    disabled={built.includes(piece) || checked !== null}
                    className={cn(built.includes(piece) && "opacity-40")}
                    onClick={() => {
                      if (checked !== null) return;
                      playTap();
                      setBuilt((list) => (list.includes(piece) ? list : [...list, piece]));
                    }}
                  >
                    <span lang="de">{check.options[piece]}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
          {checked === null && (
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => setBuilt([])}>
                {t.station.understand.reset}
              </Button>
            </div>
          )}
        </div>
      )}

      <BottomBar>
        <Feedback tone={checked === null ? "neutral" : checked ? "success" : "error"}>
          {checked === null ? "" : `${checked ? t.station.understand.correct : t.station.understand.wrong} ${check.explainEn}`}
        </Feedback>
        {checked === null ? (
          isOrder ? (
            <Button size="lg" fullWidth disabled={built.length !== check.options.length} onClick={checkOrder}>
              {t.station.understand.check}
            </Button>
          ) : (
            <Button size="lg" fullWidth disabled>
              {t.station.continue}
            </Button>
          )
        ) : (
          <Button size="lg" fullWidth onClick={next}>
            {t.station.continue}
          </Button>
        )}
      </BottomBar>
    </div>
  );
}
