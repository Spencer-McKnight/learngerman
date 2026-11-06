/**
 * German audio, behind one seam. speak() asks POST /api/tts for a
 * neural voice (Microsoft Edge via msedge-tts, cached forever in
 * Supabase Storage), plays it through an <audio> element and emits
 * word boundaries on a clock aligned to the actual playback position,
 * so a karaoke highlight stays honest through buffering. The browser's
 * speechSynthesis survives only as the last rung of the ladder: used
 * when the fetch fails, the route says "fallback", or the learner is
 * offline — never by preference.
 *
 * Only one thing ever plays: every speak() silences whatever came
 * before it, including a fetch still in flight.
 */

import { DEFAULT_VOICE, HVPT_VOICE_KEYS, resolveVoice, voiceKeyOf } from "./voices";
import {
  DEFAULT_SPEECH_RATE,
  normaliseSpeechRate,
  normaliseSpeechText,
  speechCacheMaterial,
  type SpeechClip,
  type WordBoundary,
} from "./tts-shared";
import { tokenizeText, wordIndexAtChar } from "./words";

export type { SpeechClip, WordBoundary } from "./tts-shared";

export interface SpeakOptions {
  /** A cast key ("jule") or a full Edge voice name; default narrator. */
  voice?: string;
  rate?: number;
  onBoundary?: (boundary: WordBoundary) => void;
  signal?: AbortSignal;
}

/** Playback needs a document; the neural path has no other requirement. */
export function ttsAvailable(): boolean {
  return typeof window !== "undefined";
}

// ---------------------------------------------------------------- cache

/** Warm clips keyed exactly like the server's cache material. */
const clips = new Map<string, Promise<SpeechClip | null>>();
const CLIPS_MAX = 64;

async function fetchClip(text: string, voice: string, rate: number): Promise<SpeechClip | null> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice, rate }),
    });
    // 4xx/5xx all mean "use the browser": a 502 is Edge being down, a
    // 503 is TTS_DISABLE, a 401 is a session that lapsed mid-lesson.
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<SpeechClip>;
    if (typeof data.url !== "string") return null;
    return {
      url: data.url,
      boundaries: Array.isArray(data.boundaries) ? data.boundaries : [],
      durationMs: data.durationMs,
      cached: data.cached,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch (or reuse) the clip for a line without playing it — call it
 * for the next line while the current one is still being read, so the
 * learner never waits on synthesis. Deduped per voice/rate/text.
 */
export function preload(
  text: string,
  voice: string = DEFAULT_VOICE,
  rate: number = DEFAULT_SPEECH_RATE,
): Promise<SpeechClip | null> {
  if (!ttsAvailable()) return Promise.resolve(null);
  const clean = normaliseSpeechText(text);
  if (!clean) return Promise.resolve(null);
  const name = resolveVoice(voice);
  const speed = normaliseSpeechRate(rate);
  const key = speechCacheMaterial(name, speed, clean);
  const warm = clips.get(key);
  if (warm) return warm;
  if (clips.size >= CLIPS_MAX) {
    const oldest = clips.keys().next().value;
    if (oldest !== undefined) clips.delete(oldest);
  }
  const pending = fetchClip(clean, name, speed).then((clip) => {
    // A miss is not remembered: the next attempt may succeed.
    if (!clip) clips.delete(key);
    else if (!clip.url.startsWith("data:")) {
      // Let the browser's media cache fetch the bytes now, not on play.
      const warmer = new Audio();
      warmer.preload = "auto";
      warmer.src = clip.url;
    }
    return clip;
  });
  clips.set(key, pending);
  return pending;
}

// ------------------------------------------------------------- playback

interface Playback {
  stop: () => void;
}

let current: Playback | null = null;
/** Bumped by every speak()/stop so a slow fetch cannot play late. */
let generation = 0;

export function stopSpeaking(): void {
  generation++;
  current?.stop();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Boundaries fire a touch early so the eye and the ear agree. */
const LOOKAHEAD_MS = 30;

/** Resolves true when the clip played (or was stopped), false on a media error. */
function playClip(clip: SpeechClip, opts: SpeakOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(clip.url);
    audio.preload = "auto";
    const boundaries = [...clip.boundaries].sort((a, b) => a.offsetMs - b.offsetMs);
    let next = 0;
    let frame = 0;
    let settled = false;

    const tick = () => {
      const now = audio.currentTime * 1000 + LOOKAHEAD_MS;
      while (next < boundaries.length && boundaries[next].offsetMs <= now) {
        opts.onBoundary?.(boundaries[next]);
        next++;
      }
      frame = requestAnimationFrame(tick);
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(frame);
      opts.signal?.removeEventListener("abort", abort);
      audio.onended = null;
      audio.onerror = null;
      if (current === playback) current = null;
      resolve(ok);
    };
    const playback: Playback = {
      stop: () => {
        audio.pause();
        audio.removeAttribute("src");
        finish(true);
      },
    };
    const abort = () => playback.stop();

    current = playback;
    opts.signal?.addEventListener("abort", abort, { once: true });
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.onplaying = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    // A rejected play() is almost always the autoplay policy, which
    // speechSynthesis would hit just the same — so treat it as done.
    audio.play().catch(() => finish(true));
  });
}

// ---------------------------------------------------- browser fallback

let browserVoices: SpeechSynthesisVoice[] = [];

function germanBrowserVoices(): SpeechSynthesisVoice[] {
  if (browserVoices.length === 0) {
    browserVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("de"));
  }
  return browserVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    browserVoices = [];
  };
}

/** Same cast member → same device voice, so talker variability survives offline. */
function browserVoiceIndex(voice: string): number {
  const key = voiceKeyOf(voice);
  const position = key ? HVPT_VOICE_KEYS.indexOf(key) : -1;
  if (position >= 0) return position;
  return Array.from(voice).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 0);
}

function speakWithBrowser(text: string, voice: string, rate: number, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = rate;
    const available = germanBrowserVoices();
    if (available.length > 0) {
      utterance.voice = available[browserVoiceIndex(voice) % available.length];
    }
    const tokens = tokenizeText(text);
    const started = performance.now();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", abort);
      if (current === playback) current = null;
      resolve();
    };
    const playback: Playback = {
      stop: () => {
        window.speechSynthesis.cancel();
        finish();
      },
    };
    const abort = () => playback.stop();
    current = playback;
    opts.signal?.addEventListener("abort", abort, { once: true });
    // Chrome and Safari report word boundaries by character offset.
    utterance.onboundary = (event) => {
      if (event.name !== "word" || !opts.onBoundary) return;
      const index = wordIndexAtChar(tokens, event.charIndex);
      if (index < 0) return;
      const token = tokens.find((candidate) => candidate.wordIndex === index);
      opts.onBoundary({
        word: token?.text ?? "",
        offsetMs: performance.now() - started,
        durationMs: 0,
        index,
      });
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}

// ----------------------------------------------------------------- API

/**
 * Speak German text with a neural voice; resolves when playback ends
 * (or is stopped). Falls back to the device's speechSynthesis only
 * when the neural path is unavailable.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsAvailable()) return;
  const clean = normaliseSpeechText(text);
  if (!clean) return;
  const voice = resolveVoice(opts.voice);
  const rate = normaliseSpeechRate(opts.rate);
  stopSpeaking();
  const token = generation;
  if (opts.signal?.aborted) return;

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const clip = offline ? null : await preload(clean, voice, rate);
  // Someone else spoke, or stop() ran, while we were fetching.
  if (token !== generation || opts.signal?.aborted) return;

  if (clip) {
    const played = await playClip(clip, opts);
    if (played || token !== generation) return;
    // The media element choked on the URL (an expired object, a
    // blocked CDN): forget the clip and let the device read it.
    clips.delete(speechCacheMaterial(voice, rate, clean));
  }
  await speakWithBrowser(clean, voice, rate, opts);
}

/**
 * The original seam, kept for every existing call site. `voiceIndex`
 * rotates the HVPT cast for talker variability; `voice` names one.
 */
export function speakGerman(
  text: string,
  opts: { rate?: number; voiceIndex?: number; voice?: string } = {},
): Promise<void> {
  const voice =
    opts.voice ??
    (opts.voiceIndex === undefined
      ? DEFAULT_VOICE
      : HVPT_VOICE_KEYS[Math.abs(opts.voiceIndex) % HVPT_VOICE_KEYS.length]);
  return speak(text, { voice, rate: opts.rate });
}
