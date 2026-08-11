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

const PLAN_IDEAS = [
  "Nach dem Morgenkaffee mache ich eine Runde.",
  "Wenn ich in der Bahn sitze, mache ich eine Runde.",
  "Nach dem Zähneputzen abends mache ich eine Runde.",
];

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
      .catch(() => setError("Die Einstufung lässt sich gerade nicht laden."));
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
        setError("Das hat nicht geklappt — versuch es gleich noch einmal.");
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
          <p className="text-sm">{error}</p>
          <Button onClick={() => router.push("/")}>Zurück</Button>
        </Card>
      </StepShell>
    );
  }

  if (step === "intro") {
    return (
      <StepShell progress={0.05}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Drei ehrliche Minuten.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Gleich siehst du Wörter — tippe einfach, ob du sie kennst. Sei
            ehrlich: Es gibt keine Punkte, und ein paar Wörter sind erfunden.
            So finden wir genau heraus, wo dein Deutsch heute steht, und fangen
            exakt dort an.
          </p>
          <Button
            className="py-3.5 text-base"
            disabled={!instrument}
            onClick={() => setStep("probe")}
          >
            {instrument ? "Los" : "Lade …"}
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
          Kennst du dieses Wort? · {wordIndex + 1}/{words.length}
        </p>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p key={word} className="animate-fade-up font-display text-5xl font-bold tracking-tight">
            {word}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Button variant="answer" className="py-5" onClick={() => answer(false)}>
            Nein
          </Button>
          <Button variant="answer" className="py-5" onClick={() => answer(true)}>
            Kenne ich
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
          <h2 className="font-display text-2xl font-bold">Lückentext (freiwillig)</h2>
          <p className="text-sm text-muted">
            Ergänze die fehlenden Buchstaben — oder überspring das einfach.
          </p>
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
          <Button onClick={nextPassage}>Weiter</Button>
          <Button variant="quiet" onClick={() => setStep("schreiben")}>
            Überspringen
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
            Schreib 2–3 Sätze über dich
          </h2>
          <p className="text-sm text-muted">
            Auf Deutsch, so gut es eben geht — Fehler sind hier Gold wert. Oder
            überspring auch das.
          </p>
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
            {submitting ? "Werte aus …" : "Fertig"}
          </Button>
          <Button
            variant="quiet"
            disabled={submitting}
            onClick={() => submit([], ctestAnswers)}
          >
            Überspringen
          </Button>
        </div>
      </StepShell>
    );
  }

  if (step === "anker") {
    return (
      <StepShell progress={0.9}>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold">Dein Anker</h2>
          <p className="text-sm text-muted">
            Gewohnheiten halten besser als Erinnerungen: Häng deine tägliche
            Runde an etwas, das du sowieso tust. Wann ist dein Moment?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {PLAN_IDEAS.map((idea) => (
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
            value={PLAN_IDEAS.includes(plan) ? "" : plan}
            onChange={(event) => setPlan(event.target.value)}
            maxLength={140}
            placeholder="… oder dein eigener Plan"
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
            Weiter
          </Button>
          <Button variant="quiet" onClick={() => setStep("ergebnis")}>
            Ohne Anker weiter
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
          {estimate > 0 ? "Du bringst schon etwas mit." : "Wir fangen ganz vorne an."}
        </h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          {estimate > 0
            ? `Dein Startpunkt: ungefähr ${estimate} deutsche Wörter. Ab jetzt misst die App bei jeder Antwort nach — die Einschätzung wird von allein genauer.`
            : "Perfekt — der Anfang ist der Teil, den die App am besten kann. Jede Runde bleibt immer knapp über deinem Können."}
        </p>
      </div>
      <div className="flex flex-col gap-2 pb-4">
        <Button className="py-3.5 text-base" onClick={() => router.push("/session")}>
          Erste Runde starten
        </Button>
        <Button variant="quiet" onClick={() => router.push("/")}>
          Später
        </Button>
      </div>
    </StepShell>
  );
}
