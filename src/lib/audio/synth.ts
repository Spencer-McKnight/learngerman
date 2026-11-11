/**
 * The pure half of the sound palette: note tables, envelope math and
 * procedural buffers that sound.ts feeds into WebAudio. Kept free of
 * AudioContext so the numbers behind every cue can be unit-tested in
 * node — the one place a wrong decay or a too-hot gain gets caught
 * before a learner hears it.
 */

/** Nothing in the palette may exceed this at the voice level. */
export const PEAK_GAIN = 0.12;

/** Every cue fits in this window, except the one reserved milestone. */
export const CUE_BUDGET_MS = 700;
export const MILESTONE_BUDGET_MS = 2000;

const SEMITONES: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/** MIDI note number → Hz, equal temperament around A4 = 440. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Scientific pitch ("C5", "F#4", "Bb3") → Hz. */
export function noteHz(name: string): number {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a note: ${name}`);
  const octave = Number(match[2]);
  return midiToHz((octave + 1) * 12 + SEMITONES[match[1]]);
}

/**
 * A struck metal bar is not a harmonic series: its overtones sit at
 * roughly 2.76×, 5.40× and 8.93× the fundamental (free-free bar
 * modes), which is exactly what makes a glockenspiel sound like glass
 * rather than an organ. Amplitudes fall off fast — the fundamental
 * carries the note, the partials carry the sparkle.
 */
export interface Partial {
  ratio: number;
  amplitude: number;
}

export const GLOCKENSPIEL_PARTIALS: readonly Partial[] = [
  { ratio: 1, amplitude: 1 },
  { ratio: 2.76, amplitude: 0.32 },
  { ratio: 5.4, amplitude: 0.1 },
  { ratio: 8.93, amplitude: 0.035 },
];

/** A tram bell is cast, not machined: rounder, with a hum tone below. */
export const BELL_PARTIALS: readonly Partial[] = [
  { ratio: 0.5, amplitude: 0.18 },
  { ratio: 1, amplitude: 1 },
  { ratio: 1.5, amplitude: 0.3 },
  { ratio: 2.0, amplitude: 0.45 },
  { ratio: 2.76, amplitude: 0.2 },
  { ratio: 3.5, amplitude: 0.08 },
];

/**
 * Scale partial amplitudes so their sum equals `peak` — the worst-case
 * instantaneous level of an additive voice is the sum of its parts, so
 * this is what guarantees a strike never exceeds PEAK_GAIN.
 */
export function normalisePartials(partials: readonly Partial[], peak: number): Partial[] {
  const total = partials.reduce((sum, partial) => sum + partial.amplitude, 0);
  const scale = Math.min(peak, PEAK_GAIN) / total;
  return partials.map((partial) => ({ ...partial, amplitude: partial.amplitude * scale }));
}

export interface Envelope {
  /** Seconds to reach peak — a few ms for anything struck. */
  attack: number;
  /** Time constant in seconds: level falls to e⁻¹ after this long. */
  decay: number;
}

/** Level of a percussive envelope at `t` seconds after the strike. */
export function envelopeAt(t: number, envelope: Envelope): number {
  if (t <= 0) return 0;
  if (t < envelope.attack) return t / envelope.attack;
  return Math.exp(-(t - envelope.attack) / envelope.decay);
}

/**
 * How long a strike is audible: once the exponential tail is below
 * -60 dB it can be stopped without a click. This is what the budget
 * tests measure, and what the oscillators' stop() times come from.
 */
export function envelopeLength(envelope: Envelope): number {
  return envelope.attack + envelope.decay * Math.log(1000);
}

/** Uniform noise in [-1, 1]; the RNG is injectable for deterministic tests. */
export function whiteNoise(
  length: number,
  random: () => number = Math.random,
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = random() * 2 - 1;
  return out;
}

/**
 * A small hall, synthesised: exponentially decaying noise is a good
 * enough impulse response for a two-second chime, and it costs no
 * asset. `decay` is the time to fall by 60 dB.
 */
export function impulseResponse(
  sampleRate: number,
  seconds: number,
  decay: number,
  random: () => number = Math.random,
): Float32Array<ArrayBuffer> {
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const out = new Float32Array(length);
  const rate = Math.log(1000) / (decay * sampleRate);
  for (let i = 0; i < length; i++) {
    out[i] = (random() * 2 - 1) * Math.exp(-i * rate);
  }
  return out;
}

/**
 * The themed cue list. Timings live here so a test can assert every
 * cue respects its budget without touching WebAudio; sound.ts reads
 * the same numbers when it schedules oscillators.
 */
export interface Strike {
  note: string;
  /** Seconds after the cue starts. */
  at: number;
  envelope: Envelope;
  /** Voice-level peak, ≤ PEAK_GAIN. */
  gain: number;
}

export interface CueScore {
  strikes: Strike[];
  /** Extra tail (noise bursts, reverb) beyond the last strike's ring. */
  tailMs?: number;
}

const FAST: Envelope = { attack: 0.004, decay: 0.06 };
const SHORT: Envelope = { attack: 0.004, decay: 0.05 };
const MEDIUM: Envelope = { attack: 0.004, decay: 0.07 };
const RING: Envelope = { attack: 0.005, decay: 0.075 };
const LONG: Envelope = { attack: 0.005, decay: 0.1 };

export const CUES = {
  /** Tiny mallet touch — the lightest thing in the palette. */
  tap: { strikes: [{ note: "G6", at: 0, envelope: SHORT, gain: 0.035 }] },
  /** A rising fourth: information, offered gently. */
  correct: {
    strikes: [
      { note: "G5", at: 0, envelope: FAST, gain: 0.06 },
      { note: "C6", at: 0.085, envelope: MEDIUM, gain: 0.055 },
    ],
  },
  /** Sparkle for a word gloss opening: three quick high touches. */
  reveal: {
    strikes: [
      { note: "A6", at: 0, envelope: SHORT, gain: 0.03 },
      { note: "C7", at: 0.035, envelope: SHORT, gain: 0.028 },
      { note: "E7", at: 0.07, envelope: FAST, gain: 0.026 },
    ],
  },
  /** Two descending tones — the signal a tram gives before it leaves. */
  depart: {
    strikes: [
      { note: "E5", at: 0, envelope: MEDIUM, gain: 0.06 },
      { note: "C5", at: 0.16, envelope: RING, gain: 0.055 },
    ],
  },
  /** A warm triad, rolled like a quick arpeggio. */
  streak: {
    strikes: [
      { note: "C5", at: 0, envelope: RING, gain: 0.04 },
      { note: "E5", at: 0.012, envelope: RING, gain: 0.038 },
      { note: "G5", at: 0.024, envelope: RING, gain: 0.036 },
    ],
  },
  /** Four ascending notes under reverb — reserved, like the yellow. */
  milestone: {
    strikes: [
      { note: "C5", at: 0, envelope: LONG, gain: 0.05 },
      { note: "E5", at: 0.11, envelope: LONG, gain: 0.05 },
      { note: "G5", at: 0.22, envelope: LONG, gain: 0.05 },
      { note: "C6", at: 0.33, envelope: LONG, gain: 0.055 },
    ],
    tailMs: 900,
  },
} as const satisfies Record<string, CueScore>;

export type CueName = keyof typeof CUES;

/** Total audible length of a scored cue in milliseconds. */
export function cueLengthMs(cue: CueScore): number {
  const ring = cue.strikes.reduce(
    (end, strike) => Math.max(end, strike.at + envelopeLength(strike.envelope)),
    0,
  );
  return ring * 1000 + (cue.tailMs ?? 0);
}
