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
export const ZOMBIE_REACH_DEPTH = 0.98; // depth at which zombie damages player

// Hit detection
export const TRASH_HIT_RADIUS = 50;    // base hit radius (scaled with perspective)
export const EASY_HIT_MARGIN = 1.1;    // easy mode — slightly bigger hitboxes
export const NORMAL_HIT_MARGIN = 1.0;  // normal mode — standard hitboxes
export const EASY_SPEED_MULT = 0.6;    // easy mode multiplies depthSpeedPerSec by this

// Gameplay
export const DAMAGE_PER_HIT = 20;
export const INITIAL_HEALTH = 100;
export const AUTO_FIRE_INTERVAL_MS = 300;
export const MUZZLE_FLASH_DURATION_MS = 100;
export const WAVE_COUNTDOWN_MS = 3600;
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
  { threshold: 20, multiplier: 5 },
  { threshold: 10, multiplier: 3 },
  { threshold: 5, multiplier: 2 },
];
export const BASE_SCORE_PER_KILL = 100;
export const BOSS_BONUS_MULTIPLIER = 500;

// Power-ups
export const POWERUP_DROP_CHANCE = 0.20;
export const POWERUP_LIFETIME_MS = 5000;
export const POWERUP_COLLECT_RADIUS = 60;
export const POWERUP_DURATION_MS = 8000;
export const RAPID_FIRE_COOLDOWN_MS = 120;
export const SHOTGUN_BLAST_RADIUS = 120;
export const SHOTGUN_MAX_TARGETS = 3;
export const HEALTH_PACK_AMOUNT = 30;

// Time freeze
export const TIME_FREEZE_DURATION_MS = 3000;
export const TIME_FREEZE_COOLDOWN_MS = 20000;

// Snap-to-clear (pinch gesture) — deals 1 damage to all trash
export const SNAP_CLEAR_COOLDOWN_MS = 30000;
export const SNAP_CLEAR_FLASH_MS = 400;
export const SNAP_CLEAR_SHAKE_MS = 300;
export const SNAP_CLEAR_SHAKE_INTENSITY = 8;

// Tsunami (thumbs-up hold) — kills all trash on screen
export const TSUNAMI_COOLDOWN_MS = 60000;
export const TSUNAMI_EFFECT_MS = 1200;
export const TSUNAMI_SHAKE_MS = 500;
export const TSUNAMI_SHAKE_INTENSITY = 12;
export const TSUNAMI_CHARGE_MS = 1500; // hold thumbs-up for 1.5s to trigger

// Zombie type modifiers
export const FAST_SPEED_MULT = 1.8;
export const FAST_SIZE_MULT = 0.75;
export const TANK_SPEED_MULT = 0.6;
export const TANK_SIZE_MULT = 1.4;
export const TANK_HP = 3;
export const EXPLODER_SIZE_MULT = 1.1;
export const EXPLODER_DAMAGE_RADIUS = 100;

// Net fragments
export const NET_FRAGMENT_COUNT = 3;
export const NET_FRAGMENT_SIZE_MULT = 0.5;
export const NET_FRAGMENT_SPEED_MULT = 1.6;

// Boss
export const BOSS_SPEED_MULT = 0.4;
export const BOSS_SIZE_MULT = 2.5;
export const BOSS_BASE_HP = 15;
export const BOSS_HP_PER_WAVE = 2;
export const BOSS_WAVE_INTERVAL = 5;
export const BOSS_WAVE_REGULAR_ZOMBIE_FRACTION = 0.4;
export const BOSS_SPAWN_INTERVAL_MS = 3000;
export const BOSS_KILL_SHAKE_MS = 400;
export const BOSS_KILL_SHAKE_INTENSITY = 10;

// Pistol
export const PISTOL_Y_OFFSET = 0.88;
export const PISTOL_BARREL_LENGTH = 70;
export const PISTOL_GRIP_HEIGHT = 50;
export const PISTOL_RECOIL_DURATION_MS = 150;
export const PISTOL_RECOIL_ANGLE = 0.15;
export const PISTOL_RECOIL_OFFSET = 8;


// Sea turtles
export const TURTLE_SPAWN_CHANCE = 0.3;
export const TURTLE_MAX_ON_SCREEN = 2;
export const TURTLE_SPEED_MIN = 40;
export const TURTLE_SPEED_MAX = 70;
export const TURTLE_DEPTH_MIN = 0.3;
export const TURTLE_DEPTH_MAX = 0.55;
export const TURTLE_DAMAGE = 15;
export const TURTLE_BASE_WIDTH = 80;
export const TURTLE_BASE_HEIGHT = 60;
export const TURTLE_HURT_DURATION_MS = 1500;
export const TURTLE_MIN_WAVE = 3;

// Swimming fish (friendly — don't shoot!)
export const FISH_SPAWN_CHANCE = 0.25;         // chance per spawn window
export const FISH_MAX_ON_SCREEN = 3;
export const FISH_SPEED_MIN = 50;
export const FISH_SPEED_MAX = 110;
export const FISH_DEPTH_MIN = 0.25;
export const FISH_DEPTH_MAX = 0.65;
export const FISH_BASE_WIDTH = 64;
export const FISH_BASE_HEIGHT = 40;
export const FISH_SHOOT_PENALTY = 15;          // health lost for shooting a fish
export const FISH_SAFE_BONUS = 25;             // score bonus for fish crossing safely
export const FISH_HURT_DURATION_MS = 800;
export const FISH_PENALTY_FLASH_MS = 300;

// Hit effects
export const HIT_FLASH_DURATION_MS = 80;
export const SCREEN_SHAKE_DURATION_MS = 120;
export const SCREEN_SHAKE_INTENSITY = 4;
