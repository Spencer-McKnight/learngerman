"use client";

/**
 * Free conversation — the top speaking rung, and the episode's final
 * act: the tutor opens by asking about the scene the learner just
 * lived. The opener ships inside the episode (zero wait); the tutor
 * stays inside known vocabulary, weaves due words in, and gives at
 * most one gentle correction per turn, rendered as information.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationReply } from "@/lib/engine";
import { speakGerman, ttsAvailable } from "@/lib/audio/tts";
import { recognizeGerman, sttAvailable } from "@/lib/audio/stt";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  glossMapOf,
  GlossText,
  LineWithMeaning,
  TaskHeading,
  useEpisode,
  type TaskProps,
} from "./shared";

interface Message {
  role: "tutor" | "learner";
  text: string;
  en?: string;
  correction?: ConversationReply["correction"];
}

export function ConversationTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { episode, spec } = useEpisode();
  const [messages, setMessages] = useState<Message[]>(() =>
    episode
      ? [{ role: "tutor", text: episode.opener.de, en: episode.opener.en }]
      : [],
  );
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const wovenWords = useRef(new Set<string>());
  const spoken = useRef(false);

  const glosses = useMemo(() => glossMapOf(episode), [episode]);

  // Speak the opener once — it arrived with the episode, so the
  // conversation starts instantly.
  useEffect(() => {
    if (spoken.current || !episode) return;
    spoken.current = true;
    if (ttsAvailable()) void speakGerman(episode.opener.de);
  }, [episode]);

  const learnerTurns = messages.filter((message) => message.role === "learner").length;

  const requestReply = async (history: Message[]) => {
    if (!spec) return null;
    setWaiting(true);
    try {
      const response = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedLemmas: spec.allowedLemmas,
          targetLemmas: spec.targetLemmas,
          stage: spec.stage,
          coverageTarget: spec.coverageTarget,
          ...(episode
            ? { scene: { title: episode.title, settingEn: episode.settingEn } }
            : {}),
          history: history.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { reply: ConversationReply };
      for (const id of data.reply.newWordsUsed) wovenWords.current.add(id);
      return data.reply;
    } catch {
      return null;
    } finally {
      setWaiting(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft("");
    const withLearner: Message[] = [...messages, { role: "learner", text }];
    setMessages(withLearner);
    const reply = await requestReply(withLearner);
    if (!reply) {
      setFailed(true);
      return;
    }
    setMessages([
      ...withLearner.slice(0, -1),
      { ...withLearner[withLearner.length - 1], correction: reply.correction },
      { role: "tutor", text: reply.replyDe, en: reply.replyEn },
    ]);
    if (ttsAvailable()) void speakGerman(reply.replyDe);
  };

  const record = async () => {
    setListening(true);
    const recognizer = recognizeGerman(setDraft);
    const heard = await recognizer.result;
    setListening(false);
    if (heard) setDraft(heard);
  };

  const end = async () => {
    setBusy(true);
    const woven = [...wovenWords.current];
    await submit({
      ...baseOutcome(
        task,
        learnerTurns >= 3,
        Object.fromEntries(woven.map((id) => [id, 3])) as Record<string, 1 | 2 | 3 | 4>,
      ),
      inputSeconds: task.seconds,
    });
    finish();
  };

  if (!episode && messages.length === 0) return <FailedCard skip={skip} />;

  return (
    <>
      <TaskHeading
        intro={t.tasks.intro.conversation}
        title={t.tasks.conversation.title}
        note={t.tasks.conversation.note}
      />
      <Card className="flex max-h-[50dvh] flex-col gap-3 overflow-y-auto">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${
              message.role === "learner" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                message.role === "learner"
                  ? "rounded-br-md bg-accent text-white"
                  : "rounded-bl-md bg-background"
              }`}
            >
              {message.role === "tutor" && message.en ? (
                <LineWithMeaning de={message.text} en={message.en} glosses={glosses} />
              ) : message.role === "tutor" ? (
                <GlossText text={message.text} glosses={glosses} />
              ) : (
                message.text
              )}
            </div>
            {message.correction && (
              <p className="max-w-[85%] rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted">
                💡 {message.correction.corrected}
                <span className="block">{message.correction.noteEn}</span>
              </p>
            )}
          </div>
        ))}
        {waiting && <p className="text-xs text-muted">…</p>}
        {failed && (
          <p className="text-xs text-muted">
            {t.tasks.conversation.connectionIssue}
          </p>
        )}
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoCapitalize="sentences"
            autoComplete="off"
            placeholder={t.common.inGermanPlaceholder}
            className="flex-1 rounded-lg border border-line bg-background px-3 py-2.5 text-[15px] outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
          />
          {sttAvailable() && (
            <Button type="button" variant="outline" onClick={record} disabled={listening}>
              {listening ? "●" : "🎙"}
            </Button>
          )}
          <Button type="submit" disabled={waiting || !draft.trim()}>
            →
          </Button>
        </form>
        {(learnerTurns >= 3 || failed) && (
          <Button variant="quiet" disabled={busy} onClick={end}>
            {t.tasks.conversation.endChat}
          </Button>
        )}
      </div>
    </>
  );
}
