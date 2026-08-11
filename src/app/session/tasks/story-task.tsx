"use client";

/**
 * Story / dialogue / listen-clip: the comprehensible-input warm-up
 * that quietly carries today's due words. Tapping a glossed word is
 * both help and signal — tapped targets grade lower, untapped higher.
 * The English gist stays behind a tap; German first, always.
 */

import { useMemo, useState } from "react";
import type { GeneratedDialogue, GeneratedStory } from "@/lib/engine";
import { speakGerman, stopSpeaking, ttsAvailable } from "@/lib/audio/tts";
import { playTap } from "@/lib/audio/sound";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  GeneratingCard,
  INDEX,
  TaskHeading,
  useGenerated,
  type TaskProps,
} from "./shared";

function cleanToken(token: string): string {
  return token.replace(/[^\p{L}'’-]/gu, "").toLowerCase();
}

function TappableLine({
  text,
  glosses,
  onTapGloss,
}: {
  text: string;
  glosses: Map<string, string>;
  onTapGloss: (token: string) => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  return (
    <span>
      {text.split(/(\s+)/).map((token, i) => {
        const clean = cleanToken(token);
        const gloss = clean ? glosses.get(clean) : undefined;
        if (!gloss) return <span key={i}>{token}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              playTap();
              setRevealed(revealed === `${i}` ? null : `${i}`);
              onTapGloss(clean);
            }}
            className="relative inline underline decoration-accent-bright/60 decoration-dotted underline-offset-4"
          >
            {token}
            {revealed === `${i}` && (
              <span className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow">
                {gloss}
              </span>
            )}
          </button>
        );
      })}
    </span>
  );
}

export function StoryTask({ task, submit, finish, skip }: TaskProps) {
  const generated = useGenerated<GeneratedStory | GeneratedDialogue>(task);
  const audioFirst = task.kind === "listen-clip";
  const [textShown, setTextShown] = useState(!audioFirst);
  const [gistShown, setGistShown] = useState(false);
  const [tapped] = useState(() => new Set<string>());
  const [busy, setBusy] = useState(false);

  const content = generated.content;
  const lines: { speaker?: string; de: string }[] = useMemo(() => {
    if (!content) return [];
    if ("sentences" in content) return content.sentences.map((de) => ({ de }));
    return content.turns;
  }, [content]);

  if (generated.status === "loading") return <GeneratingCard />;
  if (generated.status === "failed" || !content) return <FailedCard skip={skip} />;

  const glosses = new Map(
    content.glosses.map((gloss) => [gloss.de.toLowerCase(), gloss.en]),
  );
  const targets = task.generation?.targetLemmas ?? [];
  const fullText = lines.map((line) => line.de).join(" ");

  const complete = async (understood: boolean) => {
    setBusy(true);
    stopSpeaking();
    // Tapped words needed help; untapped targets were read cold.
    const tappedIds = new Set(
      [...tapped].flatMap((token) => INDEX.byForm.get(token) ?? []),
    );
    const lexemeGrades = Object.fromEntries(
      targets.map((id) => [
        id,
        tappedIds.has(id) ? (understood ? 2 : 1) : understood ? 3 : 2,
      ]),
    ) as Record<string, 1 | 2 | 3 | 4>;
    await submit({
      ...baseOutcome(task, understood, lexemeGrades),
      inputSeconds: task.seconds,
    });
    finish();
  };

  return (
    <>
      <TaskHeading
        title={
          audioFirst ? "Hör zu" : task.kind === "dialogue-read" ? "Lies mit" : "Lies"
        }
        note={task.note ?? "Tippe auf markierte Wörter, wenn du sie brauchst."}
      />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">{content.title}</h3>
          {ttsAvailable() && (
            <Button
              variant="outline"
              className="px-3 py-1.5 text-xs"
              onClick={() => void speakGerman(fullText)}
            >
              ▶ Anhören
            </Button>
          )}
        </div>
        {textShown ? (
          <div className="flex flex-col gap-2.5 text-[17px] leading-relaxed">
            {lines.map((line, i) => (
              <p key={i}>
                {line.speaker && (
                  <span className="mr-1.5 font-display text-sm font-semibold text-accent-bright">
                    {line.speaker}:
                  </span>
                )}
                <TappableLine
                  text={line.de}
                  glosses={glosses}
                  onTapGloss={(token) => tapped.add(token)}
                />
              </p>
            ))}
          </div>
        ) : (
          <Button variant="outline" onClick={() => setTextShown(true)}>
            Text zeigen
          </Button>
        )}
        {textShown && (
          <button
            type="button"
            onClick={() => setGistShown(!gistShown)}
            className="self-start text-xs font-medium text-accent-bright hover:underline"
          >
            {gistShown ? content.englishGist : "Worum ging es? (English)"}
          </button>
        )}
      </Card>
      {textShown && (
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Button variant="outline" disabled={busy} onClick={() => complete(false)}>
            War schwer
          </Button>
          <Button disabled={busy} onClick={() => complete(true)}>
            Verstanden
          </Button>
        </div>
      )}
    </>
  );
}
