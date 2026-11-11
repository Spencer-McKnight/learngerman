# The station player — `/station/[id]`

`page.tsx` (server) resolves the station (`stationById` → `notFound()`), refuses locked
stations with a friendly page, reads `visits` from `lesson_progress` and `?modus=`
(`station | review | ear | speak | talk`), then renders `StationPlayer` in `<Suspense>`.

`player.tsx` (client) POSTs `/api/lesson { stationId, mode }` → `{ sessionId, plan }`
(`needsPlacement` → `/willkommen`, 403 → `/`), and in parallel POSTs `/api/coach`
`{ phase: "brief" }` and, when `plan.variation`, `/api/scene { seed: visits }` (15 s
deadline, then the scripted scene). The first three scene lines are preloaded per voice.
It plays `plan.steps` in order under a top bar (close with confirm Sheet mid-lesson,
`ProgressBar segments`, beat name, compact `StationSign`), sends every outcome to
`POST /api/review`, and queues returned milestones for `MilestoneOverlay` at the end of
the current beat. Detour plans have no arrive beat and start straight into their first step.

## Beats (`beats/<kind>.tsx`), all receiving `BeatProps` from `lib.ts`

`{ station, step, plan, lines, scene, coach, visits, mode, sessionId, results,
performanceGrade, transcript, outcomes, autoplay, submit(outcome), finish(info), onMilestones }`
— `lines` are the scene lines in use (scripted or the model's variation); `finish` takes
`{ correct, detail?, performanceGrade?, transcript? }` and the player records it for the debrief.

| beat | grades | outcome(s) sent |
| --- | --- | --- |
| arrive | — | none |
| scene | heard = credited | one: `scene`, listening, `creditIds → 3`, `newLexemeIds → 2`, `inputSeconds` |
| understand | per check | one per check: `understand`, reading, `lexemeGrades: {}` |
| words | first try 3 · after a miss 2 · wrong 1 · wrong article caps at 2 | one per word: `retrieval-tap`, reading |
| grammar | construct items (`gradeSentence`) or right/wrong pairs; bite alone → correct | one: `grammar-drill`, `biteId`, stage evidence |
| speak | shadow: WER verdict (`scoreSpeech`); construct/timed: `gradeSentence` + `analyzeProduction`; scripted: WER per "du" line | shadow/scripted: one per beat with `inputSeconds`; construct: one per item with `stageAttempted/stageSuccess` |
| ear | per pair | one per pair: `hvpt-pair`, `earContrastId` |
| perform | mean verdict over the learner's lines → grade 1–4 | role-play: one `scripted-dialogue`; free: one `conversation-turn` per turn; say-it/write-it: one per prompt |
| depart | — | `POST /api/coach { phase: "debrief", results }`, `PATCH /api/lesson { sessionId, stationId, mode, performanceGrade }` |

Without speech recognition every spoken step offers a clearly labelled self-assessment;
free conversation falls back to the scripted role-play when `/api/converse` is unavailable.

## Shared pieces

`lib.ts`: `INDEX` (course lexicon), `glossFor`, `voiceFor`, `sceneLineFor`, `distractorsFor`
(bounded scan), `gradeSentence`, `stageEvidence`, `meanGrade`, `outcomeFor`, `tallyOutcomes`.
`parts.tsx`: `JuleMark`, `BeatHeading`, `BottomBar` (sticky primary actions), `Feedback`
(polite live region, fixed height), `GlossLine`/`LineWithMeaning` (karaoke + tap-to-gloss,
translation space reserved), `SelfAssess`, `RecordButton`, `useRecorder`.
Chrome strings live in `src/lib/i18n/station.ts` as `t.station.*` (`de` default, `en`).
