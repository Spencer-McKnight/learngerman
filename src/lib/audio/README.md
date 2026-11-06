# Audio

## The cast (`voices.ts`)

Characters map to Microsoft Edge neural voices so a speaker always sounds
like themselves. Keys are what curriculum authors write in `Character.voice`:

| key | voice | role |
| --- | --- | --- |
| `jule` | de-DE-SeraphinaMultilingualNeural | the teacher |
| `katja` | de-DE-KatjaNeural | narrator, default |
| `conrad`, `killian`, `florian` | de-DE-*Neural | men |
| `amala` | de-DE-AmalaNeural | woman |
| `ingrid`, `jonas` | de-AT-* | Austria |
| `leni`, `jan` | de-CH-* | Switzerland |

`resolveVoice()` accepts a key, a full `de-(DE|AT|CH)-*Neural` name (what
`hvpt.ts` rotates), or nothing (→ katja). `HVPT_VOICE_KEYS` is the rotation
for talker variability.

## Speaking (`tts.ts`, `/api/tts`, `components/audio/`)

`speak(text, { voice, rate, onBoundary, signal })` → POST `/api/tts` →
`<audio>` playback with word boundaries emitted on a clock tied to
`audio.currentTime`. `preload(text, voice)` warms the next line (deduped,
≤ 64 clips in memory). `speakGerman(text, { rate, voiceIndex, voice })` is
the legacy wrapper. `useSpeech()` gives a component `{ speak, stop,
speaking, currentWord }`; `<KaraokeText text currentWord renderWord>`
highlights the spoken word. Only one voice ever plays.

Cache path: key = sha256(`voice|rate|text`) → `tts/<key>.mp3` in the public
Storage bucket `tts` + a `tts_cache` row (boundaries, duration). Edge is
asked once per utterance, ever.

Fallback ladder:
1. Storage hit → public CDN URL.
2. Miss → synthesise (Edge, free, no key) → upload → URL.
3. Storage down or no `SUPABASE_SECRET_KEY` → inline `data:` URL.
4. Edge down (502), `TTS_DISABLE=1` (503), offline, or media error → the
   device's `speechSynthesis` (with its own word boundaries where supported).

## Listening (`stt.ts`)

`recognizeGermanDetailed({ lang, onInterim, continuous, maxAlternatives })`
returns `{ transcript, alternatives }`; `recognizeGerman(onInterim)` keeps the
string API. 15 s safety timeout. Offer typed input when `sttAvailable()` is
false.

## The instrument (`sound.ts`, `synth.ts`)

One synthesised instrument, "Glockenspiel und Straßenbahn", no assets,
every voice ≤ 0.12 peak through a master gain and soft compressor.

| cue | sound | when |
| --- | --- | --- |
| `playTap` | one soft high bar | buttons, chips |
| `playCorrect` | rising fourth G5→C6 | right answer |
| `playWrong` | felt mallet on the wooden frame | wrong answer (information, not punishment) |
| `playReveal` | three-note sparkle | a word gloss opens |
| `playStep` | a page turning | beat/step change inside a task |
| `playArrive` | one tram bell | arriving at a station |
| `playDepart` | two descending tones ("Abfahrt") | leaving a station |
| `playStreak` | rolled warm triad | streak kept |
| `playMilestone` | four ascending notes under hall reverb | genuine milestones only — like the yellow |

Preferences: `lg:sound` on/off (`soundEnabled/setSoundEnabled`), `lg:volume`
0..1 (`soundVolume/setSoundVolume`). Cue timings live in `synth.ts` so
`synth.test.ts` can prove every cue ≤ 700 ms (milestone ≤ 2 s).
