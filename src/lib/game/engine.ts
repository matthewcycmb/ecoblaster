import { GameState, DifficultyConfig } from "@/lib/types";
import {
  moveTrash,
  checkTrashReachedPlayer,
  spawnTrash,
  getTrashCountForWave,
} from "./zombies";
import { checkPowerUpCollection } from "./powerups";
import { renderFrame } from "./renderer";
import {
  DAMAGE_PER_HIT,
  HIT_TOAST_DURATION_MS,
  WAVE_COUNTDOWN_MS,
  COMBO_DECAY_MS,
  POWERUP_LIFETIME_MS,
  BOSS_WAVE_INTERVAL,
} from "@/lib/constants";
import { playBossRoar } from "@/lib/audio/sfx";

export interface GameEngine {
  start: () => void;
  stop: () => void;
}

export function createGameEngine(
  canvas: HTMLCanvasElement,
  getState: () => GameState,
  onStateChange: (phase: GameState["phase"]) => void,
  config: DifficultyConfig,
  getVideoElement?: () => HTMLVideoElement | null,
  getAimPosition?: () => { x: number; y: number } | null
): GameEngine {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let lastTime = 0;
  let running = false;

  function tick(now: number) {
    if (!running) return;
    const state = getState();

    if (lastTime === 0) lastTime = now;
    const deltaMs = Math.min(now - lastTime, 100);
    lastTime = now;

    if (state.phase === "playing") {
      const aim = getAimPosition?.() ?? null;
      updatePlaying(state, deltaMs, canvas.width, canvas.height, config, onStateChange, aim);
    } else if (state.phase === "wave-countdown") {
      if (Date.now() >= state.waveCountdownUntil) {
        state.phase = "playing";
        startWave(state, canvas.width, canvas.height, config);
        onStateChange("playing");
      }
    }

    // Clean up expired hit toasts
    const nowMs = Date.now();
    state.hitToasts = state.hitToasts.filter(
      (t) => nowMs - t.createdAt < HIT_TOAST_DURATION_MS
    );

    const video = getVideoElement?.() ?? null;
    const aim = getAimPosition?.() ?? null;
    renderFrame(ctx, state, canvas.width, canvas.height, video, aim?.x, aim?.y);
    animId = requestAnimationFrame(tick);
  }

  return {
    start() {
      running = true;
      lastTime = 0;
      animId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(animId);
    },
  };
}

function updatePlaying(
  state: GameState,
  deltaMs: number,
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig,
  onStateChange: (phase: GameState["phase"]) => void,
  aim: { x: number; y: number } | null
): void {
  const now = Date.now();

  // --- Combo decay ---
  if (state.combo.count > 0 && now - state.combo.lastKillTime > COMBO_DECAY_MS) {
    state.combo.count = 0;
    state.combo.multiplier = 1;
  }

  // --- Power-up expiry ---
  if (state.activePowerUp && now >= state.activePowerUp.expiresAt) {
    state.activePowerUp = null;
  }

  // --- Remove uncollected power-ups after lifetime ---
  state.powerUps = state.powerUps.filter(
    (pu) => pu.collected || now - pu.createdAt < POWERUP_LIFETIME_MS
  );

  // --- Auto-collect power-ups near crosshair ---
  if (aim) {
    checkPowerUpCollection(state, aim.x, aim.y);
  }

  // --- Spawn trash over time ---
  const totalForWave = getTrashCountForWave(state.wave, config, state.isSurgeWave);
  if (
    state.trashSpawned < totalForWave &&
    now - state.lastSpawnTime >= config.spawnIntervalSec * 1000
  ) {
    const z = spawnTrash(canvasWidth, canvasHeight, config, undefined, state.wave);
    state.trashItems.push(z);
    state.trashSpawned++;
    state.lastSpawnTime = now;
  }

  // --- Move trash (with slow-mo check) ---
  const slowMoActive = state.activePowerUp?.type === "slow-mo";
  moveTrash(state.trashItems, canvasWidth, canvasHeight, deltaMs, slowMoActive);

  // --- Check trash reached player ---
  for (const z of state.trashItems) {
    if (!z.alive) continue;
    if (checkTrashReachedPlayer(z)) {
      z.alive = false;
      // Barge deals 3x damage
      const damage = z.trashType === "barge" ? DAMAGE_PER_HIT * 3 : DAMAGE_PER_HIT;
      state.health = Math.max(0, state.health - damage);
      state.trashRemainingInWave--;

      // Reset combo on being hit
      state.combo.count = 0;
      state.combo.multiplier = 1;

      state.hitToasts.push({
        id: `toast-${now}-${z.id}`,
        x: canvasWidth / 2,
        y: canvasHeight * 0.5,
        createdAt: now,
        text: z.trashType === "barge" ? "Barge impact! -60 Health" : "Trash hit the reef! -20 Health",
        color: "#FF5A5F",
      });

      if (state.health <= 0) {
        state.phase = "game-over";
        onStateChange("game-over");
        return;
      }
    }
  }

  // --- Remove dead trash (keep collected power-ups from this frame) ---
  state.trashItems = state.trashItems.filter((z) => z.alive);

  // --- Animate displayed score toward actual score ---
  if (state.displayedScore < state.score) {
    const diff = state.score - state.displayedScore;
    const increment = Math.max(1, Math.ceil(diff * 0.1));
    state.displayedScore = Math.min(state.score, state.displayedScore + increment);
  }
  if (state.score !== state.displayedScore || (now - state.lastScoreChangeTime < 500)) {
    // keep lastScoreChangeTime fresh while animating
  }

  // --- High score detection ---
  if (state.score > state.highScore && !state.isNewHighScore) {
    state.isNewHighScore = true;
    state.highScore = state.score;
  }

  // --- Check wave cleared ---
  const allSpawned = state.trashSpawned >= totalForWave;
  const allDead = state.trashItems.filter((z) => z.alive).length === 0;

  // On surge waves, also require the surge to be cleared
  const surgeCondition = state.isSurgeWave ? state.surgeCleared : true;

  if (allSpawned && allDead && surgeCondition) {
    state.wave++;
    state.phase = "wave-countdown";
    state.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    state.waveTransitionUntil = Date.now() + 2000;
    onStateChange("wave-countdown");
  }
}

export function startWave(
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig
): void {
  // Detect surge wave
  state.isSurgeWave = state.wave % BOSS_WAVE_INTERVAL === 0;
  state.surgeCleared = false;

  const totalForWave = getTrashCountForWave(state.wave, config, state.isSurgeWave);
  state.trashRemainingInWave = totalForWave + (state.isSurgeWave ? 1 : 0); // +1 for the barge itself
  state.trashSpawned = 0;
  state.lastSpawnTime = 0;

  // Spawn barge immediately on surge waves
  if (state.isSurgeWave) {
    const barge = spawnTrash(canvasWidth, canvasHeight, config, "barge", state.wave);
    state.trashItems.push(barge);
    playBossRoar();
  }

  // Spawn first batch immediately (up to 3)
  const immediate = Math.min(state.wave === 1 ? 1 : 3, totalForWave);
  for (let i = 0; i < immediate; i++) {
    const z = spawnTrash(canvasWidth, canvasHeight, config, undefined, state.wave);
    state.trashItems.push(z);
    state.trashSpawned++;
  }
  state.lastSpawnTime = Date.now();
}
