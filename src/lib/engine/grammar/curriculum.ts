/**
 * Grammar bites — short explicit explanations as garnish, not the meal
 * (methodology #8): one English screen, delivered exactly when the
 * learner is developmentally ready (staircase stage + case track
 * order Nom → Akk → Dat → Gen much later), then practised in German.
 */

import type { GrammarBiteStatus, GrammarState, SyntaxStage } from "../types";

export interface GrammarBite {
  id: string;
  title: string;
  titleDe: string;
  /** Learner must have stabilised this stage (bites teach stage + 1). */
  stageRequired: SyntaxStage | 0;
  /** Bites that must be at least "practising" first. */
  deps: string[];
  /** The one-screen English explanation, ≤ ~80 words. */
  summary: string;
  /** What the follow-up drill asks the learner to construct. */
  drillFocus: string;
}

/**
 * Ordered curriculum. Order within equal gating = teaching order.
 * Gender is taught as a suffix system with colour-coded articles
 * (methodology #7); cases follow attested acquisition order.
 */
export const CURRICULUM: GrammarBite[] = [
  {
    id: "articles-as-units",
    title: "Words come with their article",
    titleDe: "der, die, das",
    stageRequired: 0,
    deps: [],
    summary:
      "German nouns have a gender you can't always guess from meaning, so learn every noun WITH its article as one word: das Haus, never just Haus. The app colours them consistently — der blue, die red, das green — and the colour arrives as feedback after you answer, so your memory does the work.",
    drillFocus: "pick the article for known nouns; colour arrives as feedback",
  },
  {
    id: "sein-haben-present",
    title: "The two anchor verbs",
    titleDe: "sein & haben",
    stageRequired: 0,
    deps: [],
    summary:
      "sein (to be) and haben (to have) carry half of everyday German. ich bin / du bist / er ist — ich habe / du hast / er hat. They are irregular because they are ancient; every language keeps its oldest verbs strange.",
    drillFocus: "construct short ich/du/er sentences with bin/bist/ist, habe/hast/hat",
  },
  {
    id: "svo-basics",
    title: "Building your first sentences",
    titleDe: "Ich trinke Kaffee",
    stageRequired: 0,
    deps: ["sein-haben-present"],
    summary:
      "Start every sentence the way English does: who — does — what. Ich trinke Kaffee. Du wohnst hier. Verb endings change with the person: ich trinke, du trinkst, er trinkt. That -e / -st / -t pattern works for almost every verb.",
    drillFocus: "construct SVO sentences, matching verb endings to the subject",
  },
  {
    id: "negation-nicht-kein",
    title: "Saying no, twice",
    titleDe: "nicht & kein",
    stageRequired: 1,
    deps: ["svo-basics"],
    summary:
      "Two ways to negate: kein replaces ein before a noun (Ich habe kein Auto), nicht negates everything else and usually comes late in the sentence (Ich arbeite heute nicht). If you could say 'a/an' there, use kein.",
    drillFocus: "choose nicht vs kein and place it",
  },
  {
    id: "gender-endings",
    title: "Gender is (often) spelled out",
    titleDe: "-ung, -heit, -chen …",
    stageRequired: 1,
    deps: ["articles-as-units"],
    summary:
      "Noun endings predict gender with near-100% reliability: -ung, -heit, -keit, -ion, -tät → die; -chen, -lein → das; -er (people) → der. Compounds take the LAST noun's gender: das Haus → das Kaffeehaus. When in doubt, der is the best statistical guess.",
    drillFocus: "predict articles for new nouns from their endings",
  },
  {
    id: "plural-patterns",
    title: "Plurals come in families",
    titleDe: "die im Plural",
    stageRequired: 1,
    deps: ["articles-as-units"],
    summary:
      "Every plural takes die, whatever the singular gender. The endings come in a few families (-e, -en, -er, -s, umlaut) and arrive word by word — notice them, don't memorise tables. die Tage, die Frauen, die Häuser.",
    drillFocus: "produce plurals of known nouns",
  },
  {
    id: "fronting-time",
    title: "Time can go first",
    titleDe: "Heute …",
    stageRequired: 1,
    deps: ["svo-basics"],
    summary:
      "German loves starting with when: Heute trinke ich Kaffee. Notice what happened — the verb stayed in second position, so ich slipped behind it. For now just recognise the pattern in what you read; producing it smoothly comes soon.",
    drillFocus: "recognise fronted-time sentences; begin producing them",
  },
  {
    id: "akkusativ-den",
    title: "The object changes one word",
    titleDe: "der → den",
    stageRequired: 2,
    deps: ["svo-basics", "articles-as-units"],
    summary:
      "When a der-word is the thing acted on, der becomes den: Der Kaffee ist gut, but Ich trinke den Kaffee. That's the whole Akkusativ for now — die and das don't change. ein becomes einen the same way.",
    drillFocus: "construct sentences choosing der/den, ein/einen",
  },
  {
    id: "modal-verbs-bracket",
    title: "Wanting, needing, being able",
    titleDe: "kann, muss, will",
    stageRequired: 2,
    deps: ["svo-basics"],
    summary:
      "Modal verbs open a bracket: the modal sits in position two, the other verb waits at the very end as an infinitive. Ich kann heute nicht kommen. Ich will Deutsch lernen. Feel that bracket — most of German grammar lives inside it.",
    drillFocus: "construct modal-bracket sentences",
  },
  {
    id: "separable-verbs",
    title: "Verbs that split",
    titleDe: "auf|stehen",
    stageRequired: 2,
    deps: ["modal-verbs-bracket"],
    summary:
      "Many verbs carry a detachable prefix. In a main clause the prefix flies to the end: aufstehen → Ich stehe um sieben auf. It's the same bracket you know from modals. The prefix changes the meaning, often drastically: kommen (come), ankommen (arrive), mitkommen (come along).",
    drillFocus: "construct main clauses with separable verbs, particle last",
  },
  {
    id: "perfekt-haben",
    title: "Talking about yesterday",
    titleDe: "Ich habe … gemacht",
    stageRequired: 3,
    deps: ["modal-verbs-bracket"],
    summary:
      "Spoken German uses the Perfekt for the past: haben in position two, the ge- participle at the end. Ich habe Kaffee getrunken. Was hast du gestern gemacht? Same bracket as modals — position two plus the end.",
    drillFocus: "construct Perfekt sentences with haben",
  },
  {
    id: "perfekt-sein",
    title: "Movement takes sein",
    titleDe: "Ich bin gegangen",
    stageRequired: 3,
    deps: ["perfekt-haben"],
    summary:
      "Verbs of movement or change build their past with sein instead of haben: Ich bin nach Hause gegangen. Er ist um acht aufgestanden. If the verb moves you from A to B (or changes your state), reach for bin/bist/ist.",
    drillFocus: "choose haben vs sein in Perfekt constructions",
  },
  {
    id: "inversion",
    title: "The verb owns second place",
    titleDe: "Heute stehe ich früh auf",
    stageRequired: 3,
    deps: ["fronting-time", "separable-verbs"],
    summary:
      "Whatever opens the sentence — heute, dann, leider — the verb refuses to leave position two, so the subject steps behind it: Heute stehe ich früh auf. This is THE German word-order rule. You've been reading it for weeks; now it's yours to produce.",
    drillFocus: "construct fronted sentences with correct inversion",
  },
  {
    id: "questions",
    title: "Questions flip the verb forward",
    titleDe: "Wo wohnst du?",
    stageRequired: 3,
    deps: ["inversion"],
    summary:
      "W-questions put the question word first and the verb second: Wo wohnst du? Was machst du? Yes/no questions start with the verb itself: Trinkst du Kaffee? Kommst du mit? Same second-position logic you already own.",
    drillFocus: "construct W- and yes/no questions",
  },
  {
    id: "dativ-intro",
    title: "The receiving case",
    titleDe: "dem, der, dem",
    stageRequired: 4,
    deps: ["akkusativ-den"],
    summary:
      "The Dativ marks the receiver or location: der/das → dem, die → der. Ich helfe dem Mann. Das Buch liegt auf dem Tisch. A few verbs always take Dativ (helfen, danken, gefallen) and some prepositions always do (mit, bei, von, zu, aus, nach, seit).",
    drillFocus: "choose Dativ forms after Dativ verbs and prepositions",
  },
  {
    id: "weil-dass",
    title: "The verb goes to the end",
    titleDe: "…, weil ich früh aufstehe",
    stageRequired: 4,
    deps: ["inversion"],
    summary:
      "weil, dass, wenn open a subordinate clause, and the verb walks all the way to the end: Ich bin müde, weil ich früh aufstehe. Separable verbs snap back together there: … weil ich um sieben aufstehe. Master this and German word order holds no more secrets.",
    drillFocus: "construct weil/dass/wenn clauses with verb-final order",
  },
  {
    id: "modal-particles",
    title: "The flavour words",
    titleDe: "halt, doch, mal",
    stageRequired: 4,
    deps: [],
    summary:
      "halt, doch, mal, eben, schon don't translate — they carry tone. Komm mal her (casual nudge). Das ist halt so (resigned shrug). Das stimmt doch! (pushback). You've heard them in every clip; they're what makes German sound like a person, not a textbook.",
    drillFocus: "match particles to the tone of short audio snippets",
  },
];

/**
 * The next bite this learner is ready for, honouring stage gates,
 * dependency order and what they've already settled. Returns null when
 * nothing new is ready — sessions then simply carry no grammar bite.
 */
export function nextGrammarBite(
  state: GrammarState,
  stage: SyntaxStage,
): GrammarBite | null {
  const active = (status: GrammarBiteStatus | undefined) =>
    status === "practising" || status === "settled" || status === "seen";
  for (const bite of CURRICULUM) {
    const status = state.bites[bite.id];
    if (status === "settled" || status === "practising" || status === "seen") continue;
    if (bite.stageRequired > stage) continue;
    if (!bite.deps.every((dep) => active(state.bites[dep]))) continue;
    return bite;
  }
  return null;
}

/** Bites currently in "practising" — the composer keeps drilling them. */
export function practisingBites(state: GrammarState): string[] {
  return Object.entries(state.bites)
    .filter(([, status]) => status === "practising" || status === "seen")
    .map(([id]) => id);
}
