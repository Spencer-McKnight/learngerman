-- Learner preferences that aren't engine state: the implementation-
-- intention plan from onboarding ("after X, I do one session"),
-- accessibility choices, and future UI settings. Kept as one jsonb
-- blob — these are display preferences, not queried state.
alter table public.learner_profiles
  add column prefs jsonb not null default '{}'::jsonb;
