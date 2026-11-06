import { describe, expect, it } from "vitest";
import {
  BELL_PARTIALS,
  CUE_BUDGET_MS,
  CUES,
  cueLengthMs,
  envelopeAt,
  envelopeLength,
  GLOCKENSPIEL_PARTIALS,
  impulseResponse,
  MILESTONE_BUDGET_MS,
  midiToHz,
  normalisePartials,
  noteHz,
  PEAK_GAIN,
  whiteNoise,
} from "./synth";

describe("note tables", () => {
  it("tunes to A4 = 440", () => {
    expect(midiToHz(69)).toBe(440);
    expect(noteHz("A4")).toBe(440);
    expect(noteHz("A5")).toBeCloseTo(880);
    expect(noteHz("C5")).toBeCloseTo(523.25, 1);
    expect(noteHz("F#4")).toBeCloseTo(369.99, 1);
    expect(noteHz("Bb3")).toBeCloseTo(233.08, 1);
  });

  it("rejects things that are not notes", () => {
    expect(() => noteHz("H5")).toThrow();
    expect(() => noteHz("C")).toThrow();
  });
});

describe("partials", () => {
  it("sum to the requested peak, never above the palette ceiling", () => {
    const scaled = normalisePartials(GLOCKENSPIEL_PARTIALS, 0.05);
    const sum = scaled.reduce((total, partial) => total + partial.amplitude, 0);
    expect(sum).toBeCloseTo(0.05);
    const hot = normalisePartials(BELL_PARTIALS, 0.5);
    const hotSum = hot.reduce((total, partial) => total + partial.amplitude, 0);
    expect(hotSum).toBeCloseTo(PEAK_GAIN);
  });

  it("keep their inharmonic ratios", () => {
    const scaled = normalisePartials(GLOCKENSPIEL_PARTIALS, 0.1);
    expect(scaled.map((partial) => partial.ratio)).toEqual([1, 2.76, 5.4, 8.93]);
  });
});

describe("envelope", () => {
  const envelope = { attack: 0.005, decay: 0.1 };

  it("is silent before the strike, peaks at the end of the attack and decays", () => {
    expect(envelopeAt(-1, envelope)).toBe(0);
    expect(envelopeAt(0, envelope)).toBe(0);
    expect(envelopeAt(0.0025, envelope)).toBeCloseTo(0.5);
    expect(envelopeAt(0.005, envelope)).toBeCloseTo(1);
    expect(envelopeAt(0.105, envelope)).toBeCloseTo(Math.E ** -1);
  });

  it("is audible until the tail falls below -60 dB", () => {
    const length = envelopeLength(envelope);
    expect(envelopeAt(length, envelope)).toBeCloseTo(0.001, 4);
  });
});

describe("cue budget", () => {
  it("keeps every cue under 700 ms and the milestone under 2 s", () => {
    for (const [name, cue] of Object.entries(CUES)) {
      const budget = name === "milestone" ? MILESTONE_BUDGET_MS : CUE_BUDGET_MS;
      expect(cueLengthMs(cue), name).toBeLessThanOrEqual(budget);
    }
  });

  it("never asks for more than the peak gain", () => {
    for (const cue of Object.values(CUES)) {
      for (const strike of cue.strikes) expect(strike.gain).toBeLessThanOrEqual(PEAK_GAIN);
    }
  });
});

describe("procedural buffers", () => {
  const seeded = () => {
    let state = 42;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  };

  it("white noise stays within [-1, 1] and is deterministic under a seeded RNG", () => {
    const a = whiteNoise(256, seeded());
    const b = whiteNoise(256, seeded());
    expect(a).toEqual(b);
    for (const sample of a) expect(Math.abs(sample)).toBeLessThanOrEqual(1);
  });

  it("impulse response has the requested length and a -60 dB tail at the decay time", () => {
    const sampleRate = 8000;
    const ir = impulseResponse(sampleRate, 1, 0.5, seeded());
    expect(ir.length).toBe(sampleRate);
    const tail = ir.subarray(sampleRate * 0.5, sampleRate * 0.5 + 200);
    const peakTail = Math.max(...Array.from(tail, Math.abs));
    expect(peakTail).toBeLessThanOrEqual(0.001);
    expect(peakTail).toBeGreaterThan(0);
  });
});
