-- v5.5 "Linie": the hand-authored course. Per-learner station progress
-- (the curriculum itself ships as TypeScript), plus which station and
-- mode each session played, for honest history.

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  station_id text not null,
  status text not null default 'started' check (status in ('unseen','started','passed')),
  best_grade smallint check (best_grade between 1 and 4),
  visits integer not null default 0,
  last_visited_at timestamptz,
  passed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

alter table public.lesson_progress enable row level security;
create policy "own rows select" on public.lesson_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.lesson_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.lesson_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

alter table public.sessions
  add column if not exists station_id text,
  add column if not exists mode text not null default 'station';

-- Milestone kinds grow: a completed line is a genuine arrival.
-- (milestone_events.kind is free text; no schema change needed.)
