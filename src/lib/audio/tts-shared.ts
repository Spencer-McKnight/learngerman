/**
 * What the TTS route and its browser client must agree on: the shape
 * of a word boundary and how an utterance is identified. The server
 * hashes the key material into the Storage filename; the client keeps
 * the same material as its in-memory key, so one line is never fetched
 * twice from either side.
 */

export interface WordBoundary {
  word: string;
  /** Milliseconds from the start of the audio. */
  offsetMs: number;
  durationMs: number;
  /** Position in the spoken word sequence, from 0. */
  index: number;
}

export interface SpeechClip {
  url: string;
  boundaries: WordBoundary[];
  durationMs?: number;
  cached?: boolean;
}

/** Response of POST /api/tts when synthesis could not happen. */
export interface SpeechFallback {
  error: string;
  fallback: true;
}

export const MAX_SPEECH_CHARS = 600;
export const DEFAULT_SPEECH_RATE = 0.92;

/** Collapse whitespace so "ja,  gern" and "ja, gern" share one cache slot. */
export function normaliseSpeechText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Rates are quantised to hundredths — nobody hears the difference. */
export function normaliseSpeechRate(rate: number | undefined): number {
  const value = rate ?? DEFAULT_SPEECH_RATE;
  return Math.round(Math.min(1.5, Math.max(0.5, value)) * 100) / 100;
}

export function speechCacheMaterial(voice: string, rate: number, text: string): string {
  return `${voice}|${normaliseSpeechRate(rate).toFixed(2)}|${normaliseSpeechText(text)}`;
}
