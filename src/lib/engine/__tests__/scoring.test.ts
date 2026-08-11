import { describe, expect, it } from "vitest";
import { editDistance, scoreSentence, scoreTyped } from "../scoring/text";
import { scoreSpeech } from "../scoring/speech";

describe("scoreTyped", () => {
  it("exact answers are correct; fast ones are Easy", () => {
    expect(scoreTyped("Kaffee", "Kaffee").grade).toBe(3);
    expect(scoreTyped("Kaffee", "Kaffee", { latencyMs: 2000 }).grade).toBe(4);
  });
  it("umlaut keyboard fallbacks are never errors", () => {
    expect(scoreTyped("schoen", "schön").verdict).toBe("correct");
    expect(scoreTyped("Strasse", "Straße").verdict).toBe("correct");
  });
  it("one slip is a typo (Hard), not a failure", () => {
    const score = scoreTyped("Kaffe", "Kaffee");
    expect(score.verdict).toBe("typo");
    expect(score.grade).toBe(2);
  });
  it("wrong answers grade Again", () => {
    expect(scoreTyped("Tee", "Kaffee").grade).toBe(1);
  });
  it("accepts any of several expected forms", () => {
    expect(scoreTyped("trinke", ["trinke", "trinkst"]).verdict).toBe("correct");
  });
});

describe("scoreSentence", () => {
  it("full match with order", () => {
    const score = scoreSentence("Heute trinke ich Kaffee", "Heute trinke ich Kaffee.");
    expect(score.accuracy).toBe(1);
    expect(score.orderCorrect).toBe(true);
  });
  it("flags wrong word order even when content matches", () => {
    const score = scoreSentence("Heute ich trinke Kaffee", "Heute trinke ich Kaffee");
    expect(score.accuracy).toBe(1);
    expect(score.orderCorrect).toBe(false);
  });
  it("reports missing and extra words", () => {
    const score = scoreSentence("Ich trinke", "Ich trinke Kaffee");
    expect(score.missing).toEqual(["kaffee"]);
    expect(score.accuracy).toBeCloseTo(2 / 3);
  });
});

describe("scoreSpeech (word-level WER, honestly)", () => {
  it("perfect shadowing is great", () => {
    const score = scoreSpeech("ich stehe um sieben auf", "Ich stehe um sieben auf.");
    expect(score.verdict).toBe("great");
    expect(score.wordAccuracy).toBe(1);
  });
  it("STT near-misses are tolerated per token", () => {
    const score = scoreSpeech("ich stehe um sieben auch", "Ich stehe um sieben auf.");
    expect(score.wordAccuracy).toBeCloseTo(4 / 5);
    expect(score.verdict).toBe("good");
  });
  it("mostly-missed targets say retry, never a fake score", () => {
    const score = scoreSpeech("äh", "Ich stehe um sieben auf.");
    expect(score.verdict).toBe("retry");
    expect(score.grade).toBe(1);
  });
});

describe("editDistance", () => {
  it("counts transpositions as one edit", () => {
    expect(editDistance("kaffee", "kafefe")).toBe(1);
  });
});
