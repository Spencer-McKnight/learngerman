"use client";

/**
 * Acts 1 and 2 of the episode: the story that sets the scene, then
 * the dialogue inside it (audio-first as listen-clip once listening
 * can carry it). Every word is tappable for its meaning; every line's
 * translation is one tap away. Tapping is both help and signal —
 * tapped targets grade lower, untapped higher.
 */

import { useMemo, useState } from "react";
import { speakGerman, stopSpeaking, ttsAvailable } from "@/lib/audio/tts";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";
import {
  baseOutcome,
  FailedCard,
  GeneratingCard,
  glossMapOf,
  INDEX,
  LineWithMeaning,
  TaskHeading,
  useEpisode,
  type TaskProps,
} from "./shared";

export function StoryTask({ task, submit, finish, skip }: TaskProps) {
  const t = useStrings();
  const { status, episode } = useEpisode();
  const audioFirst = task.kind === "listen-clip";
  const [textShown, setTextShown] = useState(!audioFirst);
  const [tapped] = useState(() => new Set<string>());
  const [busy, setBusy] = useState(false);

  const lines: { speaker?: string; de: string; en: string }[] = useMemo(() => {
    if (!episode) return [];
    return task.section === "dialogue" ? episode.dialogue : episode.story;
  }, [episode, task.section]);
  const glosses = useMemo(() => glossMapOf(episode), [episode]);

  if (status === "loading") return <GeneratingCard />;
  if (status === "failed" || !episode || lines.length === 0) return <FailedCard skip={skip} />;

  const targets = task.lexemeIds ?? [];
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
        intro={task.section === "dialogue" ? t.tasks.intro.dialogue : t.tasks.intro.story}
        title={
          audioFirst
            ? t.tasks.story.titleListen
            : task.section === "dialogue"
              ? t.tasks.story.titleDialogue
              : t.tasks.story.titleRead
        }
        note={task.note ?? t.tasks.story.tapNote}
      />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">
            {episode.title}
            {task.section === "story" && (
              <span className="ml-2 text-sm font-medium text-muted">{episode.titleEn}</span>
            )}
          </h3>
          {ttsAvailable() && (
            <Button
              variant="outline"
              className="px-3 py-1.5 text-xs"
              onClick={() => void speakGerman(fullText)}
            >
              {t.common.listen}
            </Button>
          )}
        </div>
        {textShown ? (
          <div className="flex flex-col gap-3 text-[17px] leading-relaxed">
            {lines.map((line, i) => (
              <p key={i} className="flex flex-col">
                <span>
                  {line.speaker && (
                    <span className="mr-1.5 font-display text-sm font-semibold text-accent-bright">
                      {line.speaker}:
                    </span>
                  )}
                  <LineWithMeaning
                    de={line.de}
                    en={line.en}
                    glosses={glosses}
                    onTapWord={(token) => tapped.add(token)}
                  />
                </span>
              </p>
            ))}
          </div>
        ) : (
          <Button variant="outline" onClick={() => setTextShown(true)}>
            {t.tasks.story.showText}
          </Button>
        )}
      </Card>
      {textShown && (
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Button variant="outline" disabled={busy} onClick={() => complete(false)}>
            {t.tasks.story.hard}
          </Button>
          <Button disabled={busy} onClick={() => complete(true)}>
            {t.tasks.story.understood}
          </Button>
        </div>
      )}
    </>
  );
}
