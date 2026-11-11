"use client";

/**
 * Sprechen — the speaking rung the engine chose: shadow (listen, say it
 * back, WER verdict), construct / timed recall (English prompt → your
 * German), or scripted role-play of the scene as "Du". Honest scoring
 * from the transcript; self-assessment, clearly labelled, without STT.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { SceneLine } from "@/lib/curriculum/types";
import type { SpeechScore } from "@/lib/engine";
import { playCorrect, playTap, playWrong } from "@/lib/audio/sound";
import { useSpeech } from "@/components/audio/use-speech";
import { useStrings } from "@/components/i18n-provider";
import { Button, Card, cn } from "@/components/ui";
import { meanGrade, outcomeFor, RATE_SLOW, voiceFor, type BeatProps, type Grade } from "../lib";
import { BeatHeading, BottomBar, Feedback, GlossLine, RecordButton, SelfAssess, useRecorder } from "../parts";
import { ConstructDrill } from "./speak-construct";
import { bestSpeechScore, ScriptedPlay } from "./speak-scripted";

export function SpeakBeat(props: BeatProps) {
  switch (props.step.speak) {
    case "construct":
    case "timed-recall":
      return <ConstructSpeak {...props} />;
    case "scripted":
      return <ScriptedSpeak {...props} />;
    default:
      return <ShadowSpeak {...props} />;
  }
}

function ConstructSpeak(props: BeatProps) {
  const { station, step, submit, finish } = props;
  const t = useStrings();
  const timed = step.speak === "timed-recall";
  const items = station.construct;
  if (items.length === 0) return <ShadowSpeak {...props} />;
  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.speak} title={timed ? t.station.speak.timedTitle : t.station.speak.constructTitle} note={t.station.speak.nOfM(1, items.length)} />
      <ConstructDrill
        items={items}
        input="both"
        timed={timed}
        onItem={({ grade, evidence }) => submit(outcomeFor(step, timed ? "timed-recall" : "construct-sentence", grade >= 3, {}, evidence))}
        onDone={(grades) => {
          const mean = meanGrade(grades);
          finish({ correct: mean >= 3, detail: `${grades.filter((g) => g >= 3).length}/${grades.length} sentences` });
        }}
      />
    </div>
  );
}

function ScriptedSpeak({ station, step, lines, submit, finish }: BeatProps) {
  const t = useStrings();
  const script = lines.filter((line) => line.speaker !== "narrator");
  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.speak} title={t.station.speak.scriptedTitle} note={station.scene.settingEn} />
      <ScriptedPlay
        station={station}
        lines={script}
        onDone={(grades, transcript) => {
          const mean = meanGrade(grades);
          submit(outcomeFor(step, "scripted-dialogue", mean >= 2, {}, { inputSeconds: step.seconds }));
          finish({ correct: mean >= 2, detail: `${grades.filter((g) => g >= 2).length}/${grades.length} lines`, transcript });
        }}
      />
    </div>
  );
}

function ShadowSpeak({ station, step, lines, submit, finish }: BeatProps) {
  const t = useStrings();
  const speech = useSpeech();
  const recorder = useRecorder();
  const targets = useMemo(() => {
    const indices = step.lineIndices?.length ? step.lineIndices : station.shadowLineIndices;
    return indices.map((i) => lines[i] ?? station.scene.lines[i]).filter((l): l is SceneLine => Boolean(l));
  }, [step.lineIndices, station, lines]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<SpeechScore | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const speakRef = useRef<((line: SceneLine) => void) | null>(null);
  const line = targets[index];

  useEffect(() => {
    speakRef.current = (l: SceneLine) => void speech.speak(l.de, { voice: voiceFor(station, l.speaker), rate: RATE_SLOW });
  });

  // Each line reads itself first; the learner says it back.
  useEffect(() => {
    const current = targets[index];
    if (!current) return;
    const frame = requestAnimationFrame(() => speakRef.current?.(current));
    return () => cancelAnimationFrame(frame);
  }, [index, targets]);

  if (!line) {
    return (
      <BottomBar>
        <Button size="lg" fullWidth onClick={() => finish({ correct: true, detail: "no lines" })}>
          {t.station.continue}
        </Button>
      </BottomBar>
    );
  }

  const record = async () => {
    speech.stop();
    const result = await recorder.record();
    const scored = bestSpeechScore(result, line.de);
    setScore(scored);
    if (scored.verdict === "retry") playWrong();
    else playCorrect();
  };

  const advance = (grade: Grade) => {
    speech.stop();
    const all = [...grades, grade];
    if (index + 1 < targets.length) {
      playTap();
      setGrades(all);
      setIndex(index + 1);
      setScore(null);
    } else {
      const mean = meanGrade(all);
      submit(outcomeFor(step, "shadowing", mean >= 2, {}, { inputSeconds: step.seconds }));
      finish({ correct: mean >= 2, detail: `${all.filter((g) => g >= 2).length}/${all.length} lines` });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BeatHeading eyebrow={t.station.beats.speak} title={t.station.speak.shadowTitle} note={t.station.speak.nOfM(index + 1, targets.length)} />
      <Card
        key={index}
        className={cn("flex flex-col items-center gap-3 py-8 text-center animate-fade-up", score && (score.verdict === "retry" ? "animate-wrong" : "animate-correct"))}
      >
        <p className="text-title font-medium leading-relaxed">
          <GlossLine text={line.de} currentWord={speech.currentWord} />
        </p>
        <p className="text-body-sm text-ink-muted">{line.en}</p>
        <Button variant="secondary" icon={<Volume2 aria-hidden className="size-4" />} onClick={() => speakRef.current?.(line)}>
          {t.station.speak.listen}
        </Button>
        <p className="min-h-6 text-body-sm italic text-ink-muted" lang="de">
          {recorder.listening && recorder.interim ? `„${recorder.interim}“` : ""}
        </p>
      </Card>

      <BottomBar>
        <Feedback tone={!score ? "neutral" : score.verdict === "retry" ? "error" : "success"}>
          {!score
            ? ""
            : `${score.verdict === "great" ? t.station.speak.great : score.verdict === "good" ? t.station.speak.good : t.station.speak.retry}${
                score.missedWords.length > 0 ? ` ${t.station.speak.missed(score.missedWords.join(", "))}` : ""
              }`}
        </Feedback>
        {score ? (
          <div className={cn("grid gap-2", score.verdict === "retry" ? "grid-cols-2" : "grid-cols-1")}>
            {score.verdict === "retry" && (
              <Button variant="secondary" size="lg" disabled={recorder.listening} onClick={() => void record()}>
                {t.common.again}
              </Button>
            )}
            <Button size="lg" onClick={() => advance(score.grade)}>
              {t.station.continue}
            </Button>
          </div>
        ) : recorder.available ? (
          <RecordButton listening={recorder.listening} onClick={() => void record()} />
        ) : (
          <SelfAssess onPick={advance} />
        )}
      </BottomBar>
    </div>
  );
}
