"use client";

/**
 * The placement journey (milestones-in-progression.md): never "what's
 * your level?" — a fast yes/no word probe with pseudoword honesty
 * built in, two optional refinements, then the implementation-
 * intention anchor (gamification #5) instead of notification nagging.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playTap } from "@/lib/audio/sound";
import { savePlan } from "@/app/(tabs)/du/actions";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";

type Step = "intro" | "probe" | "ctest" | "schreiben" | "anker" | "ergebnis";

interface Instrument {
  seed: number;
  vocabProbe: string[];
  ctest: { id: string; display: string; gaps: number }[];
}

interface PlacementResponse {
  placement: { vocabEstimate: number; stage: number };
  seededWords: number;
}

function StepShell({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress: number;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent-bright transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      {children}
    </main>
  );
}

export function PlacementFlow() {
  const t = useStrings();
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wordIndex, setWordIndex] = useState(0);
  const [saidYes, setSaidYes] = useState<boolean[]>([]);
  const [passageIndex, setPassageIndex] = useState(0);
  const [ctestAnswers, setCtestAnswers] = useState<Record<string, string[]>>({});
  const [text, setText] = useState("");
  const [plan, setPlan] = useState("");
  const [result, setResult] = useState<PlacementResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const seed = Math.floor(Math.random() * 100000);
    fetch(`/api/placement?seed=${seed}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setInstrument)
      .catch(() => setError("load"));
  }, []);

  const submit = useCallback(
    async (productions: string[], answers: Record<string, string[]>) => {
      if (!instrument) return;
      setSubmitting(true);
      const hasCtest = Object.values(answers).some((gaps) =>
        gaps.some((gap) => gap.trim().length > 0),
      );
      const response = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: instrument.seed,
          saidYes,
          ctest: hasCtest ? answers : undefined,
          productions: productions.length > 0 ? productions : undefined,
        }),
      });
      setSubmitting(false);
      if (!response.ok) {
        setError("submit");
        return;
      }
      setResult(await response.json());
      setStep("anker");
    },
    [instrument, saidYes],
  );

  if (error) {
    return (
      <StepShell progress={0}>
        <Card className="flex flex-col gap-4">
          <p className="text-sm">
            {error === "load" ? t.placement.loadError : t.placement.submitError}
          </p>
          <Button onClick={() => router.push("/")}>{t.common.back}</Button>
        </Card>
      </StepShell>
    );
  }

  if (step === "intro") {
    return (
      <StepShell progress={0.05}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {t.placement.introTitle}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            {t.placement.introBody}
          </p>
          <Button
            className="py-3.5 text-base"
            disabled={!instrument}
            onClick={() => setStep("probe")}
          >
            {instrument ? t.common.go : t.placement.loading}
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "probe" && instrument) {
    const words = instrument.vocabProbe;
    const word = words[wordIndex];
    const answer = (yes: boolean) => {
      playTap();
      const next = [...saidYes, yes];
      setSaidYes(next);
      if (wordIndex + 1 < words.length) setWordIndex(wordIndex + 1);
      else setStep("ctest");
    };
    return (
      <StepShell progress={0.1 + 0.5 * (wordIndex / words.length)}>
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted">
          {t.placement.knowWord} · {wordIndex + 1}/{words.length}
        </p>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p key={word} className="animate-fade-up font-display text-5xl font-bold tracking-tight">
            {word}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Button variant="answer" className="py-5" onClick={() => answer(false)}>
            {t.placement.no}
          </Button>
          <Button variant="answer" className="py-5" onClick={() => answer(true)}>
            {t.placement.know}
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "ctest" && instrument) {
    const passage = instrument.ctest[passageIndex];
    const parts = passage.display.split(/(_+)/);
    let gapIndex = -1;
    const current = ctestAnswers[passage.id] ?? Array(passage.gaps).fill("");
    const nextPassage = () => {
      if (passageIndex + 1 < instrument.ctest.length) setPassageIndex(passageIndex + 1);
      else setStep("schreiben");
    };
    return (
      <StepShell progress={0.62 + 0.1 * (passageIndex / instrument.ctest.length)}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold">{t.placement.ctestTitle}</h2>
          <p className="text-sm text-muted">{t.placement.ctestHint}</p>
        </div>
        <Card>
          <p className="text-[17px] leading-loose">
            {parts.map((part, i) => {
              if (!/^_+$/.test(part)) return <Fragment key={i}>{part}</Fragment>;
              gapIndex++;
              const index = gapIndex;
              return (
                <input
                  key={i}
                  type="text"
                  maxLength={part.length + 2}
                  value={current[index] ?? ""}
                  autoCapitalize="none"
                  onChange={(event) => {
                    const updated = [...current];
                    updated[index] = event.target.value;
                    setCtestAnswers({ ...ctestAnswers, [passage.id]: updated });
                  }}
                  style={{ width: `${part.length + 1.5}ch` }}
                  className="mx-0.5 inline-block rounded-md border-b-2 border-line bg-background px-1 text-center outline-none focus:border-accent-bright"
                />
              );
            })}
          </p>
        </Card>
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button onClick={nextPassage}>{t.common.continue}</Button>
          <Button variant="quiet" onClick={() => setStep("schreiben")}>
            {t.common.skip}
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "schreiben") {
    const productions = text
      .split(/[.!?\n]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.split(/\s+/).length >= 2);
    return (
      <StepShell progress={0.78}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold">
            {t.placement.writeTitle}
          </h2>
          <p className="text-sm text-muted">{t.placement.writeHint}</p>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder="Ich heiße … Ich wohne in … Ich trinke gern …"
          className="w-full rounded-xl border border-line bg-surface p-4 text-[15px] leading-relaxed outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
        />
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button disabled={submitting} onClick={() => submit(productions, ctestAnswers)}>
            {submitting ? t.placement.evaluating : t.common.done}
          </Button>
          <Button
            variant="quiet"
            disabled={submitting}
            onClick={() => submit([], ctestAnswers)}
          >
            {t.common.skip}
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "anker") {
    return (
      <StepShell progress={0.9}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold">{t.placement.anchorTitle}</h2>
          <p className="text-sm text-muted">{t.placement.anchorHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          {t.placement.planIdeas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setPlan(idea)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                plan === idea
                  ? "border-accent-bright bg-accent/10 font-medium"
                  : "border-line bg-surface hover:border-accent-bright/50"
              }`}
            >
              {idea}
            </button>
          ))}
          <input
            type="text"
            value={t.placement.planIdeas.includes(plan) ? "" : plan}
            onChange={(event) => setPlan(event.target.value)}
            maxLength={140}
            placeholder={t.placement.ownPlanPlaceholder}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent-bright"
          />
        </div>
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button
            onClick={async () => {
              if (plan.trim()) await savePlan(plan);
              setStep("ergebnis");
            }}
          >
            {t.common.continue}
          </Button>
          <Button variant="quiet" onClick={() => setStep("ergebnis")}>
            {t.placement.noAnchor}
          </Button>
        </div>
      </StepShell>
    );
  }

  // ergebnis
  const estimate = result?.placement.vocabEstimate ?? 0;
  return (
    <StepShell progress={1}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          {estimate > 0 ? t.placement.resultSomething : t.placement.resultZero}
        </h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          {estimate > 0
            ? t.placement.resultBodyEstimate(estimate)
            : t.placement.resultBodyZero}
        </p>
      </div>
      <div className="flex flex-col gap-2 pb-4">
        <Button className="py-3.5 text-base" onClick={() => router.push("/session")}>
          {t.placement.firstRound}
        </Button>
        <Button variant="quiet" onClick={() => router.push("/")}>
          {t.placement.later}
        </Button>
      </div>
    </StepShell>
  );
}
