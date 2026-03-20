import { Settings } from "@/lib/types";
import { FLICK_THRESHOLD, DEFAULT_COOLDOWN_MS } from "@/lib/constants";

const SETTINGS_KEY = "zombie-flick-settings";

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: FLICK_THRESHOLD,
  flickCooldownMs: DEFAULT_COOLDOWN_MS,
  difficulty: "normal",
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

    // Validate each field individually to prevent tampering
    return {
      sensitivity:
        typeof parsed.sensitivity === "number" &&
        parsed.sensitivity >= -0.08 &&
        parsed.sensitivity <= -0.005
          ? parsed.sensitivity
          : DEFAULT_SETTINGS.sensitivity,
      flickCooldownMs:
        typeof parsed.flickCooldownMs === "number" &&
        parsed.flickCooldownMs >= 50 &&
        parsed.flickCooldownMs <= 500
          ? parsed.flickCooldownMs
          : DEFAULT_SETTINGS.flickCooldownMs,
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
