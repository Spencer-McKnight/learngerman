/**
 * German audio, behind one seam: every call site uses speakGerman().
 * Today it rides the browser's speechSynthesis with the best available
 * de-DE voice (an honest placeholder — quality varies, iOS is weak);
 * the planned edge-tts → Supabase Storage pipeline replaces the body
 * of this module without touching any component.
 */

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voices: SpeechSynthesisVoice[] = [];

function germanVoices(): SpeechSynthesisVoice[] {
  if (!ttsAvailable()) return [];
  if (voices.length === 0) {
    voices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("de"));
  }
  return voices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voices = [];
  };
}

/**
 * Speak German text. `voiceIndex` rotates across available voices for
 * HVPT talker variability (modulo however many the device has).
 */
export function speakGerman(
  text: string,
  opts: { rate?: number; voiceIndex?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = opts.rate ?? 0.92;
    const available = germanVoices();
    if (available.length > 0) {
      utterance.voice = available[(opts.voiceIndex ?? 0) % available.length];
    }
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
