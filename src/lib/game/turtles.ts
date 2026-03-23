import { SeaTurtle, TrashItem, GameState } from "@/lib/types";
import {
  TURTLE_SPAWN_CHANCE,
  TURTLE_MAX_ON_SCREEN,
  TURTLE_SPEED_MIN,
  TURTLE_SPEED_MAX,
  TURTLE_DEPTH_MIN,
  TURTLE_DEPTH_MAX,
  TURTLE_BASE_WIDTH,
  TURTLE_HURT_DURATION_MS,
  TURTLE_MIN_WAVE,
  HORIZON_Y_RATIO,
  GROUND_Y_RATIO,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/constants";

let nextTurtleId = 0;

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

export function spawnTurtle(canvasWidth: number, canvasHeight: number): SeaTurtle {
  const depth = TURTLE_DEPTH_MIN + Math.random() * (TURTLE_DEPTH_MAX - TURTLE_DEPTH_MIN);
  const screenScale = computeScreenScale(depth);
  const y = computeScreenY(depth, canvasHeight);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const w = TURTLE_BASE_WIDTH * screenScale;
  const x = direction === 1 ? -w : canvasWidth + w;
  const speed = (TURTLE_SPEED_MIN + Math.random() * (TURTLE_SPEED_MAX - TURTLE_SPEED_MIN)) * screenScale;

  return {
    id: `turtle-${nextTurtleId++}`,
    x,
    y,
    depth,
    screenScale,
    speed,
    direction,
    alive: true,
    hurtAt: 0,
  };
}

export function moveTurtles(turtles: SeaTurtle[], canvasWidth: number, deltaMs: number): void {
  const now = Date.now();
  const dt = deltaMs / 1000;

  for (let i = turtles.length - 1; i >= 0; i--) {
    const t = turtles[i];

    // Remove hurt turtles after animation
    if (t.hurtAt > 0 && now - t.hurtAt > TURTLE_HURT_DURATION_MS) {
      turtles.splice(i, 1);
      continue;
    }

    t.x += t.direction * t.speed * dt;

    // Remove turtles that swam off screen
    const w = TURTLE_BASE_WIDTH * t.screenScale;
    if (t.direction === 1 && t.x > canvasWidth + w) {
      turtles.splice(i, 1);
    } else if (t.direction === -1 && t.x < -w) {
      turtles.splice(i, 1);
    }
  }
}

export function checkTurtleTrashCollision(
  turtles: SeaTurtle[],
  trashItems: TrashItem[]
): { turtle: SeaTurtle; trash: TrashItem }[] {
  const hits: { turtle: SeaTurtle; trash: TrashItem }[] = [];

  for (const turtle of turtles) {
    if (!turtle.alive || turtle.hurtAt > 0) continue;

    const tw = TURTLE_BASE_WIDTH * turtle.screenScale * 0.4;

    for (const trash of trashItems) {
      if (!trash.alive) continue;

      // Only collide if at similar depth (within 0.2)
      if (Math.abs(trash.depth - turtle.depth) > 0.2) continue;

      const dx = trash.x - turtle.x;
      const dy = trash.y - turtle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const trashRadius = trash.width * trash.screenScale * 0.3;

      if (dist < tw + trashRadius) {
        hits.push({ turtle, trash });
        break; // one hit per turtle per frame
      }
    }
  }

  return hits;
}

export function maybeSpawnTurtles(state: GameState, canvasWidth: number, canvasHeight: number): void {
  if (state.wave < TURTLE_MIN_WAVE) return;

  const aliveCount = state.seaTurtles.filter((t) => t.alive && t.hurtAt === 0).length;
  if (aliveCount >= TURTLE_MAX_ON_SCREEN) return;

  // Roll for each possible slot
  const slots = TURTLE_MAX_ON_SCREEN - aliveCount;
  for (let i = 0; i < slots; i++) {
    if (Math.random() < TURTLE_SPAWN_CHANCE) {
      state.seaTurtles.push(spawnTurtle(canvasWidth, canvasHeight));
    }
  }
}
