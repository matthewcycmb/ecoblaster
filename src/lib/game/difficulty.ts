import { Difficulty, DifficultyConfig, TrashType } from "@/lib/types";

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    initialTrash: 3,
    depthSpeedPerSec: 0.06,   // ~16 seconds to reach player
    extraPerWave: 2,
    spawnIntervalSec: 2.5,
    trashTypeWeights: { bottle: 70, bag: 18, barrel: 8, net: 4, barge: 0 },
  },
  normal: {
    initialTrash: 6,
    depthSpeedPerSec: 0.12,   // ~8 seconds to reach player
    extraPerWave: 3,
    spawnIntervalSec: 2.0,
    trashTypeWeights: { bottle: 40, bag: 25, barrel: 18, net: 17, barge: 0 },
  },
  hard: {
    initialTrash: 8,
    depthSpeedPerSec: 0.18,   // ~5.5 seconds to reach player
    extraPerWave: 3,
    spawnIntervalSec: 3,
    trashTypeWeights: { bottle: 40, bag: 25, barrel: 20, net: 15, barge: 0 },
  },
};

export function pickTrashType(config: DifficultyConfig): TrashType {
  const weights = config.trashTypeWeights;
  const entries = (Object.entries(weights) as [TrashType, number][])
    .filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "bottle";
}
