-- Neural TTS cache. A line of German read by one voice at one rate is
-- the same for every learner, so each utterance is synthesised once and
-- served forever from Storage. The table carries what the audio file
-- cannot: the word boundaries the client uses for karaoke highlighting.
-- Service-role only, like ai_response_cache: RLS enabled, no policies.
create table public.tts_cache (
  key text primary key,
  voice text not null,
  text text not null,
  duration_ms integer,
  boundaries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.tts_cache enable row level security;

-- The audio lives in a public bucket so the <audio> element can stream
-- it straight from the CDN with no signed-URL round trip. Only the
-- service role writes to it; mp3 only, and no single line is ever big.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', true, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;

create policy "tts audio is public to read"
  on storage.objects for select
  using (bucket_id = 'tts');
