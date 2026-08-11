import { describe, expect, it } from "vitest";
import { buildIndex, analyzeCoverage, nextNewLexemes, resolveToken } from "../lexicon/coverage";
import { tokenize } from "../lexicon/tokenize";
import { SEED_LEXICON } from "../lexicon/seed";

const index = buildIndex(SEED_LEXICON);

describe("tokenize", () => {
  it("expands spoken contractions and fusions", () => {
    expect(tokenize("Gibt's Kaffee im Haus?")).toEqual([
      "gibt", "es", "kaffee", "in", "dem", "haus",
    ]);
  });
  it("drops punctuation and keeps umlauts", () => {
    expect(tokenize("Schön, oder?")).toEqual(["schön", "oder"]);
  });
});

describe("lexicon index", () => {
  it("has unique ids and ascending-usable ranks", () => {
    const ids = new Set(SEED_LEXICON.map((lexeme) => lexeme.id));
    expect(ids.size).toBe(SEED_LEXICON.length);
  });
  it("resolves inflected forms to their lemma", () => {
    expect(resolveToken("trinke", index).lexemeId).toBe("trinken:V");
    expect(resolveToken("häuser", index).lexemeId).toBe("Haus:N");
  });
  it("credits compounds by their head noun", () => {
    const { lexemeId, compoundOf } = resolveToken("kaffeehaus", index);
    expect(lexemeId).toBeNull();
    expect(compoundOf).toBe("Haus:N");
  });
});

describe("analyzeCoverage", () => {
  it("computes coverage against a known set", () => {
    const known = new Set(["ich:PRON", "trinken:V", "Kaffee:N"]);
    const report = analyzeCoverage("Ich trinke Kaffee. Ich trinke Wasser.", known, index);
    expect(report.tokens).toBe(6);
    expect(report.knownTokens).toBe(5);
    expect(report.coverage).toBeCloseTo(5 / 6);
    expect(report.unknownInLexicon).toContain("Wasser:N");
  });
  it("reports out-of-lexicon tokens separately", () => {
    const known = new Set(["ich:PRON"]);
    const report = analyzeCoverage("Ich Quixotherium", known, index);
    expect(report.outOfLexicon).toEqual(["quixotherium"]);
  });
});

describe("nextNewLexemes", () => {
  it("walks straight down the frequency dictionary", () => {
    const known = new Set([SEED_LEXICON[0].id]);
    const next = nextNewLexemes(known, index, 3);
    expect(next.map((lexeme) => lexeme.rank)).toEqual(
      index.ordered
        .filter((lexeme) => lexeme.id !== SEED_LEXICON[0].id)
        .slice(0, 3)
        .map((lexeme) => lexeme.rank),
    );
  });
});
