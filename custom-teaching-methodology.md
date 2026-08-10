# Custom Teaching Methodology

This file holds the research-backed method behind Learn German. It is a foundation, not a cage: future development should honour the principles here but stay free in how it expresses them.

## The big idea

Most apps make you review flashcards, then separately read or listen to content that has nothing to do with those cards. Our method fuses them: **the content is the review**.

The app maintains a living model of every word and structure the learner knows (via spaced repetition scheduling) and generates or selects content — micro-stories, dialogues, listening clips, conversation turns — where roughly **95% of the words are already known**. The remaining ~5% is the new material, chosen from a frequency-ordered German lexicon and from words that are due for review. That single number, 95% coverage, is our computable version of Krashen's famous "i+1": always comprehensible, always slightly beyond.

We call this the **coverage engine**. Everything else — grammar sequencing, speaking practice, ear training, gamification — hangs off it.

## Core principles

1. **Input is the engine, but not the whole car.** Comprehensible input should dominate time-on-task, but the modern literature is clear that interaction, output, feedback, and short explicit explanations each add value that pure input doesn't. Build input-heavy, never input-only.

2. **"Just beyond current ability" = ~90–95% known-token coverage.** Because the app tracks every word it has taught, it can compute the exact difficulty of any text or audio for this learner. One unknown word per ~20 is the sweet spot. This is the most load-bearing mechanic in the app.

3. **Vocabulary targets are concrete and surprisingly small.** ~3,000 word families cover ~95% of everyday conversation and TV; ~5,000 lemmas cover most average texts. A frequency-ordered lexicon of ~5,000 German lemmas is the backbone; the first 2,000 deserve the richest scaffolding.

4. **Schedule memory with FSRS, not the 1980s SM-2 algorithm.** FSRS is open source, better calibrated for ~99.6% of users in large benchmarks, and cuts review workload ~20–30% at equal retention. Target ~0.85–0.90 desired retention; use default parameters until a learner has ~1,000 reviews, then optimise per-user.

5. **Flashcards and context are sequential, not rivals.** Introduce a word bare (or with a short collocation) for the fast first form–meaning mapping, then guarantee it reappears inside real content within days. Retention research shows this "meet it, then meet it again in a story" sequence beats either alone.

6. **Respect the fixed German syntax staircase.** Processability Theory research (with a 100% fit in classroom studies) shows learners acquire German word order in an unskippable order: basic SVO → adverb fronting → separable verbs → verb-second inversion → verb-final subordinate clauses. Don't drill *weil*-clauses with someone who hasn't stabilised separable verbs. Which stage a learner produces is also a powerful placement signal.

7. **Teach gender as a system, in colour.** Noun endings like -ung, -heit, -keit, -chen, -ion, -tät are near-100% reliable gender predictors; compounds take the last noun's gender; masculine is the best statistical default. Always present article + noun as one unit (*das Haus*, never *Haus*), colour-coded consistently by gender. Cases go Nominativ → Akkusativ → Dativ (Genitiv much later), matching the attested acquisition order — never the full four-case table at once.

8. **Explicit grammar works — as a garnish.** Meta-analyses show short explicit explanations outperform implicit-only exposure with large, durable effects. One-screen English "grammar bites," delivered exactly when the learner is developmentally ready for the structure (see #6), then practised in German.

9. **Speak early, but ramp the stakes.** Long silent periods aren't well supported; day-one free conversation is intimidating and low-value. The middle path: shadowing (repeat-after-audio) from the start — strong effects on listening and pronunciation, near-zero anxiety — then scripted dialogues, then free AI conversation.

10. **Train the ear deliberately.** High Variability Phonetic Training — minimal-pair identification drills across multiple voices (ü/u, ö/o, ch/sch, Kirche/Kirsche, long/short vowels) — has effect sizes near g ≈ 0.9 and transfers to pronunciation. Almost no app does this. Cheap to build, genuinely differentiating.

11. **Dose difficulty one dimension at a time.** Spacing, retrieval, and interleaving are "desirable difficulties" — but only when the learner can succeed at them. Beginners need blocked practice before interleaving. Never stack a new word + a new structure + fast audio in the same item.

12. **Colloquial German is a feature, not an afterthought.** The modal particles *halt, doch, mal, ja, eben, schon* are what separate textbook German from how adults actually talk in Erlangen — and they're nearly absent from textbooks. Treat them as high-frequency vocabulary taught through authentic audio snippets, not grammar rules. Same for spoken contractions (*hab'*, *'ne*, *gibt's*).

## Research notes — sources and takeaways

**Krashen reassessments (Frontiers in Psychology 2025; ResearchGate 2024 review)**
https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1636777/full
The current consensus: comprehensible input is necessary but not sufficient; interaction, feedback and multimodality matter. *Takeaway: our coverage engine supplies the input; conversation, corrections and grammar bites supply what input alone can't.*

**Dreaming Spanish roadmap** — https://www.dreaming.com/faq
The purest comprehensible-input product: seven levels tied to input-hour milestones (~50/150/300/600/1000/1500 h), speaking recommended from ~600 h. *Takeaway: input-hour milestones are honest and motivating — worth showing — but we deliberately start low-stakes speaking far earlier.*

**Refold** — https://refold.la/explained/
The immersion community's hybrid: a top-2,000-word deck first, then massive input, delayed-but-not-forbidden output. *Takeaway: validates frequency-deck-then-immersion sequencing; their underbuilt "activation" stages are exactly where our AI conversation can be stronger.*

**Open Spaced Repetition benchmark** — https://expertium.github.io/Benchmark.html
FSRS-6 beats SM-2 on ~350M real reviews for 99.6% of users; per-user optimisation needs ~1,000+ reviews. *Takeaway: FSRS with defaults first, per-user optimisation later, is settled.*

**Bjork & Bjork, desirable difficulties** — https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf
Spacing, retrieval, generation, interleaving — but a difficulty is only desirable if the learner can execute it. With Hwang (2025, Language Learning): beginners need blocked practice before interleaving. *Takeaway: the adaptive engine should phase interleaving in, not default to it.*

**Nation (2006) coverage research** — https://www.lextutor.ca/cover/papers/nation_2006.pdf
2,000–3,000 word families → ~95% of speech; 6,000–7,000 → 98%; listening tolerates 95% where reading wants 98%. *Takeaway: gives us the exact coverage thresholds the engine targets, and why listening content can be slightly bolder than reading.*

**Tschirner & Möhring, A Frequency Dictionary of German** — https://www.routledge.com/A-Frequency-Dictionary-of-German-Core-Vocabulary-for-Learners/Tschirner-Mohring/p/book/9781138659780
The 5,000 most frequent German words from a balanced 20M-word corpus. *Takeaway: the natural seed for our lexicon's frequency ordering.*

**van den Broek et al. (2022)** — https://onlinelibrary.wiley.com/doi/full/10.1111/cogs.13135
Words stick better when repeated in story context after initial encoding. *Takeaway: direct evidence for the coverage engine's "reviews live inside stories" design.*

**Swain's output hypothesis** — https://en.wikipedia.org/wiki/Comprehensible_output
Years of input alone left immersion students weak in production; output forces gap-noticing. *Takeaway: production tasks aren't optional polish, they're part of acquisition.*

**Hamada (2016) on shadowing** — https://journals.sagepub.com/doi/abs/10.1177/1362168815597504
Shadowing improves phoneme perception at all levels, listening most for beginners. *Takeaway: shadowing is our low-anxiety on-ramp to speaking.*

**HVPT meta-analysis (SSLA)** — https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6
79 studies; g = 0.92 pre/post for multi-talker perception training; identification beats discrimination. *Takeaway: build two-button "which word did you hear?" drills with varied voices.*

**Processability Theory (Pienemann); Jansen (2008)** — https://en.wikipedia.org/wiki/Processability_theory
Fixed German word-order stages, 100% implicational fit even in classrooms. *Takeaway: our grammar sequencing and part of our placement logic, for free.*

**German case acquisition (Baten 2013 overview)** — https://www.researchgate.net/publication/287461848_The_German_case_system_in_foreign_language_acquisition_A_research_overview
Nominative → accusative → dative; full mastery only at high proficiency. *Takeaway: sequence cases, tolerate case errors long past when textbooks would.*

**Gender-by-ending data (Your Daily German; Elon.io)** — https://yourdailygerman.com/best-way-to-learn-german-gender/
Suffix rules are near-exceptionless; -er/-el/-en only probabilistic. *Takeaway: teach the reliable suffix system explicitly; let the rest come from coloured article-noun exposure.*

**Explicit instruction meta-analyses (Norris & Ortega 2000; Goo et al. 2015)** — https://benjamins.com/catalog/sibil.48.18goo
Explicit beats implicit with effect sizes around 1.0, durable. *Takeaway: keep grammar bites short, explicit, English, and perfectly timed.*

**German modal particles** — https://en.wikipedia.org/wiki/German_modal_particles
halt/doch/mal/ja/eben/schon are ubiquitous in real speech, absent from textbooks. *Takeaway: a dedicated content thread for "how people actually talk" — one of our clearest differentiators.*

## Lessons from existing tools

We researched the tools that demonstrably teach well (and the ones that demonstrably don't). Full per-site notes:

**Duolingo efficacy research** — https://blog.duolingo.com/results-duolingo-efficacy-studies
Their "Birdbrain" model jointly estimates exercise difficulty and learner ability after every single interaction — the industry's best-documented adaptive engine. But their practical ceiling is ~A2, with a persistent recognise-but-can't-produce gap (critique: https://spellings.app/blog/duolingo-effect). *Takeaway: steal the adaptive core — predict the chance of success per exercise, serve items just past the edge — and detach it from shallow multiple-choice exercise types.*

**Anki / FSRS** — https://faqs.ankiweb.net/what-spaced-repetition-algorithm
The engine is unmatched (FSRS-6, trained on ~700M reviews; 85–90% retention is the language-learning sweet spot — 95% roughly doubles workload). A 2026 usability study (https://quantux.telecom-paris.fr/2026/03/02/a-quantative-analysis-of-anki-desktop/) shows its UX jargon burns out everyone but power users. *Takeaway: Anki's engine, never Anki's UX. Hide every knob.*

**Babbel & Pimsleur efficacy studies** — https://assets.ctfassets.net/zuzqvf4m2o58/5eYRgCslJnJBF9yhZKgX01/78b93f75ca40fca6c7b927b6e2e82bf8/Babbel-Efficacy-Study.pdf
Structured explicit dialogue lessons measurably work for beginners (~15 hours ≈ one college semester in the CUNY study). Pimsleur's timed call-and-response builds real spoken reflexes. *Takeaway: recall-under-mild-time-pressure speaking drills are worth borrowing; these studies are also a template for measuring our own app someday.*

**LingQ** — https://www.langoly.com/lingq-review/
Tap-any-word reading with a persistent per-word knowledge state; "known words" as the progress metric. *Takeaway: tap-to-gloss + per-word state is proven and is exactly what our coverage engine needs anyway; known-words is an honest progress number.*

**Clozemaster** — https://www.fluentu.com/blog/reviews/clozemaster/
Blanks the least-frequent word in natural sentences. Cloze-in-context teaches vocab, collocation and grammar at once. *Takeaway: the cloze sentence is our atomic exercise — cheap, generative, and LLMs can produce endless colloquial ones.*

**Seedlang** — https://yourdailygerman.com/seedlang-review-great/
Our closest competitor in spirit: 10,000+ short native-speaker video clips as flashcards, grammar surfacing at the moment of a mistake rather than front-loaded, gender/plural trainers. Weaknesses: self-graded speaking, no adaptive difficulty model, paywall. *Takeaway: video-context cards + just-in-time grammar is the bar to beat; its speaking-feedback gap is our opening.*

**Nicos Weg (Deutsche Welle)** — https://learngerman.dw.com
A free A1–B1 telenovela (~76 episodes per level) proving that a narrative spine — a newcomer's life in Germany — is powerful scaffolding, and that free-to-run is viable. Criticism: theatrically slow dialogue, no speaking. *Takeaway: wrap learning in a story (a newcomer in Erlangen is the natural frame); fill DW's output gap.*

**Easy German** — https://www.easygerman.org/
Street interviews at real speed with dual DE/EN subtitles — the gold standard of authentic colloquial input, and proof of demand for exactly our target register. *Takeaway: authentic-speed audio with dual-subtitle support; their register is our register.*

**Language Transfer** — https://www.languagetransfer.org
The "Thinking Method": Socratic prompts where you construct each sentence yourself before hearing the answer. Learners produce novel sentences in the first hour. *Takeaway: "construct before reveal" is the most efficient early-production mechanic we found — it kills the recognition-only plateau from day one.*

**Refold** — https://refold.la/roadmap/
Sound immersion principles, but it's a philosophy without content — learners burn weeks assembling their own pipeline. *Takeaway: be "Refold with batteries included," and don't delay speaking as dogmatically as they do.*

**Langua (vs Talkpal, Gliglish)** — https://www.unite.ai/languatalk-review/
The consensus best AI conversation app: natural voices with regional accents, gentle inline corrections, and — the standout — words saved mid-conversation become flashcards and get recycled into future conversations. Talkpal shows the failure mode: robotic voices, non-adaptive difficulty, pronunciation scores that praise errors. *Takeaway: close the loop between conversation, errors and review; only ship feedback that is actually reliable — one dishonest score costs all trust.*

**Germany's free public ecosystem** — https://www.nachrichtenleicht.de and https://vhs-lernportal.de
Weekly news in simplified German with audio; free A1–C1 courses used by ~500k learners. *Takeaway: a pipeline of level-appropriate authentic content already exists to link to; "everyday Germany" scenarios (Amt, Arzt, Bäckerei small talk) are a validated content niche.*

### The gap we fill

No existing tool combines all four of: genuinely adaptive sequencing (Duolingo/FSRS-class), authentic colloquial German (Easy German-class), real speaking practice with trustworthy feedback (Langua-class), and free access (DW-class). The free public tools are static with no speaking; the adaptive commercial ones plateau at A2 and monetise anxiety; Seedlang comes closest but lacks an adaptive model. That intersection — where this app lives — is currently empty.

## What a session feels like

A sketch, not a spec. A daily session might weave, in ~10–15 minutes: a warm greeting in German → a micro-story or dialogue generated at 95% coverage that quietly contains today's due words → one or two retrieval taps on the new words → a 60-second shadowing clip → occasionally a one-screen grammar bite the learner just became ready for → a few HVPT ear-training pairs → optionally, a short AI conversation using only known vocabulary. The learner experiences "I understood that, and it was interesting" — the reviews happened invisibly.

## Freedoms deliberately left open

- Exactly how content is generated vs curated (LLM-generated, hand-written seeds, licensed/authentic snippets) — mix freely.
- The precise mastery model (FSRS per word is settled; how structure/grammar mastery is scored is open).
- Topic and mode design (modes, themes, story arcs) — be creative; the engine doesn't care what the content is about, only its coverage.
- How aggressively to personalise coverage (90% for brave learners, 97% for cautious ones) — could even be a user setting.
