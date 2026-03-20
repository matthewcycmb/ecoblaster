import { GameState } from "@/lib/types";
import { INITIAL_HEALTH } from "@/lib/constants";

const HIGH_SCORE_KEY = "zombie-flick-high-score";

export function loadHighScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadHighScore();
    if (score > current) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    }
  } catch {
    // silently fail
  }
}

export function createInitialState(): GameState {
  return {
    phase: "idle",
    health: INITIAL_HEALTH,
    score: 0,
    wave: 1,
    zombies: [],
    hitToasts: [],
    lastFireTime: 0,
    muzzleFlashUntil: 0,
    waveCountdownUntil: 0,
    zombiesRemainingInWave: 0,
    zombiesSpawned: 0,
    lastSpawnTime: 0,
    combo: { count: 0, lastKillTime: 0, multiplier: 1 },
    powerUps: [],
    activePowerUp: null,
    isBossWave: false,
    bossDefeated: false,
    recoilUntil: 0,
    displayedScore: 0,
    lastScoreChangeTime: 0,
    highScore: loadHighScore(),
    isNewHighScore: false,
    waveTransitionUntil: 0,
  };
}
