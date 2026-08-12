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

**2026-08-11 — Stage 5 "Spielfeld": session player UI + gamified experience layer.**

- Route shape: three calm tab surfaces in a `(tabs)` group — Heute `/` (start + humane streak + detours), Weg `/weg` (progress as journey), Du `/du` (settings) — plus full-screen flows `/willkommen` (placement + if-then anchor) and `/session` (player, `?modus=` for detours).
- **Session modes added to the engine**: `composeSession(…, { mode })` with `review` / `ear` / `speak` detours — filtered from the same plan, zero new words, no grammar bite ("autonomy on a mostly-linear path"). Kinds map in `MODE_KINDS`.
- **Grammar-bite progression gap fixed**: `ReviewOutcome.biteId` now advances seen → practising → settled through `applyOutcome` + a `grammar_states` upsert (before this, nothing ever wrote bite status and the composer would serve the first bite forever).
- Celebration system honours the reserved-yellow rule end to end: MilestoneEvents (and only those) get the Ortsschild sign component + dependency-free canvas confetti + a reserved WebAudio chord. Correct/wrong feedback is a tiny synthesised tick/low note (no audio assets); sound toggle in `/du`, `prefers-reduced-motion` respected.
- **Streak is computed, not stored** (`src/lib/streak.ts`, from `sessions.completed_at`; `PATCH /api/session` marks completion): one session keeps it, a single missed day auto-freezes for free, ≥2 idle days = warm "Willkommen zurück!", never guilt. No counter to defend.
- Audio seams: `speakGerman()` wraps browser speechSynthesis as an honest placeholder — the edge-tts → Storage pipeline later replaces that module's body only. STT via Web Speech where present; every speaking task offers a clearly-labelled self-assessment fallback (never a fake score).
- Gender colours arrive as feedback only: retrieval taps ask meaning, then the article, then colour. `.das-amber` root class (localStorage, `/du` toggle) switches das to amber for red-green CVD.
- New API surface: `GET /api/progress` (progress bundle incl. streak + milestones), `POST /api/converse` (conversation-turn under the coverage contract — the generate route's schema map deliberately excludes it), `PATCH /api/session`. Migration `20260810200000_learner_prefs.sql` adds `learner_profiles.prefs` jsonb (if-then plan); applied remotely.
- Fixed en route: `nextNewLexemes(…, 0)` returned 1 lexeme (break-after-push off-by-one).
- **LLM cost floor**: `src/lib/ai.ts` centralises the gateway model — default `google/gemini-2.5-flash-lite` ($0.10/$0.40 per M, ~6× cheaper output than plain flash; language tasks here don't need more), env-overridable via `AI_MODEL`, gateway options add cost-sorted provider routing, prompt caching and cheap fallbacks (`gpt-5-nano`, `gemini-2.5-flash`). Validated responses are cached in `ai_response_cache` (service-role only, migration `20260811090000`) keyed by sha256(model+prompts) with a warm-instance Map in front — the same spec/transcript never pays for a second model call, and only contract-passing content is ever cached.
- **Prompts are cache-shaped**: the allowed-word list is sorted (de locale) and leads every prompt as a stable prefix — byte-identical across a session's 3–4 calls, so provider prompt caching (`caching: 'auto'`) discounts it; per-task lines and repair-loop feedback append after. System prompts carry only what nothing else enforces (~35 tokens): allowed-only + targets in generation; allowed-only + turn shape in converse. Register/length live in per-task lines, correction rules in the schema describes, coverage/targets in the validator — but the sentence-structure line is prompt-enforced ONLY (validator never checks structure), so never cut it. Converse sends only the last 12 transcript turns. Remaining prompt tokens are ~90% word-list data; the only further cut is switching enumeration → "A1/A2 + delta" description, deferred until repair-rate data exists.
- Gotcha: Next 16's eslint ships the React-compiler hook rules — no setState directly in effect bodies, no ref reads/writes during render, no impure calls (`Date.now`) in render. Pattern used here: per-item grades accumulate in refs (read only in handlers), randomness seeds at module scope, localStorage reads inside a rAF callback.

## Open questions (for future sessions to resolve)

- Narrative frame details (a newcomer's life in Erlangen is the leading candidate; composer already rotates Erlangen topic seeds)
- TTS pre-generation + Supabase Storage caching pipeline (edge-tts) for shadowing/HVPT audio — replaces the body of `src/lib/audio/tts.ts`
- Migration `20260811090000_ai_response_cache.sql` not yet pushed to the linked project (`supabase db push --include-all`); cache reads/writes fail silently until then, so nothing breaks — it just always calls the model
- Per-user FSRS optimisation batch job once review_events pass ~1k per learner
- Difficulty-weight calibration from aggregated review_events (current weights are research-informed estimates)
- Live end-to-end pass through placement → session → milestone on the deployed app (desk-tested only so far); replace the placeholder SVG icon with a proper maskable set

**2026-08-11 — Live end-to-end pass (first real-model run).** Full loop verified in browser with fresh learner: placement (45-item probe + C-test + writing + anchor) → session → streak on Heute → honest progress on Weg. Migration `20260811090000` confirmed applied. Bugs found and fixed en route (all small, honest):

- `retrieval-task.tsx` distractor picker: stride-7 walk over a same-POS pool whose size divides 7 (particles: pool of exactly 7) looped forever and froze the tab the moment a particle retrieval rendered. Now bounded scan, same-POS first, topped up from full lexicon.
- Unhandled gateway errors (rate limits) in `/api/generate` + `/api/converse` returned raw 500s; now caught → same honest 502 "skip" contract the client already renders. Both routes also log contract failures server-side now.
- `stt.ts`: unanswered mic-permission prompt left recognition (and the learner) stuck on "Höre zu …" forever; 15s safety timeout aborts and resolves with whatever was heard.
- Root layout: `translate="no"` — Chrome auto-translate rewrote text nodes mid-session (broke React reconciliation, wedged the player) and would translate away the German itself.
- `package.json` dev script: `next dev --turbopack` (Next 16.3 hard-errors when the Serwist webpack config is present without an explicit bundler flag).

**Model findings (decision owned by user, unchanged):** flash-lite writes natural German and hits required targets, but overruns the closed allowed-vocabulary for `story-read` at beginner size (allowed≈100): 7/7 story attempts failed coverage 76–88% vs the 90% floor. Short `shadowing` (3 sentences) passes, sometimes via the repair loop (`attempt: 2` observed rescuing). Cache verified live: identical spec → 141ms `{ cached: true, attempt: 0 }`. Separate blocker: AI Gateway free tier rate-limits flash-lite after a handful of calls (`GatewayRateLimitError`); configured fallback models did not engage — per current gateway docs `providerOptions.gateway` routing may require the `gateway()` wrapper around the model string, and `sort`/`caching` are not documented options (`order`/`only`/`models`/`user`/`tags`/`cacheControl` are). TTS pipeline (step 3) not started — gated on a healthy tutor loop.

- E2E test learner in remote project: `e2e-1786431431943@learngerman.test` (id `5de60b0e-8857-48a7-9453-71731a0806c5`) — reusable for future passes.

**2026-08-12 — Interface language switch (de/en) + full UI-string abstraction.** The user (a beginner) couldn't understand the German chrome, so every interface string — headings, action words, hints, feedback, error messages — now lives in one typed dictionary: `src/lib/i18n/strings.ts` (`de` defines the shape, `en` is type-checked against it, so the languages can't drift). The German being *learned* (stories, lexemes, dialogue lines, the placement writing prompt) is content, not chrome, and stays German in both modes. Decisions:

- **Source of truth:** `learner_profiles.prefs.uiLang`, mirrored into a `ui-lang` cookie (1yr, lax) so the root layout, login page and API routes render the right language without a DB read. `saveSettings` writes both; `login` re-syncs the cookie from prefs on a fresh device. Missing/invalid cookie ⇒ German (original behaviour).
- **Plumbing:** server components use `getUiStrings()` (`src/lib/i18n/server.ts`); client components use `useStrings()`/`useUiLang()` from `I18nProvider` (mounted in the root layout, which is now async + dynamic — all routes were force-dynamic anyway). The switch sits first in the Du settings form; its option labels ("Deutsch"/"English") are deliberately never translated so a lost beginner can always find the way out.
- **Engine boundary:** `composeSession` takes `briefingLang` (threaded from the cookie by `/api/session`) for its six briefing lines; grammar bites swap `title`/`titleDe` between heading and note per language. Persisted milestone labels (`milestone_events`) stay German — they're Ortsschild signs, and retro-translating stored rows isn't worth it. `VOCAB_MILESTONES` meanings override by count via `t.weg.vocabMeanings`; `CAN_DO` and `STAGE_NAMES` were already English.
- Merged in parallel uncommitted work found on disk (PWA install prompt in settings, new Weg tab icon) and folded its strings into the dictionary; fixed its three lint errors (typed casts, rAF idiom for setState-in-effect).
