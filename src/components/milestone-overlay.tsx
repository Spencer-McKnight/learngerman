"use client";

import { useEffect, useState } from "react";
import type { MilestoneEvent } from "@/lib/engine";
import { playMilestone } from "@/lib/audio/sound";
import { useStrings } from "./i18n-provider";
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
  const t = useStrings();
  const [index, setIndex] = useState(0);
  const [showSign, setShowSign] = useState(false);
  const event = events[index];

  useEffect(() => {
    if (!event) return;
    setShowSign(false);
    playMilestone();
    const timer = setTimeout(() => setShowSign(true), 400);
    return () => clearTimeout(timer);
  }, [index, event]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#141719]/88 px-6 backdrop-blur-md">
      <Confetti burst={index + 1} />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          key={`glow-${index}`}
          className="size-32 rounded-full bg-milestone/30 animate-glow-ring"
        />
      </div>

      <p className="relative font-display text-sm font-semibold uppercase tracking-[0.2em] text-[#f7c600]">
        {t.milestone.arrived}
      </p>
      {showSign && (
        <div className="animate-sign-pop relative">
          <Ortsschild label={event.label} detail={event.detail} />
        </div>
      )}
      {showSign && (
        <Button
          variant="outline"
          className="relative min-w-40 animate-fade-up border-[#f7c600]/30 text-white hover:border-[#f7c600]/60"
          onClick={() => {
            if (index + 1 < events.length) setIndex(index + 1);
            else onDone();
          }}
        >
          {t.common.continue}
        </Button>
      )}
    </div>
  );
}
