"use client";

/**
 * Full-screen celebration for genuine milestone crossings only — the
 * one place Duolingo-style energy is welcome (gamification #4). Shows
 * each MilestoneEvent as an Ortsschild with confetti and the reserved
 * milestone chord, one at a time.
 */

import { useEffect, useState } from "react";
import type { MilestoneEvent } from "@/lib/engine";
import { playMilestone } from "@/lib/audio/sound";
import { Confetti } from "./confetti";
import { Ortsschild } from "./ortsschild";
import { Button } from "./ui";

export function MilestoneOverlay({
  events,
  onDone,
}: {
  events: MilestoneEvent[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const event = events[index];

  useEffect(() => {
    if (event) playMilestone();
  }, [index, event]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#1b1f24]/85 px-6 backdrop-blur-sm">
      <Confetti burst={index + 1} />
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[#f7c600]">
        Du bist angekommen
      </p>
      <div className="animate-sign-pop">
        <Ortsschild label={event.label} detail={event.detail} />
      </div>
      <Button
        variant="outline"
        className="min-w-40"
        onClick={() => {
          if (index + 1 < events.length) setIndex(index + 1);
          else onDone();
        }}
      >
        Weiter
      </Button>
    </div>
  );
}
