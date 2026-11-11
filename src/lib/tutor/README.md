# The tutor layer — Jule Hartmann

Jule is the learner's VHS teacher in Erlangen (`persona.ts`). Every station
ships her hand-written briefing and debrief; this layer makes them
*personal*, never *possible*. With no `AI_GATEWAY_API_KEY` the app runs
end to end on the fallbacks below.

## Signals → key performances (`signals.ts`, pure)

`learnerSignals(snapshot, recentEvents, index)` reduces the engine's state
plus the last 200 `review_events` rows to honest, nameable facts:
lapsing words (Again grades / low retrievability, ≤ 5), the weak syntax
stage (attempted ≥ 3×, < 75 % success), the weak ear contrast, the grammar
bite in progress, the speaking rung, ≤ 2 strengths the week's numbers
support, and active days this week.

`keyPerformances(station, signals, index)` then finds ≤ 2 moments in
*this* station where those facts get tested — a scene line carrying a
lapsing word, a construct item at the weak stage, the pinned contrast,
the bite, or the performance itself. Deterministic, so the no-AI
fallback and the model talk about the same things; the model may only
choose among them (`validateBrief` rejects invented focuses).

## Routes

- `POST /api/coach` `{ stationId, phase: "brief" | "debrief", results?, lang? }`
  → `{ brief | debrief, keyPerformances, signals, source: "model" | "fallback" }`.
  Fallbacks (`coach.ts`): `fallbackBrief` splices the key performances into
  `station.coach.briefEn`; `fallbackDebrief` does honest arithmetic over the
  reported steps, grade and transcript.
- `POST /api/scene` `{ stationId, seed? }` → `{ lines, source: "model" | "scripted", cached? }`.
  Ladder: cache → strict → one repair → lenient → the scripted scene.
  `validateVariation` enforces coverage (target − 0.05 / − 0.10), every
  station lexeme present, cast-only speakers, 10–18 lines, not a copy.
- `POST /api/converse` `{ stationId, history, counterpart? }` →
  `{ replyDe, replyEn, correction, endsScene, counterpart }`; 503 without a
  key, 502 when the reply fails the coverage contract twice (`converse.ts`).

Allowed vocabulary everywhere = `knownAtStation` ∪ the learner's known
words ∪ `station.vocabulary` (`load.ts: allowedAtStation`).

## Cache keys

- brief: `(COACH_MODEL, "coach-brief", stationId, lang, signalsSignature, focuses)`
- debrief: `(COACH_MODEL, "coach-debrief", stationId, lang, signalsSignature, sha(results))`
- scene: `variationCacheKey(EPISODE_MODEL, stationId, allowedIds, seed)`
- converse: `(CHAT_MODEL, "converse", system, prompt)`

Prompts are cache-shaped: the stable part (sorted allowed list, or the
station block) leads; per-learner data and repair feedback follow.
