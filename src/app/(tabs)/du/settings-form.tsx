"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { setSoundEnabled, soundEnabled } from "@/lib/audio/sound";
import { Button, SectionLabel } from "@/components/ui";

const initialState: SettingsState = { saved: false, error: null };

function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition ${
            value === option.value
              ? "border-accent-bright bg-accent/10 font-semibold text-accent-bright"
              : "border-line text-muted hover:border-accent-bright/50"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span className="text-sm">{option.label}</span>
          {option.hint && <span className="text-[10px] leading-tight">{option.hint}</span>}
        </label>
      ))}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-accent-bright" : "bg-line"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </label>
  );
}

export function SettingsForm({
  initialMinutes,
  initialChallenge,
  initialPlan,
}: {
  initialMinutes: 5 | 8 | 12 | 15;
  initialChallenge: "sanft" | "standard" | "mutig";
  initialPlan: string;
}) {
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [challenge, setChallenge] = useState(initialChallenge);
  const [sound, setSound] = useState(true);
  const [dasAmber, setDasAmber] = useState(false);

  // Device prefs live in localStorage; read them after mount (in a
  // frame callback — the values may differ from the SSR defaults).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSound(soundEnabled());
      setDasAmber(window.localStorage.getItem("lg:das-amber") === "on");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Länge einer Runde</SectionLabel>
        <Segmented
          name="minutes"
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: "5", label: "5 min" },
            { value: "8", label: "8 min" },
            { value: "12", label: "12 min" },
            { value: "15", label: "15 min" },
          ]}
        />
        <p className="text-xs text-muted">
          Kurz und täglich schlägt lang und selten — jede Länge hält die Serie.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>Herausforderung</SectionLabel>
        <Segmented
          name="challenge"
          value={challenge}
          onChange={setChallenge}
          options={[
            { value: "sanft", label: "Sanft", hint: "~97% bekannt" },
            { value: "standard", label: "Standard", hint: "~95% bekannt" },
            { value: "mutig", label: "Mutig", hint: "~93% bekannt" },
          ]}
        />
        <p className="text-xs text-muted">
          Wie viel jedes Textes garantiert aus Wörtern besteht, die du schon
          kennst. Der Rest ist die Lernzone.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>Dein Anker</SectionLabel>
        <input
          type="text"
          name="plan"
          defaultValue={initialPlan}
          maxLength={140}
          placeholder="Nach dem Morgenkaffee mache ich eine Runde."
          className="w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
        />
        <p className="text-xs text-muted">
          Ein Wenn-dann-Plan wirkt besser als jede Erinnerung — häng die Runde
          an etwas, das du sowieso tust.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionLabel>Dieses Gerät</SectionLabel>
        <Toggle
          label="Töne"
          hint="Leise Klänge bei Antworten und Meilensteinen"
          checked={sound}
          onChange={(on) => {
            setSound(on);
            setSoundEnabled(on);
          }}
        />
        <Toggle
          label="das in Amber"
          hint="Für Rot-Grün-Farbschwäche: das wird amber statt grün"
          checked={dasAmber}
          onChange={(on) => {
            setDasAmber(on);
            window.localStorage.setItem("lg:das-amber", on ? "on" : "off");
            document.documentElement.classList.toggle("das-amber", on);
          }}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Einen Moment …" : state.saved ? "Gespeichert ✓" : "Speichern"}
      </Button>
    </form>
  );
}
