import { GameState, TrashItem, HitToast, ComboState, ActivePowerUp, PowerUp, PowerUpType } from "@/lib/types";
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
  SCREEN_SHAKE_DURATION_MS,
  SCREEN_SHAKE_INTENSITY,
  HIT_FLASH_DURATION_MS,
} from "@/lib/constants";

/* ─── Trash Item Colors ─── */

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

function getTrashSeed(id: string): number {
  return parseFloat(id.split("-")[1]) || 0;
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

  // Screen shake
  if (now < state.screenShakeUntil) {
    const intensity = SCREEN_SHAKE_INTENSITY * ((state.screenShakeUntil - now) / SCREEN_SHAKE_DURATION_MS);
    const shakeX = (Math.random() - 0.5) * 2 * intensity;
    const shakeY = (Math.random() - 0.5) * 2 * intensity;
    ctx.save();
    ctx.translate(shakeX, shakeY);
  }

  drawBackground(ctx, canvasWidth, canvasHeight, t, state.health);

  // Power-ups on ground (before zombies so they appear under)
  for (const pu of state.powerUps) {
    if (!pu.collected) {
      drawPowerUp(ctx, pu, now);
    }
  }

  const sorted = [...state.trashItems]
    .filter((z) => z.alive)
    .sort((a, b) => a.depth - b.depth);

  for (const z of sorted) {
    drawTrashItem(ctx, z, t);
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
  if (state.isSurgeWave && !state.surgeCleared) {
    const boss = state.trashItems.find((z) => z.trashType === "barge" && z.alive);
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

  // End screen shake transform
  if (now < state.screenShakeUntil) {
    ctx.restore();
  }

  // White hit flash overlay
  if (now < state.hitFlashUntil) {
    const flashAlpha = 0.15 * ((state.hitFlashUntil - now) / HIT_FLASH_DURATION_MS);
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════════════════════════ */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, health: number): void {
  const horizonY = h * HORIZON_Y_RATIO;

  // Deep ocean gradient — full canvas
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, "#001830");
  oceanGrad.addColorStop(0.15, "#002a50");
  oceanGrad.addColorStop(0.28, "#003366");
  oceanGrad.addColorStop(0.5, "#004d73");
  oceanGrad.addColorStop(0.75, "#006994");
  oceanGrad.addColorStop(1, "#004060");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Underwater light rays (same sine-wave technique as old aurora)
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let layer = 0; layer < 4; layer++) {
    const rayX = w * (0.2 + layer * 0.2) + Math.sin(t * 0.1 + layer * 2) * 30;
    const rayW = 40 + layer * 15;
    const rayGrad = ctx.createLinearGradient(rayX, 0, rayX, h * 0.75);
    const hue = 180 + layer * 10;
    rayGrad.addColorStop(0, `hsla(${hue}, 60%, 80%, 0.6)`);
    rayGrad.addColorStop(0.4, `hsla(${hue}, 50%, 70%, 0.3)`);
    rayGrad.addColorStop(1, `hsla(${hue}, 40%, 60%, 0)`);
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rayX - rayW * 0.3, 0);
    ctx.lineTo(rayX + rayW * 0.3, 0);
    ctx.lineTo(rayX + rayW, h * 0.75);
    ctx.lineTo(rayX - rayW, h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Undulating caustic light bands (reusing old aurora sine technique)
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let layer = 0; layer < 3; layer++) {
    const baseY = h * (0.08 + layer * 0.08);
    const hue = 175 + layer * 15;
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
    const causticGrad = ctx.createLinearGradient(0, baseY - 15, 0, baseY + 60);
    causticGrad.addColorStop(0, `hsla(${hue}, 70%, 70%, 0)`);
    causticGrad.addColorStop(0.3, `hsla(${hue}, 70%, 70%, 0.7)`);
    causticGrad.addColorStop(0.6, `hsla(${hue}, 70%, 70%, 0.3)`);
    causticGrad.addColorStop(1, `hsla(${hue}, 70%, 70%, 0)`);
    ctx.fillStyle = causticGrad;
    ctx.fill();
  }
  ctx.restore();

  // Faint sun disc near top
  const sunX = w * 0.5, sunY = h * 0.04, sunR = 50;
  ctx.save();
  const sunHalo = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 4);
  sunHalo.addColorStop(0, "rgba(180, 220, 255, 0.10)");
  sunHalo.addColorStop(0.3, "rgba(120, 200, 240, 0.05)");
  sunHalo.addColorStop(1, "rgba(80, 160, 220, 0)");
  ctx.fillStyle = sunHalo;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(200, 230, 255, 0.12)";
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(220, 240, 255, 0.18)";
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Floating particulate / plankton (replaces stars)
  ctx.save();
  for (let i = 0; i < 50; i++) {
    const px = seededRandom(i * 3 + 1) * w;
    const py = seededRandom(i * 3 + 2) * h * 0.85;
    const drift = Math.sin(t * 0.3 + i * 1.3) * 8;
    const bob = Math.cos(t * 0.5 + i * 2.1) * 4;
    const twinkle = 0.2 + 0.5 * Math.abs(Math.sin(t * (0.8 + seededRandom(i) * 1.5) + i * 1.7));
    const size = seededRandom(i * 3 + 3) > 0.8 ? 1.8 : 1;
    ctx.globalAlpha = twinkle * 0.3;
    ctx.fillStyle = "rgba(150, 220, 255, 0.6)";
    ctx.beginPath(); ctx.arc(px + drift, py + bob, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Coral reef silhouettes at horizon (replaces mountains)
  ctx.save();
  ctx.fillStyle = "rgba(0, 30, 50, 0.5)";
  ctx.beginPath(); ctx.moveTo(0, horizonY);
  for (let x = 0; x <= w; x += 2) {
    const ph = 20 + seededRandom(Math.floor(x / 50) + 100) * 40;
    const wave = 0.5 + 0.5 * Math.sin(x * 0.01 + seededRandom(Math.floor(x / 70) + 200) * 5);
    ctx.lineTo(x, horizonY - ph * wave);
  }
  ctx.lineTo(w, horizonY); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "rgba(0, 25, 45, 0.7)";
  ctx.beginPath(); ctx.moveTo(0, horizonY);
  for (let x = 0; x <= w; x += 2) {
    const ph = 12 + seededRandom(Math.floor(x / 40) + 300) * 30;
    const wave = 0.5 + 0.5 * Math.sin(x * 0.014 + 2 + seededRandom(Math.floor(x / 50) + 400) * 4);
    ctx.lineTo(x, horizonY - ph * wave);
  }
  ctx.lineTo(w, horizonY); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Sandy seafloor
  const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  floorGrad.addColorStop(0, "#004466");
  floorGrad.addColorStop(0.15, "#003d5c");
  floorGrad.addColorStop(0.5, "#1a3a40");
  floorGrad.addColorStop(0.85, "#2a4535");
  floorGrad.addColorStop(1, "#3a5540");
  ctx.fillStyle = floorGrad; ctx.fillRect(0, horizonY, w, h - horizonY);

  // Sandy path / lighter sand channel
  ctx.save(); ctx.globalAlpha = 0.1;
  ctx.beginPath(); ctx.moveTo(w * 0.5, horizonY);
  ctx.quadraticCurveTo(w * 0.48, h * 0.6, w * 0.35, h);
  ctx.lineTo(w * 0.65, h);
  ctx.quadraticCurveTo(w * 0.52, h * 0.6, w * 0.5, horizonY);
  ctx.closePath(); ctx.fillStyle = "#5a7a60"; ctx.fill(); ctx.restore();

  drawReefElements(ctx, w, h, horizonY, t, health);

  // Water haze at horizon
  const hazeGrad = ctx.createLinearGradient(0, horizonY - 25, 0, horizonY + 70);
  hazeGrad.addColorStop(0, "rgba(0, 50, 80, 0)");
  hazeGrad.addColorStop(0.3, "rgba(0, 60, 90, 0.3)");
  hazeGrad.addColorStop(0.6, "rgba(0, 50, 80, 0.15)");
  hazeGrad.addColorStop(1, "rgba(0, 40, 70, 0)");
  ctx.fillStyle = hazeGrad; ctx.fillRect(0, horizonY - 25, w, 95);

  // Drifting current wisps (replaces fog)
  ctx.save(); ctx.globalAlpha = 0.06;
  for (let i = 0; i < 4; i++) {
    const fogY = horizonY + (h - horizonY) * (0.3 + i * 0.15);
    const drift = Math.sin(t * 0.15 + i * 2) * 40;
    ctx.fillStyle = "rgba(0, 120, 160, 0.4)";
    ctx.beginPath(); ctx.ellipse(w * 0.3 + drift + i * 100, fogY, 250 + i * 50, 15 + i * 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.7 - drift + i * 80, fogY + 20, 200 + i * 40, 12 + i * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Perspective grid — ocean floor
  ctx.strokeStyle = "rgba(0, 80, 100, 0.12)"; ctx.lineWidth = 1;
  const centerX = w / 2;
  for (let i = 0; i < 8; i++) { const lineY = horizonY + (h - horizonY) * Math.pow((i + 1) / 8, 0.6); ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(w, lineY); ctx.stroke(); }
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(centerX, horizonY); ctx.lineTo(centerX + i * w * 0.25, h); ctx.stroke(); }

  // Seagrass (replaces grass tufts)
  ctx.save(); ctx.lineCap = "round";
  for (let i = 0; i < 30; i++) {
    const gx = seededRandom(i + 500) * w;
    const gy = horizonY + (h - horizonY) * (0.1 + seededRandom(i + 600) * 0.7);
    const grassH = 8 + seededRandom(i + 700) * 14;
    const sway = Math.sin(t * 0.8 + i * 0.7) * 4;
    ctx.strokeStyle = `rgba(0, ${80 + seededRandom(i + 750) * 60}, ${60 + seededRandom(i + 760) * 40}, 0.35)`;
    ctx.lineWidth = 1.5 + seededRandom(i + 770);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + sway, gy - grassH * 0.6, gx + sway * 1.5, gy - grassH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx + 3, gy); ctx.quadraticCurveTo(gx + 3 + sway * 0.8, gy - grassH * 0.5, gx + 3 + sway * 1.2, gy - grassH * 0.8); ctx.stroke();
  }
  ctx.restore();
}

function drawReefElements(ctx: CanvasRenderingContext2D, w: number, h: number, horizonY: number, t: number, health: number): void {
  ctx.save();

  // Health-based bleaching: 100 hp = vibrant, 0 hp = white
  const vitality = Math.max(0, Math.min(1, health / 100));

  // Lerp a hex color toward white based on vitality
  function bleach(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const br = Math.round(r + (255 - r) * (1 - vitality));
    const bg = Math.round(g + (255 - g) * (1 - vitality));
    const bb = Math.round(b + (255 - b) * (1 - vitality));
    return `rgba(${br}, ${bg}, ${bb}, ${alpha})`;
  }

  function bleachGlow(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const br = Math.round(r + (255 - r) * (1 - vitality));
    const bg = Math.round(g + (255 - g) * (1 - vitality));
    const bb = Math.round(b + (255 - b) * (1 - vitality));
    return `rgb(${br}, ${bg}, ${bb})`;
  }

  const floorY = h * 0.88; // coral sits along the bottom band
  const coralBaseColors = ["#FF6B9D", "#FF8C42", "#00D4AA", "#FF5E5B", "#D4A5FF"];

  // ── Coral 1: Branching coral (left) ──
  {
    const cx = w * 0.08, by = floorY;
    const color = coralBaseColors[0];
    const sway = Math.sin(t * 0.7) * 3;
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 8 * vitality;
    ctx.fillStyle = bleach(color, 0.85);
    ctx.strokeStyle = bleach(color, 0.6);
    ctx.lineWidth = Math.max(2, w * 0.005);
    ctx.lineCap = "round";
    // Main trunk
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.bezierCurveTo(cx - 2, by - 30, cx + 4 + sway, by - 55, cx + sway, by - 75);
    ctx.stroke();
    // Left branch
    ctx.beginPath();
    ctx.moveTo(cx + sway * 0.5, by - 40);
    ctx.bezierCurveTo(cx - 12 + sway * 0.3, by - 50, cx - 18 + sway * 0.6, by - 62, cx - 20 + sway, by - 70);
    ctx.stroke();
    // Right branch
    ctx.beginPath();
    ctx.moveTo(cx + sway * 0.5, by - 35);
    ctx.bezierCurveTo(cx + 14 + sway * 0.3, by - 45, cx + 20 + sway * 0.6, by - 58, cx + 22 + sway, by - 64);
    ctx.stroke();
    // Small sub-branch
    ctx.beginPath();
    ctx.moveTo(cx - 18 + sway, by - 68);
    ctx.bezierCurveTo(cx - 25 + sway, by - 72, cx - 28 + sway, by - 80, cx - 26 + sway, by - 84);
    ctx.stroke();
    // Tips (small circles)
    const tips = [[cx + sway, by - 75], [cx - 20 + sway, by - 70], [cx + 22 + sway, by - 64], [cx - 26 + sway, by - 84]];
    for (const [tx, ty] of tips) {
      ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Coral 2: Fan coral (left-center) ──
  {
    const cx = w * 0.2, by = floorY;
    const color = coralBaseColors[1];
    const sway = Math.sin(t * 0.6 + 1) * 2;
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 10 * vitality;
    ctx.fillStyle = bleach(color, 0.7);
    // Fan shape with bezier curves
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.bezierCurveTo(cx - 8, by - 20, cx - 30 + sway, by - 55, cx - 25 + sway, by - 80);
    ctx.bezierCurveTo(cx - 15 + sway, by - 90, cx + 15 + sway, by - 90, cx + 25 + sway, by - 80);
    ctx.bezierCurveTo(cx + 30 + sway, by - 55, cx + 8, by - 20, cx, by);
    ctx.closePath();
    ctx.fill();
    // Internal vein lines
    ctx.strokeStyle = bleach(color, 0.35);
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const spread = i * 8;
      ctx.beginPath();
      ctx.moveTo(cx, by - 5);
      ctx.bezierCurveTo(cx + spread * 0.3 + sway * 0.3, by - 30, cx + spread * 0.7 + sway * 0.6, by - 55, cx + spread + sway, by - 78);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Coral 3: Brain coral (center-left) ──
  {
    const cx = w * 0.35, by = floorY + 5;
    const color = coralBaseColors[2];
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 10 * vitality;
    ctx.fillStyle = bleach(color, 0.75);
    // Dome shape
    ctx.beginPath();
    ctx.moveTo(cx - 28, by);
    ctx.bezierCurveTo(cx - 30, by - 20, cx - 20, by - 40, cx, by - 42);
    ctx.bezierCurveTo(cx + 20, by - 40, cx + 30, by - 20, cx + 28, by);
    ctx.closePath();
    ctx.fill();
    // Meandering grooves
    ctx.strokeStyle = bleach(color, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 18, by - 10);
    ctx.bezierCurveTo(cx - 10, by - 18, cx + 5, by - 15, cx + 15, by - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, by - 22);
    ctx.bezierCurveTo(cx - 8, by - 30, cx + 8, by - 28, cx + 22, by - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 12, by - 32);
    ctx.bezierCurveTo(cx - 2, by - 38, cx + 10, by - 36, cx + 18, by - 30);
    ctx.stroke();
    ctx.restore();
  }

  // ── Coral 4: Branching coral (right-center) ──
  {
    const cx = w * 0.7, by = floorY;
    const color = coralBaseColors[3];
    const sway = Math.sin(t * 0.8 + 2.5) * 3;
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 8 * vitality;
    ctx.strokeStyle = bleach(color, 0.7);
    ctx.fillStyle = bleach(color, 0.85);
    ctx.lineWidth = Math.max(2.5, w * 0.006);
    ctx.lineCap = "round";
    // Main trunk
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.bezierCurveTo(cx + 3, by - 25, cx - 2 + sway, by - 50, cx + sway, by - 68);
    ctx.stroke();
    // Left branch
    ctx.beginPath();
    ctx.moveTo(cx + sway * 0.4, by - 30);
    ctx.bezierCurveTo(cx - 15 + sway * 0.5, by - 42, cx - 22 + sway, by - 55, cx - 18 + sway, by - 65);
    ctx.stroke();
    // Right branch
    ctx.beginPath();
    ctx.moveTo(cx + sway * 0.4, by - 25);
    ctx.bezierCurveTo(cx + 16 + sway * 0.5, by - 38, cx + 24 + sway, by - 52, cx + 20 + sway, by - 60);
    ctx.stroke();
    // Right sub-branch
    ctx.beginPath();
    ctx.moveTo(cx + 20 + sway, by - 55);
    ctx.bezierCurveTo(cx + 30 + sway, by - 58, cx + 34 + sway, by - 66, cx + 30 + sway, by - 72);
    ctx.stroke();
    // Tips
    const tips = [[cx + sway, by - 68], [cx - 18 + sway, by - 65], [cx + 20 + sway, by - 60], [cx + 30 + sway, by - 72]];
    for (const [tx, ty] of tips) {
      ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Coral 5: Fan coral (right) ──
  {
    const cx = w * 0.85, by = floorY;
    const color = coralBaseColors[4];
    const sway = Math.sin(t * 0.5 + 4) * 2.5;
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 10 * vitality;
    ctx.fillStyle = bleach(color, 0.65);
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.bezierCurveTo(cx - 6, by - 18, cx - 22 + sway, by - 50, cx - 18 + sway, by - 72);
    ctx.bezierCurveTo(cx - 10 + sway, by - 82, cx + 10 + sway, by - 82, cx + 18 + sway, by - 72);
    ctx.bezierCurveTo(cx + 22 + sway, by - 50, cx + 6, by - 18, cx, by);
    ctx.closePath();
    ctx.fill();
    // Veins
    ctx.strokeStyle = bleach(color, 0.3);
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const spread = i * 6;
      ctx.beginPath();
      ctx.moveTo(cx, by - 5);
      ctx.bezierCurveTo(cx + spread * 0.4 + sway * 0.3, by - 28, cx + spread * 0.8 + sway * 0.7, by - 50, cx + spread + sway, by - 70);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Coral 6: Small brain coral (far right) ──
  {
    const cx = w * 0.94, by = floorY + 8;
    const color = coralBaseColors[1];
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 6 * vitality;
    ctx.fillStyle = bleach(color, 0.7);
    ctx.beginPath();
    ctx.moveTo(cx - 18, by);
    ctx.bezierCurveTo(cx - 20, by - 12, cx - 12, by - 28, cx, by - 30);
    ctx.bezierCurveTo(cx + 12, by - 28, cx + 20, by - 12, cx + 18, by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = bleach(color, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 12, by - 8);
    ctx.bezierCurveTo(cx - 4, by - 16, cx + 6, by - 14, cx + 12, by - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 8, by - 18);
    ctx.bezierCurveTo(cx, by - 24, cx + 8, by - 22, cx + 14, by - 16);
    ctx.stroke();
    ctx.restore();
  }

  // ── Coral 7: Tall branching coral (far left) ──
  {
    const cx = w * 0.03, by = floorY + 3;
    const color = coralBaseColors[2];
    const sway = Math.sin(t * 0.9 + 3) * 2;
    ctx.save();
    ctx.shadowColor = bleachGlow(color);
    ctx.shadowBlur = 7 * vitality;
    ctx.strokeStyle = bleach(color, 0.65);
    ctx.fillStyle = bleach(color, 0.8);
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.bezierCurveTo(cx + 1, by - 20, cx - 3 + sway, by - 45, cx + sway, by - 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sway * 0.3, by - 28);
    ctx.bezierCurveTo(cx - 10 + sway, by - 38, cx - 14 + sway, by - 50, cx - 12 + sway, by - 55);
    ctx.stroke();
    const tips = [[cx + sway, by - 60], [cx - 12 + sway, by - 55]];
    for (const [tx, ty] of tips) {
      ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Rocks / boulders near horizon
  ctx.fillStyle = "rgba(20, 40, 35, 0.5)";
  const rocks = [
    { x: w * 0.03, y: horizonY + 3, rx: 15, ry: 8 },
    { x: w * 0.22, y: horizonY + 5, rx: 12, ry: 6 },
    { x: w * 0.75, y: horizonY + 4, rx: 18, ry: 9 },
    { x: w * 0.95, y: horizonY + 6, rx: 14, ry: 7 },
  ];
  for (const r of rocks) {
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   ZOMBIE — Type-based dispatcher
   ═══════════════════════════════════════════════════════════════ */

function drawTrashItem(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  switch (z.trashType) {
    case "bottle": drawBottle(ctx, z, t); break;
    case "bag": drawBag(ctx, z, t); break;
    case "barrel": drawBarrel(ctx, z, t); break;
    case "net": drawNet(ctx, z, t); break;
    case "barge": drawBarge(ctx, z, t); break;
  }
  if ((z.trashType === "barrel" || z.trashType === "barge") && z.hp < z.maxHp) {
    drawTrashHPBar(ctx, z);
  }
}

/* ─── Bottle (basic) ─── */
function drawBottle(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 1.5 + seed * 3) * bh * 0.02;
  const sway = Math.sin(t * 0.8 + seed * 2) * 0.06;

  ctx.save();
  ctx.translate(z.x, z.y + bob);
  ctx.rotate(sway);

  // Glow aura
  ctx.save();
  const pulse = 0.4 + 0.3 * Math.sin(t * 2 + seed);
  ctx.shadowColor = "#00ccff";
  ctx.shadowBlur = 12 * s * pulse;

  // Bottle body — rounded rectangle
  const bodyW = bw * 0.3;
  const bodyH = bh * 0.55;
  const bodyX = -bodyW / 2;
  const bodyY = -bodyH * 0.4;
  const r = bodyW * 0.25;
  ctx.fillStyle = "rgba(40, 120, 180, 0.75)";
  ctx.beginPath();
  ctx.moveTo(bodyX + r, bodyY);
  ctx.lineTo(bodyX + bodyW - r, bodyY);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + r);
  ctx.lineTo(bodyX + bodyW, bodyY + bodyH - r);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - r, bodyY + bodyH);
  ctx.lineTo(bodyX + r, bodyY + bodyH);
  ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - r);
  ctx.lineTo(bodyX, bodyY + r);
  ctx.quadraticCurveTo(bodyX, bodyY, bodyX + r, bodyY);
  ctx.closePath();
  ctx.fill();

  // Neck
  const neckW = bodyW * 0.4;
  const neckH = bodyH * 0.3;
  ctx.fillStyle = "rgba(50, 140, 200, 0.7)";
  ctx.fillRect(-neckW / 2, bodyY - neckH, neckW, neckH);

  // Cap
  const capW = neckW * 1.3;
  const capH = bodyH * 0.1;
  ctx.fillStyle = "rgba(200, 220, 240, 0.85)";
  ctx.fillRect(-capW / 2, bodyY - neckH - capH, capW, capH);

  ctx.restore(); // end glow

  // Label stripe
  if (s > 0.25) {
    ctx.fillStyle = "rgba(180, 220, 255, 0.25)";
    ctx.fillRect(bodyX + bodyW * 0.1, bodyY + bodyH * 0.3, bodyW * 0.8, bodyH * 0.2);
  }

  // Danger glow when close
  if (s > 1.0) {
    const dp = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(0, 200, 255, ${(s - 1.0) * 0.1 * (0.6 + 0.4 * dp)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.35, bh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/* ─── Bag (fast) ─── */
function drawBag(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 2.5 + seed * 3) * bh * 0.03;

  ctx.save();
  ctx.translate(z.x, z.y + bob);

  // Ghostly glow
  ctx.save();
  const pulse = 0.3 + 0.3 * Math.sin(t * 3 + seed);
  ctx.shadowColor = "rgba(220, 240, 255, 0.8)";
  ctx.shadowBlur = 18 * s * pulse;

  // Wobbly blob using sin waves on a circle
  const radius = bw * 0.28;
  const points = 24;
  ctx.fillStyle = `rgba(220, 230, 240, ${0.3 + 0.1 * Math.sin(t * 2 + seed)})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + 0.1 * Math.sin(t * 2.5 + seed)})`;
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.15 * Math.sin(angle * 3 + t * 4 + seed) + 0.1 * Math.sin(angle * 5 - t * 2.5);
    const rx = radius * wobble * Math.cos(angle);
    const ry = radius * wobble * 1.1 * Math.sin(angle);
    if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore(); // end glow

  // Handles at the top
  if (s > 0.2) {
    ctx.strokeStyle = "rgba(200, 215, 230, 0.35)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.lineCap = "round";
    const handleSway = Math.sin(t * 3 + seed) * 3 * s;
    ctx.beginPath(); ctx.moveTo(-bw * 0.08, -bw * 0.25); ctx.quadraticCurveTo(-bw * 0.12 + handleSway, -bw * 0.4, -bw * 0.02, -bw * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bw * 0.08, -bw * 0.25); ctx.quadraticCurveTo(bw * 0.12 + handleSway, -bw * 0.4, bw * 0.02, -bw * 0.35); ctx.stroke();
  }

  // Danger glow
  if (s > 1.0) {
    const dp = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(200, 220, 255, ${(s - 1.0) * 0.1 * (0.6 + 0.4 * dp)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.4, bh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/* ─── Barrel (tank) ─── */
function drawBarrel(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 1.0 + seed * 2) * bh * 0.01;
  const sway = Math.sin(t * 0.5 + seed) * 0.03;

  ctx.save();
  ctx.translate(z.x, z.y + bob);
  ctx.rotate(sway);

  // Warm glow
  ctx.save();
  const pulse = 0.4 + 0.2 * Math.sin(t * 1.5 + seed);
  ctx.shadowColor = "#ff8833";
  ctx.shadowBlur = 14 * s * pulse;

  // Barrel body — thick rectangle
  const bodyW = bw * 0.5;
  const bodyH = bh * 0.6;
  const bodyX = -bodyW / 2;
  const bodyY = -bodyH * 0.45;
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Rim bands
  ctx.fillStyle = "#6B4226";
  const bandH = bodyH * 0.06;
  ctx.fillRect(bodyX, bodyY, bodyW, bandH);
  ctx.fillRect(bodyX, bodyY + bodyH - bandH, bodyW, bandH);
  ctx.fillRect(bodyX, bodyY + bodyH * 0.47, bodyW, bandH);

  ctx.restore(); // end glow

  // Hazard stripes
  if (s > 0.2) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    const stripeW = bodyW * 0.15;
    const stripeCount = Math.floor(bodyW / stripeW);
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(bodyX + i * stripeW, bodyY + bodyH * 0.2, stripeW, bodyH * 0.2);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(bodyX + i * stripeW, bodyY + bodyH * 0.2, stripeW, bodyH * 0.2);
      }
    }
    ctx.restore();
  }

  // Hazard symbol (simple)
  if (s > 0.35) {
    ctx.fillStyle = "rgba(255, 180, 0, 0.6)";
    ctx.font = `bold ${Math.max(8, 14 * s)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", 0, bodyY + bodyH * 0.65);
  }

  // Danger glow
  if (s > 1.0) {
    const dp = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255, 136, 50, ${(s - 1.0) * 0.1 * (0.6 + 0.4 * dp)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.4, bh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/* ─── Net (exploder) ─── */
function drawNet(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 1.8 + seed * 3) * bh * 0.02;

  ctx.save();
  ctx.translate(z.x, z.y + bob);

  // Green glow aura
  const pulse = 0.4 + 0.3 * Math.sin(t * 3.5 + seed);
  ctx.save();
  ctx.shadowColor = "#33cc33";
  ctx.shadowBlur = 16 * s * pulse;

  // Diamond shape with criss-cross mesh
  const dw = bw * 0.35;
  const dh = bh * 0.45;
  ctx.strokeStyle = `rgba(30, 120, 50, ${0.6 + 0.2 * Math.sin(t * 2 + seed)})`;
  ctx.lineWidth = Math.max(1.5, 2.5 * s);
  ctx.lineCap = "round";

  // Diamond outline
  ctx.beginPath();
  ctx.moveTo(0, -dh); ctx.lineTo(dw, 0); ctx.lineTo(0, dh); ctx.lineTo(-dw, 0);
  ctx.closePath();
  ctx.fillStyle = `rgba(20, 80, 30, ${0.15 + 0.1 * pulse})`;
  ctx.fill();
  ctx.stroke();

  // Criss-cross lines
  const meshLines = 4;
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.strokeStyle = `rgba(40, 150, 60, ${0.4 + 0.15 * Math.sin(t * 2.5 + seed)})`;
  for (let i = 1; i < meshLines; i++) {
    const frac = i / meshLines;
    // Lines from top-left edge to bottom-right edge
    const x1 = -dw * (1 - frac); const y1 = -dh * frac;
    const x2 = dw * frac; const y2 = dh * (1 - frac);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Lines from top-right edge to bottom-left edge
    const x3 = dw * (1 - frac); const y3 = -dh * frac;
    const x4 = -dw * frac; const y4 = dh * (1 - frac);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }

  ctx.restore(); // end glow

  // Knots at intersections
  if (s > 0.3) {
    ctx.fillStyle = `rgba(60, 180, 80, ${0.5 + 0.2 * pulse})`;
    for (let i = 1; i < meshLines; i++) {
      for (let j = 1; j < meshLines; j++) {
        const fx = (i / meshLines - 0.5) * 2;
        const fy = (j / meshLines - 0.5) * 2;
        if (Math.abs(fx) + Math.abs(fy) < 1) {
          ctx.beginPath(); ctx.arc(fx * dw, fy * dh, 2 * s, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // Danger glow
  if (s > 1.0) {
    const dp = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(50, 200, 50, ${(s - 1.0) * 0.1 * (0.6 + 0.4 * dp)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.4, bh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/* ─── Barge (boss) ─── */
function drawBarge(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 0.8 + seed) * bh * 0.015;
  const sway = Math.sin(t * 0.4 + seed) * 0.02;

  ctx.save();
  ctx.translate(z.x, z.y + bob);
  ctx.rotate(sway);

  // Menacing red-orange glow
  ctx.save();
  const pulse = 0.4 + 0.3 * Math.sin(t * 2 + seed);
  ctx.shadowColor = "#ff4400";
  ctx.shadowBlur = 22 * s * pulse;

  // Hull — wide dark rectangle
  const hullW = bw * 0.7;
  const hullH = bh * 0.3;
  const hullX = -hullW / 2;
  const hullY = -hullH * 0.3;
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(hullX, hullY, hullW, hullH);

  // Hull edge highlight
  ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.strokeRect(hullX, hullY, hullW, hullH);

  ctx.restore(); // end glow

  // Piled trash shapes on top
  if (s > 0.15) {
    ctx.save();
    const pileY = hullY;

    // Random pile of geometric shapes
    ctx.fillStyle = "rgba(90, 70, 50, 0.7)";
    ctx.fillRect(-hullW * 0.3, pileY - bh * 0.15, hullW * 0.2, bh * 0.15);
    ctx.fillStyle = "rgba(60, 80, 60, 0.7)";
    ctx.fillRect(-hullW * 0.05, pileY - bh * 0.2, hullW * 0.15, bh * 0.2);
    ctx.fillStyle = "rgba(80, 60, 40, 0.7)";
    ctx.fillRect(hullW * 0.15, pileY - bh * 0.12, hullW * 0.18, bh * 0.12);

    // Some circles (barrel shapes in the pile)
    ctx.fillStyle = "rgba(100, 70, 30, 0.6)";
    ctx.beginPath(); ctx.arc(-hullW * 0.15, pileY - bh * 0.08, bw * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(50, 90, 50, 0.6)";
    ctx.beginPath(); ctx.arc(hullW * 0.08, pileY - bh * 0.18, bw * 0.05, 0, Math.PI * 2); ctx.fill();

    // Peak triangle
    ctx.fillStyle = "rgba(70, 70, 70, 0.5)";
    ctx.beginPath();
    ctx.moveTo(-bw * 0.05, pileY - bh * 0.3);
    ctx.lineTo(bw * 0.08, pileY - bh * 0.15);
    ctx.lineTo(-bw * 0.12, pileY - bh * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Red-orange glow line at waterline
  if (s > 0.2) {
    const glowAlpha = 0.3 + 0.2 * pulse;
    ctx.strokeStyle = `rgba(255, 80, 20, ${glowAlpha})`;
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.beginPath();
    ctx.moveTo(hullX, hullY + hullH);
    ctx.lineTo(hullX + hullW, hullY + hullH);
    ctx.stroke();
  }

  // Danger glow when close
  if (s > 1.0) {
    const dp = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255, 60, 20, ${(s - 1.0) * 0.12 * (0.6 + 0.4 * dp)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawTrashHPBar(ctx: CanvasRenderingContext2D, z: TrashItem): void {
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

function drawBossHPBar(ctx: CanvasRenderingContext2D, boss: TrashItem, canvasWidth: number): void {
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
  ctx.save();

  // Rising bubbles
  for (let i = 0; i < 20; i++) {
    const baseX = seededRandom(i + 800) * w;
    const speed = 0.03 + seededRandom(i + 850) * 0.05;
    const wobble = Math.sin(t * 1.2 + i * 2.7) * 12;
    // Bubbles rise continuously — loop with modulo
    const py = h - ((t * speed * h + seededRandom(i + 900) * h) % (h * 1.1));
    const px = baseX + wobble;
    const size = 1.5 + seededRandom(i + 950) * 3;
    const alpha = 0.08 + 0.12 * Math.abs(Math.sin(t * 0.8 + i * 1.3));

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(150, 220, 255, 0.6)";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.stroke();
    // Highlight on bubble
    ctx.fillStyle = "rgba(200, 240, 255, 0.3)";
    ctx.beginPath(); ctx.arc(px - size * 0.3, py - size * 0.3, size * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // Glowing jellyfish-like particles (replace green fireflies)
  const horizonY = h * HORIZON_Y_RATIO;
  for (let i = 0; i < 6; i++) {
    const px = seededRandom(i + 1000) * w + Math.sin(t * 0.5 + i * 3.3) * 25;
    const py = horizonY + seededRandom(i + 1100) * (h - horizonY) * 0.5 + Math.cos(t * 0.4 + i * 2.5) * 15;
    const glow = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.5 + i * 4.1));
    ctx.globalAlpha = glow * 0.35;
    ctx.fillStyle = "#44ddff"; ctx.shadowColor = "#44ddff"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   VIGNETTE
   ═══════════════════════════════════════════════════════════════ */

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const radius = Math.max(w, h) * 0.7;
  const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.4, w / 2, h / 2, radius);
  vignetteGrad.addColorStop(0, "rgba(0, 10, 30, 0)"); vignetteGrad.addColorStop(0.7, "rgba(0, 10, 30, 0)");
  vignetteGrad.addColorStop(1, "rgba(0, 10, 30, 0.5)");
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

  // Cyan glow shadow for the whole blaster
  ctx.shadowColor = "rgba(46, 196, 214, 0.5)";
  ctx.shadowBlur = 12;

  // Barrel (ocean blue gradient)
  const barrelGrad = ctx.createLinearGradient(-barrelW / 2, 0, barrelW / 2, 0);
  barrelGrad.addColorStop(0, "#1a6b8a"); barrelGrad.addColorStop(0.3, "#22a0b8");
  barrelGrad.addColorStop(0.5, "#2ec4d6"); barrelGrad.addColorStop(0.7, "#22a0b8");
  barrelGrad.addColorStop(1, "#1a6b8a");
  ctx.fillStyle = barrelGrad;
  ctx.fillRect(-barrelW / 2, -barrelL, barrelW, barrelL);
  // Barrel highlight
  ctx.fillStyle = "rgba(180,240,255,0.2)";
  ctx.fillRect(-barrelW / 2 + 2, -barrelL, 2, barrelL);
  // Muzzle cap
  ctx.fillStyle = "#0e4f63";
  ctx.fillRect(-barrelW / 2 - 1, -barrelL - 3, barrelW + 2, 5);

  // Slide / receiver
  const slideW = 14, slideH = 22;
  ctx.fillStyle = "#18889e";
  ctx.beginPath(); ctx.roundRect(-slideW / 2, -slideH, slideW, slideH, 2); ctx.fill();
  // Serrations
  ctx.strokeStyle = "rgba(0,40,60,0.4)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sy = -slideH + 4 + i * 4;
    ctx.beginPath(); ctx.moveTo(-slideW / 2 + 2, sy); ctx.lineTo(slideW / 2 - 2, sy); ctx.stroke();
  }

  // Trigger guard
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0e5a6b"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-6, 14, 0, 16); ctx.quadraticCurveTo(6, 14, 4, 0);
  ctx.stroke();
  // Trigger
  ctx.strokeStyle = "#2ec4d6"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 10); ctx.stroke();

  // Grip (dark teal)
  const gripW = 13, gripH = PISTOL_GRIP_HEIGHT;
  ctx.save(); ctx.rotate(0.08);
  ctx.shadowColor = "rgba(46, 196, 214, 0.35)";
  ctx.shadowBlur = 8;
  const gripGrad = ctx.createLinearGradient(-gripW / 2, 0, gripW / 2, 0);
  gripGrad.addColorStop(0, "#0a3a42"); gripGrad.addColorStop(0.3, "#0f5560");
  gripGrad.addColorStop(0.7, "#0f5560"); gripGrad.addColorStop(1, "#0a3a42");
  ctx.fillStyle = gripGrad;
  ctx.beginPath(); ctx.roundRect(-gripW / 2, 0, gripW, gripH, [0, 0, 4, 4]); ctx.fill();
  // Grip texture
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,60,80,0.4)"; ctx.lineWidth = 0.5;
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
    ctx.shadowColor = state.isSurgeWave ? "#FF3333" : "#0B63FF"; ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    const waveText = state.isSurgeWave ? `SURGE WAVE ${state.wave}` : `WAVE ${state.wave}`;
    ctx.strokeText(waveText, 0, 0);
    ctx.fillStyle = state.isSurgeWave ? "#FF5A5F" : "#FFFFFF";
    ctx.fillText(waveText, 0, 0);
    ctx.shadowBlur = 0;
  } else {
    // Normal small wave indicator
    ctx.textAlign = "right";
    const fontSize = state.isSurgeWave ? 16 : 14;
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    const waveText = state.isSurgeWave ? `SURGE WAVE ${state.wave}` : `WAVE ${state.wave}`;
    ctx.strokeText(waveText, x, y);
    ctx.fillStyle = state.isSurgeWave ? "#FF5A5F" : "rgba(255,255,255,0.7)";
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
