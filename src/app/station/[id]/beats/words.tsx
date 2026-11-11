"use client";

/**
 * Wörter — retrieval taps. The German lemma (nouns without their
 * article first), four English options, then for nouns the article —
 * whose colour arrives only as feedback. The scene line that carried
 * the word is shown afterwards so the word stays anchored in its
 * situation. Grades: right first try 3, right after a miss 2, wrong 1;
 * a wrong article caps at 2. One outcome per word.
 */

import { useState } from "react";
import type { Lexeme } from "@/lib/engine";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import { GenderedNoun } from "@/components/gender";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, Chip, cn, type Gender } from "@/components/ui";
import { distractorsFor, hashSeed, INDEX, outcomeFor, sceneLineFor, seededOrder, type BeatProps, type Grade } from "../lib";
import { BeatHeading, BottomBar, Feedback, GlossLine } from "../parts";

const GENDERS: Gender[] = ["der", "die", "das"];
type Phase = "meaning" | "gender" | "feedback";

export function WordsBeat({ step, lines, submit, finish }: BeatProps) {
  const t = useStrings();
  const lexemes = (step.lexemeIds ?? []).map((id) => INDEX.byId.get(id)).filter((l): l is Lexeme => Boolean(l));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("meaning");
  const [misses, setMisses] = useState<string[]>([]);
  const [meaningGrade, setMeaningGrade] = useState<Grade | null>(null);
  const [genderPick, setGenderPick] = useState<Gender | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [rightCount, setRightCount] = useState(0);

  const lexeme = lexemes[index];
  if (!lexeme) {
    return (
      <BottomBar>
        <Button size="lg" fullWidth onClick={() => finish({ correct: true, detail: "no words" })}>
          {t.station.continue}
        </Button>
      </BottomBar>
    );
  }

  const options = seededOrder([lexeme.english, ...distractorsFor(lexeme)], hashSeed(lexeme.id));
  const isNew = (step.newLexemeIds ?? []).includes(lexeme.id);
  const genderCorrect = !lexeme.gender || genderPick === lexeme.gender;
  const finalGrade: Grade = meaningGrade === null ? 1 : genderCorrect ? meaningGrade : (Math.min(meaningGrade, 2) as Grade);
  const context = phase === "feedback" ? sceneLineFor(lines, lexeme.id) : null;

  const pickMeaning = (english: string) => {
    if (phase !== "meaning" || misses.includes(english)) return;
    if (english === lexeme.english) {
      playCorrect();
      setFlash("correct");
      setMeaningGrade(misses.length === 0 ? 3 : 2);
      setPhase(lexeme.gender ? "gender" : "feedback");
      return;
    }
    playWrong();
    setFlash("wrong");
    const next = [...misses, english];
    setMisses(next);
    if (next.length >= 2) {
      setMeaningGrade(1);
      setPhase(lexeme.gender ? "gender" : "feedback");
    }
  };

  const pickGender = (gender: Gender) => {
    if (phase !== "gender") return;
    setGenderPick(gender);
    if (gender === lexeme.gender) {
      playCorrect();
      setFlash("correct");
    } else {
      playWrong();
      setFlash("wrong");
    }
    setPhase("feedback");
  };

  const next = () => {
    const grade = finalGrade;
    const right = grade >= 3;
    submit(outcomeFor(step, "retrieval-tap", right, { [lexeme.id]: grade }));
    const total = rightCount + (right ? 1 : 0);
    if (right) setRightCount(total);
    if (index + 1 < lexemes.length) {
      playTap();
      setIndex(index + 1);
      setPhase("meaning");
      setMisses([]);
      setMeaningGrade(null);
      setGenderPick(null);
      setFlash(null);
    } else {
      finish({ correct: total >= Math.ceil(lexemes.length / 2), detail: `${total}/${lexemes.length} words` });
    }
  };

  const feedbackText =
    phase === "meaning"
      ? misses.length > 0
        ? t.station.understand.wrong
        : ""
      : phase === "gender"
        ? meaningGrade === 3
          ? t.station.words.right
          : meaningGrade === 2
            ? t.station.words.rightAfterMiss
            : t.station.words.wrong(lexeme.english)
        : lexeme.gender
          ? genderCorrect
            ? t.station.words.articleRight
            : t.station.words.articleWrong(lexeme.gender)
          : meaningGrade === 3
            ? t.station.words.right
            : meaningGrade === 2
              ? t.station.words.rightAfterMiss
              : t.station.words.wrong(lexeme.english);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.words} title={t.station.words.title} note={t.station.words.nOfM(index + 1, lexemes.length)} />

      <Card
        key={lexeme.id}
        className={cn("flex min-h-36 flex-col items-center justify-center gap-2 py-8 text-center animate-fade-up", flash === "correct" && "animate-correct", flash === "wrong" && "animate-wrong")}
      >
        {isNew && (
          <Chip variant="accent" size="sm">
            {t.station.words.newWord}
          </Chip>
        )}
        {phase === "feedback" && lexeme.gender ? (
          <GenderedNoun gender={lexeme.gender} lemma={lexeme.lemma} className="font-display text-display-l animate-pop" />
        ) : (
          <p className="font-display text-display-l text-ink" lang="de">
            {lexeme.lemma}
          </p>
        )}
        <p className={cn("min-h-6 text-body-sm text-ink-muted", phase !== "feedback" && "invisible")} aria-hidden={phase !== "feedback"}>
          {lexeme.english}
        </p>
      </Card>

      {phase === "meaning" && (
        <div className="flex flex-col gap-2" role="group" aria-label={t.station.words.title}>
          {options.map((english) => (
            <Button
              key={english}
              variant="answer"
              disabled={misses.includes(english)}
              className={cn(misses.includes(english) && "border-error text-error line-through")}
              onClick={() => pickMeaning(english)}
            >
              {english}
            </Button>
          ))}
        </div>
      )}

      {phase === "gender" && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-body-sm text-ink-muted">{t.station.words.whichArticle}</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.station.words.whichArticle}>
            {GENDERS.map((gender) => (
              <Button key={gender} variant="answer" className="justify-center" onClick={() => pickGender(gender)}>
                <span lang="de">{gender}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {phase === "feedback" && (
        <div className="flex flex-col gap-2 animate-fade-up">
          {context && (
            <div className="rounded-md border border-hairline bg-surface px-3.5 py-2.5 text-body-sm">
              <span className="mr-1 font-semibold text-ink-muted">{t.station.words.fromScene}</span>
              <GlossLine text={context.de} />
              <p className="mt-0.5 text-caption text-ink-muted">{context.en}</p>
            </div>
          )}
          {finalGrade < 3 && <p className="text-center text-caption text-ink-muted">{t.station.words.comesBack}</p>}
        </div>
      )}

      <BottomBar>
        <Feedback tone={flash === "correct" ? "success" : flash === "wrong" ? "error" : "neutral"}>{feedbackText}</Feedback>
        <Button size="lg" fullWidth disabled={phase !== "feedback"} onClick={next}>
          {t.station.continue}
        </Button>
      </BottomBar>
    </div>
  );
}
