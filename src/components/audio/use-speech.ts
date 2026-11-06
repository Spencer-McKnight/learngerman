"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speak as speakLine, stopSpeaking, type SpeakOptions, type WordBoundary } from "@/lib/audio/tts";

/**
 * A component's view of the one shared speaker: call speak(), render
 * `speaking` and hand `currentWord` to <KaraokeText>. Interrupting a
 * line with another speak() is fine — the older call resolves early
 * and may not touch the state the newer one owns.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [currentWord, setCurrentWord] = useState<WordBoundary | null>(null);
  const turn = useRef(0);

  const speak = useCallback(async (text: string, opts: SpeakOptions = {}) => {
    const mine = ++turn.current;
    setSpeaking(true);
    setCurrentWord(null);
    try {
      await speakLine(text, {
        ...opts,
        onBoundary: (boundary) => {
          if (mine === turn.current) setCurrentWord(boundary);
          opts.onBoundary?.(boundary);
        },
      });
    } finally {
      if (mine === turn.current) {
        setSpeaking(false);
        setCurrentWord(null);
      }
    }
  }, []);

  const stop = useCallback(() => {
    turn.current++;
    stopSpeaking();
    setSpeaking(false);
    setCurrentWord(null);
  }, []);

  // Leaving the screen must not leave a voice talking behind it.
  useEffect(() => () => stopSpeaking(), []);

  return { speak, stop, speaking, currentWord };
}
