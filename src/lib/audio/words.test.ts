import { describe, expect, it } from "vitest";
import { activeTokenIndex, normaliseWord, tokenizeText, wordIndexAtChar } from "./words";

const text = "Guten Morgen – ich hätte gern ein Brötchen.";

describe("tokenizeText", () => {
  it("keeps whitespace and skips bare punctuation when counting words", () => {
    const tokens = tokenizeText(text);
    expect(tokens.map((token) => token.text).join("")).toBe(text);
    const words = tokens.filter((token) => token.wordIndex >= 0).map((token) => token.text);
    expect(words).toEqual(["Guten", "Morgen", "ich", "hätte", "gern", "ein", "Brötchen."]);
    expect(tokens.find((token) => token.text === "–")?.wordIndex).toBe(-1);
  });
});

describe("activeTokenIndex", () => {
  const tokens = tokenizeText(text);

  it("matches by content, ignoring punctuation", () => {
    const i = activeTokenIndex(tokens, { word: "Brötchen", offsetMs: 0, durationMs: 0, index: 6 });
    expect(tokens[i].text).toBe("Brötchen.");
  });

  it("uses the index to pick between repeated words", () => {
    const repeated = tokenizeText("ja ja ja");
    const second = activeTokenIndex(repeated, { word: "ja", offsetMs: 0, durationMs: 0, index: 1 });
    expect(second).toBe(2);
  });

  it("falls back to the word at the boundary's index", () => {
    const i = activeTokenIndex(tokens, { word: "xyz", offsetMs: 0, durationMs: 0, index: 2 });
    expect(tokens[i].text).toBe("ich");
    expect(activeTokenIndex(tokens, null)).toBe(-1);
  });

  it("survives a split compound", () => {
    const compound = tokenizeText("die U-Bahn kommt");
    const first = activeTokenIndex(compound, { word: "U", offsetMs: 0, durationMs: 0, index: 1 });
    const second = activeTokenIndex(compound, { word: "Bahn", offsetMs: 0, durationMs: 0, index: 2 });
    expect(compound[first].text).toBe("U-Bahn");
    expect(compound[second].text).toBe("U-Bahn");
  });
});

describe("helpers", () => {
  it("normalises words", () => {
    expect(normaliseWord("Brötchen.")).toBe("brötchen");
    expect(normaliseWord("–")).toBe("");
  });

  it("finds the word at a character offset", () => {
    const tokens = tokenizeText(text);
    expect(wordIndexAtChar(tokens, 0)).toBe(0);
    expect(wordIndexAtChar(tokens, 7)).toBe(1);
    expect(wordIndexAtChar(tokens, text.length - 1)).toBe(6);
  });
});
