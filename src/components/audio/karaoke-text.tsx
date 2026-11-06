"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import type { WordBoundary } from "@/lib/audio/tts";
import { activeTokenIndex, tokenizeText } from "@/lib/audio/words";

/**
 * German text that follows the voice: the word being spoken is
 * highlighted as boundaries arrive from useSpeech(). `renderWord` lets
 * a task wrap each word in its own control (a tap-to-gloss button)
 * without re-implementing the highlight.
 */
export function KaraokeText({
  text,
  currentWord,
  renderWord,
  className = "",
  activeClassName = "rounded-sm bg-accent/20 text-accent-bright",
}: {
  text: string;
  currentWord: WordBoundary | null;
  renderWord?: (word: string, index: number, active: boolean) => ReactNode;
  className?: string;
  activeClassName?: string;
}) {
  const tokens = useMemo(() => tokenizeText(text), [text]);
  const active = activeTokenIndex(tokens, currentWord);

  return (
    <span className={className} lang="de">
      {tokens.map((token, i) => {
        if (token.wordIndex < 0) return <Fragment key={i}>{token.text}</Fragment>;
        const isActive = i === active;
        const content = renderWord ? renderWord(token.text, token.wordIndex, isActive) : token.text;
        return (
          <span
            key={i}
            className={`transition-colors duration-100 ${isActive ? activeClassName : ""}`}
            aria-current={isActive ? "true" : undefined}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
}
