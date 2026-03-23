import { TrashItem, DifficultyConfig, TrashType } from "@/lib/types";
import {
  ZOMBIE_BASE_WIDTH,
  ZOMBIE_BASE_HEIGHT,
  HORIZON_Y_RATIO,
  GROUND_Y_RATIO,
  MIN_SCALE,
  MAX_SCALE,
  ZOMBIE_REACH_DEPTH,
  FAST_SPEED_MULT,
  FAST_SIZE_MULT,
  TANK_SPEED_MULT,
  TANK_SIZE_MULT,
  TANK_HP,
  EXPLODER_SIZE_MULT,
  BOSS_SPEED_MULT,
  BOSS_SIZE_MULT,
  BOSS_BASE_HP,
  BOSS_HP_PER_WAVE,
  BOSS_WAVE_INTERVAL,
  BOSS_WAVE_REGULAR_ZOMBIE_FRACTION,
  NET_FRAGMENT_COUNT,
  NET_FRAGMENT_SIZE_MULT,
  NET_FRAGMENT_SPEED_MULT,
} from "@/lib/constants";
import { pickTrashType } from "./difficulty";

let nextId = 0;
function genId(): string {
  return `z-${nextId++}-${Date.now()}`;
}

export function getTrashCountForWave(
  wave: number,
  config: DifficultyConfig,
  isSurgeWave: boolean = false
): number {
  // Accelerating growth: linear base + quadratic ramp so later waves flood the screen
  const base = config.initialTrash + (wave - 1) * config.extraPerWave;
  const quadraticBonus = Math.floor(0.12 * wave * wave);
  const total = base + quadraticBonus;

  if (isSurgeWave) {
    return Math.max(2, Math.floor(total * BOSS_WAVE_REGULAR_ZOMBIE_FRACTION));
  }
  return total;
}

/**
 * Spawn a trash item at the far horizon with a random horizontal lane.
 * Supports different trash types with unique modifiers.
 */
export function spawnTrash(
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig,
  overrideType?: TrashType,
  wave?: number
): TrashItem {
  const trashType = overrideType ?? pickTrashType(config);
  const LANES = [-0.8, -0.5, -0.2, 0.1, 0.4, 0.7];
  const laneX = trashType === "barge"
    ? (Math.random() * 0.4 - 0.2)
    : LANES[Math.floor(Math.random() * LANES.length)] + (Math.random() * 0.2 - 0.1);
  const depth = Math.random() * 0.05;
  const speedVariation = 0.85 + Math.random() * 0.30;

  let width = ZOMBIE_BASE_WIDTH;
  let height = ZOMBIE_BASE_HEIGHT;
  let hp = 1;
  // Trash gets 8% faster each wave (compounding)
  const waveSpeedMult = 1 + (wave ? (wave - 1) * 0.04 : 0);
  let speed = config.depthSpeedPerSec * speedVariation * waveSpeedMult;

  switch (trashType) {
    case "bag":
      speed *= FAST_SPEED_MULT;
      width *= FAST_SIZE_MULT;
      height *= FAST_SIZE_MULT;
      break;
    case "barrel":
      speed *= TANK_SPEED_MULT;
      width *= TANK_SIZE_MULT;
      height *= TANK_SIZE_MULT;
      hp = TANK_HP;
      break;
    case "net":
      width *= EXPLODER_SIZE_MULT;
      height *= EXPLODER_SIZE_MULT;
      break;
    case "barge": {
      speed *= BOSS_SPEED_MULT;
      width *= BOSS_SIZE_MULT;
      height *= BOSS_SIZE_MULT;
      const surgeWaveNumber = Math.max(1, Math.floor((wave ?? BOSS_WAVE_INTERVAL) / BOSS_WAVE_INTERVAL));
      hp = BOSS_BASE_HP + (surgeWaveNumber - 1) * BOSS_HP_PER_WAVE;
      break;
    }
  }

  const z: TrashItem = {
    id: genId(),
    trashType,
    laneX,
    depth,
    width,
    height,
    hp,
    maxHp: hp,
    depthSpeedPerSec: speed,
    alive: true,
    x: 0,
    y: 0,
    screenScale: MIN_SCALE,
  };

  updateTrashScreenPos(z, canvasWidth, canvasHeight);
  return z;
}

/**
 * Move all trash items toward the player (increase depth).
 */
export function moveTrash(
  trashItems: TrashItem[],
  canvasWidth: number,
  canvasHeight: number,
  deltaMs: number,
  slowMoActive: boolean = false
): void {
  const dt = deltaMs / 1000;
  const speedFactor = slowMoActive ? 0.5 : 1.0;
  for (const z of trashItems) {
    if (!z.alive) continue;
    z.depth += z.depthSpeedPerSec * dt * speedFactor;
    // Slight horizontal sway for natural floating feel
    z.laneX += Math.sin(z.depth * 12 + parseFloat(z.id.split("-")[1]) * 3) * 0.0008;
    updateTrashScreenPos(z, canvasWidth, canvasHeight);
  }
}

/**
 * Compute screen-space x, y, and scale from depth and laneX.
 */
export function updateTrashScreenPos(
  z: TrashItem,
  canvasWidth: number,
  canvasHeight: number
): void {
  const horizonY = canvasHeight * HORIZON_Y_RATIO;
  const groundY = canvasHeight * GROUND_Y_RATIO;

  // Non-linear depth for perspective (power curve)
  const t = Math.pow(Math.max(0, Math.min(1, z.depth)), 0.65);

  z.screenScale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t;
  z.y = horizonY + (groundY - horizonY) * t;
  // Lanes converge at horizon, spread near player
  const spread = canvasWidth * 0.42 * (0.3 + t * 0.7);
  z.x = canvasWidth / 2 + z.laneX * spread;
}

/**
 * Check if a trash item has reached the player.
 */
export function checkTrashReachedPlayer(z: TrashItem): boolean {
  return z.depth >= ZOMBIE_REACH_DEPTH;
}

/**
 * Spawn net fragments when a net is destroyed.
 * Fragments scatter in different directions, are smaller and faster.
 */
export function spawnNetFragments(
  parent: TrashItem,
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig
): TrashItem[] {
  const fragments: TrashItem[] = [];
  const offsets = [-0.15, 0, 0.15]; // lane offsets for scatter

  for (let i = 0; i < NET_FRAGMENT_COUNT; i++) {
    const z: TrashItem = {
      id: genId(),
      trashType: "net",
      laneX: parent.laneX + offsets[i],
      depth: parent.depth,
      width: ZOMBIE_BASE_WIDTH * EXPLODER_SIZE_MULT * NET_FRAGMENT_SIZE_MULT,
      height: ZOMBIE_BASE_HEIGHT * EXPLODER_SIZE_MULT * NET_FRAGMENT_SIZE_MULT,
      hp: 1,
      maxHp: 1,
      depthSpeedPerSec: config.depthSpeedPerSec * NET_FRAGMENT_SPEED_MULT,
      alive: true,
      isFragment: true,
      x: 0,
      y: 0,
      screenScale: MIN_SCALE,
    };
    updateTrashScreenPos(z, canvasWidth, canvasHeight);
    fragments.push(z);
  }
  return fragments;
}
