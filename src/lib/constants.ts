export const COLORS = {
  primary: "#0B63FF",
  accent: "#FFD166",
  danger: "#FF5A5F",
  bgDark: "#0F1724",
  surface: "#FFFFFF",
  textDark: "#111827",
  overlay: "rgba(0, 0, 0, 0.4)",
} as const;

// Zombie base size (at scale 1.0 — when very close to player)
export const ZOMBIE_BASE_WIDTH = 90;
export const ZOMBIE_BASE_HEIGHT = 140;

// Perspective constants
export const HORIZON_Y_RATIO = 0.28;   // horizon line at 28% from top
export const GROUND_Y_RATIO = 0.95;    // ground/player at 95% from top
export const MIN_SCALE = 0.15;         // zombie scale at depth 0 (far away)
export const MAX_SCALE = 1.8;          // zombie scale at depth 1 (right in your face)
export const ZOMBIE_REACH_DEPTH = 0.95; // depth at which zombie damages player

// Hit detection
export const ZOMBIE_HIT_RADIUS = 50;   // base hit radius (scaled with perspective)

// Gameplay
export const DAMAGE_PER_HIT = 20;
export const INITIAL_HEALTH = 100;
export const FLICK_THRESHOLD = -0.02;
export const DEFAULT_COOLDOWN_MS = 200;
export const MUZZLE_FLASH_DURATION_MS = 100;
export const WAVE_COUNTDOWN_MS = 3000;
export const HIT_TOAST_DURATION_MS = 800;
export const HAND_NOT_DETECTED_TIMEOUT_MS = 3000;
export const POSE_NOT_DETECTED_TIMEOUT_MS = 5000;
export const CANVAS_MAX_WIDTH = 1280;

// PIP webcam
export const PIP_WIDTH = 220;
export const PIP_HEIGHT = 165;
export const PIP_MARGIN = 12;
export const PIP_BORDER_RADIUS = 10;

// Combo system
export const COMBO_DECAY_MS = 2000;
export const COMBO_TIERS = [
  { threshold: 20, multiplier: 10 },
  { threshold: 10, multiplier: 5 },
  { threshold: 5, multiplier: 3 },
  { threshold: 2, multiplier: 2 },
];
export const BASE_SCORE_PER_KILL = 100;
export const BOSS_BONUS_MULTIPLIER = 500;

// Power-ups
export const POWERUP_DROP_CHANCE = 0.20;
export const POWERUP_LIFETIME_MS = 5000;
export const POWERUP_COLLECT_RADIUS = 60;
export const POWERUP_DURATION_MS = 8000;
export const RAPID_FIRE_COOLDOWN_MS = 50;
export const SHOTGUN_BLAST_RADIUS = 120;
export const HEALTH_PACK_AMOUNT = 30;

// Zombie type modifiers
export const FAST_SPEED_MULT = 1.8;
export const FAST_SIZE_MULT = 0.75;
export const TANK_SPEED_MULT = 0.6;
export const TANK_SIZE_MULT = 1.4;
export const TANK_HP = 3;
export const EXPLODER_SIZE_MULT = 1.1;
export const EXPLODER_DAMAGE_RADIUS = 100;

// Boss
export const BOSS_SPEED_MULT = 0.4;
export const BOSS_SIZE_MULT = 2.5;
export const BOSS_BASE_HP = 15;
export const BOSS_HP_PER_WAVE = 3;
export const BOSS_WAVE_INTERVAL = 5;
export const BOSS_WAVE_REGULAR_ZOMBIE_FRACTION = 0.4;

// Pistol
export const PISTOL_Y_OFFSET = 0.88;
export const PISTOL_BARREL_LENGTH = 70;
export const PISTOL_GRIP_HEIGHT = 50;
export const PISTOL_RECOIL_DURATION_MS = 150;
export const PISTOL_RECOIL_ANGLE = 0.15;
export const PISTOL_RECOIL_OFFSET = 8;
