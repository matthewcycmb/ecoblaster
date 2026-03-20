import { GameState, PowerUp, PowerUpType } from "@/lib/types";
import {
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION_MS,
  POWERUP_COLLECT_RADIUS,
  HEALTH_PACK_AMOUNT,
  INITIAL_HEALTH,
} from "@/lib/constants";
import { playPowerUpCollect } from "@/lib/audio/sfx";

export function maybeDropPowerUp(state: GameState, deathX: number, deathY: number, zombieId: string): void {
  if (Math.random() >= POWERUP_DROP_CHANCE) return;
  const types: PowerUpType[] = ["rapid-fire", "shotgun-blast", "slow-mo", "health-pack"];
  const type = types[Math.floor(Math.random() * types.length)];
  state.powerUps.push({
    id: `pu-${Date.now()}-${zombieId}`,
    type,
    x: deathX,
    y: deathY,
    createdAt: Date.now(),
    collected: false,
  });
}

export function collectPowerUp(state: GameState, pu: PowerUp): void {
  pu.collected = true;
  playPowerUpCollect();
  if (pu.type === "health-pack") {
    state.health = Math.min(INITIAL_HEALTH, state.health + HEALTH_PACK_AMOUNT);
  } else {
    state.activePowerUp = {
      type: pu.type,
      expiresAt: Date.now() + POWERUP_DURATION_MS,
    };
  }
}

export function checkPowerUpCollection(state: GameState, aimX: number, aimY: number): void {
  for (const pu of state.powerUps) {
    if (pu.collected) continue;
    const dx = pu.x - aimX;
    const dy = pu.y - aimY;
    if (Math.sqrt(dx * dx + dy * dy) <= POWERUP_COLLECT_RADIUS) {
      collectPowerUp(state, pu);
    }
  }
}
