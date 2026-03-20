import { Difficulty, DifficultyConfig, ZombieType } from "@/lib/types";

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    initialZombies: 3,
    depthSpeedPerSec: 0.08,   // ~12 seconds to reach player
    extraPerWave: 1,
    spawnIntervalSec: 5,
    zombieTypeWeights: { basic: 70, fast: 15, tank: 10, exploder: 5, boss: 0 },
  },
  normal: {
    initialZombies: 5,
    depthSpeedPerSec: 0.12,   // ~8 seconds to reach player
    extraPerWave: 2,
    spawnIntervalSec: 4,
    zombieTypeWeights: { basic: 55, fast: 20, tank: 15, exploder: 10, boss: 0 },
  },
  hard: {
    initialZombies: 8,
    depthSpeedPerSec: 0.18,   // ~5.5 seconds to reach player
    extraPerWave: 3,
    spawnIntervalSec: 3,
    zombieTypeWeights: { basic: 40, fast: 25, tank: 20, exploder: 15, boss: 0 },
  },
};

export function pickZombieType(config: DifficultyConfig): ZombieType {
  const weights = config.zombieTypeWeights;
  const entries = (Object.entries(weights) as [ZombieType, number][])
    .filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "basic";
}
