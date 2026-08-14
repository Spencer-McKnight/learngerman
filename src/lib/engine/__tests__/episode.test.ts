import { describe, expect, it } from "vitest";
import { buildIndex } from "../lexicon/coverage";
import { SEED_LEXICON } from "../lexicon/seed";
import {
  buildEpisodePrompt,
  sceneLineFor,
  usableClozeItems,
  validateEpisode,
  type Episode,
  type EpisodeSpec,
} from "../session/episode";
import { fallbackEpisode } from "../session/fallback-episodes";

const index = buildIndex(SEED_LEXICON);

const KNOWN = [
  "ich:PRON", "sein:V", "du:PRON", "der:DET", "nicht:ADV", "es:PRON", "und:CONJ",
  "ein:DET", "in:PREP", "haben:V", "was:PRON", "gut:ADJ", "trinken:V", "Kaffee:N",
  "heute:ADV", "gern:ADV", "hallo:INTJ", "bitte:INTJ", "danke:INTJ", "morgen:ADV",
  "gehen:V", "kommen:V", "hier:ADV", "sehr:ADV", "auch:ADV", "ja:INTJ", "zwei:NUM",
];

function spec(overrides: Partial<EpisodeSpec> = {}): EpisodeSpec {
  return {
    allowedLemmas: KNOWN,
    targetLemmas: ["Kaffee:N"],
    newLemmas: [],
    clozeLemmas: ["Kaffee:N"],
    stage: 1,
    coverageTarget: 0.95,
    register: "neutral",
    topic: "morgens in der Bäckerei",
    storySentences: 4,
    dialogueTurns: 6,
    constructCount: 2,
    ...overrides,
  };
}

function tinyEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    title: "Kaffee am Morgen",
    titleEn: "Coffee in the morning",
    settingEn: "A quiet morning.",
    story: [
      { de: "Es ist Morgen.", en: "It's morning." },
      { de: "Du trinkst heute gern Kaffee.", en: "You like drinking coffee today." },
    ],
    dialogue: [
      { speaker: "Anna", de: "Hallo! Kommst du?", en: "Hello! Are you coming?" },
      { speaker: "Du", de: "Ja, gern.", en: "Yes, gladly." },
      { speaker: "Anna", de: "Gut. Der Kaffee hier ist sehr gut.", en: "Good. The coffee here is very good." },
      { speaker: "Du", de: "Danke!", en: "Thanks!" },
    ],
    glosses: [{ de: "Kaffee", en: "coffee" }],
    cloze: [
      { sentence: "Du trinkst heute gern ___.", answer: "Kaffee", lexemeId: "Kaffee:N", hintEn: "a hot drink" },
    ],
    construct: [
      { promptEn: "Yes, gladly.", targetDe: "Ja, gern.", alternatives: [] },
    ],
    shadow: [
      { de: "Ja, gern.", en: "Yes, gladly." },
      { de: "Danke!", en: "Thanks!" },
    ],
    opener: { de: "Trinkst du gern Kaffee?", en: "Do you like drinking coffee?" },
    recapEn: "You had a coffee.",
    ...overrides,
  };
}

describe("episode prompt", () => {
  it("leads with the sorted allowed list and names every section need", () => {
    const { system, prompt } = buildEpisodePrompt(spec(), index);
    expect(system).toContain("ONE scene");
    expect(prompt.startsWith("Allowed words:")).toBe(true);
    expect(prompt).toContain("Bäckerei");
    expect(prompt).toContain("Cloze items");
    // Same spec twice → byte-identical prompt (provider prompt cache).
    expect(buildEpisodePrompt(spec(), index).prompt).toBe(prompt);
  });
});

describe("episode validation — the coverage contract", () => {
  it("passes a scene inside the contract", () => {
    expect(validateEpisode(tinyEpisode(), spec(), index)).toEqual([]);
  });

  it("flags missing targets and blown coverage", () => {
    const bad = tinyEpisode({
      story: [
        { de: "Ich besuche wunderbare Restaurants und bestelle exquisite Speisen.", en: "…" },
        { de: "Anschließend flaniere ich durch prachtvolle Boulevards.", en: "…" },
      ],
      dialogue: [
        { speaker: "Anna", de: "Welch vorzügliches Etablissement!", en: "…" },
        { speaker: "Du", de: "Wahrlich exquisit!", en: "…" },
        { speaker: "Anna", de: "Vortrefflich gesprochen!", en: "…" },
        { speaker: "Du", de: "Gewiss doch!", en: "…" },
      ],
    });
    const issues = validateEpisode(bad, spec(), index);
    expect(issues.some((issue) => issue.kind === "missing-target")).toBe(true);
    expect(issues.some((issue) => issue.kind === "coverage")).toBe(true);
    // The lenient acceptance floor still refuses something this far out.
    expect(validateEpisode(bad, spec(), index, { strict: false }).length).toBeGreaterThan(0);
  });

  it("flags malformed cloze items strictly but tolerates them leniently", () => {
    const noBlank = tinyEpisode({
      cloze: [{ sentence: "Du trinkst heute gern Kaffee.", answer: "Kaffee", lexemeId: "Kaffee:N", hintEn: "…" }],
    });
    expect(validateEpisode(noBlank, spec(), index).some((issue) => issue.section === "cloze")).toBe(true);
  });
});

describe("episode helpers", () => {
  it("filters cloze items to scheduled, well-formed ones", () => {
    const episode = tinyEpisode({
      cloze: [
        { sentence: "Du trinkst heute gern ___.", answer: "Kaffee", lexemeId: "Kaffee:N", hintEn: "…" },
        { sentence: "Kein Blank hier.", answer: "hier", lexemeId: "hier:ADV", hintEn: "…" },
      ],
    });
    const usable = usableClozeItems(episode, ["Kaffee:N"], index);
    expect(usable).toHaveLength(1);
    expect(usable[0].lexemeId).toBe("Kaffee:N");
  });

  it("finds the scene line that carries a word", () => {
    const line = sceneLineFor(tinyEpisode(), "Kaffee:N", index);
    expect(line?.de).toContain("Kaffee");
  });
});

describe("fallback episodes", () => {
  it("always returns a stage-appropriate, contract-shaped scene", () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      const episode = fallbackEpisode(spec({ stage }));
      expect(episode.story.length).toBeGreaterThanOrEqual(3);
      expect(episode.dialogue.length).toBeGreaterThanOrEqual(4);
      expect(episode.shadow.length).toBeGreaterThanOrEqual(2);
      expect(episode.cloze.length).toBeGreaterThanOrEqual(2);
      expect(episode.opener.de.length).toBeGreaterThan(0);
      // Every cloze item must be gradeable against the seed lexicon.
      const usable = usableClozeItems(episode, [], index);
      expect(usable.length).toBe(episode.cloze.length);
    }
  });

  it("stays essentially inside the seed lexicon (tap-to-gloss works everywhere)", () => {
    const episode = fallbackEpisode(spec({ stage: 1 }));
    const wide = spec({ allowedLemmas: SEED_LEXICON.map((lexeme) => lexeme.id), targetLemmas: [], clozeLemmas: [] });
    expect(validateEpisode(episode, wide, index, { strict: false })).toEqual([]);
  });
});
