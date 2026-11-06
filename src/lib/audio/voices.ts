/**
 * The cast of voices. Every character in the course maps to one neural
 * voice so a speaker always sounds like themselves; the tutor has her
 * own. Keys are what curriculum authors write in `Character.voice`;
 * the values are Microsoft Edge neural voice names served by /api/tts.
 */

export const VOICES = {
  /** Jule Hartmann, the teacher — warm, dry, Erlangen-born. */
  jule: "de-DE-SeraphinaMultilingualNeural",
  /** The narrator of Act-1 lines. */
  katja: "de-DE-KatjaNeural",
  conrad: "de-DE-ConradNeural",
  amala: "de-DE-AmalaNeural",
  killian: "de-DE-KillianNeural",
  florian: "de-DE-FlorianMultilingualNeural",
  /** Austrian and Swiss voices — the German-speaking world is wider than Germany. */
  ingrid: "de-AT-IngridNeural",
  jonas: "de-AT-JonasNeural",
  leni: "de-CH-LeniNeural",
  jan: "de-CH-JanNeural",
} as const;

export type VoiceKey = keyof typeof VOICES;
export type VoiceName = (typeof VOICES)[VoiceKey];

export const VOICE_KEYS = Object.keys(VOICES) as VoiceKey[];

/** Voices rotated for HVPT talker variability (≥ 4, mixed genders). */
export const HVPT_VOICE_KEYS: VoiceKey[] = ["katja", "conrad", "amala", "killian", "florian"];

export const DEFAULT_VOICE: VoiceKey = "katja";

export function voiceName(key: string): string {
  return VOICES[(key as VoiceKey) in VOICES ? (key as VoiceKey) : DEFAULT_VOICE];
}

/**
 * Any German-locale Edge neural voice is acceptable even when it is not
 * in the cast (hvpt.ts rotates full names; authors may try new ones),
 * but the name is validated so the cache never fills with junk keys.
 */
const GERMAN_NEURAL = /^de-(DE|AT|CH)-[A-Za-z]+Neural$/;

/**
 * Resolve whatever a caller hands us — a cast key ("jule"), a full
 * Edge name ("de-DE-KatjaNeural"), or nothing — to one voice name.
 */
export function resolveVoice(input: string | undefined | null): string {
  if (!input) return VOICES[DEFAULT_VOICE];
  const trimmed = input.trim();
  if (trimmed in VOICES) return VOICES[trimmed as VoiceKey];
  if (GERMAN_NEURAL.test(trimmed)) return trimmed;
  return VOICES[DEFAULT_VOICE];
}

/** The cast key for a full voice name, if that voice belongs to the cast. */
export function voiceKeyOf(name: string): VoiceKey | null {
  return VOICE_KEYS.find((key) => VOICES[key] === name) ?? null;
}
