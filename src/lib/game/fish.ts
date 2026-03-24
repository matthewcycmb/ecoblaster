import { SwimmingFish, GameState } from "@/lib/types";
import {
  FISH_SPAWN_CHANCE,
  FISH_MAX_ON_SCREEN,
  FISH_SPEED_MIN,
  FISH_SPEED_MAX,
  FISH_DEPTH_MIN,
  FISH_DEPTH_MAX,
  FISH_BASE_WIDTH,
  FISH_BASE_HEIGHT,
  FISH_HURT_DURATION_MS,
  FISH_SAFE_BONUS,
  HORIZON_Y_RATIO,
  GROUND_Y_RATIO,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/constants";

let nextFishId = 0;

function computeScreenScale(depth: number): number {
  const t = Math.pow(Math.max(0, Math.min(1, depth)), 0.65);
  return MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t;
}

function computeScreenY(depth: number, canvasHeight: number): number {
  const horizonY = canvasHeight * HORIZON_Y_RATIO;
  const groundY = canvasHeight * GROUND_Y_RATIO;
  const t = Math.pow(Math.max(0, Math.min(1, depth)), 0.65);
  return horizonY + (groundY - horizonY) * t;
}

export function spawnFish(canvasWidth: number, canvasHeight: number): SwimmingFish {
  const depth = FISH_DEPTH_MIN + Math.random() * (FISH_DEPTH_MAX - FISH_DEPTH_MIN);
  const screenScale = computeScreenScale(depth);
  const y = computeScreenY(depth, canvasHeight);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const w = FISH_BASE_WIDTH * screenScale;
  const x = direction === 1 ? -w : canvasWidth + w;
  const speed = (FISH_SPEED_MIN + Math.random() * (FISH_SPEED_MAX - FISH_SPEED_MIN)) * screenScale;

  return {
    id: `fish-${nextFishId++}`,
    x,
    y,
    depth,
    screenScale,
    speed,
    direction,
    alive: true,
    hitAt: 0,
    width: FISH_BASE_WIDTH,
    height: FISH_BASE_HEIGHT,
  };
}

export function moveFish(fish: SwimmingFish[], canvasWidth: number, deltaMs: number): void {
  const now = Date.now();
  const dt = deltaMs / 1000;

  for (let i = fish.length - 1; i >= 0; i--) {
    const f = fish[i];

    // Remove fish after hurt animation
    if (f.hitAt > 0 && now - f.hitAt > FISH_HURT_DURATION_MS) {
      fish.splice(i, 1);
      continue;
    }

    // Don't move if hit (sinking animation)
    if (f.hitAt > 0) continue;

    f.x += f.direction * f.speed * dt;

    // Check if fish crossed safely
    const w = FISH_BASE_WIDTH * f.screenScale;
    if (f.direction === 1 && f.x > canvasWidth + w) {
      fish.splice(i, 1);
    } else if (f.direction === -1 && f.x < -w) {
      fish.splice(i, 1);
    }
  }
}

/** Check if fish crossed the screen safely and award score. Returns count of safe fish removed this frame. */
export function checkFishSafeCrossing(
  state: GameState,
  canvasWidth: number
): number {
  let safeCount = 0;
  for (let i = state.swimmingFish.length - 1; i >= 0; i--) {
    const f = state.swimmingFish[i];
    if (f.hitAt > 0) continue; // already shot
    const w = FISH_BASE_WIDTH * f.screenScale;
    const crossed =
      (f.direction === 1 && f.x > canvasWidth + w) ||
      (f.direction === -1 && f.x < -w);
    if (crossed) {
      state.score += FISH_SAFE_BONUS;
      state.lastScoreChangeTime = Date.now();
      safeCount++;
    }
  }
  return safeCount;
}

/** Spawn fish alongside trash. Call during updatePlaying. */
export function maybeSpawnFish(
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const aliveCount = state.swimmingFish.filter(f => f.alive && f.hitAt === 0).length;
  if (aliveCount >= FISH_MAX_ON_SCREEN) return;

  // Higher spawn chance in later waves
  const waveMult = 1 + state.wave * 0.05;
  if (Math.random() < FISH_SPAWN_CHANCE * waveMult) {
    state.swimmingFish.push(spawnFish(canvasWidth, canvasHeight));
  }
}

/** Check if a shot at (x, y) hits a fish. Returns the hit fish or null. */
export function findFishAtPoint(
  fish: SwimmingFish[],
  aimX: number,
  aimY: number
): SwimmingFish | null {
  let closest: SwimmingFish | null = null;
  let closestDist = Infinity;

  for (const f of fish) {
    if (!f.alive || f.hitAt > 0) continue;
    const s = f.screenScale;
    const hw = (f.width * s) / 2;
    const hh = (f.height * s) / 2;

    // AABB check
    if (
      aimX >= f.x - hw && aimX <= f.x + hw &&
      aimY >= f.y - hh && aimY <= f.y + hh
    ) {
      const dx = f.x - aimX;
      const dy = f.y - aimY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closest = f;
        closestDist = dist;
      }
    }
  }

  return closest;
}
