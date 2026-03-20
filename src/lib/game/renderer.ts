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

  // Deep ocean gradient — full canvas with more color variation
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, "#000a14");
  oceanGrad.addColorStop(0.1, "#001420");
  oceanGrad.addColorStop(0.2, "#002a40");
  oceanGrad.addColorStop(0.35, "#003322");
  oceanGrad.addColorStop(0.5, "#004d63");
  oceanGrad.addColorStop(0.65, "#005a70");
  oceanGrad.addColorStop(0.8, "#006994");
  oceanGrad.addColorStop(1, "#003040");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Radial vignette — bright teal center, near-black edges
  const cx = w / 2, cy = h * 0.35;
  const vignetteR = Math.max(w, h) * 0.75;
  const vignette = ctx.createRadialGradient(cx, cy, vignetteR * 0.15, cx, cy, vignetteR);
  vignette.addColorStop(0, "rgba(0, 105, 148, 0.25)");
  vignette.addColorStop(0.3, "rgba(0, 80, 110, 0.1)");
  vignette.addColorStop(0.6, "rgba(0, 10, 20, 0.0)");
  vignette.addColorStop(1, "rgba(0, 5, 10, 0.65)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Deep green color patches for ocean variation
  ctx.save();
  ctx.globalAlpha = 0.08;
  const greenPatch = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.3);
  greenPatch.addColorStop(0, "#003322");
  greenPatch.addColorStop(1, "transparent");
  ctx.fillStyle = greenPatch;
  ctx.fillRect(0, 0, w, h);
  const greenPatch2 = ctx.createRadialGradient(w * 0.7, h * 0.55, 0, w * 0.7, h * 0.55, w * 0.25);
  greenPatch2.addColorStop(0, "#002820");
  greenPatch2.addColorStop(1, "transparent");
  ctx.fillStyle = greenPatch2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Concentrated light rays — brighter in center, dimmer at edges
  ctx.save();
  for (let layer = 0; layer < 8; layer++) {
    const centerBias = 0.25 + layer * 0.065;
    const rayX = w * centerBias + Math.sin(t * 0.08 + layer * 1.8) * 25;
    const distFromCenter = Math.abs(rayX - w * 0.5) / (w * 0.5);
    const intensity = 0.18 * (1 - distFromCenter * 0.7);
    ctx.globalAlpha = intensity;
    const rayW = 30 + layer * 12;
    const rayGrad = ctx.createLinearGradient(rayX, 0, rayX, h * 0.7);
    const hue = 178 + layer * 8;
    rayGrad.addColorStop(0, `hsla(${hue}, 65%, 82%, 0.7)`);
    rayGrad.addColorStop(0.3, `hsla(${hue}, 55%, 72%, 0.4)`);
    rayGrad.addColorStop(0.7, `hsla(${hue}, 45%, 62%, 0.1)`);
    rayGrad.addColorStop(1, `hsla(${hue}, 40%, 55%, 0)`);
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rayX - rayW * 0.2, 0);
    ctx.lineTo(rayX + rayW * 0.2, 0);
    ctx.lineTo(rayX + rayW * 1.2, h * 0.7);
    ctx.lineTo(rayX - rayW * 1.2, h * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Bright convergence spot where light rays meet
  ctx.save();
  const spotX = w * 0.5, spotY = h * 0.02;
  const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, h * 0.35);
  spotGrad.addColorStop(0, "rgba(200, 240, 255, 0.30)");
  spotGrad.addColorStop(0.15, "rgba(150, 220, 245, 0.12)");
  spotGrad.addColorStop(0.4, "rgba(100, 190, 230, 0.04)");
  spotGrad.addColorStop(1, "rgba(60, 150, 200, 0)");
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, w, h * 0.4);
  ctx.restore();

  // Undulating caustic light bands
  ctx.save();
  ctx.globalAlpha = 0.06;
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

  // Sun disc — brighter core
  const sunX = w * 0.5, sunY = h * 0.03, sunR = 55;
  ctx.save();
  const sunHalo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 5);
  sunHalo.addColorStop(0, "rgba(200, 235, 255, 0.18)");
  sunHalo.addColorStop(0.2, "rgba(150, 215, 245, 0.08)");
  sunHalo.addColorStop(0.5, "rgba(100, 180, 220, 0.03)");
  sunHalo.addColorStop(1, "rgba(60, 140, 200, 0)");
  ctx.fillStyle = sunHalo;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(220, 245, 255, 0.20)";
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(240, 250, 255, 0.28)";
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Floating particulate / plankton
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

  // Coral reef silhouettes at horizon
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

  // Dark distant rock formation silhouettes (behind existing horizon)
  ctx.fillStyle = "rgba(0, 15, 30, 0.6)";
  ctx.beginPath(); ctx.moveTo(0, horizonY);
  for (let x = 0; x <= w; x += 3) {
    const ph = 30 + seededRandom(Math.floor(x / 60) + 500) * 55;
    const wave = 0.5 + 0.5 * Math.sin(x * 0.008 + seededRandom(Math.floor(x / 80) + 600) * 6);
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

  // Caustic light spots on seafloor
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const spotX = seededRandom(i + 2000) * w;
    const spotY = horizonY + (h - horizonY) * (0.3 + seededRandom(i + 2100) * 0.5);
    const spotR = 30 + seededRandom(i + 2200) * 50;
    const flicker = 0.03 + 0.04 * Math.abs(Math.sin(t * 0.5 + i * 2.1));
    const causticSpot = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR);
    causticSpot.addColorStop(0, `rgba(100, 200, 220, ${flicker})`);
    causticSpot.addColorStop(0.5, `rgba(80, 180, 200, ${flicker * 0.5})`);
    causticSpot.addColorStop(1, "rgba(60, 160, 180, 0)");
    ctx.fillStyle = causticSpot;
    ctx.fillRect(spotX - spotR, spotY - spotR, spotR * 2, spotR * 2);
  }
  ctx.restore();

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

  // Dark rock/coral silhouettes — foreground framing on left and right edges
  ctx.save();
  const edgeW = w * 0.10;

  // Left rock formation
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(edgeW * 0.3, 0);
  ctx.bezierCurveTo(edgeW * 0.9, h * 0.05, edgeW * 1.1, h * 0.12, edgeW * 0.85, h * 0.2);
  ctx.bezierCurveTo(edgeW * 0.6, h * 0.28, edgeW * 0.95, h * 0.35, edgeW * 0.7, h * 0.45);
  ctx.bezierCurveTo(edgeW * 0.45, h * 0.55, edgeW * 0.8, h * 0.62, edgeW * 0.55, h * 0.72);
  ctx.bezierCurveTo(edgeW * 0.3, h * 0.82, edgeW * 0.6, h * 0.9, edgeW * 0.4, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const leftGrad = ctx.createLinearGradient(0, 0, edgeW, 0);
  leftGrad.addColorStop(0, "rgba(0, 10, 20, 0.75)");
  leftGrad.addColorStop(0.6, "rgba(0, 16, 32, 0.35)");
  leftGrad.addColorStop(1, "rgba(0, 16, 32, 0)");
  ctx.fillStyle = leftGrad;
  ctx.fill();

  // Right rock formation (mirrored)
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w - edgeW * 0.3, 0);
  ctx.bezierCurveTo(w - edgeW * 0.85, h * 0.06, w - edgeW * 1.05, h * 0.14, w - edgeW * 0.8, h * 0.22);
  ctx.bezierCurveTo(w - edgeW * 0.55, h * 0.3, w - edgeW * 0.9, h * 0.38, w - edgeW * 0.65, h * 0.48);
  ctx.bezierCurveTo(w - edgeW * 0.4, h * 0.58, w - edgeW * 0.75, h * 0.65, w - edgeW * 0.5, h * 0.75);
  ctx.bezierCurveTo(w - edgeW * 0.25, h * 0.85, w - edgeW * 0.55, h * 0.92, w - edgeW * 0.35, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  const rightGrad = ctx.createLinearGradient(w, 0, w - edgeW, 0);
  rightGrad.addColorStop(0, "rgba(0, 10, 20, 0.75)");
  rightGrad.addColorStop(0.6, "rgba(0, 16, 32, 0.35)");
  rightGrad.addColorStop(1, "rgba(0, 16, 32, 0)");
  ctx.fillStyle = rightGrad;
  ctx.fill();

  ctx.restore();
}

function drawReefElements(ctx: CanvasRenderingContext2D, w: number, h: number, horizonY: number, t: number, health: number): void {
  ctx.save();

  // Health-based bleaching: 100 hp = vibrant, 0 hp = white
  const vitality = Math.max(0, Math.min(1, health / 100));

  function bleachRGB(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [
      Math.round(r + (255 - r) * (1 - vitality)),
      Math.round(g + (255 - g) * (1 - vitality)),
      Math.round(b + (255 - b) * (1 - vitality)),
    ];
  }

  function bleach(hex: string, alpha: number): string {
    const [r, g, b] = bleachRGB(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function bleachGlow(hex: string): string {
    const [r, g, b] = bleachRGB(hex);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Reef sits in the bottom 12% of canvas
  const reefTop = h * 0.88;
  const reefBase = h;

  // ─── Helper: draw a branching coral ───
  function drawBranchingCoral(x: number, baseY: number, scale: number, color1: string, color2: string, seed: number) {
    const sway = Math.sin(t * 0.7 + seed) * 3 * scale;
    const trunkH = 70 * scale;
    const lw = Math.max(2.5, w * 0.005) * scale;
    ctx.save();
    ctx.shadowColor = bleachGlow(color1);
    ctx.shadowBlur = 10 * vitality;
    ctx.lineCap = "round";

    // Helper to draw one branch segment
    function branch(fromX: number, fromY: number, toX: number, toY: number, thickness: number) {
      ctx.strokeStyle = bleach(color1, 0.8);
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      const midX = (fromX + toX) / 2 + sway * 0.5;
      const midY = (fromY + toY) / 2;
      ctx.quadraticCurveTo(midX, midY, toX + sway, toY);
      ctx.stroke();
      // Tip bud
      ctx.fillStyle = bleach(color2, 0.9);
      ctx.beginPath();
      ctx.arc(toX + sway, toY, thickness * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main trunk
    const topY = baseY - trunkH;
    ctx.strokeStyle = bleach(color1, 0.85);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(x - 2 * scale, baseY - trunkH * 0.4, x + 3 * scale + sway * 0.5, baseY - trunkH * 0.7, x + sway, topY);
    ctx.stroke();

    // Left branch
    branch(x + sway * 0.3, baseY - trunkH * 0.5, x - 22 * scale, baseY - trunkH * 0.85, lw * 0.7);
    // Right branch
    branch(x + sway * 0.3, baseY - trunkH * 0.45, x + 24 * scale, baseY - trunkH * 0.8, lw * 0.7);
    // Top-left sub-branch
    branch(x - 20 * scale + sway, baseY - trunkH * 0.83, x - 30 * scale, baseY - trunkH * 1.05, lw * 0.5);
    // Top-right sub-branch
    branch(x + 22 * scale + sway, baseY - trunkH * 0.78, x + 34 * scale, baseY - trunkH * 0.98, lw * 0.5);
    // Main tip
    ctx.fillStyle = bleach(color2, 0.9);
    ctx.beginPath();
    ctx.arc(x + sway, topY, lw * 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─── Helper: draw a fan coral ───
  function drawFanCoral(x: number, baseY: number, scale: number, color1: string, color2: string, seed: number) {
    const sway = Math.sin(t * 0.5 + seed) * 2 * scale;
    const fanH = 75 * scale;
    const fanW = 32 * scale;
    ctx.save();
    ctx.shadowColor = bleachGlow(color1);
    ctx.shadowBlur = 12 * vitality;

    // Stem
    ctx.strokeStyle = bleach(color2, 0.7);
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + sway * 0.3, baseY - fanH * 0.25);
    ctx.stroke();

    // Semi-circular fan
    ctx.fillStyle = bleach(color1, 0.55);
    ctx.beginPath();
    ctx.moveTo(x - fanW + sway, baseY - fanH * 0.25);
    ctx.bezierCurveTo(
      x - fanW * 1.1 + sway, baseY - fanH * 0.7,
      x - fanW * 0.5 + sway, baseY - fanH * 1.05,
      x + sway, baseY - fanH
    );
    ctx.bezierCurveTo(
      x + fanW * 0.5 + sway, baseY - fanH * 1.05,
      x + fanW * 1.1 + sway, baseY - fanH * 0.7,
      x + fanW + sway, baseY - fanH * 0.25
    );
    ctx.closePath();
    ctx.fill();

    // Radiating vein lines
    ctx.strokeStyle = bleach(color2, 0.3);
    ctx.lineWidth = 0.8;
    for (let i = -4; i <= 4; i++) {
      const angle = (i / 4) * 0.9;
      const endX = x + Math.sin(angle) * fanW * 0.9 + sway;
      const endY = baseY - fanH * 0.25 - Math.cos(angle) * fanH * 0.7;
      ctx.beginPath();
      ctx.moveTo(x + sway * 0.3, baseY - fanH * 0.25);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Helper: draw a brain coral ───
  function drawBrainCoral(x: number, baseY: number, scale: number, color1: string, color2: string) {
    const rw = 30 * scale;
    const rh = 24 * scale;
    ctx.save();
    ctx.shadowColor = bleachGlow(color1);
    ctx.shadowBlur = 10 * vitality;

    // Dome
    ctx.fillStyle = bleach(color1, 0.75);
    ctx.beginPath();
    ctx.moveTo(x - rw, baseY);
    ctx.bezierCurveTo(x - rw * 1.05, baseY - rh * 0.6, x - rw * 0.5, baseY - rh, x, baseY - rh * 1.05);
    ctx.bezierCurveTo(x + rw * 0.5, baseY - rh, x + rw * 1.05, baseY - rh * 0.6, x + rw, baseY);
    ctx.closePath();
    ctx.fill();

    // Wavy groove lines
    ctx.strokeStyle = bleach(color2, 0.4);
    ctx.lineWidth = 1.2 * scale;
    for (let row = 0; row < 4; row++) {
      const rowY = baseY - rh * 0.2 - row * rh * 0.22;
      const rowW = rw * (0.85 - row * 0.12);
      ctx.beginPath();
      ctx.moveTo(x - rowW, rowY);
      for (let px = 0; px <= 1; px += 0.05) {
        const lx = x - rowW + px * rowW * 2;
        const ly = rowY + Math.sin(px * Math.PI * 3 + row * 1.5) * 3 * scale;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Helper: draw tube coral cluster ───
  function drawTubeCoral(x: number, baseY: number, scale: number, color1: string, color2: string, seed: number) {
    ctx.save();
    ctx.shadowColor = bleachGlow(color1);
    ctx.shadowBlur = 8 * vitality;
    const tubeCount = 5 + Math.floor(seededRandom(seed + 800) * 4);
    for (let i = 0; i < tubeCount; i++) {
      const tubeX = x + (seededRandom(seed + i * 7) - 0.5) * 24 * scale;
      const tubeH = (18 + seededRandom(seed + i * 7 + 1) * 22) * scale;
      const tubeW = (3 + seededRandom(seed + i * 7 + 2) * 2.5) * scale;
      const sway = Math.sin(t * 0.6 + seed + i * 0.8) * 1.5 * scale;

      // Tube body
      ctx.fillStyle = bleach(color1, 0.7);
      ctx.beginPath();
      ctx.moveTo(tubeX - tubeW, baseY);
      ctx.lineTo(tubeX - tubeW + sway * 0.5, baseY - tubeH);
      ctx.lineTo(tubeX + tubeW + sway * 0.5, baseY - tubeH);
      ctx.lineTo(tubeX + tubeW, baseY);
      ctx.closePath();
      ctx.fill();

      // Open top (darker ring)
      ctx.fillStyle = bleach(color2, 0.6);
      ctx.beginPath();
      ctx.ellipse(tubeX + sway * 0.5, baseY - tubeH, tubeW, tubeW * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rim highlight
      ctx.strokeStyle = bleach(color1, 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(tubeX + sway * 0.5, baseY - tubeH, tubeW, tubeW * 0.5, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─── Helper: draw kelp strand ───
  function drawKelp(x: number, baseY: number, scale: number, color: string, seed: number) {
    const kelpH = (50 + seededRandom(seed + 900) * 40) * scale;
    const sway = Math.sin(t * 0.8 + seed * 1.3) * 8 * scale;
    const sway2 = Math.sin(t * 1.2 + seed * 2.1) * 4 * scale;
    ctx.save();
    ctx.strokeStyle = bleach(color, 0.6);
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineCap = "round";

    // Main stalk
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(
      x + sway * 0.3, baseY - kelpH * 0.3,
      x + sway * 0.7 + sway2 * 0.3, baseY - kelpH * 0.6,
      x + sway + sway2, baseY - kelpH
    );
    ctx.stroke();

    // Leaves along stalk
    ctx.fillStyle = bleach(color, 0.4);
    for (let leaf = 0; leaf < 3; leaf++) {
      const lt = 0.3 + leaf * 0.25;
      const lx = x + sway * lt + sway2 * lt * 0.3;
      const ly = baseY - kelpH * lt;
      const leafSway = Math.sin(t * 1.0 + seed + leaf * 1.5) * 5 * scale;
      const dir = leaf % 2 === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx + dir * (12 * scale + leafSway), ly - 6 * scale, lx + dir * (8 * scale + leafSway), ly - 14 * scale);
      ctx.quadraticCurveTo(lx + dir * (3 * scale), ly - 8 * scale, lx, ly);
      ctx.fill();
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════
  // Place coral across the reef bed (dense, overlapping)
  // ═══════════════════════════════════════════

  // Back layer kelp (behind everything, tall, faded)
  const kelpPositions = [0.02, 0.1, 0.18, 0.28, 0.42, 0.55, 0.65, 0.78, 0.88, 0.95];
  for (let i = 0; i < kelpPositions.length; i++) {
    const kx = w * kelpPositions[i];
    const ky = reefBase - (reefBase - reefTop) * (0.1 + seededRandom(i + 50) * 0.3);
    const kScale = 0.8 + seededRandom(i + 60) * 0.6;
    const color = i % 2 === 0 ? "#1a5c2a" : "#2d8a4e";
    drawKelp(kx, ky, kScale, color, i * 13);
  }

  // Mid-layer: fan corals (semi-circular, tall, good backdrop)
  drawFanCoral(w * 0.08, reefBase - (reefBase - reefTop) * 0.15, 1.0, "#D4A5FF", "#9B59B6", 1);
  drawFanCoral(w * 0.32, reefBase - (reefBase - reefTop) * 0.1, 1.2, "#9B59B6", "#D4A5FF", 3);
  drawFanCoral(w * 0.62, reefBase - (reefBase - reefTop) * 0.12, 0.9, "#D4A5FF", "#9B59B6", 5);
  drawFanCoral(w * 0.88, reefBase - (reefBase - reefTop) * 0.18, 1.1, "#9B59B6", "#D4A5FF", 7);

  // Branching corals — pink/red, the signature reef shape
  drawBranchingCoral(w * 0.05, reefBase - (reefBase - reefTop) * 0.05, 1.0, "#FF6B9D", "#FF4466", 0);
  drawBranchingCoral(w * 0.22, reefBase - (reefBase - reefTop) * 0.08, 1.3, "#FF4466", "#FF6B9D", 2);
  drawBranchingCoral(w * 0.48, reefBase - (reefBase - reefTop) * 0.06, 1.1, "#FF6B9D", "#FF4466", 4);
  drawBranchingCoral(w * 0.72, reefBase - (reefBase - reefTop) * 0.1, 1.2, "#FF4466", "#FF6B9D", 6);
  drawBranchingCoral(w * 0.93, reefBase - (reefBase - reefTop) * 0.04, 0.9, "#FF6B9D", "#FF4466", 8);

  // Brain corals — green domes, ground level
  drawBrainCoral(w * 0.15, reefBase - (reefBase - reefTop) * 0.02, 1.1, "#00D4AA", "#2ECC71");
  drawBrainCoral(w * 0.40, reefBase + 2, 1.3, "#2ECC71", "#00D4AA");
  drawBrainCoral(w * 0.58, reefBase - (reefBase - reefTop) * 0.03, 0.9, "#00D4AA", "#2ECC71");
  drawBrainCoral(w * 0.82, reefBase + 1, 1.0, "#2ECC71", "#00D4AA");

  // Tube coral clusters — orange, fill gaps
  drawTubeCoral(w * 0.12, reefBase - (reefBase - reefTop) * 0.03, 1.0, "#FF8C42", "#E67E22", 10);
  drawTubeCoral(w * 0.28, reefBase - (reefBase - reefTop) * 0.05, 0.8, "#E67E22", "#FF8C42", 12);
  drawTubeCoral(w * 0.52, reefBase - (reefBase - reefTop) * 0.02, 1.1, "#FF8C42", "#E67E22", 14);
  drawTubeCoral(w * 0.68, reefBase - (reefBase - reefTop) * 0.04, 0.9, "#E67E22", "#FF8C42", 16);
  drawTubeCoral(w * 0.85, reefBase - (reefBase - reefTop) * 0.01, 1.0, "#FF8C42", "#E67E22", 18);

  // Front kelp (a few strands in front for depth)
  drawKelp(w * 0.06, reefBase, 1.1, "#2d8a4e", 100);
  drawKelp(w * 0.35, reefBase - 3, 0.9, "#1a5c2a", 101);
  drawKelp(w * 0.75, reefBase, 1.0, "#2d8a4e", 102);
  drawKelp(w * 0.96, reefBase - 2, 0.8, "#1a5c2a", 103);

  // Rocks / boulders scattered in the reef bed
  ctx.fillStyle = "rgba(20, 40, 35, 0.5)";
  const rocks = [
    { x: w * 0.03, y: reefBase - 2, rx: 15, ry: 8 },
    { x: w * 0.25, y: reefBase, rx: 12, ry: 6 },
    { x: w * 0.45, y: reefBase - 1, rx: 18, ry: 9 },
    { x: w * 0.60, y: reefBase + 1, rx: 14, ry: 7 },
    { x: w * 0.78, y: reefBase - 2, rx: 16, ry: 8 },
    { x: w * 0.95, y: reefBase, rx: 13, ry: 7 },
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
  ctx.fillStyle = "rgba(60, 150, 200, 0.55)";
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

  // Glass reflection highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(bodyX + bodyW * 0.1, bodyY + bodyH * 0.05, bodyW * 0.15, bodyH * 0.85);
  // Bottom inner light
  ctx.fillStyle = "rgba(100, 200, 255, 0.08)";
  ctx.beginPath();
  ctx.ellipse(0, bodyY + bodyH * 0.85, bodyW * 0.35, bodyH * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

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
  if (s > 0.15) {
    ctx.strokeStyle = "rgba(220, 235, 250, 0.5)";
    ctx.lineWidth = Math.max(1.5, 2.5 * s);
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

  // Rust patches
  if (s > 0.25) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#8B4513";
    // Irregular rust spots
    for (let ri = 0; ri < 3; ri++) {
      const rx = bodyX + seededRandom(seed + ri * 11 + 50) * bodyW;
      const ry = bodyY + seededRandom(seed + ri * 11 + 51) * bodyH;
      const rr = (3 + seededRandom(seed + ri * 11 + 52) * 5) * s;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.7, seededRandom(seed + ri * 11 + 53) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Hazard triangle symbol
  if (s > 0.35) {
    const triSize = Math.max(6, 10 * s);
    const triY = bodyY + bodyH * 0.62;
    ctx.fillStyle = "rgba(255, 200, 0, 0.7)";
    ctx.beginPath();
    ctx.moveTo(0, triY - triSize);
    ctx.lineTo(triSize * 0.85, triY + triSize * 0.5);
    ctx.lineTo(-triSize * 0.85, triY + triSize * 0.5);
    ctx.closePath();
    ctx.fill();
    // Exclamation inside
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.font = `bold ${Math.max(6, 9 * s)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", 0, triY);
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
  ctx.fillStyle = `rgba(40, 100, 50, ${0.15 + 0.1 * pulse})`;
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

  // Rope fraying at edges
  if (s > 0.25) {
    ctx.strokeStyle = `rgba(60, 140, 70, 0.3)`;
    ctx.lineWidth = Math.max(0.5, 1 * s);
    for (let fi = 0; fi < 4; fi++) {
      const angle = (fi / 4) * Math.PI * 2 + t * 0.3;
      const fx = Math.cos(angle) * dw * 1.05;
      const fy = Math.sin(angle) * dh * 1.05;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(angle) * 5 * s, fy + Math.sin(angle) * 5 * s);
      ctx.stroke();
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

  // Piled trash silhouettes on top
  if (s > 0.15) {
    ctx.save();
    const pileY = hullY;

    // Background pile mass
    ctx.fillStyle = "rgba(70, 60, 45, 0.7)";
    ctx.beginPath();
    ctx.moveTo(-hullW * 0.4, pileY);
    ctx.bezierCurveTo(-hullW * 0.35, pileY - bh * 0.15, -hullW * 0.1, pileY - bh * 0.25, 0, pileY - bh * 0.28);
    ctx.bezierCurveTo(hullW * 0.15, pileY - bh * 0.22, hullW * 0.35, pileY - bh * 0.12, hullW * 0.4, pileY);
    ctx.closePath();
    ctx.fill();

    // Individual trash silhouettes on the pile
    // Mini barrel
    ctx.fillStyle = "rgba(100, 70, 30, 0.65)";
    ctx.fillRect(-hullW * 0.25, pileY - bh * 0.18, hullW * 0.1, bh * 0.12);
    // Mini bottle
    ctx.fillStyle = "rgba(60, 130, 180, 0.5)";
    ctx.fillRect(hullW * 0.05, pileY - bh * 0.2, hullW * 0.04, bh * 0.14);
    ctx.fillRect(hullW * 0.055, pileY - bh * 0.23, hullW * 0.03, bh * 0.04);
    // Mini bag blob
    ctx.fillStyle = "rgba(200, 210, 220, 0.4)";
    ctx.beginPath();
    ctx.arc(hullW * 0.2, pileY - bh * 0.12, bw * 0.04, 0, Math.PI * 2);
    ctx.fill();
    // Crate shape
    ctx.fillStyle = "rgba(90, 75, 50, 0.6)";
    ctx.fillRect(-hullW * 0.08, pileY - bh * 0.15, hullW * 0.12, bh * 0.1);
    // Net draped over
    if (s > 0.3) {
      ctx.strokeStyle = "rgba(40, 120, 50, 0.3)";
      ctx.lineWidth = Math.max(0.5, 1 * s);
      for (let ni = 0; ni < 5; ni++) {
        const nx = -hullW * 0.3 + ni * hullW * 0.15;
        ctx.beginPath();
        ctx.moveTo(nx, pileY - bh * 0.1);
        ctx.quadraticCurveTo(nx + hullW * 0.05, pileY - bh * 0.22, nx + hullW * 0.1, pileY - bh * 0.08);
        ctx.stroke();
      }
    }

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

  // Tiny floating debris (organic particles, detritus)
  for (let i = 0; i < 15; i++) {
    const dx = seededRandom(i + 1200) * w;
    const dy = seededRandom(i + 1300) * h * 0.7 + h * 0.15;
    const drift = Math.sin(t * 0.2 + i * 1.7) * 15;
    const sink = Math.sin(t * 0.15 + i * 2.3) * 8;
    const size = 0.8 + seededRandom(i + 1400) * 1.5;
    ctx.globalAlpha = 0.06 + 0.04 * Math.abs(Math.sin(t * 0.5 + i));
    ctx.fillStyle = "rgba(120, 160, 140, 0.5)";
    ctx.fillRect(dx + drift - size / 2, dy + sink - size / 2, size, size * (0.5 + seededRandom(i + 1500) * 0.5));
  }

  // Small fish silhouettes swimming across background
  for (let i = 0; i < 3; i++) {
    const fishSpeed = 0.02 + seededRandom(i + 1600) * 0.03;
    const fishX = ((t * fishSpeed * w + seededRandom(i + 1700) * w) % (w * 1.3)) - w * 0.15;
    const fishY = h * (0.2 + seededRandom(i + 1800) * 0.4) + Math.sin(t * 0.8 + i * 3) * 20;
    const fishSize = 4 + seededRandom(i + 1900) * 4;
    const dir = seededRandom(i + 1650) > 0.5 ? 1 : -1;
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "rgba(80, 140, 180, 0.6)";
    ctx.save();
    ctx.translate(fishX, fishY);
    ctx.scale(dir, 1);
    // Fish body
    ctx.beginPath();
    ctx.moveTo(fishSize, 0);
    ctx.quadraticCurveTo(fishSize * 0.3, -fishSize * 0.4, -fishSize * 0.5, 0);
    ctx.quadraticCurveTo(fishSize * 0.3, fishSize * 0.4, fishSize, 0);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-fishSize * 0.5, 0);
    ctx.lineTo(-fishSize, -fishSize * 0.35);
    ctx.lineTo(-fishSize, fishSize * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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
  // Score is now rendered in the HTML HUD at the bottom — skip canvas rendering
  return;
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
  // Wave display is now rendered in the HTML HUD — skip canvas rendering
  return;

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
  // Now rendered in HTML HUD
  return;
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
