/**
 * Speech recognition (de-DE) via the Web Speech API where it exists
 * (Chrome/Edge/Android). Components must always offer the honest
 * fallback path when sttAvailable() is false — typed input or
 * clearly-labelled self-assessment, never a fake score.
 */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => RecognitionLike)
    | null;
}

export function sttAvailable(): boolean {
  return recognitionCtor() !== null;
}

export interface Recognizer {
  /** Resolves with the final transcript ("" on error/silence). */
  result: Promise<string>;
  stop: () => void;
}

/** Listen for one German utterance, reporting interim text as it forms. */
export function recognizeGerman(onInterim?: (text: string) => void): Recognizer {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.resolve(""), stop: () => {} };
  const recognition = new Ctor();
  recognition.lang = "de-DE";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let transcript = "";
  const result = new Promise<string>((resolve) => {
    // Safety net: an unanswered mic-permission prompt keeps recognition
    // in "starting" forever with no onend/onerror — never leave the
    // learner stuck on a listening state.
    const timeout = setTimeout(() => {
      recognition.abort();
      resolve(transcript);
    }, 15000);
    const settle = () => {
      clearTimeout(timeout);
      resolve(transcript);
    };
    recognition.onresult = (event) => {
      transcript = Array.from({ length: event.results.length })
        .map((_, i) => event.results[i][0].transcript)
        .join(" ")
        .trim();
      onInterim?.(transcript);
    };
    recognition.onend = settle;
    recognition.onerror = settle;
  });
  recognition.start();
  return { result, stop: () => recognition.stop() };
}
