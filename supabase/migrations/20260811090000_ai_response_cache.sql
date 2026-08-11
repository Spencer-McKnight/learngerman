-- Shared cache of validated LLM outputs, keyed by a hash of model +
-- prompts. Generated content is learner-agnostic (the same spec repeats
-- across learners and sessions), so one table serves everyone and the
-- same query never pays for a second model call. Service-role only:
-- RLS enabled with no policies.
create table public.ai_response_cache (
  key text primary key,
  model text not null,
  kind text not null,
  content jsonb not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now()
);
alter table public.ai_response_cache enable row level security;

-- Fire-and-forget hit counter so the dashboard can show what the cache
-- is saving us.
create function public.touch_ai_cache(cache_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_response_cache
  set hits = hits + 1, last_hit_at = now()
  where key = cache_key;
$$;
