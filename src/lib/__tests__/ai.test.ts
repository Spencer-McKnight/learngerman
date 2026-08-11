import { describe, expect, it } from "vitest";
import { aiCacheKey } from "../ai";

describe("aiCacheKey", () => {
  it("is stable for identical parts", () => {
    expect(aiCacheKey("model", "system", "prompt")).toBe(
      aiCacheKey("model", "system", "prompt"),
    );
  });

  it("differs when any part changes", () => {
    expect(aiCacheKey("model", "system", "prompt a")).not.toBe(
      aiCacheKey("model", "system", "prompt b"),
    );
  });

  it("keeps part boundaries distinct", () => {
    expect(aiCacheKey("ab", "c")).not.toBe(aiCacheKey("a", "bc"));
  });
});
