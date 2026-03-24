import { GameState } from "@/lib/types";

export function activateOceanCurrent(state: GameState): boolean {
  if (state.currentCharges <= 0) return false;
  state.currentCharges--;

  for (const trash of state.trashItems) {
    if (!trash.alive) continue;
    const dir = Math.random() > 0.5 ? 1 : -1;
    trash.laneX += dir * 0.4;
    trash.laneX = Math.max(-1, Math.min(1, trash.laneX));
    trash.depth = Math.max(0, trash.depth - 0.15);
  }

  state.currentEffectUntil = Date.now() + 600;
  return true;
}
