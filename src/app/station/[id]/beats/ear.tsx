"use client";

/**
 * Ohr — HVPT minimal pairs across real voices: the drill's voice per
 * item goes straight to speak(), two big answer buttons, one outcome
 * per pair carrying the contrast id (that is how the engine's mastery
 * window works). The drill's seed is the session, so render stays pure.
 */

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { buildEarDrill, CONTRASTS } from "@/lib/engine";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { preload } from "@/lib/audio/tts";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, cn } from "@/components/ui";
import { hashSeed, outcomeFor, type BeatProps } from "../lib";
import { BeatHeading, BottomBar, Feedback } from "../parts";

const NEXT_DELAY_MS = 700;

export function EarBeat({ step, sessionId, submit, finish }: BeatProps) {
  const t = useStrings();
  const speech = useSpeech();
  const contrast = CONTRASTS.find((c) => c.id === step.contrastId) ?? null;
  const count = Math.max(4, step.pairCount ?? 6);
  const [drill] = useState(() => (contrast ? buildEarDrill(contrast, count, hashSeed(sessionId + step.contrastId)) : []));
  const [index, setIndex] = useState(0);
  const [played, setPlayed] = useState(false);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [right, setRight] = useState(0);
  const playRef = useRef<(() => void) | null>(null);
  const timerRef = useRef(0);

  const item = drill[index];
  const heardWord = item ? (item.play === "a" ? item.pair.a : item.pair.b) : "";

  useEffect(() => {
    playRef.current = () => {
      if (!item) return;
      setPlayed(true);
      void speech.speak(heardWord, { voice: item.voice });
      const next = drill[index + 1];
      if (next) void preload(next.play === "a" ? next.pair.a : next.pair.b, next.voice);
    };
  });

  // Each pair plays itself; the gesture that opened the beat allows it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => playRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [index]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (!contrast || !item) {
    return (
      <BottomBar>
        <Button size="lg" fullWidth onClick={() => finish({ correct: true, detail: "no contrast" })}>
          {t.station.continue}
        </Button>
      </BottomBar>
    );
  }

  const answer = (choice: "a" | "b") => {
    if (!played || picked) return;
    setPicked(choice);
    const correct = choice === item.play;
    const total = right + (correct ? 1 : 0);
    if (correct) {
      playCorrect();
      setRight(total);
    } else playWrong();
    submit(outcomeFor(step, "hvpt-pair", correct, {}, { earContrastId: contrast.id }));
    timerRef.current = window.setTimeout(() => {
      if (index + 1 < drill.length) {
        setIndex(index + 1);
        setPlayed(false);
        setPicked(null);
      } else {
        finish({ correct: total >= Math.ceil(drill.length * 0.75), detail: `${total}/${drill.length} pairs` });
      }
    }, NEXT_DELAY_MS);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.ear} title={t.station.ear.title(contrast.label)} note={`${contrast.description} · ${t.station.ear.nOfM(index + 1, drill.length)}`} />
      <Card className="flex flex-col items-center gap-4 py-10">
        <Button variant="secondary" size="lg" icon={<Volume2 aria-hidden className="size-5" />} onClick={() => playRef.current?.()}>
          {played ? t.station.ear.playAgain : t.station.ear.play}
        </Button>
        <p className="text-caption text-ink-muted">{t.station.ear.whichWord}</p>
      </Card>
      <BottomBar>
        <Feedback tone={picked === null ? "neutral" : picked === item.play ? "success" : "error"}>
          {picked === null ? "" : picked === item.play ? t.station.understand.correct : t.station.understand.wrong} {t.station.ear.score(right, drill.length)}
        </Feedback>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label={t.station.ear.whichWord}>
          {(["a", "b"] as const).map((side) => {
            const word = side === "a" ? item.pair.a : item.pair.b;
            const state = picked === null ? null : side === item.play ? "right" : picked === side ? "wrong" : null;
            return (
              <Button
                key={side}
                variant="answer"
                size="lg"
                disabled={!played || picked !== null}
                className={cn("min-h-16 justify-center text-display-m", state === "right" && "border-success text-success", state === "wrong" && "border-error text-error")}
                onClick={() => answer(side)}
              >
                <span lang="de">{word}</span>
              </Button>
            );
          })}
        </div>
      </BottomBar>
    </div>
  );
}
