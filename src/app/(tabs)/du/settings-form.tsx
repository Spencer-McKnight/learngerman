"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { setSoundEnabled, soundEnabled } from "@/lib/audio/sound";
import { useStrings } from "@/components/i18n-provider";
import type { UiLang } from "@/lib/i18n/strings";
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

type InstallState = "hidden" | "prompt" | "ios" | "installed";

function useInstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("hidden");

  useEffect(() => {
    // Standalone/iOS detection reads external state; defer the setState
    // to a frame callback (same idiom as the localStorage prefs below).
    const frame = requestAnimationFrame(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;
      if (standalone) {
        setInstallState("installed");
        return;
      }
      const isIos =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as Window & { MSStream?: unknown }).MSStream;
      if (isIos) setInstallState("ios");
    });

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setInstallState("prompt");
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => setInstallState("installed");
    window.addEventListener("appinstalled", installed);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") setInstallState("installed");
    deferredPrompt.current = null;
  }, []);

  return { installState, install };
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function SettingsForm({
  initialMinutes,
  initialChallenge,
  initialPlan,
  initialUiLang,
}: {
  initialMinutes: 5 | 8 | 12 | 15;
  initialChallenge: "sanft" | "standard" | "mutig";
  initialPlan: string;
  initialUiLang: UiLang;
}) {
  const t = useStrings();
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [challenge, setChallenge] = useState(initialChallenge);
  const [uiLang, setUiLang] = useState<UiLang>(initialUiLang);
  const [sound, setSound] = useState(true);
  const [dasAmber, setDasAmber] = useState(false);
  const { installState, install } = useInstallPrompt();

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
        <SectionLabel>{t.settings.language}</SectionLabel>
        <Segmented
          name="uiLang"
          value={uiLang}
          onChange={setUiLang}
          options={[
            // Language names stay untranslated so a beginner lost in
            // the wrong language can always find the way out.
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
          ]}
        />
        <p className="text-xs text-muted">{t.settings.languageNote}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>{t.settings.roundLength}</SectionLabel>
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
        <p className="text-xs text-muted">{t.settings.roundLengthNote}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>{t.settings.challenge}</SectionLabel>
        <Segmented
          name="challenge"
          value={challenge}
          onChange={setChallenge}
          options={[
            { value: "sanft", label: t.settings.gentle, hint: t.settings.knownHint(97) },
            { value: "standard", label: t.settings.standard, hint: t.settings.knownHint(95) },
            { value: "mutig", label: t.settings.brave, hint: t.settings.knownHint(93) },
          ]}
        />
        <p className="text-xs text-muted">{t.settings.challengeNote}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>{t.settings.anchor}</SectionLabel>
        <input
          type="text"
          name="plan"
          defaultValue={initialPlan}
          maxLength={140}
          placeholder={t.settings.anchorPlaceholder}
          className="w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/30"
        />
        <p className="text-xs text-muted">{t.settings.anchorNote}</p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionLabel>{t.settings.device}</SectionLabel>
        <Toggle
          label={t.settings.sounds}
          hint={t.settings.soundsHint}
          checked={sound}
          onChange={(on) => {
            setSound(on);
            setSoundEnabled(on);
          }}
        />
        <Toggle
          label={t.settings.dasAmber}
          hint={t.settings.dasAmberHint}
          checked={dasAmber}
          onChange={(on) => {
            setDasAmber(on);
            window.localStorage.setItem("lg:das-amber", on ? "on" : "off");
            document.documentElement.classList.toggle("das-amber", on);
          }}
        />
        {installState === "prompt" && (
          <button
            type="button"
            onClick={install}
            className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-accent-bright/50"
          >
            <span className="text-base">📲</span>
            <span>
              <span className="block text-sm font-medium">{t.settings.installTitle}</span>
              <span className="block text-xs text-muted">{t.settings.installHint}</span>
            </span>
          </button>
        )}
        {installState === "ios" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5">
            <span className="text-base">📲</span>
            <span>
              <span className="block text-sm font-medium">{t.settings.installTitle}</span>
              <span className="block text-xs text-muted">
                {t.settings.installIosPrefix}{" "}
                <span className="inline-flex translate-y-px text-base leading-none">
                  ⎙
                </span>{" "}
                {t.settings.installIosSuffix}
              </span>
            </span>
          </div>
        )}
        {installState === "installed" && (
          <div className="flex items-center gap-2.5 px-3 py-1 text-sm text-muted">
            <span>✓</span>
            <span>{t.settings.installedNote}</span>
          </div>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t.common.oneMoment : state.saved ? t.settings.saved : t.settings.save}
      </Button>
    </form>
  );
}
