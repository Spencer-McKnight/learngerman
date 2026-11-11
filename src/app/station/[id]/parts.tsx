"use client";

/**
 * Small pieces every beat shares: Jule's mark, the beat heading, the
 * sticky bottom bar (primary actions in thumb reach), German lines
 * with tap-to-gloss and a translation that reserves its space, the
 * honest self-assessment row, and a recorder hook over the STT seam.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Mic } from "lucide-react";
import type { Line } from "@/lib/curriculum/types";
import { recognizeGermanDetailed, sttAvailable } from "@/lib/audio/stt";
import { playReveal, playTap } from "@/lib/audio/sound";
import type { WordBoundary } from "@/lib/audio/tts";
import { KaraokeText } from "@/components/audio/karaoke-text";
import { useStrings } from "@/components/i18n-provider";
import { Button, Eyebrow, WordChip, cn, lineStyle, type LineNumber } from "@/components/ui";
import { glossFor, glossText, type Grade } from "./lib";

export function lineNumberOf(line: Line): LineNumber {
  return Math.min(5, Math.max(1, line.number)) as LineNumber;
}

/** Jule's avatar: initials in the line's colour. No photos. */
export function JuleMark({ line, size = "md" }: { line: Line; size?: "sm" | "md" }) {
  const t = useStrings();
  return (
    <span
      role="img"
      aria-label={t.station.jule.name}
      style={lineStyle(lineNumberOf(line))}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-pill bg-(--badge-bg) font-display font-bold text-(--badge-ink)",
        size === "sm" ? "size-8 text-caption" : "size-12 text-body",
      )}
    >
      JH
    </span>
  );
}

export function BeatHeading({ eyebrow, title, note }: { eyebrow: string; title: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow tone="accent">{eyebrow}</Eyebrow>
      <h2 className="font-display text-display-m text-ink">{title}</h2>
      {note && <p className="text-body-sm text-ink-muted">{note}</p>}
    </div>
  );
}

/** Sticky bottom area: the screen's primary action sits in thumb reach. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-gutter mt-auto flex flex-col gap-2 border-t border-hairline bg-ground/95 px-gutter pt-3 pb-[max(0.75rem,var(--safe-bottom))] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A polite live region for feedback that matters; keeps its height so nothing shifts. */
export function Feedback({ tone, children }: { tone: "neutral" | "success" | "error"; children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "min-h-6 text-body-sm font-medium",
        tone === "success" && "text-success",
        tone === "error" && "text-error",
        tone === "neutral" && "text-ink-muted",
      )}
    >
      {children}
    </p>
  );
}

/** One word of German text as a tappable gloss (the karaoke `renderWord`). */
export function renderGlossWord(revealGender: boolean) {
  return function GlossWord(word: string, index: number, active: boolean) {
    const gloss = glossFor(word);
    if (!gloss) return word;
    return (
      <WordChip
        key={index}
        word={word}
        gloss={glossText(gloss)}
        gender={gloss.gender}
        revealGender={revealGender}
        current={active}
        onTap={() => playReveal()}
      />
    );
  };
}

/** German text where every known word is a reference; follows the voice when `currentWord` is given. */
export function GlossLine({
  text,
  currentWord = null,
  revealGender = true,
  className,
}: {
  text: string;
  currentWord?: WordBoundary | null;
  revealGender?: boolean;
  className?: string;
}) {
  return <KaraokeText text={text} currentWord={currentWord} renderWord={renderGlossWord(revealGender)} className={className} />;
}

/**
 * A German line with its meaning one tap away. The translation's space
 * is reserved so revealing it never moves the lines below.
 */
export function LineWithMeaning({
  de,
  en,
  open,
  currentWord,
  className,
}: {
  de: string;
  en: string;
  /** Force the translation visible (lines the learner must speak). */
  open?: boolean;
  currentWord?: WordBoundary | null;
  className?: string;
}) {
  const t = useStrings();
  const [shown, setShown] = useState(false);
  const visible = open || shown;
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-body text-ink">
        <GlossLine text={de} currentWord={currentWord} />
        {!open && (
          <button
            type="button"
            aria-pressed={shown}
            onClick={() => {
              playTap();
              setShown((v) => !v);
            }}
            className="ml-2 inline-flex min-h-6 items-center rounded-xs px-1 font-display text-caption font-semibold text-accent hover:bg-accent-soft"
          >
            {shown ? t.station.scene.hideEn : t.station.scene.showEn}
          </button>
        )}
      </span>
      <span className={cn("min-h-[1.55em] text-body-sm text-ink-muted", !visible && "invisible")} aria-hidden={!visible}>
        {en}
      </span>
    </span>
  );
}

/** Three honest buttons when no recogniser exists — never a fake score. */
export function SelfAssess({ onPick, disabled }: { onPick: (grade: Grade) => void; disabled?: boolean }) {
  const t = useStrings();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-caption text-ink-muted">{t.station.speak.noStt}</p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="answer" className="justify-center text-body-sm" disabled={disabled} onClick={() => onPick(1)}>
          {t.station.speak.selfHard}
        </Button>
        <Button variant="answer" className="justify-center text-body-sm" disabled={disabled} onClick={() => onPick(2)}>
          {t.station.speak.selfSoso}
        </Button>
        <Button variant="answer" className="justify-center text-body-sm" disabled={disabled} onClick={() => onPick(3)}>
          {t.station.speak.selfEasy}
        </Button>
      </div>
    </div>
  );
}

/** A microphone-shaped record button with the recording state spelled out. */
export function RecordButton({
  listening,
  onClick,
  disabled,
  fullWidth = true,
}: {
  listening: boolean;
  onClick: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const t = useStrings();
  return (
    <Button
      size="lg"
      fullWidth={fullWidth}
      disabled={disabled || listening}
      aria-busy={listening || undefined}
      icon={<Mic aria-hidden className="size-5" />}
      onClick={onClick}
    >
      {listening ? t.station.speak.recording : t.station.speak.record}
    </Button>
  );
}

/** One utterance at a time over the Web Speech seam; `available` is false where it does not exist. */
export function useRecorder() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const available = typeof window !== "undefined" && sttAvailable();

  const record = useCallback(async (): Promise<{ transcript: string; alternatives: string[] }> => {
    if (!sttAvailable()) return { transcript: "", alternatives: [] };
    setListening(true);
    setInterim("");
    const recognizer = recognizeGermanDetailed({ onInterim: setInterim });
    stopRef.current = recognizer.stop;
    try {
      return await recognizer.result;
    } finally {
      stopRef.current = null;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => stopRef.current?.(), []);
  return { available, listening, interim, record, stop };
}
