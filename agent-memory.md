# Agent Memory

A running log of decisions and context for agents working on Learn German. Append, don't rewrite history. Keep entries short; deep reasoning lives in the four research files.

## How to use this file

Read this first, then the research files as needed: `custom-teaching-methodology.md` (how we teach, lessons from existing tools), `milestones-in-progression.md` (placement + progression tracks), `gamification-strategy.md` (motivation mechanics, adopt/refuse lists), `technology.md` (stack, fallbacks, visual direction). These are principles, not specs — you have freedom in how you express them.

## Decision log

**2026-08-10 — Research phase complete.** Four research streams (learning science, existing tools, technology, gamification/design) composed into the files above. Settled directions:

- **Core mechanic:** the "coverage engine" — all content served at ~95% known-word coverage per learner; reviews live *inside* generated stories/dialogues rather than as separate flashcard piles. This is the computable form of "just beyond current ability."
- **Scheduling:** FSRS-6 via `ts-fsrs`, defaults first (retention ≈ 0.9), per-user optimisation only after ~1k reviews.
- **Grammar sequencing:** gated by Pienemann's fixed German word-order stages; cases taught Nom → Akk → Dat; gender taught as a suffix system with colour-coded articles.
- **Speaking ramp:** shadowing → construct-before-reveal → scripted dialogue → free AI conversation. No dogmatic silent period, no day-one free conversation.
- **Register:** colloquial modern German (modal particles, contractions, street speed) is a first-class content thread, not an extra.
- **Gamification:** White Hat only — honest competence metrics (known words, CEFR estimate, syntax stages), humane streak (one-lesson bar, free freezes, forgiveness). Refused: leagues, hearts, gem economies, guilt notifications, fake scores.
- **Stack:** Next.js App Router + Supabase (already provisioned; see `.env`) on Vercel Hobby; PWA via Serwist; AI via Vercel AI SDK + AI Gateway (start Gemini free tier, upgrade = change a model string); TTS via edge-tts cached in Supabase Storage (Piper fallback); STT via Web Speech + Groq Whisper; pronunciation scoring only via Azure's real assessment or not at all.
- **Visual direction:** "signage modern" — DIN-flavoured type, traffic-blue primary `#154889`, Ortsschild yellow `#F7C600` reserved for milestones, porcelain ground `#F7F6F3`; gender colours der `#2563EB` / die `#E03131` / das `#2F9E44` used everywhere, always with a second channel, arriving as feedback not as pre-highlighted answers.
- **Doc style:** research files stay succinct, plain-language, and non-restrictive by the user's request.

**2026-08-10 — Stage 1 "Fundament" built (infrastructure + connected services).**

- Next.js 16.3 (App Router, TS, Tailwind 4, src dir) scaffolded into the repo; pnpm is the package manager.
- Supabase project `pkfgjaxyjyvmaubkaere` (eu-central-1) linked via CLI; first migration `20260810130000_profiles.sql` pushed and verified — `profiles` + RLS + auto-create-on-signup trigger. This is the RLS pattern all future tables follow.
- Cookie auth via `@supabase/ssr`: browser/server/admin clients in `src/lib/supabase/`, session refresh in `src/proxy.ts` (Next 16 renamed middleware → proxy; docs live in `node_modules/next/dist/docs/`).
- PWA via Serwist (`src/app/sw.ts`, manifest, placeholder SVG icon). Gotcha: `@serwist/next` is webpack-only, so `build` script is `next build --webpack`; dev stays Turbopack (SW disabled in dev anyway).
- Design tokens from technology.md live in `globals.css` as Tailwind `@theme` values (incl. gender colours); Barlow = display face, Inter = body.
- Live service checks in `src/lib/health.ts`, surfaced at `/api/health` and on the landing page.
- Installed for later stages, not yet used: `ts-fsrs`, `ai` (SDK v7), `zod`.
- Open: `AI_GATEWAY_API_KEY` unset; no Vercel project yet; replace SVG icon with proper PNG/maskable set; Supabase idle-pause keep-alive not yet scheduled.

**2026-08-10 — Stage 2 "Anmeldung" built (auth + persistent sessions).**

- Email/password auth with a single German-first login/signup panel at `/login` (server actions + `useActionState`; optional display name feeds the profiles trigger).
- "Stay signed in": Supabase refresh tokens never expire by default and the proxy refreshes the JWT on every request — login is a rare event by design. No session timebox configured; leave it that way.
- Email confirmations disabled via `supabase config push` (config.toml is now the source of truth for remote auth settings; `site_url` = localhost:3000 — must add the production URL to `additional_redirect_urls` when Vercel exists).
- Whole app gated behind `/login` in the proxy; public exceptions: `/login`, `/auth/*`, `/api/health`.
- `/api/health` status code now only reflects required services (AI Gateway is informational until the tutor lands).
- Live-verified against the real project: instant session on signup, trigger-created profile, RLS isolation (own row only, anonymous sees nothing).

**2026-08-10 — Stage 3 "Veröffentlichung": GitHub + Vercel live.**

- Private repo: https://github.com/Spencer-McKnight/learngerman (git-connected to Vercel, pushes to main auto-deploy production).
- Production: https://learngerman-mauve.vercel.app (project `learngerman`, Hobby plan — non-commercial clause applies). Supabase env vars set in all three Vercel environments; secret key marked sensitive.
- Supabase auth `site_url` now points at production; localhost kept in `additional_redirect_urls` for dev. Remote auth config managed via `supabase config push`.
- Daily Vercel cron hits `/api/health` (03:00 UTC) — doubles as the Supabase free-tier keep-alive (pauses after 7 idle days).
- Verified in production: login gate redirect, /login renders, /api/health ok:true, manifest + service worker served.

**2026-08-10 — Stage 4 "Maschinenraum": the learning engine built.** Full design in `learning-engine.md`; code in `src/lib/engine/` (pure TS, 49 vitest tests), API routes `/api/placement`, `/api/session`, `/api/review`, `/api/generate`.

- **Ability model decided: feature-based Elo** (logit scale shared by learner ratings and item difficulty). Chosen over IRT/Bayesian because item difficulty must be computed from *features* of freshly generated content (new-word count, stage stretch, speed, production, time pressure) — nothing per-item to fit with a handful of users. Target 85% success; K decays with attempts.
- **Placement decided: explicit-but-tiny** — 3-minute yes/no probe (LexTALE scoring, pseudoword false-alarm correction) + optional C-test + syntax productions; seeds FSRS cards with frequency-proportional stability as a *prior*, then Elo/FSRS re-estimation makes placement continuous and invisible.
- **Content strategy decided: LLM-generated under a validated coverage contract.** `GenerationSpec` (allowed lemmas / required targets / stage ceiling / register) → `generateObject` with Zod schemas → `validateGenerated` re-prompts once, then skips. Curated/authentic links can join later as an extra content source; the coverage analyser scores any text.
- Lexicon ships as precomputed TS (`lexicon/seed.ts`, 298 lemmas, forms for inflection lookup, gender/plural/CEFR/register tags); tokeniser expands spoken contractions (gibt's, 'ne) and prep-article fusions (im, zum); compound fallback credits known head nouns. Full 5k pipeline later, same shape.
- Syntax staircase enforced in code: production detectors (SVO / fronting / separable / inversion / verb-final) feed per-stage evidence; stabilisation = 8/10 recent successes across ≥3 days, stages unskippable; `stageConstraints` gives generation a comprehend ceiling of stage+1.
- Speech scored word-level WER only — no fake phoneme scores. Typos (incl. ae/oe/ue/ss fallbacks) never fail a card.
- Session composer encodes: reviews inside stories, workload-aware new-word budget (halved when a grammar bite lands), flow-channel filter for production extras, speaking-rung gating, HVPT blocked-then-interleaved.
- DB: migration `20260810160000_learning_engine.sql` — 9 per-user RLS tables (word_states, skill_states, syntax_states, ear_states, grammar_states, learner_profiles, review_events, sessions, milestone_events). Gotcha: `window` is a Postgres reserved word → column is `outcome_window`.
- `vitest` added (`pnpm test`); vitest.config.ts maps `@/` alias.

## Open questions (for future sessions to resolve)

- Narrative frame details (a newcomer's life in Erlangen is the leading candidate; composer already rotates Erlangen topic seeds)
- Per-user FSRS optimisation batch job once review_events pass ~1k per learner
- Difficulty-weight calibration from aggregated review_events (current weights are research-informed estimates)
