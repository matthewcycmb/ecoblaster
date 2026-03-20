import { ComboState } from "@/lib/types";
import { COMBO_TIERS } from "@/lib/constants";

export function getComboMultiplier(count: number): number {
  for (const tier of COMBO_TIERS) {
    if (count >= tier.threshold) return tier.multiplier;
  }
  return 1;
}

export function incrementCombo(combo: ComboState): { newMultiplier: number; milestoneReached: boolean } {
  combo.count++;
  combo.lastKillTime = Date.now();
  const oldMult = combo.multiplier;
  combo.multiplier = getComboMultiplier(combo.count);
  return {
    newMultiplier: combo.multiplier,
    milestoneReached: combo.multiplier > oldMult,
  };
}
