import { Settings } from "@/lib/types";

const SETTINGS_KEY = "zombie-flick-settings";

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "easy",
  muted: false,
  playerName: "",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };

    return {
      difficulty:
        parsed.difficulty === "easy" ||
        parsed.difficulty === "normal" ||
        parsed.difficulty === "hard"
          ? parsed.difficulty
          : DEFAULT_SETTINGS.difficulty,
      muted:
        typeof parsed.muted === "boolean"
          ? parsed.muted
          : DEFAULT_SETTINGS.muted,
      playerName:
        typeof parsed.playerName === "string" &&
        parsed.playerName.length <= 32
          ? parsed.playerName
          : DEFAULT_SETTINGS.playerName,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently fail
  }
}
