export type AudioEvent =
  | "mic_active"
  | "mic_muted"
  | "mic_test"
  | "screen_start"
  | "screen_stop"
  | "connected"
  | "disconnected"
  | "join"
  | "leave";

export type AudioMode = "sound" | "voice" | "both" | "disabled";
export type AudioVoice = "laura" | "adam";

export type AudioPreferences = {
  soundsEnabled: boolean;
  voiceEnabled: boolean;
  voice: AudioVoice;
  mode: AudioMode;
  soundsVolume: number;
  voiceVolume: number;
};

export const defaultAudioPreferences: AudioPreferences = {
  soundsEnabled: true,
  voiceEnabled: true,
  voice: "laura",
  mode: "both",
  soundsVolume: 0.7,
  voiceVolume: 0.85,
};

const storageKey = "grindlobby.audio-preferences";
const eventQueue: Promise<void>[] = [];

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === "undefined") return defaultAudioPreferences;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as Partial<AudioPreferences> | null;
    return {
      ...defaultAudioPreferences,
      ...stored,
      soundsVolume: Math.min(1, Math.max(0, Number(stored?.soundsVolume ?? defaultAudioPreferences.soundsVolume))),
      voiceVolume: Math.min(1, Math.max(0, Number(stored?.voiceVolume ?? defaultAudioPreferences.voiceVolume))),
    };
  } catch {
    return defaultAudioPreferences;
  }
}

export function saveAudioPreferences(preferences: AudioPreferences) {
  if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(preferences));
}

function playFile(path: string, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.addEventListener("ended", () => resolve(), { once: true });
    audio.addEventListener("error", () => resolve(), { once: true });
    audio.play().catch(() => resolve());
  });
}

export function playAudioEvent(event: AudioEvent, preferences = loadAudioPreferences()) {
  if (preferences.mode === "disabled") return;
  const play = async () => {
    const playSound = preferences.soundsEnabled && (preferences.mode === "sound" || preferences.mode === "both");
    const playVoice = preferences.voiceEnabled && (preferences.mode === "voice" || preferences.mode === "both");
    if (playSound) await playFile(`/audio/ui/${event}.wav`, preferences.soundsVolume);
    if (playSound && playVoice) await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (playVoice && ["connected", "disconnected", "mic_active", "mic_muted", "screen_start", "screen_stop"].includes(event)) {
      await playFile(`/audio/voices/${preferences.voice}/${event}.mp3`, preferences.voiceVolume);
    }
  };
  const next = (eventQueue[eventQueue.length - 1] || Promise.resolve()).then(play);
  eventQueue.push(next);
  next.finally(() => {
    const index = eventQueue.indexOf(next);
    if (index >= 0) eventQueue.splice(index, 1);
  });
}
