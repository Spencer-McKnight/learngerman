# Milestones in Progression

How Learn German discovers where a learner is, decides what comes next, and communicates progress honestly. Progression here is **mastery-gated, never time-gated**: things unlock because ability grew, and ability is measured by what the learner can *produce*, not what they can click.

## Discovering the level

The app never asks "are you beginner, intermediate or advanced?" — self-assessment is known to be unreliable. Instead:

1. **A three-minute vocabulary probe (first session).** A LexTALE-style yes/no lexical decision test ("is this a real German word you know?") gives a proficiency estimate that beats self-rating, in about 3 minutes. A German version exists and is widely used in psycholinguistics (https://www.lextale.com/whatislextale.html).
2. **A C-test for refinement.** Short gapped paragraphs — the format of onSET, the validated rapid German placement test used by universities (https://www.onset.de/en/language-placement-test-english-onset/). Cheap to build, CEFR-mappable, done in minutes.
3. **Syntax stage probes.** Which German word-order structures does the learner actually produce? (See the staircase below.) A few construct-the-sentence tasks reveal the current stage precisely.
4. **Then, forever: continuous re-estimation.** Duolingo's Birdbrain model shows the way — jointly estimate item difficulty and learner ability from every single interaction, and always serve tasks with roughly 80–90% predicted success. Placement is not an event; it's a running state.

## The progression backbone

Progress runs on several tracks at once. Milestones are honest points on these tracks, not arbitrary level numbers.

**Vocabulary track** (frequency-ordered lemmas, per Nation's coverage research — https://www.lextutor.ca/cover/papers/nation_2006.pdf):
- ~500 words — you can survive politeness, shops, and introductions
- ~1,000 words — most simple exchanges become possible
- ~2,000 words — the richest-scaffolding zone ends; real content opens up
- ~3,000 word families — **~95% of everyday conversation and TV understood**; the conversational threshold
- ~5,000 lemmas — most average texts largely covered; the full frequency dictionary absorbed

**Syntax staircase** (Processability Theory — fixed, unskippable, 100% fit in classroom studies; https://en.wikipedia.org/wiki/Processability_theory):
1. Basic sentences (SVO): *Ich trinke Kaffee.*
2. Fronting: *Heute trinke ich… (starts as "Heute ich trinke")*
3. Separable verbs: *Ich stehe um sieben auf.*
4. Verb-second inversion: *Heute stehe ich früh auf.*
5. Verb-final subordinate clauses: *…, weil ich früh aufstehe.*

Each stage a learner stabilises is a genuine milestone — and gates which grammar the app teaches next.

**Case track** (matching the attested acquisition order): Nominativ → Akkusativ → Dativ → Genitiv much later. Case errors are tolerated far longer than textbooks tolerate them, because that's how acquisition actually proceeds.

**CEFR bands** (anchored to Goethe-Institut's guided-hour estimates — https://www.goethe.de/ins/de/en/uun/dln.html):
- A1 ≈ 60–150 cumulative hours — concrete everyday phrases
- A2 ≈ 150–260 — routine exchanges about familiar things
- B1 ≈ 260–490 — handle most travel/daily situations, express opinions
- B2 ≈ 450–600 — comfortable with native speakers, most media
- C1 ≈ 800–1,000+ — effortless, flexible, nuanced

Content roughly doubles per level; the app should show these bands so expectations stay honest. Dreaming Spanish's input-hour milestones (~50/150/300/600/1000/1500 h — https://www.dreaming.com/faq) are a useful second yardstick for the listening track.

**Skills ramp (speaking):** shadowing from day one → construct-before-reveal sentence building → scripted dialogues → timed recall drills → free AI conversation. Each rung is a milestone; nobody is pushed up a rung before the one below feels easy.

**Ear track:** high-variability minimal-pair training (ü/u, ö/o, ch/sch, long/short vowels) with per-contrast mastery — "you can now reliably hear Kirche vs Kirsche" is a real, celebratable milestone most apps never even measure.

**Register track (the colloquial thread):** understanding your first modal particle in the wild (*halt*, *doch*, *mal*), following a street-speed clip without slowdown, understanding a joke. These map to the app's promise of real Erlangen German, not textbook German.

## How progress is shown

Only numbers that mean something outside the app:
- **Known words** (with what that buys: "you now know words covering ~91% of everyday speech")
- **Estimated CEFR band**, shown as a range with confidence, never false precision
- **CEFR can-do statements** as checkable milestones ("I can order food and handle small talk while doing it") — the CEFR is literally built from these
- **Syntax stages unlocked**, **contrasts mastered**, **minutes of real German understood**

Never "you are 87% fluent." Never progress bars that fill because time was spent.

## Milestone moments

Genuine milestones deserve genuine celebration (see gamification-strategy.md): crossing a coverage threshold, stabilising a syntax stage, first free conversation, a CEFR band change. A lovely frame for these: German town signs — arriving at each CEFR band like arriving at a new town on the journey deeper into Germany.

## Freedoms deliberately left open

- The exact ability model (simple per-skill Elo, IRT, or Bayesian mastery estimates — anything honest works)
- How placement blends into the first sessions (an explicit "find my level" flow vs. invisibly adaptive first week)
- Whether input-hours are tracked automatically, self-reported, or both
- The narrative/visual dress of milestones — the tracks above are the skeleton, not the costume
