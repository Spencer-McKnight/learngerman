"use client";

import { createContext, useContext, useState } from "react";
import type { Episode, EpisodeSpec, ReviewOutcome, TaskSpec } from "@/lib/engine";
import { buildIndex, SEED_LEXICON } from "@/lib/engine";
import { playTap } from "@/lib/audio/sound";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card } from "@/components/ui";

export const INDEX = buildIndex(SEED_LEXICON);

export interface TaskProps {
  task: TaskSpec;
  submit: (outcome: ReviewOutcome) => Promise<void>;
  finish: () => void;
  skip: () => void;
  sparkle?: (x: number, y: number) => void;
}

export function baseOutcome(
  task: TaskSpec,
  correct: boolean,
  lexemeGrades: ReviewOutcome["lexemeGrades"] = {},
): ReviewOutcome {
  return {
    taskKind: task.kind,
    skill: task.skill,
    correct,
    lexemeGrades,
    difficulty: task.difficulty,
  };
}

export function gradesFor(
  lexemeIds: string[],
  grade: 1 | 2 | 3 | 4,
): ReviewOutcome["lexemeGrades"] {
  return Object.fromEntries(lexemeIds.map((id) => [id, grade]));
}

/* ---------- The episode: one scene shared by every task ---------- */

export interface EpisodeState {
  status: "loading" | "ready" | "failed";
  episode: Episode | null;
  /** The spec the episode was generated from (conversation needs it). */
  spec: EpisodeSpec | null;
  /** True when a curated fallback scene is being served. */
  fallback: boolean;
}

const EpisodeContext = createContext<EpisodeState>({
  status: "failed",
  episode: null,
  spec: null,
  fallback: false,
});

export const EpisodeProvider = EpisodeContext.Provider;

export function useEpisode(): EpisodeState {
  return useContext(EpisodeContext);
}

/* ---------- Tap-to-gloss: every word is a reference ---------- */

/** Word→meaning map from the episode's glosses (exact surface forms). */
export function glossMapOf(episode: Episode | null): Map<string, string> {
  if (!episode) return new Map();
  return new Map(episode.glosses.map((gloss) => [gloss.de.toLowerCase(), gloss.en]));
}

function cleanToken(token: string): string {
  return token.replace(/[^\p{L}'’-]/gu, "").toLowerCase();
}

/** Resolve one surface token to a gloss: episode glosses first, then the lexicon. */
function glossFor(clean: string, glosses?: Map<string, string>): string | null {
  const fromEpisode = glosses?.get(clean);
  if (fromEpisode) return fromEpisode;
  const ids = INDEX.byForm.get(clean);
  if (!ids || ids.length === 0) return null;
  const lexeme = INDEX.byId.get(ids[0]);
  if (!lexeme) return null;
  return lexeme.gender ? `${lexeme.gender} ${lexeme.lemma} — ${lexeme.english}` : lexeme.english;
}

/**
 * German text where EVERY resolvable word is tappable for its meaning
 * (the LingQ takeaway: always a reference within reach). Tapping is
 * also a signal — callers learn which words needed help.
 */
export function GlossText({
  text,
  glosses,
  onTapWord,
  className,
}: {
  text: string;
  glosses?: Map<string, string>;
  onTapWord?: (token: string) => void;
  className?: string;
}) {
  const [revealed, setRevealed] = useState<number | null>(null);
  return (
    <span className={className}>
      {text.split(/(\s+)/).map((token, i) => {
        const clean = cleanToken(token);
        const gloss = clean ? glossFor(clean, glosses) : null;
        if (!gloss) return <span key={i}>{token}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              playTap();
              setRevealed(revealed === i ? null : i);
              onTapWord?.(clean);
            }}
            className="relative inline decoration-accent-bright/40 decoration-dotted underline-offset-4 hover:underline focus-visible:underline"
          >
            {token}
            {revealed === i && (
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

/**
 * A German line with its translation one tap away — no German is ever
 * a black box, especially lines the learner is asked to speak.
 */
export function LineWithMeaning({
  de,
  en,
  glosses,
  open,
  onTapWord,
  className,
}: {
  de: string;
  en: string;
  glosses?: Map<string, string>;
  /** Force the translation visible (speaking tasks show it always). */
  open?: boolean;
  onTapWord?: (token: string) => void;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  const visible = open || shown;
  return (
    <span className={`inline-flex flex-col gap-0.5 ${className ?? ""}`}>
      <GlossText text={de} glosses={glosses} onTapWord={onTapWord} />
      {visible ? (
        <span className="text-sm text-muted">{en}</span>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="self-start text-xs font-medium text-accent-bright/80 hover:underline"
          aria-label="EN"
        >
          EN
        </button>
      )}
    </span>
  );
}

/* ---------- Shared chrome ---------- */

export function GeneratingCard() {
  const t = useStrings();
  return (
    <Card className="flex flex-col items-center gap-3 py-10">
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-line border-t-accent-bright"
      />
      <p className="text-sm text-muted">{t.tasks.generating}</p>
    </Card>
  );
}

export function FailedCard({ skip }: { skip: () => void }) {
  const t = useStrings();
  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-muted">{t.tasks.failedBody}</p>
      <Button variant="outline" onClick={skip}>
        {t.common.continue}
      </Button>
    </Card>
  );
}

export function TaskHeading({
  title,
  note,
  intro,
}: {
  title: string;
  note?: string;
  /** One line on why this step exists / how it ties into the scene. */
  intro?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {intro && (
        <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {intro}
        </p>
      )}
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}
