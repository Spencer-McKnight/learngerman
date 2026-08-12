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
          className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-all duration-200 ${
            value === option.value
              ? "border-accent-bright bg-accent/10 font-semibold text-accent-bright shadow-sm scale-[1.02]"
              : "border-line text-muted hover:border-accent-bright/50 hover:shadow-sm"
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
        className={`relative h-6 w-11 shrink-0 rounded-full transition-all duration-200 ${
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
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
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
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <SettingsIcon type="language" />
            {t.settings.language}
          </span>
        </SectionLabel>
        <Segmented
          name="uiLang"
          value={uiLang}
          onChange={setUiLang}
          options={[
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <SettingsIcon type="clock" />
            {t.settings.roundLength}
          </span>
        </SectionLabel>
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
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <SettingsIcon type="target" />
            {t.settings.challenge}
          </span>
        </SectionLabel>
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
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <SettingsIcon type="anchor" />
            {t.settings.anchor}
          </span>
        </SectionLabel>
        <input
          type="text"
          name="plan"
          defaultValue={initialPlan}
          maxLength={140}
          placeholder={t.settings.anchorPlaceholder}
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:border-accent-bright focus:ring-2 focus:ring-accent-glow focus:shadow-md"
        />
      </div>

      <div className="flex flex-col gap-4">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <SettingsIcon type="device" />
            {t.settings.device}
          </span>
        </SectionLabel>
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
            className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left transition-all duration-200 hover:border-accent-bright/50 hover:shadow-sm"
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
            <span className="text-success">✓</span>
            <span>{t.settings.installedNote}</span>
          </div>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-error animate-shake">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t.common.oneMoment : state.saved ? t.settings.saved : t.settings.save}
      </Button>
    </form>
  );
}

function SettingsIcon({ type }: { type: "language" | "clock" | "target" | "anchor" | "device" }) {
  const cls = "size-3.5 text-muted";
  if (type === "language")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10" />
      </svg>
    );
  if (type === "clock")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  if (type === "target")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  if (type === "anchor")
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="5" r="3" />
        <line x1="12" x2="12" y1="22" y2="8" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </svg>
  );
}
