import { GameState, DifficultyConfig } from "@/lib/types";
import {
  moveZombies,
  checkZombieReachedPlayer,
  spawnZombie,
  getZombieCountForWave,
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

  // --- Spawn zombies over time ---
  const totalForWave = getZombieCountForWave(state.wave, config, state.isBossWave);
  if (
    state.zombiesSpawned < totalForWave &&
    now - state.lastSpawnTime >= config.spawnIntervalSec * 1000
  ) {
    const z = spawnZombie(canvasWidth, canvasHeight, config, undefined, state.wave);
    state.zombies.push(z);
    state.zombiesSpawned++;
    state.lastSpawnTime = now;
  }

  // --- Move zombies (with slow-mo check) ---
  const slowMoActive = state.activePowerUp?.type === "slow-mo";
  moveZombies(state.zombies, canvasWidth, canvasHeight, deltaMs, slowMoActive);

  // --- Check zombie reached player ---
  for (const z of state.zombies) {
    if (!z.alive) continue;
    if (checkZombieReachedPlayer(z)) {
      z.alive = false;
      // Boss deals 3x damage
      const damage = z.zombieType === "boss" ? DAMAGE_PER_HIT * 3 : DAMAGE_PER_HIT;
      state.health = Math.max(0, state.health - damage);
      state.zombiesRemainingInWave--;

      // Reset combo on being hit
      state.combo.count = 0;
      state.combo.multiplier = 1;

      state.hitToasts.push({
        id: `toast-${now}-${z.id}`,
        x: canvasWidth / 2,
        y: canvasHeight * 0.5,
        createdAt: now,
        text: z.zombieType === "boss" ? "BOSS HIT! -60 HP" : "You were hit! -20 HP",
        color: "#FF5A5F",
      });

      if (state.health <= 0) {
        state.phase = "game-over";
        onStateChange("game-over");
        return;
      }
    }
  }

  // --- Remove dead zombies (keep collected power-ups from this frame) ---
  state.zombies = state.zombies.filter((z) => z.alive);

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
  const allSpawned = state.zombiesSpawned >= totalForWave;
  const allDead = state.zombies.filter((z) => z.alive).length === 0;

  // On boss waves, also require the boss to be defeated
  const bossCondition = state.isBossWave ? state.bossDefeated : true;

  if (allSpawned && allDead && bossCondition) {
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
  // Detect boss wave
  state.isBossWave = state.wave % BOSS_WAVE_INTERVAL === 0;
  state.bossDefeated = false;

  const totalForWave = getZombieCountForWave(state.wave, config, state.isBossWave);
  state.zombiesRemainingInWave = totalForWave + (state.isBossWave ? 1 : 0); // +1 for the boss itself
  state.zombiesSpawned = 0;
  state.lastSpawnTime = 0;

  // Spawn boss immediately on boss waves
  if (state.isBossWave) {
    const boss = spawnZombie(canvasWidth, canvasHeight, config, "boss", state.wave);
    state.zombies.push(boss);
    playBossRoar();
  }

  // Spawn first batch immediately (up to 3)
  const immediate = Math.min(3, totalForWave);
  for (let i = 0; i < immediate; i++) {
    const z = spawnZombie(canvasWidth, canvasHeight, config, undefined, state.wave);
    state.zombies.push(z);
    state.zombiesSpawned++;
  }
  state.lastSpawnTime = Date.now();
}
