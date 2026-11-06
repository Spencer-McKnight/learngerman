"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Share, Volume1, Volume2, VolumeX } from "lucide-react";
import { saveSettings, type SettingsState } from "./actions";
import { playTap, setSoundEnabled, setSoundVolume, soundEnabled, soundVolume } from "@/lib/audio/sound";
import { speak, stopSpeaking } from "@/lib/audio/tts";
import { useStrings } from "@/components/i18n-provider";
import type { UiLang } from "@/lib/i18n/strings";
import { Button, Eyebrow, Field, SectionLabel, Segmented, Toggle } from "@/components/ui";

const initialState: SettingsState = { saved: false, error: null };

/** What Jule says when the learner tests her voice: German content, not chrome. */
const VOICE_TEST_LINE = "Servus, ich bin Jule. Schön, dass du da bist — steigen wir ein?";

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

type Minutes = "5" | "8" | "12" | "15";
type Challenge = "sanft" | "standard" | "mutig";

const CHALLENGE_PCT: Record<Challenge, number> = { sanft: 97, standard: 95, mutig: 93 };

export function SettingsForm({
  initialMinutes,
  initialChallenge,
  initialPlan,
  initialUiLang,
}: {
  initialMinutes: 5 | 8 | 12 | 15;
  initialChallenge: Challenge;
  initialPlan: string;
  initialUiLang: UiLang;
}) {
  const t = useStrings();
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const [minutes, setMinutes] = useState<Minutes>(String(initialMinutes) as Minutes);
  const [challenge, setChallenge] = useState<Challenge>(initialChallenge);
  const [uiLang, setUiLang] = useState<UiLang>(initialUiLang);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(100);
  const [dasAmber, setDasAmber] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { installState, install } = useInstallPrompt();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSound(soundEnabled());
      setVolume(Math.round(soundVolume() * 100));
      setDasAmber(window.localStorage.getItem("lg:das-amber") === "on");
    });
    return () => {
      cancelAnimationFrame(frame);
      stopSpeaking();
    };
  }, []);

  const testVoice = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      await speak(VOICE_TEST_LINE, { voice: "jule" });
    } finally {
      setSpeaking(false);
    }
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Segmented controls are buttons; the chosen values post through these. */}
      <input type="hidden" name="uiLang" value={uiLang} />
      <input type="hidden" name="minutes" value={minutes} />
      <input type="hidden" name="challenge" value={challenge} />

      <div className="flex flex-col gap-2.5">
        <Eyebrow as="h2" id="settings-language">{t.settings.language}</Eyebrow>
        <Segmented<UiLang>
          aria-labelledby="settings-language"
          value={uiLang}
          onChange={(next) => {
            playTap();
            setUiLang(next);
          }}
          options={[
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <Eyebrow as="h2" id="settings-minutes">{t.settings.roundLength}</Eyebrow>
        <Segmented<Minutes>
          aria-labelledby="settings-minutes"
          value={minutes}
          onChange={(next) => {
            playTap();
            setMinutes(next);
          }}
          options={[
            { value: "5", label: "5 min" },
            { value: "8", label: "8 min" },
            { value: "12", label: "12 min" },
            { value: "15", label: "15 min" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <Eyebrow as="h2" id="settings-challenge">{t.settings.challenge}</Eyebrow>
        <Segmented<Challenge>
          aria-labelledby="settings-challenge"
          value={challenge}
          onChange={(next) => {
            playTap();
            setChallenge(next);
          }}
          options={[
            { value: "sanft", label: t.settings.gentle },
            { value: "standard", label: t.settings.standard },
            { value: "mutig", label: t.settings.brave },
          ]}
        />
        <p className="text-caption text-ink-muted">
          <span className="tabular">{t.settings.knownHint(CHALLENGE_PCT[challenge])}</span>
          {" — "}
          {t.settings.challengeNote}
        </p>
      </div>

      <Field
        label={t.settings.anchor}
        name="plan"
        defaultValue={initialPlan}
        maxLength={140}
        placeholder={t.settings.anchorPlaceholder}
        autoComplete="off"
      />

      <div className="flex flex-col gap-3">
        <SectionLabel>{t.settings.device}</SectionLabel>
        <Toggle
          label={t.settings.sounds}
          description={t.settings.soundsHint}
          checked={sound}
          onChange={(on) => {
            setSound(on);
            setSoundEnabled(on);
            if (on) playTap();
          }}
        />
        <div className="flex flex-col gap-1.5 px-1">
          <label htmlFor="settings-volume" className="flex items-center justify-between">
            <span className="flex flex-col">
              <span className="text-body font-medium text-ink">{t.settings.volume}</span>
              <span className="text-body-sm text-ink-muted">{t.settings.volumeHint}</span>
            </span>
            <span className="text-body-sm tabular text-ink-muted">{volume} %</span>
          </label>
          <div className="flex min-h-11 items-center gap-3">
            <VolumeIcon className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <input
              id="settings-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={!sound}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                setSoundVolume(next / 100);
              }}
              onPointerUp={() => playTap()}
              onKeyUp={(event) => {
                if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") playTap();
              }}
              className="h-11 w-full cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-1">
          <span className="flex min-w-0 flex-col">
            <span className="text-body font-medium text-ink">{t.settings.testVoice}</span>
            <span className="text-body-sm text-ink-muted">
              {speaking ? t.settings.testVoiceSpeaking : t.settings.testVoiceHint}
            </span>
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-pressed={speaking}
            onClick={testVoice}
            icon={<Volume2 className="size-4" aria-hidden />}
          >
            {t.settings.testVoice}
          </Button>
        </div>
        <Toggle
          label={t.settings.dasAmber}
          description={t.settings.dasAmberHint}
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
            className="flex min-h-11 items-center gap-3 rounded-md border border-hairline px-3 py-2.5 text-left transition-[border-color,box-shadow] hover:border-accent hover:shadow-flat"
          >
            <Download className="size-5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-body-sm font-medium text-ink">{t.settings.installTitle}</span>
              <span className="block text-caption text-ink-muted">{t.settings.installHint}</span>
            </span>
          </button>
        )}
        {installState === "ios" && (
          <div className="flex items-start gap-3 rounded-md border border-hairline px-3 py-2.5">
            <Download className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-body-sm font-medium text-ink">{t.settings.installTitle}</span>
              <span className="block text-caption text-ink-muted">
                {t.settings.installIosPrefix}{" "}
                <Share className="inline size-3.5 align-text-bottom" aria-hidden />{" "}
                {t.settings.installIosSuffix}
              </span>
            </span>
          </div>
        )}
        {installState === "installed" && (
          <div className="flex items-center gap-2.5 px-1 text-body-sm text-ink-muted">
            <Check className="size-4 text-success" aria-hidden />
            <span>{t.settings.installedNote}</span>
          </div>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-body-sm font-medium text-error animate-shake">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} size="lg">
        {state.saved && !pending ? t.settings.saved : t.settings.save}
      </Button>
    </form>
  );
}
