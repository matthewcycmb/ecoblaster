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
  | "upgrade-select"
  | "game-over";

export type UpgradeId = "wider-hitbox" | "faster-fire" | "health-regen" | "longer-combos" | "splash-damage" | "score-bonus" | "tougher-reef";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
}

export interface SwimmingFish {
  id: string;
  x: number;
  y: number;
  depth: number;
  screenScale: number;
  speed: number;
  direction: 1 | -1;
  alive: boolean;
  hitAt: number;       // timestamp when shot (for hurt animation)
  width: number;
  height: number;
  spriteIndex: number; // 0-5, which fish sprite from the sheet
}

export interface ReefDefender {
  id: string;
  laneX: number;
  depth: number;
  hp: number;
  maxHp: number;
  lastAttackTime: number;
  x: number;
  y: number;
  screenScale: number;
}

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
  isFragment?: boolean;       // net fragment — doesn't split further
  // Computed screen-space values (updated each frame)
  x: number;
  y: number;
  screenScale: number;
}

export interface SeaTurtle {
  id: string;
  x: number;
  y: number;
  depth: number;
  screenScale: number;
  speed: number;
  direction: 1 | -1;
  alive: boolean;
  hurtAt: number;
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
  seaTurtles: SeaTurtle[];
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
  lastBargeSpawnTime: number;
  comboFlashUntil: number;
  comboResetFlashUntil: number;
  // Upgrades
  upgrades: UpgradeId[];
  pendingUpgradeChoices: Upgrade[] | null;
  // Ocean current
  currentCharges: number;
  currentEffectUntil: number;
  // Reef defenders
  reefDefenders: ReefDefender[];
  // Swimming fish (don't shoot!)
  swimmingFish: SwimmingFish[];
  fishPenaltyFlashUntil: number;
}

export interface HandGunState {
  lastFireTime: number;
  muzzleFlashUntil: number;
  recoilUntil: number;
}

export interface Settings {
  difficulty: Difficulty;
  muted: boolean;
  playerName: string;
}
