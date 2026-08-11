/**
 * Subtle interface sounds, synthesised with WebAudio — no asset files,
 * a few milliseconds each, always quiet. The palette is deliberately
 * small: a tick for correct, a soft low note for wrong (information,
 * never punishment), a tiny tap, and one warm chord reserved for
 * genuine milestones, mirroring the Ortsschild-yellow rule.
 */

const PREF_KEY = "lg:sound";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) !== "off";
}

export function setSoundEnabled(on: boolean): void {
  window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
}

function note(
  audio: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = "sine",
): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCorrect(): void {
  if (!soundEnabled()) return;
  const audio = context();
  if (!audio) return;
  const t = audio.currentTime;
  note(audio, 880, t, 0.09, 0.05);
  note(audio, 1318.5, t + 0.07, 0.14, 0.04);
}

export function playWrong(): void {
  if (!soundEnabled()) return;
  const audio = context();
  if (!audio) return;
  note(audio, 233, audio.currentTime, 0.16, 0.04, "triangle");
}

export function playTap(): void {
  if (!soundEnabled()) return;
  const audio = context();
  if (!audio) return;
  note(audio, 660, audio.currentTime, 0.04, 0.025);
}

/** Reserved for genuine milestones only — like the yellow. */
export function playMilestone(): void {
  if (!soundEnabled()) return;
  const audio = context();
  if (!audio) return;
  const t = audio.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
    note(audio, frequency, t + i * 0.09, 0.5, 0.045);
  });
}
