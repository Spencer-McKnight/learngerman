/**
 * High-variability phonetic training (HVPT meta-analysis: g ≈ 0.92 for
 * multi-talker perception training; identification beats discrimination).
 * Two-button "which word did you hear?" drills over German minimal
 * pairs, rotated across different TTS voices, with honest per-contrast
 * mastery ("you can now reliably hear Kirche vs Kirsche").
 */

import type { EarContrastState } from "../types";

export interface MinimalPair {
  a: string;
  b: string;
}

export interface Contrast {
  id: string;
  label: string;
  /** What the learner is told they're training, in plain words. */
  description: string;
  pairs: MinimalPair[];
}

export const CONTRASTS: Contrast[] = [
  {
    id: "u-ue",
    label: "u vs ü",
    description: "Hearing the rounded front ü against plain u",
    pairs: [
      { a: "Mutter", b: "Mütter" },
      { a: "musste", b: "müsste" },
      { a: "drucken", b: "drücken" },
      { a: "Stuck", b: "Stück" },
      { a: "schwul", b: "schwül" },
      { a: "Bruder", b: "Brüder" },
    ],
  },
  {
    id: "o-oe",
    label: "o vs ö",
    description: "Hearing ö against plain o",
    pairs: [
      { a: "schon", b: "schön" },
      { a: "konnte", b: "könnte" },
      { a: "Ofen", b: "Öfen" },
      { a: "losen", b: "lösen" },
      { a: "Sohne", b: "Söhne" },
    ],
  },
  {
    id: "ch-sch",
    label: "ch vs sch",
    description: "The soft ich-sound against sch",
    pairs: [
      { a: "Kirche", b: "Kirsche" },
      { a: "wichen", b: "wischen" },
      { a: "Löcher", b: "Löscher" },
      { a: "keuchen", b: "keuschen" },
      { a: "Fichte", b: "fischte" },
    ],
  },
  {
    id: "a-long-short",
    label: "long vs short a",
    description: "Vowel length: Stadt against Staat",
    pairs: [
      { a: "Stadt", b: "Staat" },
      { a: "Bann", b: "Bahn" },
      { a: "Kamm", b: "kam" },
      { a: "Schall", b: "Schal" },
      { a: "Wall", b: "Wahl" },
    ],
  },
  {
    id: "i-long-short",
    label: "long vs short i",
    description: "Vowel length: Mitte against Miete",
    pairs: [
      { a: "Mitte", b: "Miete" },
      { a: "bitten", b: "bieten" },
      { a: "still", b: "Stiel" },
      { a: "Ritt", b: "riet" },
      { a: "wissen", b: "Wiesen" },
    ],
  },
  {
    id: "e-ae",
    label: "long e vs ä",
    description: "Hearing long e against open ä",
    pairs: [
      { a: "Beeren", b: "Bären" },
      { a: "Ehre", b: "Ähre" },
      { a: "sehen", b: "säen" },
      { a: "Feder", b: "Fäden" },
    ],
  },
];

/** de-DE neural voices rotated for talker variability (edge-tts). */
export const HVPT_VOICES = [
  "de-DE-KatjaNeural",
  "de-DE-ConradNeural",
  "de-DE-AmalaNeural",
  "de-DE-KillianNeural",
];

const WINDOW = 12;
const MASTERY_ACCURACY = 0.9;
const MIN_SEEN = 16;

export function emptyContrastState(contrastId: string): EarContrastState {
  return { contrastId, seen: 0, correct: 0, window: [], mastered: false };
}

/** Record one identification outcome (pure). Mastery sticks once won. */
export function recordEarOutcome(
  state: EarContrastState,
  correct: boolean,
): EarContrastState {
  const window = [...state.window.slice(-(WINDOW - 1)), correct];
  const accuracy = window.filter(Boolean).length / window.length;
  return {
    contrastId: state.contrastId,
    seen: state.seen + 1,
    correct: state.correct + (correct ? 1 : 0),
    window,
    mastered:
      state.mastered ||
      (state.seen + 1 >= MIN_SEEN && window.length >= WINDOW && accuracy >= MASTERY_ACCURACY),
  };
}

/**
 * Which contrast to train next: unmastered, worst recent accuracy
 * first; brand-new contrasts start after the first has some traction
 * (blocked before interleaved — methodology #10).
 */
export function nextContrast(states: EarContrastState[]): Contrast | null {
  const byId = new Map(states.map((state) => [state.contrastId, state]));
  const unmastered = CONTRASTS.filter((contrast) => !byId.get(contrast.id)?.mastered);
  if (unmastered.length === 0) return null;
  const started = unmastered.filter((contrast) => (byId.get(contrast.id)?.seen ?? 0) > 0);
  if (started.length === 0) return unmastered[0];
  started.sort((a, b) => recentAccuracy(byId.get(a.id)) - recentAccuracy(byId.get(b.id)));
  const worst = byId.get(started[0].id);
  // Introduce a fresh contrast only once the current worst is ≥70%.
  if (worst && recentAccuracy(worst) >= 0.7 && started.length < unmastered.length) {
    return unmastered.find((contrast) => (byId.get(contrast.id)?.seen ?? 0) === 0) ?? started[0];
  }
  return started[0];
}

function recentAccuracy(state: EarContrastState | undefined): number {
  if (!state || state.window.length === 0) return 0;
  return state.window.filter(Boolean).length / state.window.length;
}

/** Build one drill: pairs sampled round-robin, voices rotated. */
export function buildEarDrill(
  contrast: Contrast,
  count = 6,
  seed = Date.now(),
): { pair: MinimalPair; play: "a" | "b"; voice: string }[] {
  const drill: { pair: MinimalPair; play: "a" | "b"; voice: string }[] = [];
  for (let i = 0; i < count; i++) {
    const pair = contrast.pairs[(seed + i) % contrast.pairs.length];
    drill.push({
      pair,
      play: (seed + i * 7) % 2 === 0 ? "a" : "b",
      voice: HVPT_VOICES[(seed + i) % HVPT_VOICES.length],
    });
  }
  return drill;
}
