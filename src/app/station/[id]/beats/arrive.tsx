"use client";

/**
 * Ankunft — Jule meets you at the station: the can-do as the headline,
 * her briefing (personalised when the tutor answered, hand-written
 * otherwise), what to listen for, the key performances to watch, and
 * the engine's honest one-liners. She can read the brief aloud in her
 * own voice; "Los geht's" rings the tram bell.
 */

import { Square, Volume2 } from "lucide-react";
import { lineOf } from "@/lib/curriculum";
import { playArrive } from "@/lib/audio/sound";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, Chip, Eyebrow, StationSign } from "@/components/ui";
import type { BeatProps } from "../lib";
import { BottomBar, JuleMark, lineNumberOf } from "../parts";

export function ArriveBeat({ station, plan, coach, visits, finish }: BeatProps) {
  const t = useStrings();
  const line = lineOf(station);
  const speech = useSpeech();

  const brief = coach.brief?.briefEn ?? station.coach.briefEn;
  const listenFor = coach.brief?.listenForEn ?? station.coach.listenForEn;
  const keyPerformances = coach.brief?.keyPerformances ?? coach.keyPerformances;

  const toggleSpeech = () => {
    if (speech.speaking) speech.stop();
    else void speech.speak(brief, { voice: "jule" });
  };

  return (
    <div className="flex flex-1 flex-col gap-5 stagger-children">
      <StationSign
        name={station.name}
        subtitle={station.title}
        line={lineNumberOf(line)}
        status="current"
        index={station.order}
        statusLabel={t.station.stationStatus}
        arrive
      />

      <Card variant="raised" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <JuleMark line={line} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-display text-title text-ink">{t.station.jule.name}</span>
            <span className="text-caption text-ink-muted">{t.station.jule.role}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={speech.speaking}
            icon={speech.speaking ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
            onClick={toggleSpeech}
          >
            {speech.speaking ? t.station.jule.stop : t.station.jule.speak}
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <Eyebrow>{t.station.arrive.objective}</Eyebrow>
          <h2 className="font-display text-display-m text-ink">{station.canDoEn}</h2>
        </div>

        <p className="text-body text-ink">{brief}</p>

        {listenFor.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow>{t.station.arrive.listenFor}</Eyebrow>
            <ul className="flex flex-col gap-1">
              {listenFor.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-body-sm text-ink">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-pill bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {keyPerformances.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow>{t.station.arrive.watchFor}</Eyebrow>
            <ul className="flex flex-col gap-2">
              {keyPerformances.map((kp) => (
                <li key={kp.focusDe} className="flex flex-col gap-1">
                  <Chip variant="accent" size="sm" className="self-start">
                    <span lang="de">{kp.focusDe}</span>
                  </Chip>
                  <span className="text-caption text-ink-muted">{kp.whyEn}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {plan.briefing.length > 0 && (
        <div className="flex flex-col gap-1.5 px-1">
          <Eyebrow>{visits > 0 ? t.station.arrive.visit(visits + 1) : t.station.arrive.today}</Eyebrow>
          <ul className="flex flex-col gap-1">
            {plan.briefing.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-body-sm text-ink">
                <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <BottomBar>
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            speech.stop();
            playArrive();
            finish({ correct: true });
          }}
        >
          {t.station.arrive.go}
        </Button>
      </BottomBar>
    </div>
  );
}
