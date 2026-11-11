/**
 * "Glockenspiel und Straßenbahn" — one instrument for the whole app,
 * synthesised in WebAudio with no asset files. The palette is a small
 * German-town soundscape: a glockenspiel for touches, answers and
 * reveals; a felt-mallet knock on wood for wrong (information, never
 * punishment); the tram's bell for arriving at a station and its
 * two-tone signal for leaving; a sheet of paper turning between
 * steps; and one chime under a little hall reverb, reserved for
 * genuine milestones — mirroring the Ortsschild-yellow rule.
 *
 * Every voice peaks at or below PEAK_GAIN and the whole instrument runs
 * through a shared master gain and a soft compressor, so stacked cues
 * (a streak triad on top of a tap) can never clip. The pure numbers —
 * note tables, partial ratios, envelopes, cue timings — live in
 * synth.ts where vitest can reach them.
 */

import {
  BELL_PARTIALS,
  CUES,
  envelopeLength,
  GLOCKENSPIEL_PARTIALS,
  impulseResponse,
  normalisePartials,
  noteHz,
  PEAK_GAIN,
  whiteNoise,
  type CueScore,
  type Envelope,
  type Partial,
} from "./synth";

const PREF_KEY = "lg:sound";
const VOLUME_KEY = "lg:volume";

/** Headroom under 0 dBFS even with every cue firing at once. */
const MASTER_TRIM = 0.8;

interface Instrument {
  ctx: AudioContext;
  master: GainNode;
  /** Reverb send, only the milestone uses it. */
  hall: ConvolverNode;
  noise: AudioBuffer;
}

let instrument: Instrument | null = null;
let gestureHooked = false;

function buildInstrument(): Instrument | null {
  if (typeof window === "undefined") return null;
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = soundVolume() * MASTER_TRIM;
    // Soft knee, gentle ratio: it only ever catches the sum of
    // simultaneous cues, never shapes a single strike's envelope.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    master.connect(compressor).connect(ctx.destination);

    const hall = ctx.createConvolver();
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
    // Two independent noise tails give the hall a bit of width.
    ir.copyToChannel(impulseResponse(ctx.sampleRate, 0.9, 0.7), 0);
    ir.copyToChannel(impulseResponse(ctx.sampleRate, 0.9, 0.7), 1);
    hall.buffer = ir;
    hall.connect(master);

    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    noise.copyToChannel(whiteNoise(noise.length), 0);

    return { ctx, master, hall, noise };
  } catch {
    return null;
  }
}

/**
 * Browsers start an AudioContext suspended until a user gesture; the
 * first tap on anything wakes it so the very first cue is not lost.
 */
function hookFirstGesture(): void {
  if (gestureHooked || typeof window === "undefined") return;
  gestureHooked = true;
  const wake = () => {
    if (instrument?.ctx.state === "suspended") void instrument.ctx.resume();
  };
  for (const type of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(type, wake, { passive: true });
  }
}

function play(): Instrument | null {
  if (!soundEnabled()) return null;
  instrument ??= buildInstrument();
  if (!instrument) return null;
  hookFirstGesture();
  if (instrument.ctx.state === "suspended") void instrument.ctx.resume();
  return instrument;
}

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the session still plays sound.
  }
}

/** 0..1, persisted; 1 is still quiet — PEAK_GAIN caps every voice. */
export function soundVolume(): number {
  if (typeof window === "undefined") return 1;
  try {
    const stored = window.localStorage.getItem(VOLUME_KEY);
    if (stored === null) return 1;
    const volume = Number(stored);
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
  } catch {
    return 1;
  }
}

export function setSoundVolume(volume: number): void {
  const clamped = Math.min(1, Math.max(0, volume));
  try {
    window.localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    // Same as above: a lost preference is not a lost session.
  }
  if (instrument) {
    const { ctx, master } = instrument;
    // A short ramp so dragging a slider never zippers.
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(clamped * MASTER_TRIM, ctx.currentTime, 0.02);
  }
}

/**
 * One struck bar: additive partials, a few-ms attack, exponential
 * decay. The second partial is detuned by a hair so the pair beats
 * slowly — the shimmer that makes a real glockenspiel bloom instead of
 * ringing like a test tone.
 */
function strike(
  inst: Instrument,
  frequency: number,
  start: number,
  envelope: Envelope,
  gain: number,
  partials: readonly Partial[] = GLOCKENSPIEL_PARTIALS,
  out: AudioNode = inst.master,
): void {
  const { ctx } = inst;
  const stop = start + envelopeLength(envelope);
  normalisePartials(partials, gain).forEach((partial, i) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    const shimmer = i === 1 ? 1.0035 : 1;
    osc.frequency.value = frequency * partial.ratio * shimmer;
    // Higher partials die sooner on a real bar.
    const decay = envelope.decay / (1 + i * 0.6);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(partial.amplitude, start + envelope.attack);
    env.gain.setTargetAtTime(0, start + envelope.attack, decay);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(stop);
  });
}

/** Play a scored cue from synth.ts on the glockenspiel. */
function score(inst: Instrument, cue: CueScore, out: AudioNode = inst.master): void {
  const t = inst.ctx.currentTime;
  for (const s of cue.strikes) strike(inst, noteHz(s.note), t + s.at, s.envelope, s.gain, undefined, out);
}

/**
 * A short, filtered burst of the shared noise buffer — the raw material
 * for anything in the town that is not a bar being struck.
 */
function burst(
  inst: Instrument,
  start: number,
  seconds: number,
  gain: number,
  filter: { type: BiquadFilterType; from: number; to?: number; q?: number },
): void {
  const { ctx, master, noise } = inst;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = filter.type;
  band.Q.value = filter.q ?? 1;
  band.frequency.setValueAtTime(filter.from, start);
  if (filter.to) band.frequency.exponentialRampToValueAtTime(filter.to, start + seconds);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(Math.min(gain, PEAK_GAIN), start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  src.connect(band).connect(env).connect(master);
  src.start(start);
  src.stop(start + seconds + 0.01);
}

/** Lightest touch in the palette — buttons, chips, toggles. */
export function playTap(): void {
  const inst = play();
  if (inst) score(inst, CUES.tap);
}

/** A right answer: a rising fourth on the glockenspiel. */
export function playCorrect(): void {
  const inst = play();
  if (inst) score(inst, CUES.correct);
}

/**
 * Wrong: a felt mallet on the wooden frame, not a bar. A low thump
 * with a short woody knock over it — the sound of "not that one",
 * with nothing in it to sting.
 */
export function playWrong(): void {
  const inst = play();
  if (!inst) return;
  const { ctx, master } = inst;
  const t = ctx.currentTime;
  const thump = ctx.createOscillator();
  const env = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(190, t);
  thump.frequency.exponentialRampToValueAtTime(110, t + 0.12);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.07, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  thump.connect(env).connect(master);
  thump.start(t);
  thump.stop(t + 0.18);
  burst(inst, t, 0.07, 0.05, { type: "bandpass", from: 420, q: 2.5 });
}

/** A word gloss opening: three quick high sparkles. */
export function playReveal(): void {
  const inst = play();
  if (inst) score(inst, CUES.reveal);
}

/** Step change inside a task: one sheet of paper turning over. */
export function playStep(): void {
  const inst = play();
  if (!inst) return;
  const t = inst.ctx.currentTime;
  // Two overlapping swishes read as a single flip of a page.
  burst(inst, t, 0.09, 0.045, { type: "bandpass", from: 1200, to: 4200, q: 0.8 });
  burst(inst, t + 0.05, 0.07, 0.03, { type: "highpass", from: 2500, to: 5000, q: 0.7 });
}

/** Arriving at a station: one tram bell, bright, with a hum beneath. */
export function playArrive(): void {
  const inst = play();
  if (!inst) return;
  strike(inst, noteHz("A5"), inst.ctx.currentTime, { attack: 0.003, decay: 0.09 }, 0.08, BELL_PARTIALS);
}

/** Leaving a station: the two descending tones of "Abfahrt". */
export function playDepart(): void {
  const inst = play();
  if (inst) score(inst, CUES.depart);
}

/** A kept streak: a warm triad rolled quickly. */
export function playStreak(): void {
  const inst = play();
  if (inst) score(inst, CUES.streak);
}

/**
 * Reserved for genuine milestones only — like the yellow. The one cue
 * allowed to breathe: four ascending notes, dry to the master and wet
 * to the hall at the same time, so the chime rings on after the bars
 * have stopped.
 */
export function playMilestone(): void {
  const inst = play();
  if (!inst) return;
  score(inst, CUES.milestone);
  const send = inst.ctx.createGain();
  send.gain.value = 0.5;
  send.connect(inst.hall);
  score(inst, CUES.milestone, send);
}
