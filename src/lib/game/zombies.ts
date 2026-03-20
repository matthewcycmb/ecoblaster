import { Zombie, DifficultyConfig, ZombieType } from "@/lib/types";
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
} from "@/lib/constants";
import { pickZombieType } from "./difficulty";

let nextId = 0;
function genId(): string {
  return `z-${nextId++}-${Date.now()}`;
}

export function getZombieCountForWave(
  wave: number,
  config: DifficultyConfig,
  isBossWave: boolean = false
): number {
  // Base count: initial + per-wave increase
  const base = config.initialZombies + (wave - 1) * config.extraPerWave;
  // Add 1 extra zombie every 5 waves for escalating difficulty
  const waveBonus = Math.floor(wave / 5);
  const total = base + waveBonus;

  if (isBossWave) {
    return Math.max(2, Math.floor(total * BOSS_WAVE_REGULAR_ZOMBIE_FRACTION));
  }
  return total;
}

/**
 * Spawn a zombie at the far horizon with a random horizontal lane.
 * Supports different zombie types with unique modifiers.
 */
export function spawnZombie(
  canvasWidth: number,
  canvasHeight: number,
  config: DifficultyConfig,
  overrideType?: ZombieType,
  wave?: number
): Zombie {
  const zombieType = overrideType ?? pickZombieType(config);
  const laneX = zombieType === "boss"
    ? (Math.random() * 0.4 - 0.2)
    : (Math.random() * 1.6 - 0.8);
  const depth = Math.random() * 0.05;
  const speedVariation = 0.85 + Math.random() * 0.30;

  let width = ZOMBIE_BASE_WIDTH;
  let height = ZOMBIE_BASE_HEIGHT;
  let hp = 1;
  let speed = config.depthSpeedPerSec * speedVariation;

  switch (zombieType) {
    case "fast":
      speed *= FAST_SPEED_MULT;
      width *= FAST_SIZE_MULT;
      height *= FAST_SIZE_MULT;
      break;
    case "tank":
      speed *= TANK_SPEED_MULT;
      width *= TANK_SIZE_MULT;
      height *= TANK_SIZE_MULT;
      hp = TANK_HP;
      break;
    case "exploder":
      width *= EXPLODER_SIZE_MULT;
      height *= EXPLODER_SIZE_MULT;
      break;
    case "boss": {
      speed *= BOSS_SPEED_MULT;
      width *= BOSS_SIZE_MULT;
      height *= BOSS_SIZE_MULT;
      const bossWaveNumber = Math.max(1, Math.floor((wave ?? BOSS_WAVE_INTERVAL) / BOSS_WAVE_INTERVAL));
      hp = BOSS_BASE_HP + (bossWaveNumber - 1) * BOSS_HP_PER_WAVE;
      break;
    }
  }

  const z: Zombie = {
    id: genId(),
    zombieType,
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

  updateZombieScreenPos(z, canvasWidth, canvasHeight);
  return z;
}

/**
 * Move all zombies toward the player (increase depth).
 */
export function moveZombies(
  zombies: Zombie[],
  canvasWidth: number,
  canvasHeight: number,
  deltaMs: number,
  slowMoActive: boolean = false
): void {
  const dt = deltaMs / 1000;
  const speedFactor = slowMoActive ? 0.5 : 1.0;
  for (const z of zombies) {
    if (!z.alive) continue;
    z.depth += z.depthSpeedPerSec * dt * speedFactor;
    // Slight horizontal sway for natural walking feel
    z.laneX += Math.sin(z.depth * 12 + parseFloat(z.id.split("-")[1]) * 3) * 0.0008;
    updateZombieScreenPos(z, canvasWidth, canvasHeight);
  }
}

/**
 * Compute screen-space x, y, and scale from depth and laneX.
 */
export function updateZombieScreenPos(
  z: Zombie,
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
  const spread = canvasWidth * 0.42 * (0.1 + t * 0.9);
  z.x = canvasWidth / 2 + z.laneX * spread;
}

/**
 * Check if a zombie has reached the player.
 */
export function checkZombieReachedPlayer(z: Zombie): boolean {
  return z.depth >= ZOMBIE_REACH_DEPTH;
}

/**
 * Handle exploder death: damages nearby zombies in radius.
 * Returns list of zombies killed by the explosion.
 */
export function handleExploderDeath(
  exploder: Zombie,
  allZombies: Zombie[],
  explosionRadius: number
): Zombie[] {
  const killed: Zombie[] = [];
  for (const z of allZombies) {
    if (!z.alive || z.id === exploder.id) continue;
    const dx = z.x - exploder.x;
    const dy = z.y - exploder.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= explosionRadius * exploder.screenScale) {
      z.hp -= 2;
      if (z.hp <= 0) {
        z.alive = false;
        killed.push(z);
      }
    }
  }
  return killed;
}
