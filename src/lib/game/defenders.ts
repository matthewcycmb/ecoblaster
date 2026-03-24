import { GameState, ReefDefender } from "@/lib/types";
import { HORIZON_Y_RATIO, GROUND_Y_RATIO, MIN_SCALE, MAX_SCALE } from "@/lib/constants";

export function createDefender(state: GameState): ReefDefender {
  // Auto-place in least-defended lane
  const lanes = [-0.8, -0.5, -0.2, 0.1, 0.4, 0.7];
  const laneCounts = lanes.map(lane => ({
    lane,
    count: state.reefDefenders.filter(d => Math.abs(d.laneX - lane) < 0.15).length,
  }));
  laneCounts.sort((a, b) => a.count - b.count);
  const bestLane = laneCounts[0].lane;

  return {
    id: `defender-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    laneX: bestLane,
    depth: 0.7,
    hp: 3,
    maxHp: 3,
    lastAttackTime: 0,
    x: 0,
    y: 0,
    screenScale: 1,
  };
}

export function updateDefenders(
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const now = Date.now();
  const horizonY = canvasHeight * HORIZON_Y_RATIO;
  const groundY = canvasHeight * GROUND_Y_RATIO;

  for (let di = state.reefDefenders.length - 1; di >= 0; di--) {
    const defender = state.reefDefenders[di];

    // Update screen position
    const t = defender.depth;
    const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t;
    defender.screenScale = scale;
    defender.x = canvasWidth / 2 + defender.laneX * canvasWidth * 0.4 * scale;
    defender.y = horizonY + (groundY - horizonY) * t;

    // Find nearest trash in same lane
    let nearestTrash = null;
    let nearestDist = Infinity;
    for (const trash of state.trashItems) {
      if (!trash.alive) continue;
      if (Math.abs(trash.laneX - defender.laneX) > 0.15) continue;
      if (Math.abs(trash.depth - defender.depth) > 0.2) continue;
      const dist = Math.abs(trash.depth - defender.depth);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestTrash = trash;
      }
    }

    // Attack every 1s
    if (nearestTrash && now - defender.lastAttackTime >= 1000) {
      defender.lastAttackTime = now;
      nearestTrash.hp--;
      state.hitToasts.push({
        id: `defender-hit-${now}-${nearestTrash.id}`,
        x: nearestTrash.x,
        y: nearestTrash.y - 20,
        createdAt: now,
        text: "-1",
        color: "#33CCFF",
      });
      if (nearestTrash.hp <= 0) {
        nearestTrash.alive = false;
        state.trashRemainingInWave--;
      }
    }

    // Trash reaching defender damages it
    for (const trash of state.trashItems) {
      if (!trash.alive) continue;
      if (Math.abs(trash.laneX - defender.laneX) > 0.15) continue;
      if (trash.depth >= defender.depth) {
        defender.hp--;
        trash.alive = false;
        state.trashRemainingInWave--;
        if (defender.hp <= 0) {
          state.reefDefenders.splice(di, 1);
          state.hitToasts.push({
            id: `defender-died-${now}-${defender.id}`,
            x: defender.x,
            y: defender.y - 30,
            createdAt: now,
            text: "Defender lost!",
            color: "#FF5A5F",
          });
          break;
        }
      }
    }
  }
}
