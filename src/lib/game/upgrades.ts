import { Upgrade, UpgradeId } from "@/lib/types";

// Max times each upgrade can stack
const MAX_STACKS: Record<UpgradeId, number> = {
  "wider-hitbox": 2,
  "faster-fire": 2,
  "health-regen": 2,
  "longer-combos": 2,
  "splash-damage": 2,
  "score-bonus": 2,
  "tougher-reef": 2,
};

export const ALL_UPGRADES: Upgrade[] = [
  { id: "wider-hitbox", name: "Eagle Eye", description: "Bigger hitboxes", icon: "🎯" },
  { id: "faster-fire", name: "Quick Draw", description: "Faster fire rate", icon: "⚡" },
  { id: "health-regen", name: "Coral Growth", description: "+8 HP per wave", icon: "🪸" },
  { id: "longer-combos", name: "Flow State", description: "Slower combo decay", icon: "🔥" },
  { id: "splash-damage", name: "Shockwave", description: "Splash damage", icon: "💥" },
  { id: "score-bonus", name: "Treasure Hunter", description: "+10% score", icon: "💎" },
  { id: "tougher-reef", name: "Reef Armor", description: "+15 max HP", icon: "🛡️" },
];

export function getRandomUpgradeChoices(owned: UpgradeId[]): Upgrade[] {
  // Count how many of each upgrade the player already has
  const counts: Partial<Record<UpgradeId, number>> = {};
  for (const id of owned) {
    counts[id] = (counts[id] || 0) + 1;
  }

  // Filter out maxed upgrades
  const pool = ALL_UPGRADES.filter(u => (counts[u.id] || 0) < MAX_STACKS[u.id]);

  const choices: Upgrade[] = [];
  const remaining = [...pool];
  while (choices.length < 2 && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    choices.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return choices;
}

export interface UpgradeModifiers {
  hitMarginBonus: number;
  fireCooldownMult: number;
  healthRegenPerWave: number;
  comboDecayBonus: number;
  splashRadius: number;
  scoreBonusMult: number;
  maxHealthBonus: number;
}

export function applyUpgrades(upgrades: UpgradeId[]): UpgradeModifiers {
  const counts: Partial<Record<UpgradeId, number>> = {};
  for (const id of upgrades) {
    counts[id] = (counts[id] || 0) + 1;
  }
  // Clamp to max stacks
  const c = (id: UpgradeId) => Math.min(counts[id] || 0, MAX_STACKS[id]);
  return {
    hitMarginBonus: c("wider-hitbox") * 0.15,
    fireCooldownMult: Math.pow(0.85, c("faster-fire")),  // softer: 0.85 instead of 0.8
    healthRegenPerWave: c("health-regen") * 8,            // reduced from 10 to 8
    comboDecayBonus: c("longer-combos") * 400,            // reduced from 500 to 400
    splashRadius: c("splash-damage") * 35,                // reduced from 40 to 35
    scoreBonusMult: 1 + 0.1 * c("score-bonus"),          // reduced from 0.15 to 0.1
    maxHealthBonus: c("tougher-reef") * 15,               // reduced from 20 to 15
  };
}
