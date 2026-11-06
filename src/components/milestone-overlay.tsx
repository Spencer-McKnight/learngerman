"use client";

import { useEffect, useId, useState } from "react";
import type { MilestoneEvent } from "@/lib/engine";
import { playMilestone } from "@/lib/audio/sound";
import { useStrings } from "./i18n-provider";
import { Confetti } from "./confetti";
import { Button, Eyebrow, Ortsschild } from "./ui";

/**
 * The one place the app spends energy: a milestone (a CEFR band, a
 * vocabulary threshold, a line completed). Dark scrim, confetti in
 * signage colours, the Ortsschild arriving with a small overshoot, one
 * button. Queue of events; `onDone` after the last one.
 */
export function MilestoneOverlay({
  events,
  onDone,
}: {
  events: MilestoneEvent[];
  onDone: () => void;
}) {
  const t = useStrings();
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [showSign, setShowSign] = useState(false);
  const event = events[index];

  useEffect(() => {
    if (!event) return;
    playMilestone();
    const timer = window.setTimeout(() => setShowSign(true), 350);
    return () => window.clearTimeout(timer);
  }, [index, event]);

  if (!event) return null;

  const last = index + 1 >= events.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-scrim px-gutter backdrop-blur-md"
    >
      <Confetti burst={index + 1} />

      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div key={`glow-${index}`} className="size-32 rounded-pill bg-milestone/30 animate-glow-ring" />
      </div>

      <Eyebrow tone="milestone" className="relative tracking-[0.2em]">
        {t.milestone.arrived}
      </Eyebrow>
      <h2 id={titleId} className="sr-only">
        {event.label}
        {event.detail ? ` — ${event.detail}` : ""}
      </h2>
      {showSign && (
        <div key={`sign-${index}`} className="relative animate-sign-arrive">
          <Ortsschild label={event.label} detail={event.detail} />
        </div>
      )}
      {showSign && (
        <Button
          variant="secondary"
          size="lg"
          autoFocus
          className="relative min-w-44 animate-fade-up border-white/30 bg-transparent text-white shadow-none hover:border-milestone hover:bg-white/10 hover:text-white"
          onClick={() => {
            if (!last) {
              setShowSign(false);
              setIndex(index + 1);
            } else {
              onDone();
            }
          }}
        >
          {t.common.continue}
        </Button>
      )}
    </div>
  );
}
