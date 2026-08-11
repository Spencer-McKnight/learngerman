# The Learning Engine

How Learn German actually decides what to teach, when, and how it knows it worked. This is the algorithmic spine built from the four research files; code lives in `src/lib/engine/` (pure TypeScript, fully tested — persistence and LLM calls stay at the edges).

## The journey in one paragraph

A new learner takes a **three-minute placement** (yes/no vocabulary probe + optional C-test + syntax probe) that seeds an honest starting state. From then on, every day the **session composer** reads their state and weaves a ~12-minute session: a micro-story at ~95% known words that *quietly contains today's due reviews*, retrieval taps for a few new words, a shadowing clip, a grammar bite exactly when they're developmentally ready, minimal-pair ear training, and a speaking task at their current rung. Every interaction updates **FSRS memory cards**, **per-skill ability ratings**, **syntax-stage evidence** and **ear mastery** — so placement never ends, it just becomes invisible. Milestones fire only when ability genuinely grew.

## The state model (what the app knows about you)

| Track | State | Algorithm |
|---|---|---|
| Vocabulary | one FSRS-6 card per lexeme | `ts-fsrs`, retention 0.9 (`scheduler/`) |
| Ability | logit rating per skill (reading, listening, writing, speaking, grammar) | Birdbrain-lite Elo (`ability/`) |
| Syntax | stabilised Pienemann stage 1–5 + rolling production evidence | staircase detectors (`syntax/`) |
| Grammar | status per one-screen bite | gated curriculum (`grammar/`) |
| Ear | per-contrast accuracy windows | HVPT mastery (`ear/`) |
| Speaking | rung: shadowing → construct → scripted → timed recall → free conversation | rung promotion rule (`session/composer.ts`) |
| Input | minutes of German understood | input-hours track |

All of it lives in per-user RLS tables (`supabase/migrations/20260810160000_learning_engine.sql`); the lexicon itself ships as precomputed TypeScript (298-lemma seed now, 5k pipeline later, same shape).

## The core loop, precisely

1. **Compose** (`composeSession`): due FSRS cards become the story's target words — *reviews live inside content*. New-word budget is workload-aware (big due pile ⇒ zero new words) and **halved when a grammar bite is served** — one new difficulty dimension at a time. Every candidate production task is priced in logit units (`itemDifficulty`) and dropped if predicted success < 60%; the aim is the 80–90% flow channel.
2. **Generate** (`/api/generate`): each content task carries a `GenerationSpec` — allowed lemmas (everything known), required targets (due + new), syntax ceiling, register. The LLM output is **validated against the coverage contract** (`validateGenerated`): unknown words or missing targets trigger one repair re-prompt; failing twice, the task is skipped. Incomprehensible content is never served.
3. **Score** (`scoring/`): typed answers get Damerau–Levenshtein grading (umlaut fallbacks free, one slip = typo = Hard, not failure); constructed sentences get token-alignment + word-order checks; speech gets word-level WER from the STT transcript — **never invented phoneme scores**.
4. **Apply** (`applyOutcome`): one pure state transition folds any outcome into cards, ratings, stage evidence, ear windows and input minutes. `/api/review` wraps it, persists, and detects milestone crossings.

## Progression gates (all mastery, never time)

- **Syntax stage climbs** only when the *next* stage shows ≥8/10 recent successful productions across ≥3 distinct days — and stages cannot be skipped, matching the 100%-fit acquisition order.
- **Grammar bites unlock** by stage + dependency, in the case order Nom → Akk → Dat (Genitiv nowhere near the early curriculum), gender taught as the suffix system.
- **Speaking rungs promote** on ≥80% success over the last 10 attempts *and* an ability floor — nobody is pushed up before the rung below feels easy.
- **Ear contrasts master** at ≥90% over a 12-item window with ≥16 total items; new contrasts stay blocked until the current one has traction.
- **CEFR estimate** triangulates three independent signals (vocab size, mean ability, syntax stage) and is always shown as a range whose width is the signals' disagreement.

## Use cases → engine paths

- **Day one:** `GET/POST /api/placement` → probe scored with pseudoword false-alarm correction (saying yes to everything lands you at ~zero), FSRS cards pre-seeded with frequency-proportional stability — a prior real reviews recalibrate within days.
- **Daily session:** `POST /api/session` → plan; client renders taps/bites/ear drills directly and calls `/api/generate` for content tasks; every result goes to `POST /api/review`.
- **Conversation (top rung):** `conversationReplySchema` keeps the AI inside known vocabulary, weaves due words in, and returns at most one gentle inline correction per turn.
- **Progress screen:** `progressSummary` — known words with what they buy ("~91% of everyday speech"), CEFR range, stage, contrasts, input minutes. Nothing else exists to show.

## Deliberately deferred

Per-user FSRS parameter optimisation (needs ~1k logged reviews — the `review_events` log is already collecting them), difficulty calibration from aggregate logs, TTS caching pipeline, full 5k lexicon build, and all UI.
