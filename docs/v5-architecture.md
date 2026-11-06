# Learn German v5.5 — "Linie"

The jump from v1 (one AI-generated episode per session, browser-synth voices,
beep feedback) to v5.5: a **structured, story-driven course** that an engine
adapts and a named teacher supplements. This document is the contract every
module is built against. The research files at the repo root still hold the
*why*; this holds the *what*.

## The concept in one breath

You arrive in Erlangen with a suitcase and no German. The course is a map of
transit **lines**; every **station** is a lesson with a scripted scene from your
new life (the Bäckerei, the flat, the Bergkirchweih). Your teacher, **Jule
Hartmann**, meets you at every station: she briefs you on what to listen for,
watches how you perform, and tells you honestly what to work on. Between
stations, the engine quietly schedules reviews, gates grammar by what you can
already produce, trains your ear, and climbs your speaking ramp. Every voice
you hear is a real neural voice. Every sound is part of one small instrument.

## Three layers, three owners

| Layer | Owns | Never does |
|---|---|---|
| **Curriculum** (`src/lib/curriculum/`) | hand-authored lines, stations, scenes, objectives, performances, vocabulary introduced per station | call the model, read learner state |
| **Engine** (`src/lib/engine/`) | FSRS, Elo, syntax staircase, ear mastery, speaking rungs, coverage contract, `composeLesson` | author content, call the model |
| **Tutor** (`src/lib/tutor/` + `/api/coach*`) | Jule's persona; personalised briefings/debriefs that name **key performances**; scene variations and free conversation under the coverage contract | invent curriculum; replace the scripted scene on a first visit |

The app works end to end **with no AI key**: every station ships with its
scripted scene, hand-written briefing and debrief. The model makes it personal,
never possible.

## The station ritual (what one lesson is)

Every station runs the same nine beats; the engine decides which optional
beats appear and how long they run (`composeLesson`). Fixed order, always.

| # | Beat | Kind | Source | Optional? |
|---|---|---|---|---|
| 1 | **Ankunft** — Jule's briefing: objective (a can-do), what to listen for, 1–2 key performances | `arrive` | lesson.brief, personalised by tutor when available | no |
| 2 | **Szene** — listen + read the scene; each character a distinct voice; karaoke highlight; tap-to-gloss; replay at street speed | `scene` | lesson.scene (variation from tutor on replays) | no |
| 3 | **Verstehen** — 2–4 comprehension checks | `understand` | lesson.checks | no |
| 4 | **Wörter** — retrieval taps: station vocabulary + due reviews | `words` | lesson.vocabulary + engine due words | no |
| 5 | **Baustein** — one-screen grammar bite + drill | `grammar` | engine (`nextGrammarBite`, must match lesson.grammar when set) | yes |
| 6 | **Sprechen** — shadow → construct → scripted role-play as "Du" | `speak` | lesson.scene lines + lesson.construct; rung from engine | no (sub-kind varies) |
| 7 | **Ohr** — HVPT minimal pairs | `ear` | engine (`nextContrast`), lesson may pin a contrast | yes |
| 8 | **Leistung** — the proof of the can-do (a short task the learner performs) | `perform` | lesson.performance; tutor acts as counterpart when rung allows | no |
| 9 | **Abfahrt** — honest debrief, what to watch next time, next station preview | `depart` | lesson.debrief, personalised by tutor | no |

Detours from the home screen reuse beats: **Wiederholen** (4), **Ohr** (7),
**Sprechen** (6), **Gespräch** (free conversation, rung-gated).

## Progression

- Stations unlock in order within a line; a line unlocks when the previous
  line's stations are all **passed** (performance ≥ "good"). Replaying a passed
  station is always allowed and serves a scene *variation*.
- `lesson_progress` (new table) stores per-station status: `unseen` →
  `started` → `passed` (+ best performance grade, visits, last_visited).
- Engine tracks stay exactly as before (words, skills, syntax, ear, grammar,
  rung). Milestones (Ortsschild) stay reserved for genuine ability events; a
  *line completed* is added as a milestone kind.
- Placement is unchanged in substance (probe + C-test + production) but now
  also suggests a **starting station** (`placement.ts: suggestStart`).

## Adaptive composition (`composeLesson`)

Input: `Lesson`, `LearnerSnapshot`, lexicon index, options (mode, minutes,
briefingLang). Output: `LessonPlan` = ordered `StepSpec[]` + budgets +
`sceneSpec` (for a variation) + briefing data. Rules carried over:
reviews live inside the scene where possible (due words that appear in the
scene are credited by the scene step); one new difficulty dimension at a
time (bite ⇒ halve new-word budget); flow-channel filter on production
extras; rung gating; ear contrast blocked-then-interleaved.

## Audio

- `src/lib/audio/tts.ts` → `speak(text, { voice, rate })` returns
  `{ play(), stop(), boundaries }`; audio comes from `POST /api/tts`
  (Microsoft Edge neural voices via `msedge-tts`), cached forever in the
  Supabase Storage bucket `tts` keyed by sha256(voice|rate|text). Browser
  `speechSynthesis` is the last-resort fallback only.
- Voices: `src/lib/audio/voices.ts` maps **characters** → neural voices
  (Jule = de-DE-SeraphinaMultilingualNeural; narrator = KatjaNeural; men =
  ConradNeural/KillianNeural/FlorianMultilingualNeural; women = AmalaNeural…).
  HVPT rotates ≥4 voices.
- Sound palette `src/lib/audio/sound.ts`: one instrument ("Glockenspiel &
  Straßenbahn"), synthesised, with envelopes/filters/reverb. Cues: tap,
  correct, wrong, reveal (word gloss), step (beat change), arrive (station),
  depart, milestone (reserved). Respect the sound preference and reduced
  motion.

## Design system — "Wegweiser"

Documented in `docs/design-system.md`; tokens in `src/app/globals.css`;
primitives in `src/components/ui/`. Identity: German signage modern — DIN
display (Barlow), humanist body (Inter), porcelain ground, traffic blue,
reserved Ortsschild yellow, gender colours as feedback. Non-functional
requirements are part of the system: WCAG AA both themes, 44px targets, focus
visible, reduced motion, no colour-only meaning, one-hand mobile reach,
offline shell, no layout shift, ≤ 200 ms perceived response to a tap.

## Routes

- `/` — **Linie**: the line map (lines → stations), today's station, streak, detours
- `/station/[id]` — the lesson player (nine beats)
- `/weg` — honest progress (unchanged metrics, new stations/lines)
- `/du` — settings
- `/willkommen` — placement
- `/api/lesson` (POST compose, PATCH complete), `/api/review`, `/api/progress`,
  `/api/placement`, `/api/tts`, `/api/coach` (brief/debrief), `/api/scene`
  (variation), `/api/converse`, `/api/health`

Removed: `/session` and `/api/session` and `/api/episode` (superseded).
