export type Difficulty = "easy" | "normal" | "hard";

export type TrashType = "bottle" | "bag" | "barrel" | "net" | "barge";

export type PowerUpType = "rapid-fire" | "shotgun-blast" | "slow-mo" | "health-pack";

export interface DifficultyConfig {
  initialTrash: number;
  depthSpeedPerSec: number;  // how fast trash approaches (depth units/sec)
  extraPerWave: number;
  spawnIntervalSec: number;
  trashTypeWeights: Record<TrashType, number>;
}

export type GamePhase =
  | "idle"
  | "playing"
  | "paused"
  | "wave-countdown"
  | "game-over";

export interface TrashItem {
  id: string;
  trashType: TrashType;
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
  trashItems: TrashItem[];
  hitToasts: HitToast[];
  lastFireTime: number;
  muzzleFlashUntil: number;
  waveCountdownUntil: number;
  trashRemainingInWave: number;
  trashSpawned: number;
  lastSpawnTime: number;
  combo: ComboState;
  powerUps: PowerUp[];
  activePowerUp: ActivePowerUp | null;
  isSurgeWave: boolean;
  surgeCleared: boolean;
  recoilUntil: number;
  hitFlashUntil: number;
  screenShakeUntil: number;
  displayedScore: number;
  lastScoreChangeTime: number;
  highScore: number;
  isNewHighScore: boolean;
  waveTransitionUntil: number;
}

export interface Settings {
  difficulty: Difficulty;
  muted: boolean;
  playerName: string;
}
