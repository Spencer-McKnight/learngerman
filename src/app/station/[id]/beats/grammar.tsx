"use client";

/**
 * Baustein — one screen of grammar, then a short drill. The drill
 * prefers the station's own construct items at the bite's stage; when
 * none fit, it offers "which sentence is right?" pairs built from the
 * bite's own example sentences (the verb moved out of second position
 * is the wrong one). If no honest drill exists, the bite stands alone
 * with one "Got it". One outcome, carrying the bite id.
 */

import { useState } from "react";
import { CURRICULUM, splitSentences, tokenize, type SyntaxStage } from "@/lib/engine";
import type { ConstructItem } from "@/lib/curriculum/types";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { Button, Card, Eyebrow, Field, cn } from "@/components/ui";
import { gradeSentence, hashSeed, INDEX, outcomeFor, seededOrder, stageEvidence, type BeatProps, type Grade } from "../lib";
import { BeatHeading, BottomBar, Feedback, GlossLine } from "../parts";

type DrillItem = { kind: "construct"; item: ConstructItem } | { kind: "pair"; right: string; wrong: string };

function isVerb(token: string): boolean {
  const ids = INDEX.byForm.get(token);
  return Boolean(ids?.some((id) => INDEX.byId.get(id)?.pos === "V"));
}

/** Example sentences of the summary where the verb sits in position two, turned into right/wrong pairs. */
function pairsFromSummary(summary: string, targetStage: SyntaxStage): DrillItem[] {
  if (targetStage < 2) return [];
  const pairs: DrillItem[] = [];
  for (const sentence of splitSentences(summary)) {
    const clean = sentence.replace(/[()"]/g, "").trim();
    const words = clean.split(/\s+/);
    const tokens = tokenize(clean);
    if (words.length < 3 || words.length > 7 || tokens.length !== words.length) continue;
    const known = tokens.filter((token) => INDEX.byForm.has(token)).length;
    if (known / tokens.length < 0.8 || !isVerb(tokens[1])) continue;
    const [first, verb, ...rest] = words;
    const wrong = [first, ...rest, verb].join(" ").replace(/[.!?]$/, "") + ".";
    pairs.push({ kind: "pair", right: clean.replace(/[.!?]$/, "") + ".", wrong });
    if (pairs.length >= 3) break;
  }
  return pairs;
}

function buildDrill(constructs: ConstructItem[], summary: string, targetStage: SyntaxStage): DrillItem[] {
  if (constructs.length > 0) {
    return [...constructs]
      .sort((a, b) => Math.abs(a.stage - targetStage) - Math.abs(b.stage - targetStage))
      .slice(0, 3)
      .map((item) => ({ kind: "construct", item }));
  }
  return pairsFromSummary(summary, targetStage);
}

export function GrammarBeat({ station, step, submit, finish }: BeatProps) {
  const t = useStrings();
  const lang = useUiLang();
  const bite = CURRICULUM.find((b) => b.id === step.biteId) ?? null;
  const targetStage = Math.min(5, (bite?.stageRequired ?? 0) + 1) as SyntaxStage;
  const drill = bite ? buildDrill(station.construct, bite.summary, targetStage) : [];
  const [phase, setPhase] = useState<"bite" | "drill">("bite");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ grade: Grade; orderIssue: boolean } | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [evidence, setEvidence] = useState<ReturnType<typeof stageEvidence>>({});

  if (!bite) {
    return (
      <BottomBar>
        <Button size="lg" fullWidth onClick={() => finish({ correct: true, detail: "no bite" })}>
          {t.station.continue}
        </Button>
      </BottomBar>
    );
  }

  const item = drill[index];
  const title = lang === "de" ? bite.titleDe : bite.title;
  const subtitle = lang === "de" ? bite.title : bite.titleDe;

  const complete = (all: Grade[]) => {
    const mean = all.length === 0 ? 3 : all.reduce((s, g) => s + g, 0) / all.length;
    const correct = mean >= 2.5;
    submit(outcomeFor(step, "grammar-drill", correct, {}, { biteId: bite.id, ...evidence }));
    finish({ correct, detail: all.length > 0 ? `${all.filter((g) => g >= 3).length}/${all.length} drill` : "bite read" });
  };

  const checkConstruct = () => {
    if (item?.kind !== "construct" || checked || !answer.trim()) return;
    const result = gradeSentence(answer, [item.item.targetDe, ...item.item.alternatives]);
    const produced = stageEvidence(answer);
    if (produced.stageAttempted !== undefined && (evidence.stageAttempted === undefined || produced.stageAttempted >= evidence.stageAttempted)) {
      setEvidence(produced);
    }
    if (result.grade >= 3) playCorrect();
    else playWrong();
    setChecked({ grade: result.grade, orderIssue: result.orderIssue });
  };

  const pickPair = (choice: string) => {
    if (item?.kind !== "pair" || checked) return;
    setPicked(choice);
    const right = choice === item.right;
    if (right) playCorrect();
    else playWrong();
    setChecked({ grade: right ? 3 : 1, orderIssue: !right });
  };

  const next = () => {
    if (!checked) return;
    const all = [...grades, checked.grade];
    if (index + 1 < drill.length) {
      playTap();
      setGrades(all);
      setIndex(index + 1);
      setAnswer("");
      setPicked(null);
      setChecked(null);
    } else complete(all);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.grammar} title={<span lang={lang === "de" ? "de" : undefined}>{title}</span>} note={subtitle} />

      {phase === "bite" ? (
        <>
          <Card className="flex flex-col gap-4">
            <p className="text-body text-ink">{bite.summary}</p>
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-body-sm text-ink-muted">{bite.drillFocus}</p>
          </Card>
          <BottomBar>
            <Button
              size="lg"
              fullWidth
              onClick={() => {
                playTap();
                if (drill.length > 0) setPhase("drill");
                else complete([]);
              }}
            >
              {drill.length > 0 ? t.station.grammar.drill : t.station.grammar.gotIt}
            </Button>
          </BottomBar>
        </>
      ) : item ? (
        <>
          <Eyebrow>{`${t.station.grammar.drill} · ${t.station.grammar.nOfM(index + 1, drill.length)}`}</Eyebrow>
          {item.kind === "construct" ? (
            <Card key={index} className={cn("flex flex-col gap-3 animate-fade-up", checked && (checked.grade >= 3 ? "animate-correct" : "animate-wrong"))}>
              <p className="text-body-sm text-ink-muted">{t.station.grammar.sayInGerman}</p>
              <p className="text-title font-semibold text-ink">{item.item.promptEn}</p>
              {!checked ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    checkConstruct();
                  }}
                  className="flex flex-col gap-2"
                >
                  <Field
                    label={t.station.grammar.sayInGerman}
                    size="lg"
                    lang="de"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    placeholder={t.station.grammar.placeholder}
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                  />
                </form>
              ) : (
                <div className="flex flex-col gap-1 animate-fade-up">
                  <p className="text-title font-semibold">
                    <GlossLine text={item.item.targetDe} />
                  </p>
                  {item.item.alternatives.length > 0 && (
                    <p className="text-caption text-ink-muted">
                      {t.station.speak.alternatives} <span lang="de">{item.item.alternatives.join(" · ")}</span>
                    </p>
                  )}
                  <p className="text-body-sm italic text-ink-muted">{t.station.grammar.yourAnswer(answer.trim())}</p>
                </div>
              )}
            </Card>
          ) : (
            <div key={index} className="flex flex-col gap-2 animate-fade-up">
              <p className="text-body-sm text-ink-muted">{t.station.grammar.whichIsRight}</p>
              {seededOrder([item.right, item.wrong], hashSeed(item.right)).map((option) => {
                const state = !checked ? null : option === item.right ? "right" : option === picked ? "wrong" : null;
                return (
                  <Button
                    key={option}
                    variant="answer"
                    disabled={Boolean(checked) && state === null}
                    className={cn(state === "right" && "border-success text-success", state === "wrong" && "border-error text-error")}
                    onClick={() => pickPair(option)}
                  >
                    <span lang="de">{option}</span>
                  </Button>
                );
              })}
            </div>
          )}
          <BottomBar>
            <Feedback tone={!checked ? "neutral" : checked.grade >= 3 ? "success" : "error"}>
              {!checked
                ? ""
                : item.kind === "pair"
                  ? checked.grade >= 3
                    ? t.station.grammar.exact
                    : t.station.grammar.wrongPick
                  : checked.grade >= 3
                    ? t.station.grammar.exact
                    : checked.grade === 2
                      ? t.station.grammar.almost
                      : t.station.grammar.lookAgain}
            </Feedback>
            {!checked && item.kind === "construct" ? (
              <Button size="lg" fullWidth disabled={!answer.trim()} onClick={checkConstruct}>
                {t.station.grammar.check}
              </Button>
            ) : (
              <Button size="lg" fullWidth disabled={!checked} onClick={next}>
                {t.station.continue}
              </Button>
            )}
          </BottomBar>
        </>
      ) : null}
    </div>
  );
}
