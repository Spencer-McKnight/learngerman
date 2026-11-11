# Learn German — "Linie"

A story-driven German course that an engine adapts and a teacher supplements.
You arrive in Erlangen with no German; the course is a map of transit **lines**,
every **station** a hand-authored lesson from your new life there (the
Bäckerei, the flat, the Bergkirchweih). Your teacher, **Jule Hartmann**, briefs
you before every scene and debriefs you honestly after. Real neural voices,
tap-to-gloss, spaced repetition hidden inside the scenes, grammar gated by what
you can already produce, ear training, a speaking ramp from shadowing to free
conversation.

Method, progression and design research live at the repo root
(`custom-teaching-methodology.md`, `milestones-in-progression.md`,
`gamification-strategy.md`, `technology.md`); the v5.5 product contract in
`docs/v5-architecture.md`; the design system in `docs/design-system.md`;
running decisions in `agent-memory.md`.

## How it is built

| Layer | Where | What it owns |
|---|---|---|
| Curriculum | `src/lib/curriculum/` | 5 lines, 28 stations: scripted scenes, vocabulary, checks, speaking material, performances, Jule's notes. Enforced by `curriculum.test.ts` (≥ 95 % coverage, every taught word appears, …). |
| Engine | `src/lib/engine/` | FSRS-6 cards, per-skill Elo, Pienemann syntax staircase, HVPT ear mastery, speaking rungs, the coverage contract, `composeLesson` (the nine-beat station ritual). |
| Tutor | `src/lib/tutor/`, `/api/coach`, `/api/scene`, `/api/converse` | Jule's persona; learner signals → key performances; personalised brief/debrief; scene variations on replays; in-character conversation. Works without a key (hand-written fallbacks). |
| Audio | `src/lib/audio/`, `/api/tts` | Edge neural voices (cast per character), word boundaries for karaoke, Storage cache, one synthesised instrument for every cue. |
| Surfaces | `src/app/` | `/` the line map, `/station/[id]` the player, `/weg` honest progress, `/du` settings, `/willkommen` placement. |

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**; installable PWA via **Serwist**
- **Supabase** — Postgres (RLS on every table), Auth (cookie-based via `@supabase/ssr`), Storage (`tts` bucket)
- **ts-fsrs** (FSRS-6), **Vercel AI SDK + AI Gateway** (model is a config string), **msedge-tts**

## Development

```bash
pnpm install
cp .env.example .env   # then fill in keys
pnpm dev               # Turbopack dev server
pnpm test              # vitest (engine, curriculum contract, tutor, audio)
pnpm lint
pnpm build             # production build (webpack — required by Serwist)
```

Service connectivity: `/api/health`.

## Database

Migrations live in `supabase/migrations/`; the project is linked via the Supabase CLI:

```bash
supabase db push --include-all   # applies tts_cache + lesson_progress for v5.5
supabase migration list
```
