"use client";

/**
 * Free conversation inside the performance: the counterpart's lines
 * come from /api/converse under the coverage contract, up to six
 * learner turns, ending gracefully when the model says the scene has
 * reached its natural end. If the route is offline (no key, 502), the
 * caller falls back to the scripted role-play — honestly announced.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import type { SceneLine, SpeakerId, Station } from "@/lib/curriculum/types";
import { playTap } from "@/lib/audio/sound";
import type { PerformanceUtterance } from "@/lib/tutor/coach";
import type { ConverseReply } from "@/lib/tutor/converse";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, Field, IconButton, cn } from "@/components/ui";
import { speakerName, stageEvidence, voiceFor, type Grade } from "../lib";
import { BottomBar, LineWithMeaning, useRecorder } from "../parts";

export const MAX_TURNS = 6;

interface Message {
  role: "tutor" | "learner";
  text: string;
  en?: string;
  correction?: ConverseReply["correction"];
}

export interface FreeConversationProps {
  station: Station;
  counterpart: SpeakerId;
  /** The scripted opener, when the performance has one. */
  opener?: SceneLine;
  onTurn: (text: string, correct: boolean, evidence: ReturnType<typeof stageEvidence>) => void;
  onDone: (grades: Grade[], transcript: PerformanceUtterance[]) => void;
  onOffline: () => void;
}

export function FreeConversation({ station, counterpart, opener, onTurn, onDone, onOffline }: FreeConversationProps) {
  const t = useStrings();
  const speech = useSpeech();
  const recorder = useRecorder();
  const [messages, setMessages] = useState<Message[]>(() => (opener ? [{ role: "tutor", text: opener.de, en: opener.en }] : []));
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [transcript, setTranscript] = useState<PerformanceUtterance[]>([]);
  const startedRef = useRef(false);
  const voice = voiceFor(station, counterpart);
  const name = speakerName(station, counterpart, t.station.scene.you);
  const learnerTurns = messages.filter((m) => m.role === "learner").length;

  const ask = async (history: Message[]): Promise<ConverseReply | null> => {
    setWaiting(true);
    try {
      const response = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: station.id, counterpart, history: history.map((m) => ({ role: m.role, text: m.text })) }),
      });
      if (!response.ok) return null;
      return (await response.json()) as ConverseReply;
    } catch {
      return null;
    } finally {
      setWaiting(false);
    }
  };

  // Speak the opener, or fetch one when the script has none.
  const startRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    startRef.current = () => {
      if (opener) {
        void speech.speak(opener.de, { voice });
        return;
      }
      void ask([]).then((reply) => {
        if (!reply) {
          onOffline();
          return;
        }
        setMessages([{ role: "tutor", text: reply.replyDe, en: reply.replyEn }]);
        void speech.speak(reply.replyDe, { voice });
      });
    };
  });
  useEffect(() => {
    if (startedRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      startRef.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting || ended) return;
    playTap();
    setDraft("");
    speech.stop();
    const lastTutor = [...messages].reverse().find((m) => m.role === "tutor");
    const withLearner: Message[] = [...messages, { role: "learner", text }];
    setMessages(withLearner);
    const reply = await ask(withLearner);
    if (!reply) {
      onOffline();
      return;
    }
    const correct = reply.correction === null;
    const grade: Grade = correct ? 3 : 2;
    onTurn(text, correct, stageEvidence(text));
    const nextGrades = [...grades, grade];
    const nextTranscript = [...transcript, { promptDe: lastTutor?.text, saidDe: text, expectedDe: reply.correction?.corrected ?? text }];
    setGrades(nextGrades);
    setTranscript(nextTranscript);
    setMessages([
      ...withLearner.slice(0, -1),
      { ...withLearner[withLearner.length - 1], correction: reply.correction },
      { role: "tutor", text: reply.replyDe, en: reply.replyEn },
    ]);
    void speech.speak(reply.replyDe, { voice });
    if (reply.endsScene || nextGrades.length >= MAX_TURNS) setEnded(true);
  };

  const record = async () => {
    const result = await recorder.record();
    if (result.transcript) setDraft(result.transcript);
  };

  const finishNow = () => {
    speech.stop();
    onDone(grades, transcript);
  };

  return (
    <>
      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message, i) => {
          const own = message.role === "learner";
          return (
            <li key={i} className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
              <span className={cn("px-1 font-display text-caption font-semibold uppercase tracking-[0.14em]", own ? "text-accent" : "text-ink-muted")}>
                {own ? t.station.scene.you : name}
              </span>
              <div className={cn("max-w-[92%] rounded-lg border px-3.5 py-2.5", own ? "rounded-tr-xs border-accent-soft bg-accent-soft" : "rounded-tl-xs border-hairline bg-surface")}>
                {own ? (
                  <span lang="de">{message.text}</span>
                ) : (
                  <LineWithMeaning de={message.text} en={message.en ?? ""} currentWord={i === messages.length - 1 ? speech.currentWord : null} />
                )}
              </div>
              {message.correction && (
                <p className="max-w-[92%] rounded-md border border-hairline bg-surface px-3 py-2 text-caption text-ink-muted">
                  <span className="font-semibold text-ink">{t.station.perform.correction}: </span>
                  <span lang="de">{message.correction.corrected}</span>
                  <span className="block">{message.correction.noteEn}</span>
                </p>
              )}
            </li>
          );
        })}
        {waiting && (
          <li className="px-1 text-caption text-ink-muted" aria-live="polite">
            {name} {t.station.perform.waiting}
          </li>
        )}
      </ol>

      <BottomBar>
        <p className="min-h-5 text-center text-caption text-ink-muted">
          {t.station.perform.turn(Math.min(MAX_TURNS, learnerTurns + 1), MAX_TURNS)} · {t.station.perform.freeHint}
        </p>
        {ended ? (
          <Button size="lg" fullWidth onClick={finishNow}>
            {t.station.perform.end}
          </Button>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <Field
              className="flex-1"
              label={t.station.speak.typeOrSay}
              lang="de"
              autoCapitalize="sentences"
              autoComplete="off"
              placeholder={t.station.speak.placeholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {recorder.available && (
              <IconButton label={t.station.speak.micLabel} variant="secondary" pressed={recorder.listening} disabled={recorder.listening} onClick={() => void record()}>
                <Mic />
              </IconButton>
            )}
            <IconButton label={t.station.perform.send} variant="primary" type="submit" disabled={waiting || !draft.trim()}>
              <Send />
            </IconButton>
          </form>
        )}
        {!ended && learnerTurns >= 2 && (
          <Button variant="quiet" onClick={finishNow}>
            {t.station.perform.end}
          </Button>
        )}
      </BottomBar>
    </>
  );
}
