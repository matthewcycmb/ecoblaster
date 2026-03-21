import { GameState, TrashItem, HitToast, ComboState, ActivePowerUp, PowerUp, PowerUpType } from "@/lib/types";
import {
  HIT_TOAST_DURATION_MS,
  PIP_WIDTH,
  PIP_HEIGHT,
  PIP_MARGIN,
  PIP_BORDER_RADIUS,
  POWERUP_LIFETIME_MS,
  PISTOL_Y_OFFSET,
  PISTOL_BARREL_LENGTH,
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

/* ─── Background Image ─── */

let bgImage: HTMLImageElement | null = null;
let bgImageLoading = false;

function loadBgImage(): void {
  if (bgImage || bgImageLoading || typeof window === "undefined") return;
  bgImageLoading = true;
  const img = new window.Image();
  img.src = "/game-bg.jpg";
  img.onload = () => { bgImage = img; };
}

/* ─── Coral Monster Sprite ─── */

let monsterImage: HTMLImageElement | null = null;
let monsterImageLoading = false;

function loadMonsterImage(): void {
  if (monsterImage || monsterImageLoading || typeof window === "undefined") return;
  monsterImageLoading = true;
  const img = new window.Image();
  img.src = "/coral-monster.png";
  img.onload = () => { monsterImage = img; };
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

  drawBackground(ctx, canvasWidth, canvasHeight, t);

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

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  loadBgImage();
  // Draw pixel art background image, covering the full canvas
  if (bgImage) {
    ctx.imageSmoothingEnabled = false;
    const isMobile = w < 768;
    if (isMobile) {
      // On narrow screens, crop to the center of the image to hide side coral/rocks
      // and show only the open water area, with just bottom reef visible
      const imgW = bgImage.naturalWidth;
      const imgH = bgImage.naturalHeight;
      // Crop the center 40% horizontally to remove side framing
      const cropMargin = imgW * 0.3;
      const srcX = cropMargin;
      const srcW = imgW - cropMargin * 2;
      ctx.drawImage(bgImage, srcX, 0, srcW, imgH, 0, 0, w, h);
    } else {
      ctx.drawImage(bgImage, 0, 0, w, h);
    }
  } else {
    // Fallback solid color while loading
    ctx.fillStyle = "#0a5a6e";
    ctx.fillRect(0, 0, w, h);
  }

  // Animated light rays from surface
  ctx.save();
  for (let layer = 0; layer < 5; layer++) {
    const centerBias = 0.3 + layer * 0.1;
    const rayX = w * centerBias + Math.sin(t * 0.1 + layer * 2) * 30;
    const rayW = 25 + layer * 10;
    ctx.globalAlpha = 0.06 + 0.02 * Math.sin(t * 0.3 + layer);
    const rayGrad = ctx.createLinearGradient(rayX, 0, rayX, h * 0.6);
    rayGrad.addColorStop(0, "rgba(180, 240, 255, 0.5)");
    rayGrad.addColorStop(0.4, "rgba(100, 210, 240, 0.2)");
    rayGrad.addColorStop(1, "rgba(60, 180, 220, 0)");
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rayX - rayW * 0.3, 0);
    ctx.lineTo(rayX + rayW * 0.3, 0);
    ctx.lineTo(rayX + rayW * 1.5, h * 0.6);
    ctx.lineTo(rayX - rayW * 1.5, h * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floating particles / plankton
  ctx.save();
  for (let i = 0; i < 15; i++) {
    const px = seededRandom(i * 3 + 1) * w;
    const py = seededRandom(i * 3 + 2) * h * 0.75;
    const drift = Math.sin(t * 0.3 + i * 1.3) * 8;
    const bob = Math.cos(t * 0.5 + i * 2.1) * 4;
    const twinkle = 0.2 + 0.5 * Math.abs(Math.sin(t * (0.8 + seededRandom(i) * 1.5) + i * 1.7));
    ctx.globalAlpha = twinkle * 0.25;
    ctx.fillStyle = "rgba(180, 240, 255, 0.7)";
    ctx.fillRect(Math.round(px + drift), Math.round(py + bob), 2, 2);
  }
  ctx.restore();

  // Animated bubbles rising
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const bx = seededRandom(i + 800) * w;
    const speed = 0.03 + seededRandom(i + 810) * 0.04;
    const by = h - ((t * speed * h + seededRandom(i + 820) * h) % (h * 1.1));
    const bSize = 2 + seededRandom(i + 830) * 3;
    const wobble = Math.sin(t * 1.5 + i * 3) * 6;
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(t + i);
    ctx.strokeStyle = "rgba(200, 245, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx + wobble, by, bSize, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Subtle caustic shimmer on seafloor area
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 6; i++) {
    const spotX = seededRandom(i + 2000) * w;
    const spotY = h * 0.7 + seededRandom(i + 2100) * h * 0.25;
    const spotR = 30 + seededRandom(i + 2200) * 50;
    const flicker = 0.5 + 0.5 * Math.sin(t * 0.6 + i * 2.1);
    ctx.globalAlpha = 0.03 * flicker;
    const causticSpot = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR);
    causticSpot.addColorStop(0, "rgba(100, 220, 240, 0.8)");
    causticSpot.addColorStop(1, "rgba(60, 180, 200, 0)");
    ctx.fillStyle = causticSpot;
    ctx.fillRect(spotX - spotR, spotY - spotR, spotR * 2, spotR * 2);
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
   CORAL MONSTER (replaces pistol)
   ═══════════════════════════════════════════════════════════════ */

interface PistolRenderResult { barrelTipX: number; barrelTipY: number; }

function drawPistol(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number, canvasHeight: number,
  state: GameState,
  aimX: number, aimY: number, hasAim: boolean
): PistolRenderResult {
  loadMonsterImage();

  const pivotX = canvasWidth / 2;
  const pivotY = canvasHeight * PISTOL_Y_OFFSET;

  // Angle toward aim, default straight up
  let angle = -Math.PI / 2;
  if (hasAim) {
    angle = Math.atan2(aimY - pivotY, aimX - pivotX);
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

  // Draw coral monster sprite — smaller on mobile
  const isMobile = canvasWidth < 768;
  const monsterH = isMobile ? 70 : 120;
  const monsterW = monsterH * (198 / 246); // preserve aspect ratio

  ctx.save();
  ctx.imageSmoothingEnabled = false; // pixel art crisp
  ctx.translate(pivotX, pivotY + recoilOff);
  ctx.rotate(finalAngle + Math.PI / 2);

  if (monsterImage) {
    // Draw centered horizontally, extending upward from pivot
    ctx.drawImage(monsterImage, -monsterW / 2, -monsterH, monsterW, monsterH);
  }

  ctx.restore();

  // Compute tip (top of monster) in world space for muzzle flash
  const rot = finalAngle + Math.PI / 2;
  const tipLocalY = -barrelL - 3;
  const worldTipX = pivotX - tipLocalY * Math.sin(rot);
  const worldTipY = (pivotY + recoilOff) + tipLocalY * Math.cos(rot);

  return { barrelTipX: worldTipX, barrelTipY: worldTipY };
}

