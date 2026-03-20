export type Difficulty = "easy" | "normal" | "hard";

export type ZombieType = "basic" | "fast" | "tank" | "exploder" | "boss";

export type PowerUpType = "rapid-fire" | "shotgun-blast" | "slow-mo" | "health-pack";

export interface DifficultyConfig {
  initialZombies: number;
  depthSpeedPerSec: number;  // how fast zombies approach (depth units/sec)
  extraPerWave: number;
  spawnIntervalSec: number;
  zombieTypeWeights: Record<ZombieType, number>;
}

export type GamePhase =
  | "idle"
  | "playing"
  | "paused"
  | "wave-countdown"
  | "game-over";

export interface Zombie {
  id: string;
  zombieType: ZombieType;
  laneX: number;             // -1 to 1 horizontal world position
  depth: number;             // 0.0 (far/horizon) to 1.0 (reached player)
  width: number;             // base width before perspective scaling
  height: number;            // base height before perspective scaling
  hp: number;
  maxHp: number;
  depthSpeedPerSec: number;  // depth units per second
  alive: boolean;
  // Computed screen-space values (updated each frame)
  x: number;
  y: number;
  screenScale: number;
}

export interface HitToast {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  text: string;
  color: string;
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  createdAt: number;
  collected: boolean;
}

export interface ActivePowerUp {
  type: Exclude<PowerUpType, "health-pack">;
  expiresAt: number;
}

export interface ComboState {
  count: number;
  lastKillTime: number;
  multiplier: number;
}

export interface GameState {
  phase: GamePhase;
  health: number;
  score: number;
  wave: number;
  zombies: Zombie[];
  hitToasts: HitToast[];
  lastFireTime: number;
  muzzleFlashUntil: number;
  waveCountdownUntil: number;
  zombiesRemainingInWave: number;
  zombiesSpawned: number;
  lastSpawnTime: number;
  combo: ComboState;
  powerUps: PowerUp[];
  activePowerUp: ActivePowerUp | null;
  isBossWave: boolean;
  bossDefeated: boolean;
  recoilUntil: number;
  displayedScore: number;
  lastScoreChangeTime: number;
  highScore: number;
  isNewHighScore: boolean;
  waveTransitionUntil: number;
}

export interface Settings {
  sensitivity: number;
  flickCooldownMs: number;
  difficulty: Difficulty;
  muted: boolean;
  playerName: string;
}
