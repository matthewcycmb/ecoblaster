import { GameState, Zombie, HitToast, ComboState, ActivePowerUp, PowerUp, PowerUpType } from "@/lib/types";
import {
  HIT_TOAST_DURATION_MS,
  HORIZON_Y_RATIO,
  PIP_WIDTH,
  PIP_HEIGHT,
  PIP_MARGIN,
  PIP_BORDER_RADIUS,
  POWERUP_LIFETIME_MS,
  PISTOL_Y_OFFSET,
  PISTOL_BARREL_LENGTH,
  PISTOL_GRIP_HEIGHT,
  PISTOL_RECOIL_DURATION_MS,
  PISTOL_RECOIL_ANGLE,
  PISTOL_RECOIL_OFFSET,
} from "@/lib/constants";

/* ─── Zombie Variant Palettes ─── */

interface ZombiePalette {
  skin: string;
  skinDark: string;
  clothes: string;
  clothesDark: string;
  eyeColor: string;
  eyeGlow: string;
  bloodTint: string;
}

const ZOMBIE_PALETTES: ZombiePalette[] = [
  { skin: "#3a7a32", skinDark: "#2d5a27", clothes: "#4a3a2a", clothesDark: "#3d2d1f", eyeColor: "#FF3333", eyeGlow: "#FF0000", bloodTint: "#8B0000" },
  { skin: "#5a4a6a", skinDark: "#4a3a58", clothes: "#3a4a3a", clothesDark: "#2d3d2d", eyeColor: "#FF6600", eyeGlow: "#FF4400", bloodTint: "#6B0020" },
  { skin: "#7a8a72", skinDark: "#6a7a62", clothes: "#5a4a42", clothesDark: "#4a3a32", eyeColor: "#FFFF44", eyeGlow: "#AAAA00", bloodTint: "#4B0000" },
  { skin: "#6a5a3a", skinDark: "#5a4a2a", clothes: "#2a3a2a", clothesDark: "#1d2d1d", eyeColor: "#00FF66", eyeGlow: "#00CC44", bloodTint: "#3B0000" },
];

// Type-specific palettes
const FAST_PALETTE: ZombiePalette = { skin: "#8090a0", skinDark: "#607080", clothes: "#404858", clothesDark: "#303848", eyeColor: "#66CCFF", eyeGlow: "#3399FF", bloodTint: "#4B0020" };
const TANK_PALETTE: ZombiePalette = { skin: "#5a4a3a", skinDark: "#4a3a2a", clothes: "#3a3020", clothesDark: "#2a2010", eyeColor: "#FF4444", eyeGlow: "#CC0000", bloodTint: "#6B0000" };
const EXPLODER_PALETTE: ZombiePalette = { skin: "#4a6a3a", skinDark: "#3a5a2a", clothes: "#3a4a2a", clothesDark: "#2a3a1a", eyeColor: "#44FF44", eyeGlow: "#00FF00", bloodTint: "#003B00" };
const BOSS_PALETTE: ZombiePalette = { skin: "#4a2a3a", skinDark: "#3a1a2a", clothes: "#2a1a20", clothesDark: "#1a0a10", eyeColor: "#FF00FF", eyeGlow: "#CC00CC", bloodTint: "#4B0020" };

const POWERUP_COLORS: Record<PowerUpType, string> = {
  "rapid-fire": "#FF9900",
  "shotgun-blast": "#FF3366",
  "slow-mo": "#33CCFF",
  "health-pack": "#33FF66",
};

const POWERUP_LABELS: Record<string, string> = {
  "rapid-fire": "RAPID FIRE",
  "shotgun-blast": "SHOTGUN",
  "slow-mo": "SLOW-MO",
};

const POWERUP_ICONS: Record<PowerUpType, string> = {
  "rapid-fire": "R",
  "shotgun-blast": "S",
  "slow-mo": "T",
  "health-pack": "+",
};

function getZombieSeed(id: string): number {
  return parseFloat(id.split("-")[1]) || 0;
}

function getBasicPalette(id: string): ZombiePalette {
  const idx = (parseInt(id.split("-")[1]) || 0) % ZOMBIE_PALETTES.length;
  return ZOMBIE_PALETTES[idx];
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function hashStringSimple(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ─── Main Render Entry ─── */

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  videoElement?: HTMLVideoElement | null,
  aimX?: number,
  aimY?: number
): void {
  const hasAim = aimX !== undefined && aimY !== undefined;
  const cx = hasAim ? aimX : canvasWidth / 2;
  const cy = hasAim ? aimY : canvasHeight / 2;
  const now = Date.now();
  const t = now / 1000;

  drawBackground(ctx, canvasWidth, canvasHeight, t);

  // Power-ups on ground (before zombies so they appear under)
  for (const pu of state.powerUps) {
    if (!pu.collected) {
      drawPowerUp(ctx, pu, now);
    }
  }

  const sorted = [...state.zombies]
    .filter((z) => z.alive)
    .sort((a, b) => a.depth - b.depth);

  for (const z of sorted) {
    drawZombie(ctx, z, t);
  }

  drawAmbientParticles(ctx, canvasWidth, canvasHeight, t);

  // Pistol at bottom (draw before crosshair)
  const pistolResult = drawPistol(ctx, canvasWidth, canvasHeight, state, cx, cy, hasAim);

  if (hasAim || state.phase !== "playing") {
    drawCrosshair(ctx, cx, cy, t);
  }

  // Muzzle flash at barrel tip
  if (now < state.muzzleFlashUntil) {
    const flashProgress = (state.muzzleFlashUntil - now) / 100;
    drawMuzzleFlash(ctx, pistolResult.barrelTipX, pistolResult.barrelTipY, flashProgress);
  }

  for (const toast of state.hitToasts) {
    const age = now - toast.createdAt;
    if (age < HIT_TOAST_DURATION_MS) {
      drawHitToast(ctx, toast, age);
    }
  }

  drawVignette(ctx, canvasWidth, canvasHeight);

  // Boss HP bar
  if (state.isBossWave && !state.bossDefeated) {
    const boss = state.zombies.find((z) => z.zombieType === "boss" && z.alive);
    if (boss) {
      drawBossHPBar(ctx, boss, canvasWidth);
    }
  }

  // Score & Wave display on canvas
  if (state.phase === "playing" || state.phase === "wave-countdown") {
    drawScoreDisplay(ctx, state, canvasWidth);
    drawWaveDisplay(ctx, state, canvasWidth);
    if (state.isNewHighScore) {
      drawNewHighScoreIndicator(ctx, canvasWidth);
    }
  }

  // Combo display
  if (state.combo.count >= 2) {
    drawComboDisplay(ctx, state.combo, canvasWidth, canvasHeight);
  }

  // Active power-up indicator
  if (state.activePowerUp) {
    drawActivePowerUpIndicator(ctx, state.activePowerUp, canvasWidth, canvasHeight);
  }

  // PIP webcam (top-center)
  if (videoElement && videoElement.readyState >= 2) {
    drawPipWebcam(ctx, videoElement, canvasWidth, canvasHeight, t);
  }
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════════════════════════ */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const horizonY = h * HORIZON_Y_RATIO;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, "#050510");
  skyGrad.addColorStop(0.25, "#0a0a2a");
  skyGrad.addColorStop(0.5, "#1a1040");
  skyGrad.addColorStop(0.75, "#2a1545");
  skyGrad.addColorStop(1, "#35183a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  // Aurora borealis
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let layer = 0; layer < 3; layer++) {
    const baseY = horizonY * (0.15 + layer * 0.12);
    const hue = 130 + layer * 35;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 40);
    for (let x = 0; x <= w; x += 3) {
      const y = baseY + Math.sin(x * 0.004 + t * 0.25 + layer * 1.5) * 18 +
        Math.sin(x * 0.009 + t * 0.4 + layer * 3) * 8 + Math.sin(x * 0.002 + t * 0.15) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, baseY + 60);
    ctx.lineTo(0, baseY + 60);
    ctx.closePath();
    const auroraGrad = ctx.createLinearGradient(0, baseY - 15, 0, baseY + 60);
    auroraGrad.addColorStop(0, `hsla(${hue}, 70%, 55%, 0)`);
    auroraGrad.addColorStop(0.3, `hsla(${hue}, 70%, 55%, 0.7)`);
    auroraGrad.addColorStop(0.6, `hsla(${hue}, 70%, 55%, 0.3)`);
    auroraGrad.addColorStop(1, `hsla(${hue}, 70%, 55%, 0)`);
    ctx.fillStyle = auroraGrad;
    ctx.fill();
  }
  ctx.restore();

  // Moon
  const moonX = w * 0.82, moonY = h * 0.09, moonR = 38;
  ctx.save();
  const haloGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 3.5);
  haloGrad.addColorStop(0, "rgba(180, 180, 220, 0.12)");
  haloGrad.addColorStop(0.5, "rgba(140, 140, 200, 0.05)");
  haloGrad.addColorStop(1, "rgba(100, 100, 180, 0)");
  ctx.fillStyle = haloGrad;
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(210, 210, 230, 0.22)";
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(230, 230, 245, 0.3)";
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(150, 150, 180, 0.15)";
  ctx.beginPath(); ctx.arc(moonX - 10, moonY - 8, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX + 12, moonY + 5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX - 4, moonY + 12, 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.08 + 0.04 * Math.sin(t * 0.2);
  ctx.fillStyle = "#aaaacc";
  const cloudX = moonX - 30 + ((t * 8) % 120) - 30;
  ctx.beginPath(); ctx.ellipse(cloudX, moonY - 5, 35, 8, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cloudX + 15, moonY + 3, 25, 6, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = seededRandom(i * 3 + 1) * w;
    const sy = seededRandom(i * 3 + 2) * horizonY * 0.85;
    const baseSize = seededRandom(i * 3 + 3) > 0.7 ? 2 : 1;
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * (1.5 + seededRandom(i) * 2) + i * 1.7));
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.5})`;
    ctx.beginPath(); ctx.arc(sx, sy, baseSize, 0, Math.PI * 2); ctx.fill();
    if (baseSize > 1 && twinkle > 0.7) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${twinkle * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy);
      ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke();
    }
  }

  // Mountains
  ctx.fillStyle = "rgba(20, 15, 30, 0.6)";
  ctx.beginPath(); ctx.moveTo(0, horizonY);
  for (let x = 0; x <= w; x += 2) {
    const ph = 25 + seededRandom(Math.floor(x / 60) + 100) * 45;
    ctx.lineTo(x, horizonY - ph * (0.5 + 0.5 * Math.sin(x * 0.008 + seededRandom(Math.floor(x / 80) + 200) * 6)));
  }
  ctx.lineTo(w, horizonY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(15, 10, 22, 0.8)";
  ctx.beginPath(); ctx.moveTo(0, horizonY);
  for (let x = 0; x <= w; x += 2) {
    const ph = 15 + seededRandom(Math.floor(x / 45) + 300) * 35;
    ctx.lineTo(x, horizonY - ph * (0.5 + 0.5 * Math.sin(x * 0.012 + 2 + seededRandom(Math.floor(x / 55) + 400) * 4)));
  }
  ctx.lineTo(w, horizonY); ctx.closePath(); ctx.fill();

  // Ground
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, "#1a2a15"); groundGrad.addColorStop(0.15, "#172210");
  groundGrad.addColorStop(0.4, "#121c0c"); groundGrad.addColorStop(1, "#0a1206");
  ctx.fillStyle = groundGrad; ctx.fillRect(0, horizonY, w, h - horizonY);

  // Dirt path
  ctx.save(); ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.moveTo(w * 0.5, horizonY);
  ctx.quadraticCurveTo(w * 0.48, h * 0.6, w * 0.35, h);
  ctx.lineTo(w * 0.65, h);
  ctx.quadraticCurveTo(w * 0.52, h * 0.6, w * 0.5, horizonY);
  ctx.closePath(); ctx.fillStyle = "#2a2015"; ctx.fill(); ctx.restore();

  drawGraveyardElements(ctx, w, horizonY);

  // Fog
  const fogGrad1 = ctx.createLinearGradient(0, horizonY - 25, 0, horizonY + 70);
  fogGrad1.addColorStop(0, "rgba(30, 40, 50, 0)"); fogGrad1.addColorStop(0.3, "rgba(35, 45, 55, 0.4)");
  fogGrad1.addColorStop(0.6, "rgba(30, 40, 50, 0.25)"); fogGrad1.addColorStop(1, "rgba(25, 35, 45, 0)");
  ctx.fillStyle = fogGrad1; ctx.fillRect(0, horizonY - 25, w, 95);

  ctx.save(); ctx.globalAlpha = 0.08;
  for (let i = 0; i < 4; i++) {
    const fogY = horizonY + (h - horizonY) * (0.3 + i * 0.15);
    const drift = Math.sin(t * 0.15 + i * 2) * 40;
    ctx.fillStyle = "rgba(40, 55, 50, 0.5)";
    ctx.beginPath(); ctx.ellipse(w * 0.3 + drift + i * 100, fogY, 250 + i * 50, 15 + i * 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.7 - drift + i * 80, fogY + 20, 200 + i * 40, 12 + i * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Grid
  ctx.strokeStyle = "rgba(25, 45, 18, 0.2)"; ctx.lineWidth = 1;
  const centerX = w / 2;
  for (let i = 0; i < 8; i++) { const lineY = horizonY + (h - horizonY) * Math.pow((i + 1) / 8, 0.6); ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(w, lineY); ctx.stroke(); }
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(centerX, horizonY); ctx.lineTo(centerX + i * w * 0.25, h); ctx.stroke(); }

  // Grass tufts
  ctx.save(); ctx.strokeStyle = "rgba(30, 60, 20, 0.4)"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  for (let i = 0; i < 30; i++) {
    const gx = seededRandom(i + 500) * w;
    const gy = horizonY + (h - horizonY) * (0.1 + seededRandom(i + 600) * 0.7);
    const grassH = 6 + seededRandom(i + 700) * 10;
    const sway = Math.sin(t * 1.5 + i * 0.7) * 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + sway - 2, gy - grassH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + sway + 2, gy - grassH * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function drawGraveyardElements(ctx: CanvasRenderingContext2D, w: number, horizonY: number): void {
  ctx.save();
  const treeX = w * 0.08, treeBaseY = horizonY + 5;
  ctx.strokeStyle = "rgba(20, 15, 10, 0.7)"; ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(treeX, treeBaseY); ctx.lineTo(treeX - 3, treeBaseY - 80); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(treeX - 3, treeBaseY - 60); ctx.quadraticCurveTo(treeX - 25, treeBaseY - 75, treeX - 40, treeBaseY - 65); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(treeX - 2, treeBaseY - 72); ctx.quadraticCurveTo(treeX + 20, treeBaseY - 90, treeX + 35, treeBaseY - 85); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(treeX - 3, treeBaseY - 48); ctx.quadraticCurveTo(treeX - 30, treeBaseY - 52, treeX - 38, treeBaseY - 42); ctx.stroke();

  const tree2X = w * 0.93, tree2BaseY = horizonY + 3;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(tree2X, tree2BaseY); ctx.lineTo(tree2X + 2, tree2BaseY - 65); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(tree2X + 2, tree2BaseY - 50); ctx.quadraticCurveTo(tree2X + 22, tree2BaseY - 60, tree2X + 30, tree2BaseY - 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tree2X + 1, tree2BaseY - 58); ctx.quadraticCurveTo(tree2X - 18, tree2BaseY - 72, tree2X - 28, tree2BaseY - 68); ctx.stroke();

  const tombstones = [
    { x: w * 0.04, h: 22, w: 14, type: 0 }, { x: w * 0.14, h: 28, w: 16, type: 1 },
    { x: w * 0.19, h: 18, w: 12, type: 2 }, { x: w * 0.24, h: 24, w: 14, type: 0 },
    { x: w * 0.76, h: 26, w: 15, type: 1 }, { x: w * 0.82, h: 20, w: 13, type: 2 },
    { x: w * 0.88, h: 30, w: 16, type: 0 }, { x: w * 0.96, h: 22, w: 14, type: 1 },
  ];
  ctx.fillStyle = "rgba(25, 20, 18, 0.65)";
  for (const ts of tombstones) {
    const tsY = horizonY + 2;
    if (ts.type === 0) { ctx.beginPath(); ctx.moveTo(ts.x - ts.w / 2, tsY); ctx.lineTo(ts.x - ts.w / 2, tsY - ts.h + ts.w / 2); ctx.arc(ts.x, tsY - ts.h + ts.w / 2, ts.w / 2, Math.PI, 0); ctx.lineTo(ts.x + ts.w / 2, tsY); ctx.closePath(); ctx.fill(); }
    else if (ts.type === 1) { ctx.fillRect(ts.x - 3, tsY - ts.h, 6, ts.h); ctx.fillRect(ts.x - ts.w * 0.4, tsY - ts.h * 0.65, ts.w * 0.8, 4); }
    else { ctx.save(); ctx.translate(ts.x, tsY); ctx.rotate(-0.12); ctx.fillRect(-ts.w / 2, -ts.h, ts.w, ts.h); ctx.restore(); }
  }

  ctx.strokeStyle = "rgba(30, 25, 25, 0.45)"; ctx.lineWidth = 1.5;
  const fenceY = horizonY + 8, fenceH = 25;
  for (let x = w * 0.02; x < w * 0.22; x += 12) {
    ctx.beginPath(); ctx.moveTo(x, fenceY); ctx.lineTo(x, fenceY - fenceH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 2, fenceY - fenceH); ctx.lineTo(x, fenceY - fenceH - 5); ctx.lineTo(x + 2, fenceY - fenceH); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(w * 0.02, fenceY - fenceH * 0.35); ctx.lineTo(w * 0.22, fenceY - fenceH * 0.35);
  ctx.moveTo(w * 0.02, fenceY - fenceH * 0.7); ctx.lineTo(w * 0.22, fenceY - fenceH * 0.7); ctx.stroke();
  for (let x = w * 0.78; x < w * 0.98; x += 12) {
    ctx.beginPath(); ctx.moveTo(x, fenceY); ctx.lineTo(x, fenceY - fenceH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 2, fenceY - fenceH); ctx.lineTo(x, fenceY - fenceH - 5); ctx.lineTo(x + 2, fenceY - fenceH); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(w * 0.78, fenceY - fenceH * 0.35); ctx.lineTo(w * 0.98, fenceY - fenceH * 0.35);
  ctx.moveTo(w * 0.78, fenceY - fenceH * 0.7); ctx.lineTo(w * 0.98, fenceY - fenceH * 0.7); ctx.stroke();
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   ZOMBIE — Type-based dispatcher
   ═══════════════════════════════════════════════════════════════ */

function drawZombie(ctx: CanvasRenderingContext2D, z: Zombie, t: number): void {
  switch (z.zombieType) {
    case "fast": drawZombieBody(ctx, z, t, FAST_PALETTE, { lean: 0.15, walkMult: 1.8 }); break;
    case "tank": drawZombieBody(ctx, z, t, TANK_PALETTE, { bulky: true }); break;
    case "exploder": drawZombieBody(ctx, z, t, EXPLODER_PALETTE, { glow: "#00FF00" }); break;
    case "boss": drawZombieBody(ctx, z, t, BOSS_PALETTE, { boss: true }); break;
    default: drawZombieBody(ctx, z, t, getBasicPalette(z.id), {}); break;
  }
  // HP bar for tanks and bosses with damage
  if ((z.zombieType === "tank" || z.zombieType === "boss") && z.hp < z.maxHp) {
    drawZombieHPBar(ctx, z);
  }
}

interface ZombieDrawOpts {
  lean?: number;
  walkMult?: number;
  bulky?: boolean;
  glow?: string;
  boss?: boolean;
}

function drawZombieBody(ctx: CanvasRenderingContext2D, z: Zombie, t: number, colors: ZombiePalette, opts: ZombieDrawOpts): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getZombieSeed(z.id);
  const walkMult = opts.walkMult ?? 1;
  const walkPhase = z.depth * 25 * walkMult + seed * 2;
  const walkCycle = Math.sin(walkPhase);
  const bodyBob = Math.abs(Math.sin(walkPhase)) * bh * 0.012;

  ctx.save();
  ctx.translate(z.x, z.y - bodyBob);

  // Lean forward for fast zombies
  if (opts.lean) { ctx.rotate(opts.lean); }

  // Exploder glow aura
  if (opts.glow && s > 0.15) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed);
    ctx.save();
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 15 * s * pulse;
    ctx.fillStyle = `rgba(0, 255, 0, ${0.06 * pulse})`;
    ctx.beginPath(); ctx.ellipse(0, -bh * 0.1, bw * 0.4, bh * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath(); ctx.ellipse(0, bh * 0.05 + bodyBob, bw * 0.45, bh * 0.05, 0, 0, Math.PI * 2); ctx.fill();

  // Legs
  const legW = Math.max(3, (opts.bulky ? 9 : 7) * s);
  const legSwing = bw * 0.1 * walkCycle;
  ctx.strokeStyle = colors.clothesDark; ctx.lineWidth = legW; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-bw * 0.1, bh * 0.14); ctx.lineTo(-bw * 0.1 + legSwing * 0.5, bh * 0.28); ctx.lineTo(-bw * 0.12 + legSwing, bh * 0.43); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bw * 0.1, bh * 0.14); ctx.lineTo(bw * 0.1 - legSwing * 0.5, bh * 0.28); ctx.lineTo(bw * 0.12 - legSwing, bh * 0.43); ctx.stroke();

  // Torso
  const shoulderW = opts.bulky ? 0.38 : (opts.boss ? 0.42 : 0.32);
  ctx.beginPath();
  ctx.moveTo(-bw * 0.18, bh * 0.15); ctx.lineTo(-bw * shoulderW, -bh * 0.08);
  ctx.lineTo(-bw * (shoulderW - 0.04), -bh * 0.18); ctx.lineTo(bw * (shoulderW - 0.04), -bh * 0.18);
  ctx.lineTo(bw * shoulderW, -bh * 0.08); ctx.lineTo(bw * 0.18, bh * 0.15); ctx.closePath();
  ctx.fillStyle = colors.clothes; ctx.fill();

  // Boss armor plates
  if (opts.boss && s > 0.3) {
    ctx.fillStyle = "rgba(60, 60, 70, 0.6)";
    ctx.fillRect(-bw * 0.2, -bh * 0.15, bw * 0.4, bh * 0.2);
    ctx.strokeStyle = "rgba(100, 100, 110, 0.5)"; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeRect(-bw * 0.2, -bh * 0.15, bw * 0.4, bh * 0.2);
    // Shoulder armor
    ctx.fillStyle = "rgba(50, 50, 60, 0.7)";
    ctx.beginPath(); ctx.ellipse(-bw * 0.35, -bh * 0.14, bw * 0.1, bh * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bw * 0.35, -bh * 0.14, bw * 0.1, bh * 0.06, 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // Torn strips
  if (s > 0.25 && !opts.boss) {
    ctx.strokeStyle = colors.clothesDark; ctx.lineWidth = Math.max(1, 2 * s); ctx.lineCap = "round";
    const stripSway = Math.sin(t * 3 + seed) * 2 * s;
    ctx.beginPath(); ctx.moveTo(-bw * 0.12, bh * 0.14); ctx.lineTo(-bw * 0.14 + stripSway, bh * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bw * 0.05, bh * 0.14); ctx.lineTo(bw * 0.03 + stripSway, bh * 0.20); ctx.stroke();
  }

  // Exploder pustules
  if (opts.glow && s > 0.3) {
    ctx.save();
    ctx.fillStyle = `rgba(100, 255, 50, ${0.4 + 0.2 * Math.sin(t * 5 + seed)})`;
    ctx.shadowColor = "#00FF00"; ctx.shadowBlur = 5 * s;
    ctx.beginPath(); ctx.arc(-bw * 0.1, -bh * 0.02, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bw * 0.12, bh * 0.05, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bw * 0.02, -bh * 0.1, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Neck
  ctx.fillStyle = colors.skin;
  ctx.fillRect(-bw * 0.06, -bh * 0.23, bw * 0.12, bh * 0.06);

  // Arms
  const armW = Math.max(3, (opts.bulky ? 7 : 5) * s);
  const armSwing = bw * 0.03 * Math.sin(z.depth * 20 + seed);
  ctx.strokeStyle = colors.skin; ctx.lineWidth = armW; ctx.lineCap = "round";
  const armReach = opts.boss ? 0.55 : 0.48;
  ctx.beginPath(); ctx.moveTo(-bw * 0.3, -bh * 0.15); ctx.lineTo(-bw * 0.4, -bh * 0.08 + armSwing); ctx.lineTo(-bw * armReach, -bh * 0.28 + armSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bw * 0.3, -bh * 0.15); ctx.lineTo(bw * 0.4, -bh * 0.08 - armSwing); ctx.lineTo(bw * armReach, -bh * 0.28 - armSwing); ctx.stroke();

  // Claws / spikes
  if (s > 0.2) {
    const clawLen = Math.max(3, (opts.boss ? 12 : 8) * s);
    ctx.lineWidth = Math.max(1.5, 3 * s); ctx.strokeStyle = opts.boss ? "#666" : colors.skinDark;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-bw * armReach, -bh * 0.28 + armSwing); ctx.lineTo(-bw * armReach - clawLen * 0.5 + i * clawLen * 0.3, -bh * 0.28 + armSwing - clawLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bw * armReach, -bh * 0.28 - armSwing); ctx.lineTo(bw * armReach + clawLen * 0.5 + i * clawLen * 0.3, -bh * 0.28 - armSwing - clawLen); ctx.stroke();
    }
  }

  // Head
  const headR = bw * (opts.boss ? 0.25 : 0.22);
  const headY = -bh * 0.32;
  ctx.fillStyle = colors.skin;
  ctx.beginPath(); ctx.ellipse(0, headY, headR, headR * 1.1, 0, 0, Math.PI * 2); ctx.fill();

  // Boss horns
  if (opts.boss && s > 0.25) {
    ctx.strokeStyle = "#555"; ctx.lineWidth = Math.max(2, 4 * s); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-headR * 0.6, headY - headR * 0.6); ctx.lineTo(-headR * 0.9, headY - headR * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headR * 0.6, headY - headR * 0.6); ctx.lineTo(headR * 0.9, headY - headR * 1.5); ctx.stroke();
  }

  // Hair
  if (s > 0.3 && !opts.boss) {
    ctx.strokeStyle = "rgba(30, 25, 20, 0.6)"; ctx.lineWidth = Math.max(1, 2 * s); ctx.lineCap = "round";
    const hairSway = Math.sin(t * 2 + seed * 3) * 2 * s;
    ctx.beginPath(); ctx.moveTo(-headR * 0.5, headY - headR * 0.8); ctx.lineTo(-headR * 0.7 + hairSway, headY - headR * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headR * 0.3, headY - headR); ctx.lineTo(headR * 0.45 - hairSway, headY - headR * 0.5); ctx.stroke();
  }

  // Eyes
  if (s > 0.15) {
    const eyeR = Math.max(2, (opts.boss ? 6 : 4.5) * s);
    ctx.save();
    ctx.shadowColor = colors.eyeGlow; ctx.shadowBlur = (opts.boss ? 15 : 10) * s;
    ctx.fillStyle = opts.boss ? (Math.sin(t * 3) > 0 ? colors.eyeColor : "#FF4444") : colors.eyeColor;
    ctx.beginPath(); ctx.arc(-headR * 0.35, headY - headR * 0.05, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.35, headY - headR * 0.05, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (s > 0.5) {
      ctx.save(); ctx.fillStyle = colors.eyeColor;
      for (let trail = 1; trail <= 3; trail++) {
        ctx.globalAlpha = 0.3 - trail * 0.08;
        const ty = headY - headR * 0.05 + trail * 3 * s;
        ctx.beginPath(); ctx.arc(-headR * 0.35, ty, eyeR * (1 - trail * 0.15), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headR * 0.35, ty, eyeR * (1 - trail * 0.15), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Mouth
  if (s > 0.45) {
    const mouthY = headY + headR * 0.35;
    const mouthW = headR * 0.6;
    ctx.fillStyle = "rgba(30, 5, 5, 0.8)"; ctx.strokeStyle = "#1a1a14"; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.moveTo(-mouthW, mouthY);
    for (let i = 0; i < 5; i++) { ctx.lineTo(-mouthW + (mouthW * 2) * (i / 4), mouthY + (i % 2 === 0 ? 3 * s : 0)); }
    ctx.quadraticCurveTo(mouthW * 0.3, mouthY + 6 * s, -mouthW, mouthY);
    ctx.fill(); ctx.stroke();
  }

  // Danger glow
  if (s > 1.0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255, 30, 30, ${(s - 1.0) * 0.12 * (0.6 + 0.4 * pulse)})`;
    ctx.beginPath(); ctx.ellipse(0, -bh * 0.1, bw * 0.5, bh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawZombieHPBar(ctx: CanvasRenderingContext2D, z: Zombie): void {
  const barWidth = z.width * z.screenScale * 0.6;
  const barHeight = Math.max(3, 4 * z.screenScale);
  const barX = z.x - barWidth / 2;
  const barY = z.y - z.height * z.screenScale * 0.5 - 8 * z.screenScale;
  const fillRatio = z.hp / z.maxHp;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = fillRatio > 0.5 ? "#10b981" : fillRatio > 0.25 ? "#FFD166" : "#FF5A5F";
  ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
}

/* ═══════════════════════════════════════════════════════════════
   BOSS HP BAR
   ═══════════════════════════════════════════════════════════════ */

function drawBossHPBar(ctx: CanvasRenderingContext2D, boss: Zombie, canvasWidth: number): void {
  const barWidth = canvasWidth * 0.5;
  const barHeight = 14;
  const barX = (canvasWidth - barWidth) / 2;
  const barY = 50;
  const fillRatio = boss.hp / boss.maxHp;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath(); ctx.roundRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4); ctx.fill();

  const hpGrad = ctx.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
  hpGrad.addColorStop(0, "#FF3333"); hpGrad.addColorStop(1, "#FF6600");
  ctx.fillStyle = hpGrad;
  ctx.beginPath(); ctx.roundRect(barX, barY, barWidth * fillRatio, barHeight, 3); ctx.fill();

  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
  ctx.fillText(`BOSS  ${boss.hp}/${boss.maxHp}`, canvasWidth / 2, barY + barHeight + 14);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   COMBO DISPLAY
   ═══════════════════════════════════════════════════════════════ */

function drawComboDisplay(ctx: CanvasRenderingContext2D, combo: ComboState, canvasWidth: number, canvasHeight: number): void {
  const text = `x${combo.multiplier}`;
  const subText = `${combo.count} COMBO`;
  const x = canvasWidth / 2;
  const y = canvasHeight * 0.15;
  const pulse = 1 + Math.sin(Date.now() / 100) * 0.05 * combo.multiplier;

  ctx.save();
  ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.font = "bold 36px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = combo.multiplier >= 10 ? "#FF3333" : combo.multiplier >= 5 ? "#FF9900" : combo.multiplier >= 3 ? "#FFD166" : "#FFFFFF";
  ctx.fillText(text, 0, 0);
  ctx.font = "bold 14px Inter, system-ui, sans-serif";
  ctx.strokeText(subText, 0, 22); ctx.fillStyle = "#FFFFFF"; ctx.fillText(subText, 0, 22);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   POWER-UP RENDERING
   ═══════════════════════════════════════════════════════════════ */

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, now: number): void {
  const age = now - pu.createdAt;
  const fadeStart = POWERUP_LIFETIME_MS - 1500;
  const alpha = age > fadeStart ? 1 - (age - fadeStart) / 1500 : 1;
  const bob = Math.sin(age / 200) * 5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pu.x, pu.y + bob);

  const color = POWERUP_COLORS[pu.type];
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px Inter, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(POWERUP_ICONS[pu.type], 0, 0);
  ctx.restore();
}

function drawActivePowerUpIndicator(ctx: CanvasRenderingContext2D, active: ActivePowerUp, canvasWidth: number, canvasHeight: number): void {
  const remaining = Math.max(0, active.expiresAt - Date.now());
  const secs = (remaining / 1000).toFixed(1);
  const label = POWERUP_LABELS[active.type] ?? active.type;
  const color = POWERUP_COLORS[active.type];
  const x = canvasWidth / 2;
  const y = canvasHeight - 50;

  ctx.save();
  ctx.font = "bold 16px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.roundRect(x - 80, y - 12, 160, 30, 6); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(`${label} ${secs}s`, x, y + 6);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   CROSSHAIR
   ═══════════════════════════════════════════════════════════════ */

function drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  const size = 24;
  const rotation = t * 0.4;
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.arc(0, 0, size + 6, rotation, rotation + Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)"; ctx.shadowBlur = 3;
  ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size - 8, 0); ctx.lineTo(-size + 7, 0); ctx.moveTo(size - 7, 0); ctx.lineTo(size + 8, 0);
  ctx.moveTo(0, -size - 8); ctx.lineTo(0, -size + 7); ctx.moveTo(0, size - 7); ctx.lineTo(0, size + 8); ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let a = 0; a < 4; a++) {
    const angle = a * Math.PI / 2;
    const dx = Math.cos(angle) * size, dy = Math.sin(angle) * size;
    ctx.beginPath(); ctx.moveTo(dx, dy - 2.5); ctx.lineTo(dx + 2.5, dy); ctx.lineTo(dx, dy + 2.5); ctx.lineTo(dx - 2.5, dy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   MUZZLE FLASH
   ═══════════════════════════════════════════════════════════════ */

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number): void {
  ctx.save();
  const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * progress);
  outerGrad.addColorStop(0, `rgba(255, 209, 102, ${0.6 * progress})`);
  outerGrad.addColorStop(0.3, `rgba(255, 180, 60, ${0.3 * progress})`);
  outerGrad.addColorStop(0.7, `rgba(255, 140, 30, ${0.1 * progress})`);
  outerGrad.addColorStop(1, "rgba(255, 140, 30, 0)");
  ctx.fillStyle = outerGrad; ctx.beginPath(); ctx.arc(cx, cy, 90 * progress, 0, Math.PI * 2); ctx.fill();
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25 * progress);
  innerGrad.addColorStop(0, `rgba(255, 255, 240, ${0.9 * progress})`); innerGrad.addColorStop(1, "rgba(255, 255, 240, 0)");
  ctx.fillStyle = innerGrad; ctx.beginPath(); ctx.arc(cx, cy, 25 * progress, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255, 220, 100, ${0.6 * progress})`; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + progress * 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 20 * progress, cy + Math.sin(angle) * 20 * progress);
    ctx.lineTo(cx + Math.cos(angle) * (45 + 20 * (1 - progress)), cy + Math.sin(angle) * (45 + 20 * (1 - progress))); ctx.stroke();
  }
  ctx.globalAlpha = 0.15 * progress;
  const flareGrad = ctx.createLinearGradient(cx - 120, cy, cx + 120, cy);
  flareGrad.addColorStop(0, "rgba(255, 200, 100, 0)"); flareGrad.addColorStop(0.4, "rgba(255, 200, 100, 0.3)");
  flareGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.5)"); flareGrad.addColorStop(0.6, "rgba(255, 200, 100, 0.3)");
  flareGrad.addColorStop(1, "rgba(255, 200, 100, 0)");
  ctx.fillStyle = flareGrad; ctx.fillRect(cx - 120, cy - 3, 240, 6);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   HIT TOASTS
   ═══════════════════════════════════════════════════════════════ */

function drawHitToast(ctx: CanvasRenderingContext2D, toast: HitToast, age: number): void {
  const alpha = 1 - age / HIT_TOAST_DURATION_MS;
  const progress = age / HIT_TOAST_DURATION_MS;
  const yOffset = -age * 0.07;
  const idSeed = hashStringSimple(toast.id);

  ctx.save();
  for (let i = 0; i < 8; i++) {
    const angle = seededRandom(idSeed + i) * Math.PI * 2;
    const speed = 25 + seededRandom(idSeed + i + 50) * 45;
    const px = toast.x + Math.cos(angle) * speed * progress;
    const py = toast.y + Math.sin(angle) * speed * progress + progress * progress * 30;
    const size = (2.5 - progress * 2) * (1 + seededRandom(idSeed + i + 100) * 0.8);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = toast.color === "#FF5A5F" ? "rgba(160, 0, 0, 0.8)" : "rgba(255, 200, 50, 0.8)";
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, size), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.save(); ctx.globalAlpha = alpha;
  const scaleAnim = progress < 0.1 ? 0.8 + progress * 2 : 1.0;
  ctx.translate(toast.x, toast.y + yOffset); ctx.scale(scaleAnim, scaleAnim);
  ctx.font = "bold 24px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
  ctx.strokeText(toast.text, 0, 0);
  ctx.fillStyle = toast.color; ctx.fillText(toast.text, 0, 0);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   AMBIENT PARTICLES
   ═══════════════════════════════════════════════════════════════ */

function drawAmbientParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  ctx.save(); ctx.globalAlpha = 0.15;
  for (let i = 0; i < 15; i++) {
    const px = seededRandom(i + 800) * w + Math.sin(t * 0.3 + i * 2.1) * 30;
    const py = seededRandom(i + 900) * h * 0.7 + h * 0.15 + Math.cos(t * 0.25 + i * 1.7) * 20;
    ctx.fillStyle = "rgba(200, 200, 180, 0.5)";
    ctx.beginPath(); ctx.arc(px, py, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  const horizonY = h * HORIZON_Y_RATIO;
  for (let i = 0; i < 6; i++) {
    const px = seededRandom(i + 1000) * w + Math.sin(t * 0.5 + i * 3.3) * 25;
    const py = horizonY + seededRandom(i + 1100) * (h - horizonY) * 0.5 + Math.cos(t * 0.4 + i * 2.5) * 15;
    const glow = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.5 + i * 4.1));
    ctx.globalAlpha = glow * 0.4;
    ctx.fillStyle = "#88ff44"; ctx.shadowColor = "#88ff44"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   VIGNETTE
   ═══════════════════════════════════════════════════════════════ */

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const radius = Math.max(w, h) * 0.7;
  const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.4, w / 2, h / 2, radius);
  vignetteGrad.addColorStop(0, "rgba(0, 0, 0, 0)"); vignetteGrad.addColorStop(0.7, "rgba(0, 0, 0, 0)");
  vignetteGrad.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = vignetteGrad; ctx.fillRect(0, 0, w, h);
}

/* ═══════════════════════════════════════════════════════════════
   PIP WEBCAM — Top-center
   ═══════════════════════════════════════════════════════════════ */

function drawPipWebcam(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, canvasWidth: number, canvasHeight: number, t: number): void {
  const pipX = (canvasWidth - PIP_WIDTH) / 2;
  const pipY = PIP_MARGIN + 8;

  ctx.save();
  ctx.shadowColor = "rgba(11, 99, 255, 0.25)"; ctx.shadowBlur = 15;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath(); ctx.roundRect(pipX - 2, pipY - 2, PIP_WIDTH + 4, PIP_HEIGHT + 4, PIP_BORDER_RADIUS + 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.roundRect(pipX, pipY, PIP_WIDTH, PIP_HEIGHT, PIP_BORDER_RADIUS); ctx.clip();
  ctx.translate(pipX + PIP_WIDTH, pipY); ctx.scale(-1, 1);
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const scale = Math.max(PIP_WIDTH / vw, PIP_HEIGHT / vh);
  ctx.drawImage(video, (PIP_WIDTH - vw * scale) / 2, (PIP_HEIGHT - vh * scale) / 2, vw * scale, vh * scale);
  ctx.restore();

  ctx.save(); ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(pipX, pipY, PIP_WIDTH, PIP_HEIGHT, PIP_BORDER_RADIUS); ctx.stroke(); ctx.restore();

  ctx.save();
  const liveX = pipX + 8, liveY = pipY + 14;
  if (Math.sin(t * 3) > 0) {
    ctx.fillStyle = "#FF3333"; ctx.shadowColor = "#FF0000"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(liveX, liveY, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.font = "bold 9px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)"; ctx.textAlign = "left";
  ctx.fillText("LIVE", liveX + 7, liveY + 3);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   PISTOL
   ═══════════════════════════════════════════════════════════════ */

interface PistolRenderResult { barrelTipX: number; barrelTipY: number; }

function drawPistol(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number, canvasHeight: number,
  state: GameState,
  aimX: number, aimY: number, hasAim: boolean
): PistolRenderResult {
  const pivotX = canvasWidth / 2;
  const pivotY = canvasHeight * PISTOL_Y_OFFSET;

  // Angle toward aim, default straight up
  let angle = -Math.PI / 2;
  if (hasAim) {
    angle = Math.atan2(aimY - pivotY, aimX - pivotX);
    // Clamp to upper hemisphere (pointing upward)
    angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, angle));
  }

  // Recoil animation
  const now = Date.now();
  let recoilProgress = 0;
  if (now < state.recoilUntil) {
    const elapsed = PISTOL_RECOIL_DURATION_MS - (state.recoilUntil - now);
    const t = elapsed / PISTOL_RECOIL_DURATION_MS;
    recoilProgress = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
  }

  const recoilAngle = PISTOL_RECOIL_ANGLE * recoilProgress;
  const recoilOff = PISTOL_RECOIL_OFFSET * recoilProgress;
  const finalAngle = angle + recoilAngle;
  const barrelL = PISTOL_BARREL_LENGTH;
  const barrelW = 10;

  ctx.save();
  ctx.translate(pivotX, pivotY + recoilOff);
  ctx.rotate(finalAngle + Math.PI / 2);

  // Barrel (metallic gradient)
  const barrelGrad = ctx.createLinearGradient(-barrelW / 2, 0, barrelW / 2, 0);
  barrelGrad.addColorStop(0, "#3a3a3a"); barrelGrad.addColorStop(0.3, "#6a6a6a");
  barrelGrad.addColorStop(0.5, "#8a8a8a"); barrelGrad.addColorStop(0.7, "#6a6a6a");
  barrelGrad.addColorStop(1, "#3a3a3a");
  ctx.fillStyle = barrelGrad;
  ctx.fillRect(-barrelW / 2, -barrelL, barrelW, barrelL);
  // Barrel highlight
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(-barrelW / 2 + 2, -barrelL, 2, barrelL);
  // Muzzle cap
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-barrelW / 2 - 1, -barrelL - 3, barrelW + 2, 5);

  // Slide / receiver
  const slideW = 14, slideH = 22;
  ctx.fillStyle = "#444";
  ctx.beginPath(); ctx.roundRect(-slideW / 2, -slideH, slideW, slideH, 2); ctx.fill();
  // Serrations
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sy = -slideH + 4 + i * 4;
    ctx.beginPath(); ctx.moveTo(-slideW / 2 + 2, sy); ctx.lineTo(slideW / 2 - 2, sy); ctx.stroke();
  }

  // Trigger guard
  ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-6, 14, 0, 16); ctx.quadraticCurveTo(6, 14, 4, 0);
  ctx.stroke();
  // Trigger
  ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 10); ctx.stroke();

  // Grip (wooden)
  const gripW = 13, gripH = PISTOL_GRIP_HEIGHT;
  ctx.save(); ctx.rotate(0.08);
  const gripGrad = ctx.createLinearGradient(-gripW / 2, 0, gripW / 2, 0);
  gripGrad.addColorStop(0, "#2a1a0a"); gripGrad.addColorStop(0.3, "#4a3020");
  gripGrad.addColorStop(0.7, "#4a3020"); gripGrad.addColorStop(1, "#2a1a0a");
  ctx.fillStyle = gripGrad;
  ctx.beginPath(); ctx.roundRect(-gripW / 2, 0, gripW, gripH, [0, 0, 4, 4]); ctx.fill();
  // Grip texture
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 0.5;
  for (let i = 0; i < 6; i++) {
    const gy = 8 + i * 6;
    ctx.beginPath(); ctx.moveTo(-gripW / 2 + 2, gy); ctx.lineTo(gripW / 2 - 2, gy); ctx.stroke();
  }
  ctx.restore();

  ctx.restore();

  // Compute barrel tip in world space
  const rot = finalAngle + Math.PI / 2;
  const tipLocalY = -barrelL - 3;
  const worldTipX = pivotX - tipLocalY * Math.sin(rot);
  const worldTipY = (pivotY + recoilOff) + tipLocalY * Math.cos(rot);

  return { barrelTipX: worldTipX, barrelTipY: worldTipY };
}

/* ═══════════════════════════════════════════════════════════════
   SCORE DISPLAY (Canvas)
   ═══════════════════════════════════════════════════════════════ */

function drawScoreDisplay(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number): void {
  const x = canvasWidth - 24;
  const y = 52;
  const now = Date.now();
  const timeSinceChange = now - state.lastScoreChangeTime;
  const flashIntensity = Math.max(0, 1 - timeSinceChange / 500);

  ctx.save();
  ctx.textAlign = "right";

  // Label
  ctx.font = "bold 13px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("SCORE", x, y - 30);

  // Score value
  const scoreFontSize = 34 + flashIntensity * 6;
  ctx.font = `bold ${Math.round(scoreFontSize)}px Inter, system-ui, sans-serif`;
  ctx.shadowColor = flashIntensity > 0.1 ? "#FFD166" : "rgba(11, 99, 255, 0.4)";
  ctx.shadowBlur = 8 + flashIntensity * 15;
  ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
  const scoreText = state.displayedScore.toLocaleString();
  ctx.strokeText(scoreText, x, y);

  // Color flashes gold on change
  const r = Math.round(255);
  const g = Math.round(209 * flashIntensity + 255 * (1 - flashIntensity));
  const b = Math.round(102 * flashIntensity + 255 * (1 - flashIntensity));
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillText(scoreText, x, y);

  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   WAVE DISPLAY (Canvas)
   ═══════════════════════════════════════════════════════════════ */

function drawWaveDisplay(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number): void {
  const x = canvasWidth - 24;
  const y = 78;
  const now = Date.now();

  const transitionActive = now < state.waveTransitionUntil;
  const transitionProgress = transitionActive ? 1 - (state.waveTransitionUntil - now) / 2000 : 1;

  ctx.save();

  // During wave transition: large centered announcement
  if (transitionActive && transitionProgress < 0.5) {
    const pulse = 1 + Math.sin(now / 80) * 0.08;
    const centerX = canvasWidth / 2;
    const centerY = 130;
    ctx.translate(centerX, centerY); ctx.scale(pulse, pulse);
    ctx.textAlign = "center";
    ctx.font = "bold 32px Inter, system-ui, sans-serif";
    ctx.shadowColor = state.isBossWave ? "#FF3333" : "#0B63FF"; ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    const waveText = state.isBossWave ? `BOSS WAVE ${state.wave}` : `WAVE ${state.wave}`;
    ctx.strokeText(waveText, 0, 0);
    ctx.fillStyle = state.isBossWave ? "#FF5A5F" : "#FFFFFF";
    ctx.fillText(waveText, 0, 0);
    ctx.shadowBlur = 0;
  } else {
    // Normal small wave indicator
    ctx.textAlign = "right";
    const fontSize = state.isBossWave ? 16 : 14;
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    const waveText = state.isBossWave ? `BOSS WAVE ${state.wave}` : `WAVE ${state.wave}`;
    ctx.strokeText(waveText, x, y);
    ctx.fillStyle = state.isBossWave ? "#FF5A5F" : "rgba(255,255,255,0.7)";
    ctx.fillText(waveText, x, y);
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   NEW HIGH SCORE INDICATOR
   ═══════════════════════════════════════════════════════════════ */

function drawNewHighScoreIndicator(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
  const now = Date.now();
  const pulse = 0.7 + 0.3 * Math.sin(now / 150);
  const x = canvasWidth - 24;
  const y = 100;

  ctx.save();
  ctx.textAlign = "right";
  ctx.font = "bold 12px Inter, system-ui, sans-serif";
  ctx.shadowColor = "#FFD166"; ctx.shadowBlur = 10 * pulse;
  ctx.fillStyle = `rgba(255, 209, 102, ${pulse})`;
  ctx.fillText("NEW HIGH SCORE!", x, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}
