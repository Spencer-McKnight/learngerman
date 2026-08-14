"use client";

/**
 * HVPT minimal pairs: "which word did you hear?" across rotated
 * voices. Every answer is its own outcome — that's how the engine's
 * per-contrast mastery window works.
 */

import { useEffect, useMemo, useState } from "react";
import { buildEarDrill, CONTRASTS } from "@/lib/engine";
import { speakGerman } from "@/lib/audio/tts";
import { playCorrect, playWrong } from "@/lib/audio/sound";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import { baseOutcome, TaskHeading, type TaskProps } from "./shared";

/** Session-level seed so drills vary between visits (module scope —
 *  render itself stays pure). */
const DRILL_SEED = Date.now() % 100000;

export function HvptTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const contrast = CONTRASTS.find((candidate) => candidate.id === task.contrastId);
  const count = Math.max(4, Math.round(task.seconds / 10));
  const drill = useMemo(
    () => (contrast ? buildEarDrill(contrast, count, DRILL_SEED) : []),
    [contrast, count],
  );
  const [index, setIndex] = useState(0);
  const [played, setPlayed] = useState(false);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [right, setRight] = useState(0);

  const missing = !contrast || drill.length === 0;
  useEffect(() => {
    if (missing) skip();
  }, [missing, skip]);
  if (missing) return null;

  const item = drill[index];
  const heardWord = item.play === "a" ? item.pair.a : item.pair.b;

  const play = () => {
    setPlayed(true);
    void speakGerman(heardWord, { voiceIndex: index });
  };

  const answer = async (choice: "a" | "b") => {
    if (!played || picked) return;
    setPicked(choice);
    const correct = choice === item.play;
    if (correct) {
      playCorrect();
      setRight(right + 1);
    } else {
      playWrong();
    }
    // One outcome per identification — feeds the mastery window.
    void submit({ ...baseOutcome(task, correct), earContrastId: contrast.id });
    setTimeout(() => {
      if (index + 1 < drill.length) {
        setIndex(index + 1);
        setPlayed(false);
        setPicked(null);
      } else {
        finish();
      }
    }, 700);
  };

  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.hvpt}
        title={t.tasks.hvpt.title(contrast.label)}
        note={`${contrast.description} · ${t.common.nOfM(index + 1, drill.length)}`}
      />
      <Card className="flex flex-col items-center gap-5 py-10">
        <Button variant="outline" className="px-8 py-4 text-base" onClick={play}>
          {played ? t.tasks.hvpt.playAgain : t.tasks.hvpt.play}
        </Button>
        <p className="text-xs text-muted">{t.tasks.hvpt.whichWord}</p>
      </Card>
      <div className="mt-auto grid grid-cols-2 gap-3">
        {(["a", "b"] as const).map((side) => {
          const word = side === "a" ? item.pair.a : item.pair.b;
          const state =
            picked === null
              ? ""
              : side === item.play
                ? "!border-success !text-success"
                : picked === side
                  ? "!border-error !text-error"
                  : "";
          return (
            <Button
              key={side}
              variant="answer"
              disabled={!played}
              className={`py-5 text-xl ${state}`}
              onClick={() => void answer(side)}
            >
              {word}
            </Button>
          );
        })}
      </div>
    </>
  );
}
