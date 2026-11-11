"use client";

/**
 * The placement journey (milestones-in-progression.md): never "what's
 * your level?" — a fast yes/no word probe with pseudoword honesty
 * built in, two optional refinements, then the implementation-
 * intention anchor (gamification #5) instead of notification nagging.
 * The result names the station the learner boards first.
 */

import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { playArrive, playTap } from "@/lib/audio/sound";
import { savePlan } from "@/app/(tabs)/du/actions";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { Button, Card, Eyebrow, Field, ProgressBar, StationSign, type LineNumber } from "@/components/ui";

/** What the result step needs to show the starting station — passed from
 *  the server page so the client never bundles the curriculum. */
export interface StartStation {
  id: string;
  name: string;
  title: string;
  titleEn: string;
  canDoEn: string;
  minutes: number;
  order: number;
  line: LineNumber;
}

type Step = "intro" | "probe" | "ctest" | "schreiben" | "anker" | "ergebnis";

/** The four steps the segmented bar counts; intro sits before, the result after. */
const STEPS: readonly Step[] = ["probe", "ctest", "schreiben", "anker"];

interface Instrument {
  seed: number;
  vocabProbe: string[];
  ctest: { id: string; display: string; gaps: number }[];
}

interface PlacementResponse {
  placement: { vocabEstimate: number; stage: number };
  seededWords: number;
  startStationId?: string;
}

function StepShell({
  children,
  step,
  label,
}: {
  children: ReactNode;
  step: Step;
  label: string;
}) {
  const index = STEPS.indexOf(step);
  const current = step === "ergebnis" ? STEPS.length : Math.max(0, index);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter pt-[calc(var(--safe-top)+2rem)] pb-[calc(var(--safe-bottom)+2rem)]">
      <ProgressBar segments={STEPS.length} current={current} label={label} />
      {children}
    </main>
  );
}

export function PlacementFlow({ stations }: { stations: StartStation[] }) {
  const t = useStrings();
  const lang = useUiLang();
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

  const stepLabel = (current: Step) => {
    const index =
      current === "intro" ? 0 : current === "ergebnis" ? STEPS.length - 1 : STEPS.indexOf(current);
    return `${t.placement.stepLabel(index + 1, STEPS.length)} · ${t.placement.steps[index]}`;
  };

  if (error) {
    return (
      <StepShell step="intro" label={stepLabel("intro")}>
        <Card className="flex flex-col gap-4">
          <p className="text-body text-ink">
            {error === "load" ? t.placement.loadError : t.placement.submitError}
          </p>
          <Button onClick={() => router.push("/")}>{t.common.back}</Button>
        </Card>
      </StepShell>
    );
  }

  if (step === "intro") {
    return (
      <StepShell step="intro" label={stepLabel("intro")}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <Eyebrow tone="accent">{t.login.eyebrow}</Eyebrow>
          <h1 className="font-display text-display-xl text-ink">{t.placement.introTitle}</h1>
          <p className="text-body text-ink-muted">{t.placement.introBody}</p>
        </div>
        <div className="pb-4">
          <Button size="lg" fullWidth loading={!instrument} onClick={() => setStep("probe")}>
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
      <StepShell step="probe" label={stepLabel("probe")}>
        <p className="text-center text-caption text-ink-muted">
          {t.placement.knowWord} · <span className="tabular">{t.common.nOfM(wordIndex + 1, words.length)}</span>
        </p>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p key={word} lang="de" className="animate-fade-up break-words text-center font-display text-display-xl text-ink">
            {word}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Button variant="answer" className="min-h-16 justify-center text-center" onClick={() => answer(false)}>
            {t.placement.no}
          </Button>
          <Button variant="answer" className="min-h-16 justify-center text-center" onClick={() => answer(true)}>
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
    const current = ctestAnswers[passage.id] ?? Array<string>(passage.gaps).fill("");
    const nextPassage = () => {
      if (passageIndex + 1 < instrument.ctest.length) setPassageIndex(passageIndex + 1);
      else setStep("schreiben");
    };
    return (
      <StepShell step="ctest" label={stepLabel("ctest")}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-display-m text-ink">{t.placement.ctestTitle}</h2>
          <p className="text-body-sm text-ink-muted">{t.placement.ctestHint}</p>
        </div>
        <Card>
          <p lang="de" className="text-title font-normal leading-loose text-ink">
            {parts.map((part, i) => {
              if (!/^_+$/.test(part)) return <Fragment key={i}>{part}</Fragment>;
              gapIndex++;
              const index = gapIndex;
              return (
                <input
                  key={i}
                  type="text"
                  aria-label={`${t.placement.ctestTitle} ${index + 1}`}
                  maxLength={part.length + 2}
                  value={current[index] ?? ""}
                  autoCapitalize="none"
                  autoComplete="off"
                  onChange={(event) => {
                    const updated = [...current];
                    updated[index] = event.target.value;
                    setCtestAnswers({ ...ctestAnswers, [passage.id]: updated });
                  }}
                  style={{ width: `${part.length + 1.5}ch` }}
                  className="mx-0.5 inline-block rounded-xs border-b-2 border-hairline bg-surface-sunken px-1 text-center text-ink outline-none transition-[border-color] focus:border-accent"
                />
              );
            })}
          </p>
        </Card>
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button size="lg" onClick={nextPassage}>{t.common.continue}</Button>
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
      <StepShell step="schreiben" label={stepLabel("schreiben")}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-display-m text-ink">{t.placement.writeTitle}</h2>
          <p className="text-body-sm text-ink-muted">{t.placement.writeHint}</p>
        </div>
        <Field
          multiline
          label={t.placement.writeTitle}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          lang="de"
          autoCapitalize="sentences"
          placeholder="Ich heiße … Ich wohne in … Ich trinke gern …"
          className="[&>label]:sr-only"
        />
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button size="lg" loading={submitting} onClick={() => submit(productions, ctestAnswers)}>
            {submitting ? t.placement.evaluating : t.common.done}
          </Button>
          <Button variant="quiet" disabled={submitting} onClick={() => submit([], ctestAnswers)}>
            {t.common.skip}
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "anker") {
    const ownPlan = t.placement.planIdeas.includes(plan) ? "" : plan;
    return (
      <StepShell step="anker" label={stepLabel("anker")}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-display-m text-ink">{t.placement.anchorTitle}</h2>
          <p className="text-body-sm text-ink-muted">{t.placement.anchorHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          {t.placement.planIdeas.map((idea) => (
            <Button
              key={idea}
              variant="answer"
              aria-pressed={plan === idea}
              onClick={() => {
                playTap();
                setPlan(idea);
              }}
              className={plan === idea ? "border-accent bg-accent-soft text-accent" : undefined}
            >
              <span className="text-body">{idea}</span>
            </Button>
          ))}
          <Field
            label={t.placement.ownPlanPlaceholder}
            value={ownPlan}
            onChange={(event) => setPlan(event.target.value)}
            maxLength={140}
            placeholder={t.placement.ownPlanPlaceholder}
            autoComplete="off"
            className="[&>label]:sr-only"
          />
        </div>
        <div className="mt-auto flex flex-col gap-2 pb-4">
          <Button
            size="lg"
            onClick={async () => {
              if (plan.trim()) await savePlan(plan);
              playArrive();
              setStep("ergebnis");
            }}
          >
            {t.common.continue}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              playArrive();
              setStep("ergebnis");
            }}
          >
            {t.placement.noAnchor}
          </Button>
        </div>
      </StepShell>
    );
  }

  // ergebnis
  const estimate = result?.placement.vocabEstimate ?? 0;
  const start = result?.startStationId
    ? stations.find((station) => station.id === result.startStationId)
    : undefined;
  const startHref = start ? `/station/${start.id}` : "/";
  return (
    <StepShell step="ergebnis" label={stepLabel("ergebnis")}>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="font-display text-display-l text-ink">
            {estimate > 0 ? t.placement.resultSomething : t.placement.resultZero}
          </h2>
          <p className="mx-auto max-w-sm text-body text-ink-muted">
            {estimate > 0 ? t.placement.resultBodyEstimate(estimate) : t.placement.resultBodyZero}
          </p>
        </div>
        {start && (
          <Card variant="raised" className="flex flex-col gap-3">
            <Eyebrow>{t.placement.startHere}</Eyebrow>
            <StationSign
              name={start.name}
              subtitle={lang === "de" ? start.title : start.titleEn}
              line={start.line}
              status="current"
              index={start.order}
              statusLabel={t.home.status.current}
              arrive
            />
            <p className="text-body-sm text-ink-muted">
              {start.canDoEn} · <span className="tabular">{t.home.minutes(start.minutes)}</span>
            </p>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-2 pb-4">
        <Link href={startHref} className="block rounded-md">
          <Button size="lg" fullWidth tabIndex={-1}>
            {start ? t.placement.board : t.placement.toMap}
          </Button>
        </Link>
        <Button variant="quiet" onClick={() => router.push("/")}>
          {t.placement.later}
        </Button>
      </div>
    </StepShell>
  );
}
