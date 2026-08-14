/**
 * Hand-written episodes served when generation is unavailable (no AI
 * key, gateway outage, or content that failed the coverage contract
 * on every attempt). Written entirely inside the seed lexicon so every
 * word is tappable, and shaped exactly like generated episodes — the
 * session must never dead-end on "no usable text".
 */

import type { Episode, EpisodeSpec } from "./episode";

const BAECKEREI: Episode = {
  title: "Morgens in der Bäckerei",
  titleEn: "Morning at the bakery",
  settingEn: "Early morning in Erlangen — you're new in town, hungry, and the bakery around the corner smells wonderful.",
  story: [
    { de: "Es ist früh am Morgen.", en: "It's early in the morning." },
    { de: "Du bist neu in Erlangen.", en: "You're new in Erlangen." },
    { de: "Du hast Hunger und gehst in die Bäckerei.", en: "You're hungry and you walk to the bakery." },
    { de: "Die Bäckerei ist klein, aber sehr schön.", en: "The bakery is small, but very lovely." },
    { de: "Eine Frau arbeitet hier.", en: "A woman works here." },
  ],
  dialogue: [
    { speaker: "Frau Weber", de: "Guten Morgen! Was darf es sein?", en: "Good morning! What can I get you?" },
    { speaker: "Du", de: "Hallo! Zwei Brötchen, bitte.", en: "Hello! Two rolls, please." },
    { speaker: "Frau Weber", de: "Gern. Möchtest du auch einen Kaffee?", en: "Happily. Would you also like a coffee?" },
    { speaker: "Du", de: "Ja, bitte. Was kostet das?", en: "Yes, please. How much is that?" },
    { speaker: "Frau Weber", de: "Drei Euro zwanzig.", en: "Three euros twenty." },
    { speaker: "Du", de: "Hier, bitte. Danke!", en: "Here you go. Thanks!" },
    { speaker: "Frau Weber", de: "Danke, tschüss! Bis morgen!", en: "Thanks, bye! See you tomorrow!" },
  ],
  glosses: [
    { de: "Brötchen", en: "bread roll(s)" },
    { de: "Bäckerei", en: "bakery" },
    { de: "Hunger", en: "hunger" },
    { de: "kostet", en: "costs" },
  ],
  cloze: [
    {
      sentence: "Du hast ___ und gehst in die Bäckerei.",
      answer: "Hunger",
      lexemeId: "Hunger:N",
      hintEn: "what you feel before breakfast",
    },
    {
      sentence: "Zwei ___, bitte.",
      answer: "Brötchen",
      lexemeId: "Brötchen:N",
      hintEn: "bread rolls",
    },
    {
      sentence: "Was ___ das?",
      answer: "kostet",
      lexemeId: "kosten:V",
      hintEn: "asking the price",
    },
  ],
  construct: [
    {
      promptEn: "I would like a coffee, please.",
      targetDe: "Ich möchte einen Kaffee, bitte.",
      alternatives: ["Einen Kaffee, bitte.", "Ich möchte bitte einen Kaffee."],
    },
    {
      promptEn: "How much is that?",
      targetDe: "Was kostet das?",
      alternatives: ["Wie viel kostet das?"],
    },
    {
      promptEn: "See you tomorrow!",
      targetDe: "Bis morgen!",
      alternatives: [],
    },
  ],
  shadow: [
    { de: "Guten Morgen! Was darf es sein?", en: "Good morning! What can I get you?" },
    { de: "Zwei Brötchen, bitte.", en: "Two rolls, please." },
    { de: "Was kostet das?", en: "How much is that?" },
  ],
  opener: {
    de: "Guten Morgen! Was isst du gern am Morgen?",
    en: "Good morning! What do you like to eat in the morning?",
  },
  recapEn: "You bought fresh rolls and a coffee at the bakery — your first small win of the day in Erlangen.",
};

const SUPERMARKT: Episode = {
  title: "Im Supermarkt",
  titleEn: "At the supermarket",
  settingEn: "Your kitchen is empty. Time to face the big supermarket on the edge of town — and maybe ask someone for help.",
  story: [
    { de: "Heute gehst du in den Supermarkt.", en: "Today you're going to the supermarket." },
    { de: "Du brauchst Brot, Milch und Äpfel.", en: "You need bread, milk and apples." },
    { de: "Der Supermarkt ist sehr groß.", en: "The supermarket is very big." },
    { de: "Du suchst die Milch, aber wo ist sie?", en: "You're looking for the milk — but where is it?" },
  ],
  dialogue: [
    { speaker: "Du", de: "Entschuldigung, wo finde ich die Milch?", en: "Excuse me, where do I find the milk?" },
    { speaker: "Herr Braun", de: "Da, neben dem Brot.", en: "Over there, next to the bread." },
    { speaker: "Du", de: "Ah, danke. Und was kosten die Äpfel?", en: "Ah, thanks. And how much are the apples?" },
    { speaker: "Herr Braun", de: "Zwei Euro. Sie sind neu und sehr gut.", en: "Two euros. They're fresh and very good." },
    { speaker: "Du", de: "Super, dann nehme ich vier.", en: "Great, then I'll take four." },
    { speaker: "Herr Braun", de: "Gern. Brauchst du noch etwas?", en: "Sure. Do you need anything else?" },
    { speaker: "Du", de: "Nein, danke. Das ist alles.", en: "No, thanks. That's everything." },
  ],
  glosses: [
    { de: "Äpfel", en: "apples" },
    { de: "Milch", en: "milk" },
    { de: "Entschuldigung", en: "excuse me" },
  ],
  cloze: [
    {
      sentence: "Entschuldigung, wo ___ ich die Milch?",
      answer: "finde",
      lexemeId: "finden:V",
      hintEn: "to locate something",
    },
    {
      sentence: "Du brauchst Brot, ___ und Äpfel.",
      answer: "Milch",
      lexemeId: "Milch:N",
      hintEn: "white, goes in coffee",
    },
    {
      sentence: "Super, dann ___ ich vier.",
      answer: "nehme",
      lexemeId: "nehmen:V",
      hintEn: "to take",
    },
  ],
  construct: [
    {
      promptEn: "Excuse me, where do I find the bread?",
      targetDe: "Entschuldigung, wo finde ich das Brot?",
      alternatives: ["Wo finde ich das Brot?"],
    },
    {
      promptEn: "I need milk and apples.",
      targetDe: "Ich brauche Milch und Äpfel.",
      alternatives: [],
    },
    {
      promptEn: "That's all, thanks.",
      targetDe: "Das ist alles, danke.",
      alternatives: ["Das ist alles."],
    },
  ],
  shadow: [
    { de: "Wo finde ich die Milch?", en: "Where do I find the milk?" },
    { de: "Dann nehme ich vier.", en: "Then I'll take four." },
    { de: "Das ist alles, danke.", en: "That's everything, thanks." },
  ],
  opener: {
    de: "Hallo! Was kaufst du gern im Supermarkt?",
    en: "Hello! What do you like buying at the supermarket?",
  },
  recapEn: "You found everything on your list — and asked a stranger for help in German for the first time.",
};

const BAHNHOF: Episode = {
  title: "Am Bahnhof",
  titleEn: "At the train station",
  settingEn: "Evening at Erlangen station. The train to Nürnberg is late — and the woman waiting next to you starts talking.",
  story: [
    { de: "Es ist Abend am Bahnhof in Erlangen.", en: "It's evening at the station in Erlangen." },
    { de: "Du wartest auf den Zug nach Nürnberg.", en: "You're waiting for the train to Nürnberg." },
    { de: "Der Zug kommt heute spät.", en: "The train is late today." },
    { de: "Eine Frau wartet auch und sieht müde aus.", en: "A woman is waiting too, and she looks tired." },
  ],
  dialogue: [
    { speaker: "Frau Keller", de: "Entschuldigung, wartest du auch auf den Zug nach Nürnberg?", en: "Excuse me, are you also waiting for the train to Nürnberg?" },
    { speaker: "Du", de: "Ja, genau. Er kommt heute spät.", en: "Yes, exactly. It's late today." },
    { speaker: "Frau Keller", de: "Ja, das ist echt schlecht. Woher kommst du?", en: "Yeah, that's really annoying. Where are you from?" },
    { speaker: "Du", de: "Ich komme aus Australien. Ich wohne jetzt hier in Erlangen.", en: "I'm from Australia. I live here in Erlangen now." },
    { speaker: "Frau Keller", de: "Toll! Und wie findest du die Stadt?", en: "Great! And how do you like the town?" },
    { speaker: "Du", de: "Ich finde sie sehr schön. Die Leute hier sind super.", en: "I think it's beautiful. The people here are great." },
    { speaker: "Frau Keller", de: "Guck, da kommt der Zug!", en: "Look, there's the train!" },
  ],
  glosses: [
    { de: "Bahnhof", en: "train station" },
    { de: "Zug", en: "train" },
    { de: "müde", en: "tired" },
  ],
  cloze: [
    {
      sentence: "Du wartest auf den ___ nach Nürnberg.",
      answer: "Zug",
      lexemeId: "Zug:N",
      hintEn: "it runs on rails",
    },
    {
      sentence: "Der Zug kommt heute ___.",
      answer: "spät",
      lexemeId: "spät:ADV",
      hintEn: "the opposite of early",
    },
    {
      sentence: "Wie ___ du die Stadt?",
      answer: "findest",
      lexemeId: "finden:V",
      hintEn: "asking for an opinion",
    },
  ],
  construct: [
    {
      promptEn: "I'm waiting for the train.",
      targetDe: "Ich warte auf den Zug.",
      alternatives: [],
    },
    {
      promptEn: "I live in Erlangen now.",
      targetDe: "Ich wohne jetzt in Erlangen.",
      alternatives: ["Jetzt wohne ich in Erlangen."],
    },
    {
      promptEn: "I really like the city.",
      targetDe: "Ich finde die Stadt sehr schön.",
      alternatives: ["Die Stadt gefällt mir sehr.", "Ich finde die Stadt echt schön."],
    },
  ],
  shadow: [
    { de: "Er kommt heute spät.", en: "It's late today." },
    { de: "Ich wohne jetzt hier in Erlangen.", en: "I live here in Erlangen now." },
    { de: "Die Leute hier sind super.", en: "The people here are great." },
  ],
  opener: {
    de: "Na, fährst du gern mit dem Zug?",
    en: "So, do you like taking the train?",
  },
  recapEn: "A late train turned into your first real small talk with a stranger — entirely in German.",
};

const EPISODES: Episode[] = [BAECKEREI, SUPERMARKT, BAHNHOF];

/**
 * Pick the best-fitting curated episode: syntax stage first (later
 * scenes use structures beginners haven't met), then topic rotation
 * so back-to-back fallbacks don't repeat.
 */
export function fallbackEpisode(spec: EpisodeSpec): Episode {
  if (spec.stage >= 3) return BAHNHOF;
  if (spec.stage === 2) return SUPERMARKT;
  const seed = spec.topic.length + spec.allowedLemmas.length;
  return EPISODES[seed % 2 === 0 ? 0 : 1];
}
