# Learn German

An adaptive German tutor: comprehensible input served at ~95% known-word
coverage — always at your level, always slightly beyond it. Method, progression
and design decisions live in the research files at the repo root
(`custom-teaching-methodology.md`, `milestones-in-progression.md`,
`gamification-strategy.md`, `technology.md`); running decisions in
`agent-memory.md`.

## Stack

- **Next.js 16** (App Router) + **Tailwind 4**, installable PWA via **Serwist**
- **Supabase** — Postgres (RLS on every table), Auth (cookie-based via
  `@supabase/ssr`), Storage
- **ts-fsrs** (FSRS-6) for spaced repetition scheduling
- **Vercel AI SDK + AI Gateway** for the LLM tutor

## Development

```bash
pnpm install
cp .env.example .env   # then fill in keys
pnpm dev               # Turbopack dev server
pnpm build             # production build (webpack — required by Serwist)
```

Service connectivity is visible at `/` and as JSON at `/api/health`.

## Database

Migrations live in `supabase/migrations/`. The project is linked via the
Supabase CLI:

```bash
supabase db push       # apply new migrations to the remote database
supabase migration list
```
