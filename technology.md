# Technology

The researched stack for Learn German. Guiding rule: **free-first, with every paid upgrade one config string away**. Everything below fits comfortably in free tiers at few-user scale; nothing locks us in.

## The stack at a glance

- **Platform:** Next.js (App Router) on Vercel Hobby + Supabase (Postgres, Auth, Storage) with cookie-based `@supabase/ssr` auth and row-level security on every table. Serwist for an installable, offline-capable PWA — the mobile-centric answer without app stores.
- **Spaced repetition:** `ts-fsrs` running FSRS-6 defaults (request_retention ≈ 0.9), card state as JSONB per user-item in Postgres. Zero API cost, best-validated scheduler in existence. Per-user parameter optimisation later, once a learner has ~1,000 review logs.
- **Text-to-speech (German audio):** pre-generate with edge-tts (Microsoft's free neural voices — Katja/Conrad de-DE are genuinely good), cache MP3s in Supabase Storage so each sentence is synthesised exactly once. Fallback with a clean licence: Piper + Thorsten voices, runnable in CI for free. In-browser Piper (piper-tts-web) can give offline PWA audio later. Avoid the browser's built-in speechSynthesis for German — iOS quality is unacceptable.
- **Speech recognition:** Web Speech API (`de-DE`) as the instant free mic input on Chrome/Edge/Android; record-and-upload to Groq Whisper (free: 2,000 requests/day) elsewhere and for anything we want to grade properly. For real phoneme-level pronunciation scoring, Azure Pronunciation Assessment — German is GA and the free tier's 5 audio-hours/month is plenty for a few users. Rule from the tools research: only ship pronunciation feedback that's actually reliable.
- **LLM tutor:** Vercel AI SDK (`generateObject` + Zod schemas for exercises that must parse; `useChat` for conversation) behind AI Gateway, so the model is a config string. Start on Gemini Flash's free tier (sufficient for a handful of users; note free-tier data may train Google's models); Groq's free Llama lane for cheap grading. Quality upgrade when wanted: Claude Haiku ($1/$5 per MTok — roughly cents per day at our scale). The tutor generates content constrained to the learner's known-lemma list — this is how the 95%-coverage engine breathes.
- **German language data (one-time offline pipeline):** Python pipeline with spaCy `de_core_news_lg` (lemma, gender, case morphology), CharSplit for compound splitting; vocabulary table = Goethe A1/A2/B1 word lists (level tags) joined with HermitDave's OpenSubtitles de_50k frequency list (colloquial rank — exactly our register). Runtime stays pure TypeScript reading precomputed data; no NLP servers to host.

## Known weak points, with fallbacks

- edge-tts is unofficial → Piper/Thorsten is the licensed safety net.
- Web Speech recognition is missing on Firefox, inconsistent on iOS → the Groq Whisper upload path covers it.
- Supabase free projects pause after 7 idle days → a scheduled keep-alive ping; Pro ($25/mo) if it ever matters.
- Vercel Hobby is strictly non-commercial and hard-pauses at limits → fine for personal use; Pro ($20/mo) is the first paid step if the app ever monetises.
- Gemini free-tier limits or privacy concerns → flip the Gateway model string to Haiku for ~$1–3/month.

## Research notes — sources and takeaways

**ts-fsrs** — https://github.com/open-spaced-repetition/ts-fsrs
Official TypeScript FSRS: `createEmptyCard()`, rate a review, get the updated card + log back; hooks designed for DB integration; a companion binding can train parameters from review logs. *Takeaway: purpose-built for us — one row per user-item, JSONB card state.*

**SRS Benchmark** — https://expertium.github.io/Benchmark.html
~350M reviews benchmarked: FSRS-6 beats SM-2 for 99.6% of users; defaults trained on ~700M reviews; per-user optimisation worthwhile only after ~200–1,000 reviews. *Takeaway: ship defaults day one, optimise later as a batch job.*

**edge-tts** — https://github.com/rany2/edge-tts
Free Microsoft neural TTS, no API key; excellent de-DE voices, 24 kHz MP3, even word-timing output (useful for karaoke-style read-alongs). Unofficial. *Takeaway: best free German audio; synthesise once, cache forever.*

**Piper + Thorsten voices** — https://github.com/rhasspy/piper and https://huggingface.co/Thorsten-Voice/Piper
Open-source neural TTS with MIT/CC0 German voices; and https://github.com/Mintplex-Labs/piper-tts-web runs it fully client-side (~60 MB model, cached, then offline). *Takeaway: the legally-clean fallback and the future offline-PWA audio story.*

**Web Speech API** — https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
SpeechRecognition (de-DE) is free, quota-less, and accurate on Chrome/Android; absent on Firefox; synthesis quality for German is a lottery. *Takeaway: recognition yes (where present), synthesis no.*

**Groq speech + LLM** — https://console.groq.com/docs/speech-to-text
Free tier without a card: 2,000 Whisper requests/day; paid Whisper at $0.04/audio-hour. *Takeaway: the strongest free path for graded speaking exercises.*

**Azure Speech pronunciation assessment** — https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment
The only real phoneme-level pronunciation scoring service; German GA; free tier 5 audio-hours/month (+0.5M free TTS chars). *Takeaway: how we do honest pronunciation feedback instead of fake scores.*

**Gemini free tier** — https://ai.google.dev/gemini-api/docs/rate-limits
The biggest genuinely-free LLM quota (hundreds to ~1,500 requests/day on Flash-class models); free-tier prompts may be used for training. *Takeaway: $0 tutoring for a handful of users; mind the privacy trade.*

**Claude pricing** — https://platform.claude.com/docs/en/pricing.md
Haiku-class at $1/$5 per MTok with structured outputs; a typical exercise-generation call ≈ $0.01. *Takeaway: the quality lever for German corrections costs tens of cents per active user per month.*

**Vercel AI SDK + AI Gateway** — https://ai-sdk.dev and https://vercel.com/docs/ai-gateway
Structured generation with Zod, streaming chat hooks, ~100 models behind one key with zero markup and failover. *Takeaway: write tutor logic once; swap models by changing a string.*

**German NLP: spaCy / simplemma / CharSplit** — https://spacy.io/models/de, https://github.com/adbar/simplemma, https://github.com/dtuggener/CharSplit
Lemma accuracy ~0.98, full morphology; CharSplit splits compounds at ~95% head accuracy (Autobahnraststätte → Autobahn + Raststätte). *Takeaway: enrich all content offline; store lemma/gender/case/level per word in Postgres.*

**Vocabulary data** — https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf, https://github.com/hermitdave/FrequencyWords, https://wortschatz.uni-leipzig.de
Goethe's official exam vocab (A1 ~650 entries, B1 ~2,400) as CEFR tags; OpenSubtitles de_50k as the colloquial frequency spine (CC BY-SA); Leipzig Corpora for depth. *Takeaway: join level tags with subtitle frequency ranks — that join IS our core vocab table. Use Goethe lists as tagging data, don't republish verbatim.*

**CEFR classification of German** — https://arxiv.org/pdf/2512.06483
Fine-tuned LLMs reach ~77% exact CEFR accuracy on German (errors adjacent-level); classic readability formulas are weak alone. *Takeaway: don't build a classifier — the tutor LLM labels its own output, cross-checked against our known-word coverage stats.*

**Platform docs** — https://supabase.com/pricing, https://vercel.com/docs/limits, https://serwist.pages.dev
Supabase free: 500 MB Postgres, 50k MAU auth, 1 GB storage — pauses after 7 idle days. Vercel Hobby: ~1M function invocations, non-commercial. Serwist is the Next.js-endorsed PWA service worker. *Takeaway: the whole app fits free tiers; the two real gotchas are the idle pause and the non-commercial clause.*

## Visual direction and colour scheme

**Evidence stance first:** the famous claims that specific colours boost cognition don't survive meta-analysis (Gnambs 2020, https://link.springer.com/article/10.3758/s13423-020-01772-1 — the "red impairs performance" effect has no evidential value after bias correction). So we choose colours for legibility, hierarchy, and mood-by-convention — which are real — not for claimed brain effects.

**The direction: "signage modern."** The app's visual language borrows from something unmistakably German and quietly beautiful: DIN typography and the geometry of German road and town signage. The learner's journey is literally framed as travelling deeper into Germany — so milestone markers can be drawn as Autobahn direction signs, and arriving at a new CEFR band as passing a yellow Ortsschild reading "A2". Serious but joyful sits naturally here: calm, disciplined surfaces most of the time (Linear-style restraint), warmth in the type and illustrations (Headspace's lesson: never clinical white), and Duolingo-style energy only at genuine milestone moments.

Proposed tokens (a starting point, not a mandate):

- Ground (light, default): porcelain `#F7F6F3` — warm-neutral, not cream
- Ink: `#1B1F24`
- Primary accent (actions, links, the path): traffic blue `#154889`, with a brighter interactive variant `#1D5FD6`
- Milestone/celebration: Ortsschild yellow `#F7C600` — reserved exclusively for milestone moments so it stays special
- Functional green/red for correct/error, muted, never the star
- Dark theme (reading-friendly, optional): surfaces `#16181D`-family (never pure black), text off-white `#E8E6E1`; both themes independently meet WCAG AA 4.5:1 (an optional dark mode doesn't exempt either theme — https://www.boia.org/blog/offering-a-dark-mode-doesnt-satisfy-wcag-color-contrast-requirements). Light mode stays the default: positive polarity wins for sustained reading, and light-on-dark halates for the ~1 in 3 people with astigmatism.

**Grammatical gender colours — a load-bearing design feature, not decoration.** A German-teaching experiment (Arzt & Kost 2016, https://onlinelibrary.wiley.com/doi/10.1111/tger.10207) found colour-coded articles significantly protected gender knowledge from decay at delayed test — the cheapest effective technique available. The classroom convention: masculine blue, feminine red, neuter green:

- der `#2563EB` · die `#E03131` · das `#2F9E44` (offer an alternate with das → amber `#F08C00` for red-green colour-vision deficiency)
- Rules: the same three colours *everywhere* (noun chips, drills, dictionary, conversation transcripts); colour is never the only carrier (the article text itself is always present); and learners must *retrieve* gender — colour arrives as feedback, not as a pre-highlighted answer (active processing beats passive exposure: https://www.researchgate.net/publication/280206673_Can_colors_voices_and_images_help_learners_acquire_the_grammatical_gender_of_German_nouns).

**Typography:** a DIN-flavoured grotesk for display and numbers (free options: Barlow or Archivo carry the DIN feeling well), over a highly legible humanist body face (e.g., Inter or Source Sans 3) with generous line-height — German text runs long and compound-heavy, so the body face earns its keep. Type at bold weights carries the joy; the layout stays quiet.

**Design-language references** worth keeping open while building: Headspace's system (warm surfaces, one reserved action colour — https://blakecrosley.com/guides/design/headspace), Linear's (near-black discipline, one accent — https://getdesign.md/linear.app/design-md), and Duolingo's (energy, chunky components) as the pole we visit only for celebrations.

## Freedoms deliberately left open

- Exact schema design, state management, and component library (shadcn/ui would fit naturally, but choose freely)
- Whether content generation happens ahead-of-time (cron batches) or on-demand — both fit the free tiers
- The illustration style riding on the signage frame (flat geometric? tiny photographic moments of Erlangen?)
- When to introduce the offline story (PWA install prompt timing, what's cached)
