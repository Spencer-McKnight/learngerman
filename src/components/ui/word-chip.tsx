"use client";

import { useId, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";
import type { Gender } from "./chip";

const GENDER_TEXT: Record<Gender, string> = {
  der: "text-gender-der",
  die: "text-gender-die",
  das: "text-gender-das",
};

export interface WordChipProps {
  /** The surface form as it appears in the text. */
  word: string;
  /** The gloss shown in the popover (meaning, or "die Bäckerei — bakery"). */
  gloss: ReactNode;
  /** The noun's gender; colours the word when `revealGender`. */
  gender?: Gender;
  /** Colour is feedback: pass true only once the learner has retrieved it
   *  or the step is pure reading (the scene). Default: no colour. */
  revealGender?: boolean;
  /** Called on every tap — the signal of which words needed help. */
  onTap?: (word: string) => void;
  /** The karaoke highlight for the word currently being spoken. */
  current?: boolean;
  className?: string;
}

/**
 * A tappable word inside running German text, with its meaning one tap
 * away in a small popover (the LingQ rule: a reference always within
 * reach). Tapping again, Escape or focus leaving closes it. `current`
 * draws the karaoke underline sweep during playback; `gender` with
 * `revealGender` colours the word as feedback. Use it inside scene
 * lines, briefings and transcripts. Not for standalone vocabulary cards
 * (use `Chip`), not for links, and never pre-colour a noun the learner is
 * about to be asked the gender of.
 */
export function WordChip({
  word,
  gloss,
  gender,
  revealGender = false,
  onTap,
  current = false,
  className,
}: WordChipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const onBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <span className="relative inline" onBlur={onBlur} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          setOpen((v) => !v);
          onTap?.(word);
        }}
        className={cn(
          "inline rounded-xs decoration-accent/40 decoration-dotted underline-offset-4 hover:underline focus-visible:underline",
          current && "animate-karaoke",
          open && "bg-accent-soft",
          gender && revealGender && cn("font-semibold", GENDER_TEXT[gender]),
          className,
        )}
      >
        {word}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2.5 py-1.5 text-caption font-medium text-ground shadow-floating animate-pop"
        >
          {gloss}
        </span>
      )}
    </span>
  );
}
