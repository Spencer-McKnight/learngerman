-- Learning engine state. The lexicon itself ships as precomputed
-- TypeScript (technology.md); these tables hold only per-learner state.
-- Every table follows the profiles RLS pattern: rows belong to their
-- auth user, service-role writes bypass RLS where noted.

-- One FSRS card per learner per lexeme. `card` is the ts-fsrs card
-- verbatim; `due` is duplicated out of it for indexed queries.
create table public.word_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  lexeme_id text not null,
  card jsonb not null,
  due timestamptz not null,
  success_days text[] not null default '{}',
  introduced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lexeme_id)
);
create index word_states_due_idx on public.word_states (user_id, due);

-- Per-skill Elo/Rasch rating (logit units).
create table public.skill_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill text not null check (skill in ('reading','listening','writing','speaking','grammar')),
  rating real not null default 0,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

-- Processability staircase: stabilised stage + rolling evidence.
create table public.syntax_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stage smallint not null default 1 check (stage between 1 and 5),
  evidence jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- HVPT ear training, one row per minimal-pair contrast.
create table public.ear_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  contrast_id text not null,
  seen integer not null default 0,
  correct integer not null default 0,
  outcome_window jsonb not null default '[]',
  mastered boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, contrast_id)
);

-- Grammar bites the learner has met and their status.
create table public.grammar_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  bite_id text not null,
  status text not null check (status in ('seen','practising','settled')),
  updated_at timestamptz not null default now(),
  primary key (user_id, bite_id)
);

-- Learner-level engine settings and tracks (extends profiles).
create table public.learner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coverage_target real not null default 0.95 check (coverage_target between 0.85 and 0.99),
  minutes_per_session smallint not null default 12,
  speaking_rung text not null default 'shadowing'
    check (speaking_rung in ('shadowing','construct','scripted','timed-recall','free-conversation')),
  speaking_outcomes jsonb not null default '[]',
  input_minutes real not null default 0,
  placed boolean not null default false,
  placement jsonb,
  updated_at timestamptz not null default now()
);

-- Append-only log of every graded interaction (feeds future per-user
-- FSRS optimisation and difficulty calibration).
create table public.review_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_kind text not null,
  skill text not null,
  correct boolean not null,
  difficulty real not null,
  lexeme_grades jsonb not null default '{}',
  payload jsonb,
  created_at timestamptz not null default now()
);
create index review_events_user_idx on public.review_events (user_id, created_at);

-- Composed session plans, for resuming and for honest history.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan jsonb not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index sessions_user_idx on public.sessions (user_id, started_at);

-- Genuine milestones only (vocab thresholds, stages, contrasts, bands).
create table public.milestone_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  label text not null,
  detail text not null,
  achieved_at timestamptz not null default now()
);

-- RLS: learners see and write only their own state.
do $$
declare t text;
begin
  foreach t in array array[
    'word_states','skill_states','syntax_states','ear_states',
    'grammar_states','learner_profiles','review_events','sessions',
    'milestone_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- updated_at maintenance (function exists from the profiles migration).
create trigger word_states_set_updated_at
  before update on public.word_states
  for each row execute function public.set_updated_at();
create trigger skill_states_set_updated_at
  before update on public.skill_states
  for each row execute function public.set_updated_at();
create trigger syntax_states_set_updated_at
  before update on public.syntax_states
  for each row execute function public.set_updated_at();
create trigger ear_states_set_updated_at
  before update on public.ear_states
  for each row execute function public.set_updated_at();
create trigger grammar_states_set_updated_at
  before update on public.grammar_states
  for each row execute function public.set_updated_at();
create trigger learner_profiles_set_updated_at
  before update on public.learner_profiles
  for each row execute function public.set_updated_at();
