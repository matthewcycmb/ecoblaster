import { GameState, DifficultyConfig, HandGunState } from "@/lib/types";
import {
  moveTrash,
  checkTrashReachedPlayer,
  spawnTrash,
  getTrashCountForWave,
} from "./zombies";
import { checkPowerUpCollection } from "./powerups";
import { moveTurtles, checkTurtleTrashCollision, maybeSpawnTurtles } from "./turtles";
import { moveFish, maybeSpawnFish } from "./fish";
import { renderFrame } from "./renderer";
import { updateDefenders } from "./defenders";
import {
  DAMAGE_PER_HIT,
  HIT_TOAST_DURATION_MS,
  WAVE_COUNTDOWN_MS,
  POWERUP_LIFETIME_MS,
  BOSS_WAVE_INTERVAL,
  BOSS_SPAWN_INTERVAL_MS,
  TURTLE_DAMAGE,
  INITIAL_HEALTH,
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
  getConfig: () => DifficultyConfig,
  getVideoElement?: () => HTMLVideoElement | null,
  getAimPosition?: () => { x: number; y: number } | null,
  getAimPositions?: () => ({ x: number; y: number } | null)[],
  getHandGunStates?: () => HandGunState[]
): GameEngine {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let lastTime = 0;
  let running = false;

  function tick(now: number) {
    if (!running) return;
    const state = getState();
    const config = getConfig();

    if (lastTime === 0) lastTime = now;
    const deltaMs = Math.min(now - lastTime, 100);
    lastTime = now;

    if (state.phase === "playing") {
      const allAims = getAimPositions?.() ?? [];
      const aim = allAims[0] ?? getAimPosition?.() ?? null;
      const allAimsList = allAims.filter(Boolean) as { x: number; y: number }[];
      if (allAimsList.length === 0 && aim) allAimsList.push(aim);
      updatePlaying(state, deltaMs, canvas.width, canvas.height, config, onStateChange, aim, allAimsList);
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
    const aims = getAimPositions?.() ?? [];
    const aim = aims[0] ?? getAimPosition?.() ?? null;
    const secondAim = aims[1] ?? null;
    const handGunStatesArr = getHandGunStates?.() ?? [];
    renderFrame(
      ctx, state, canvas.width, canvas.height, video,
      aim?.x, aim?.y,
      secondAim?.x, secondAim?.y,
      handGunStatesArr.length > 0 ? handGunStatesArr : undefined
    );
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
  aim: { x: number; y: number } | null,
  allAims: { x: number; y: number }[] = []
): void {
  const now = Date.now();

  // --- Time freeze check ---
  const freezeActive = state.timeFreezeActive && now < state.timeFreezeUntil;
  if (!freezeActive && state.timeFreezeActive) {
    state.timeFreezeActive = false;
  }

  // Combo only resets when trash hits the reef (health loss) — no time decay

  // --- Power-up expiry ---
  if (state.activePowerUp && now >= state.activePowerUp.expiresAt) {
    state.activePowerUp = null;
  }

  // --- Remove uncollected power-ups after lifetime ---
  state.powerUps = state.powerUps.filter(
    (pu) => pu.collected || now - pu.createdAt < POWERUP_LIFETIME_MS
  );

  // --- Auto-collect power-ups near crosshair(s) ---
  for (const a of allAims) {
    checkPowerUpCollection(state, a.x, a.y);
  }

  // --- Skip movement, spawning, and reach-checks during freeze ---
  if (!freezeActive) {
    // --- Spawn trash over time (batch size grows each wave) ---
    const totalForWave = getTrashCountForWave(state.wave, config, state.isSurgeWave);
    const spawnInterval = Math.max(1.0, config.spawnIntervalSec - (state.wave - 1) * 0.08);
    if (
      state.trashSpawned < totalForWave &&
      now - state.lastSpawnTime >= spawnInterval * 1000
    ) {
      const batchSize = Math.min(4, 1 + Math.floor(state.wave / 3));
      const toSpawn = Math.min(batchSize, totalForWave - state.trashSpawned);
      for (let i = 0; i < toSpawn; i++) {
        const z = spawnTrash(canvasWidth, canvasHeight, config, undefined, state.wave);
        state.trashItems.push(z);
        state.trashSpawned++;
      }
      state.lastSpawnTime = now;
    }

    // --- Barge spawns smaller trash while alive ---
    if (state.isSurgeWave && !state.surgeCleared) {
      const barge = state.trashItems.find((z) => z.trashType === "barge" && z.alive);
      if (barge && now - state.lastBargeSpawnTime >= BOSS_SPAWN_INTERVAL_MS) {
        const minion = spawnTrash(canvasWidth, canvasHeight, config, undefined, state.wave);
        minion.laneX = barge.laneX + (Math.random() * 0.3 - 0.15);
        minion.depth = barge.depth;
        state.trashItems.push(minion);
        state.lastBargeSpawnTime = now;
      }
    }

    // --- Move trash (with slow-mo check + low-health slowdown) ---
    const slowMoActive = state.activePowerUp?.type === "slow-mo";
    const lowHealthFactor = state.health < 30 ? 0.5 : 1.0;
    moveTrash(state.trashItems, canvasWidth, canvasHeight, deltaMs * lowHealthFactor, slowMoActive);

    // --- Move swimming fish + spawn new ones ---
    moveFish(state.swimmingFish, canvasWidth, deltaMs);
    maybeSpawnFish(state, canvasWidth, canvasHeight);

    // --- Move sea turtles and check collisions ---
    moveTurtles(state.seaTurtles, canvasWidth, deltaMs);
    const turtleHits = checkTurtleTrashCollision(state.seaTurtles, state.trashItems);
    for (const { turtle } of turtleHits) {
      turtle.hurtAt = now;
      state.health = Math.max(0, state.health - TURTLE_DAMAGE);
      state.combo.count = 0;
      state.combo.multiplier = 1;
      state.hitToasts.push({
        id: `toast-turtle-${now}-${turtle.id}`,
        x: turtle.x,
        y: turtle.y - 40,
        createdAt: now,
        text: `Turtle hurt! -${TURTLE_DAMAGE} Health`,
        color: "#FF9900",
      });
      if (state.health <= 0) {
        state.phase = "game-over";
        onStateChange("game-over");
        return;
      }
    }

    // --- Check trash reached player ---
    for (const z of state.trashItems) {
      if (!z.alive) continue;
      if (checkTrashReachedPlayer(z)) {
        z.alive = false;
        const damage = z.trashType === "barge" ? DAMAGE_PER_HIT * 3 : DAMAGE_PER_HIT;
        state.health = Math.max(0, state.health - damage);
        state.trashRemainingInWave--;

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
  }

  // --- Update reef defenders ---
  updateDefenders(state, canvasWidth, canvasHeight);

  // --- Remove dead trash ---
  state.trashItems = state.trashItems.filter((z) => z.alive);

  // --- Animate displayed score toward actual score ---
  if (state.displayedScore < state.score) {
    const diff = state.score - state.displayedScore;
    const increment = Math.max(1, Math.ceil(diff * 0.1));
    state.displayedScore = Math.min(state.score, state.displayedScore + increment);
  }

  // --- High score detection ---
  if (state.score > state.highScore && !state.isNewHighScore) {
    state.isNewHighScore = true;
    state.highScore = state.score;
  }

  // --- Check wave cleared ---
  const totalForWave = getTrashCountForWave(state.wave, config, state.isSurgeWave);
  const allSpawned = state.trashSpawned >= totalForWave;
  const allDead = state.trashItems.filter((z) => z.alive).length === 0;
  const surgeCondition = state.isSurgeWave ? state.surgeCleared : true;

  if (allSpawned && allDead && surgeCondition) {
    state.wave++;
    state.phase = "wave-countdown";
    state.waveCountdownUntil = Date.now() + WAVE_COUNTDOWN_MS;
    onStateChange("wave-countdown");
  }
}

export function startWave(
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig
): void {
  // Small health regen between waves
  state.health = Math.min(INITIAL_HEALTH, state.health + 5);

  // Reset ocean current charges
  state.currentCharges = 2;

  // Detect surge wave
  state.isSurgeWave = state.wave % BOSS_WAVE_INTERVAL === 0;
  state.surgeCleared = false;

  const totalForWave = getTrashCountForWave(state.wave, config, state.isSurgeWave);
  state.trashRemainingInWave = totalForWave + (state.isSurgeWave ? 1 : 0);
  state.trashSpawned = 0;
  state.lastSpawnTime = 0;

  // Spawn barge immediately on surge waves
  if (state.isSurgeWave) {
    const barge = spawnTrash(canvasWidth, canvasHeight, config, "barge", state.wave);
    state.trashItems.push(barge);
    state.lastBargeSpawnTime = Date.now();
    playBossRoar();
  }

  // Spawn first batch immediately
  const immediate = Math.min(state.wave === 1 ? 2 : 3 + Math.floor(state.wave / 2), totalForWave);
  for (let i = 0; i < immediate; i++) {
    const z = spawnTrash(canvasWidth, canvasHeight, config, undefined, state.wave);
    state.trashItems.push(z);
    state.trashSpawned++;
  }
  state.lastSpawnTime = Date.now();

  // Spawn sea turtles (after wave 2)
  maybeSpawnTurtles(state, canvasWidth, canvasHeight);
}
