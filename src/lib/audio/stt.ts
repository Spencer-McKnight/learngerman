/**
 * Speech recognition via the Web Speech API where it exists
 * (Chrome/Edge/Android). Components must always offer the honest
 * fallback path when sttAvailable() is false — typed input or
 * clearly-labelled self-assessment, never a fake score.
 *
 * Interim text streams as it forms; the final result carries the
 * engine's alternatives too, so a scorer can accept "Brötchen" when
 * the top hypothesis heard "Brot chen".
 */

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult extends ArrayLike<RecognitionAlternative> {
  isFinal?: boolean;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
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

export interface RecognitionOutcome {
  /** Best transcript ("" on error/silence). */
  transcript: string;
  /** Other hypotheses for the same speech, best first, without the top one. */
  alternatives: string[];
}

export interface DetailedRecognizer {
  result: Promise<RecognitionOutcome>;
  stop: () => void;
}

export interface Recognizer {
  /** Resolves with the final transcript ("" on error/silence). */
  result: Promise<string>;
  stop: () => void;
}

export interface RecognizeOptions {
  lang?: string;
  onInterim?: (text: string) => void;
  /** Keep listening across pauses until stop() — off by default so a line resolves on its own. */
  continuous?: boolean;
  maxAlternatives?: number;
}

/** A hard ceiling: nothing listens for longer than this, whatever happens. */
const SAFETY_MS = 15000;

/** Listen for one German utterance with full detail. */
export function recognizeGermanDetailed(opts: RecognizeOptions = {}): DetailedRecognizer {
  const Ctor = recognitionCtor();
  const empty: RecognitionOutcome = { transcript: "", alternatives: [] };
  if (!Ctor) return { result: Promise.resolve(empty), stop: () => {} };
  const recognition = new Ctor();
  recognition.lang = opts.lang ?? "de-DE";
  recognition.interimResults = true;
  recognition.continuous = opts.continuous ?? false;
  recognition.maxAlternatives = opts.maxAlternatives ?? 3;
  let outcome = empty;
  const result = new Promise<RecognitionOutcome>((resolve) => {
    // Safety net: an unanswered mic-permission prompt keeps recognition
    // in "starting" forever with no onend/onerror — never leave the
    // learner stuck on a listening state.
    const timeout = setTimeout(() => {
      recognition.abort();
      resolve(outcome);
    }, SAFETY_MS);
    const settle = () => {
      clearTimeout(timeout);
      resolve(outcome);
    };
    recognition.onresult = (event) => {
      // Each result is one segment; segment n's alternative k pairs
      // with every other segment's best guess to form alternative k.
      const segments = Array.from({ length: event.results.length }, (_, i) => event.results[i]);
      const pick = (k: number) =>
        segments
          .map((segment) => (segment[k] ?? segment[0]).transcript)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      const transcript = pick(0);
      const width = segments.reduce((max, segment) => Math.max(max, segment.length), 0);
      const alternatives = Array.from({ length: Math.max(0, width - 1) }, (_, k) => pick(k + 1)).filter(
        (candidate, i, all) => candidate && candidate !== transcript && all.indexOf(candidate) === i,
      );
      outcome = { transcript, alternatives };
      opts.onInterim?.(transcript);
    };
    recognition.onend = settle;
    recognition.onerror = settle;
  });
  recognition.start();
  return { result, stop: () => recognition.stop() };
}

/** Listen for one German utterance, reporting interim text as it forms. */
export function recognizeGerman(
  onInterim?: (text: string) => void,
  opts: Omit<RecognizeOptions, "onInterim"> = {},
): Recognizer {
  const detailed = recognizeGermanDetailed({ ...opts, onInterim });
  return { result: detailed.result.then((outcome) => outcome.transcript), stop: detailed.stop };
}
