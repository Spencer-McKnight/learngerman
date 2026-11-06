"use client";

/**
 * Szene — the scene as a chat-like script. Every line is read by its
 * own character's voice in sequence with the karaoke highlight; any
 * word is a tap away from its gloss; the translation sits under each
 * line, revealed on tap into space that is already reserved. Slow
 * first, then street speed. One outcome on completion: the scene's
 * due words are credited, the new ones meet the learner for the first time.
 */

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { playTap } from "@/lib/audio/sound";
import { preload } from "@/lib/audio/tts";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, Chip, Eyebrow, IconButton, Segmented, Spinner, cn } from "@/components/ui";
import { gradesFor, outcomeFor, RATE_SLOW, RATE_STREET, speakerName, voiceFor, type BeatProps } from "../lib";
import { BeatHeading, BottomBar, LineWithMeaning } from "../parts";

type Speed = "slow" | "street";

/** A speak() that resolves this fast never played anything (autoplay refused). */
const BLOCKED_MS = 250;

export function SceneBeat({ station, step, lines, scene, autoplay, submit, finish }: BeatProps) {
  const t = useStrings();
  const speech = useSpeech();
  const [speed, setSpeed] = useState<Speed>("slow");
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [heardAll, setHeardAll] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const runRef = useRef(0);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const ready = scene.status === "ready";

  const rateOf = (value: Speed) => (value === "street" ? RATE_STREET : RATE_SLOW);

  const playFrom = async (start: number, value: Speed) => {
    const run = ++runRef.current;
    const rate = rateOf(value);
    setPlaying(true);
    setBlocked(false);
    for (let i = start; i < lines.length; i++) {
      if (run !== runRef.current) return;
      setCurrent(i);
      const next = lines[i + 1];
      if (next) void preload(next.de, voiceFor(station, next.speaker), rate);
      const began = performance.now();
      await speech.speak(lines[i].de, { voice: voiceFor(station, lines[i].speaker), rate });
      if (run !== runRef.current) return;
      if (i === start && performance.now() - began < BLOCKED_MS) {
        setBlocked(true);
        setPlaying(false);
        return;
      }
    }
    setPlaying(false);
    setHeardAll(true);
  };

  const pause = () => {
    runRef.current++;
    speech.stop();
    setPlaying(false);
  };

  const togglePlay = () => {
    playTap();
    if (playing) pause();
    else void playFrom(Math.max(0, heardAll ? 0 : current), speed);
  };

  const changeSpeed = (value: Speed) => {
    setSpeed(value);
    if (playing) void playFrom(Math.max(0, current), value);
  };

  // The latest playFrom, reachable from the autoplay effect without re-running it.
  const playFromRef = useRef<typeof playFrom | null>(null);
  useEffect(() => {
    playFromRef.current = playFrom;
  });

  // A gesture on the previous beat lets the voices start on their own.
  useEffect(() => {
    if (!autoplay || !ready || startedRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      void playFromRef.current?.(0, "slow");
    });
    return () => cancelAnimationFrame(frame);
  }, [autoplay, ready]);

  // Follow the voice down the script.
  useEffect(() => {
    if (current < 0) return;
    const el = document.getElementById(`scene-line-${current}`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [current]);

  const complete = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    pause();
    submit(
      outcomeFor(
        step,
        "scene",
        true,
        { ...gradesFor(step.creditIds ?? [], 3), ...gradesFor(step.newLexemeIds ?? [], 2) },
        { inputSeconds: step.seconds },
      ),
    );
    finish({ correct: true, detail: `${lines.length} lines` });
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading
        eyebrow={t.station.beats.scene}
        title={
          <>
            <span lang="de">{station.scene.title}</span>
            <span className="ml-2 text-body font-medium text-ink-muted">{station.scene.titleEn}</span>
          </>
        }
        note={station.scene.settingEn}
      />

      <div className="flex flex-col gap-2">
        <Eyebrow>{t.station.scene.cast}</Eyebrow>
        <ul className="flex flex-wrap gap-1.5">
          {station.scene.cast.map((member) => (
            <li key={member.id}>
              <Chip size="sm">
                <span className="font-semibold">{member.name}</span>
                <span className="text-ink-muted">· {member.roleEn}</span>
              </Chip>
            </li>
          ))}
        </ul>
        {scene.source === "model" && <p className="text-caption text-ink-muted">{t.station.scene.variation}</p>}
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          label={playing ? t.station.scene.pause : t.station.scene.play}
          variant="primary"
          disabled={!ready}
          onClick={togglePlay}
        >
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <IconButton
          label={t.station.scene.replay}
          variant="secondary"
          disabled={!ready}
          onClick={() => {
            playTap();
            void playFrom(0, speed);
          }}
        >
          <RotateCcw />
        </IconButton>
        <Segmented<Speed>
          aria-label={t.station.scene.speedLabel}
          size="sm"
          className="ml-auto max-w-64"
          value={speed}
          onChange={changeSpeed}
          options={[
            { value: "slow", label: t.station.scene.slow },
            { value: "street", label: t.station.scene.street },
          ]}
        />
      </div>

      {!ready ? (
        <div className="flex items-center gap-3 py-8">
          <Spinner label={t.station.scene.preparing} />
          <span className="text-body-sm text-ink-muted">{t.station.scene.preparing}</span>
        </div>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={station.scene.title}>
          {lines.map((line, i) => {
            const mine = line.speaker === "du";
            const narration = line.speaker === "narrator";
            const active = i === current;
            return (
              <li
                key={`${i}-${line.de}`}
                id={`scene-line-${i}`}
                className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start", narration && "items-stretch")}
              >
                {!narration && (
                  <button
                    type="button"
                    onClick={() => {
                      playTap();
                      runRef.current++;
                      setCurrent(i);
                      setPlaying(false);
                      void speech.speak(line.de, { voice: voiceFor(station, line.speaker), rate: rateOf(speed) });
                    }}
                    className={cn(
                      "min-h-6 rounded-xs px-1 font-display text-caption font-semibold uppercase tracking-[0.14em] hover:bg-accent-soft",
                      mine ? "text-accent" : "text-ink-muted",
                    )}
                  >
                    {speakerName(station, line.speaker, t.station.scene.you)}
                  </button>
                )}
                <div
                  className={cn(
                    "max-w-[92%] rounded-lg border px-3.5 py-2.5 transition-[border-color,box-shadow]",
                    narration
                      ? "max-w-full border-transparent bg-transparent px-1 py-1 italic text-ink-muted"
                      : mine
                        ? "rounded-tr-xs border-accent-soft bg-accent-soft"
                        : "rounded-tl-xs border-hairline bg-surface",
                    active && !narration && "border-accent shadow-raised",
                  )}
                >
                  <LineWithMeaning de={line.de} en={line.en} currentWord={active ? speech.currentWord : null} />
                  {line.noteEn && (
                    <p className="mt-1.5 border-t border-hairline pt-1.5 text-caption text-ink-muted">
                      <span className="font-semibold">{t.station.scene.note}: </span>
                      {line.noteEn}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <BottomBar>
        <p aria-live="polite" className="min-h-5 text-center text-caption text-ink-muted">
          {blocked ? t.station.scene.blocked : heardAll ? t.station.scene.heardAll : t.station.scene.tapHint}
        </p>
        <Button size="lg" fullWidth disabled={!ready} onClick={complete}>
          {t.station.continue}
        </Button>
      </BottomBar>
    </div>
  );
}
