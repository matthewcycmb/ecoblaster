import { GameState, TrashItem, SeaTurtle, SwimmingFish, HitToast, ComboState, ActivePowerUp, PowerUp, PowerUpType, HandGunState, ReefDefender } from "@/lib/types";
import {
  TURTLE_BASE_WIDTH,
  TURTLE_BASE_HEIGHT,
  TURTLE_HURT_DURATION_MS,
  HIT_TOAST_DURATION_MS,
  PIP_WIDTH,
  PIP_HEIGHT,
  PIP_WIDTH_MOBILE,
  PIP_HEIGHT_MOBILE,
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
  FISH_BASE_WIDTH,
  FISH_BASE_HEIGHT,
  FISH_HURT_DURATION_MS,
  FISH_PENALTY_FLASH_MS,
  TIME_FREEZE_DURATION_MS,
  SNAP_CLEAR_FLASH_MS,
  TSUNAMI_EFFECT_MS,
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

/* ─── Turtle Sprite ─── */

let turtleSprite: HTMLImageElement | null = null;
let turtleSpriteLoading = false;

function loadTurtleSprite(): void {
  if (turtleSprite || turtleSpriteLoading || typeof window === "undefined") return;
  turtleSpriteLoading = true;
  const img = new window.Image();
  img.src = "/trash/turtle.png";
  img.onload = () => { turtleSprite = img; };
}

/* ─── Trash Sprites ─── */
const trashSprites: Record<string, HTMLImageElement | null> = {};
let trashSpritesLoading = false;

function loadTrashSprites(): void {
  if (trashSpritesLoading || typeof window === "undefined") return;
  trashSpritesLoading = true;
  const types = ["bottle", "bag", "barrel", "net", "barge"];
  for (const type of types) {
    const img = new window.Image();
    img.src = `/trash/${type}.png`;
    img.onload = () => { trashSprites[type] = img; };
  }
}

/* ─── Main Render Entry ─── */

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  videoElement?: HTMLVideoElement | null,
  aimX?: number,
  aimY?: number,
  secondAimX?: number,
  secondAimY?: number,
  handGunStates?: HandGunState[]
): void {
  const hasAim = aimX !== undefined && aimY !== undefined;
  const hasSecondAim = secondAimX !== undefined && secondAimY !== undefined;
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

  drawBackground(ctx, canvasWidth, canvasHeight, t, state.wave);
  loadTrashSprites();

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

  // Ocean current effect
  if (now < state.currentEffectUntil) {
    drawCurrentEffect(ctx, canvasWidth, canvasHeight, state.currentEffectUntil - now);
  }

  // Reef defenders (mid-field, after trash)
  for (const defender of state.reefDefenders) {
    drawReefDefender(ctx, defender, now);
  }

  // Sea turtles
  loadTurtleSprite();
  for (const turtle of state.seaTurtles) {
    if (turtle.alive || turtle.hurtAt > 0) {
      drawSeaTurtle(ctx, turtle, t);
    }
  }

  // Swimming fish (friendly — don't shoot!)
  for (const fish of state.swimmingFish) {
    if (fish.alive || fish.hitAt > 0) {
      drawSwimmingFish(ctx, fish, t);
    }
  }

  // Dual pistols when both hands active, single centered pistol otherwise
  if (hasAim && hasSecondAim) {
    // Two pistols — left and right
    const gs0 = handGunStates?.[0];
    const gs1 = handGunStates?.[1];
    const pistol0 = drawPistol(ctx, canvasWidth, canvasHeight, state, cx, cy, true, canvasWidth * 0.25, gs0);
    const pistol1 = drawPistol(ctx, canvasWidth, canvasHeight, state, secondAimX, secondAimY, true, canvasWidth * 0.75, gs1, true);
    drawCrosshair(ctx, cx, cy, t);
    drawCrosshair(ctx, secondAimX, secondAimY, t, "rgba(80, 200, 255, 0.9)");
    // Muzzle flashes per hand
    if (gs0 && now < gs0.muzzleFlashUntil) {
      drawMuzzleFlash(ctx, pistol0.barrelTipX, pistol0.barrelTipY, (gs0.muzzleFlashUntil - now) / 100);
    }
    if (gs1 && now < gs1.muzzleFlashUntil) {
      drawMuzzleFlash(ctx, pistol1.barrelTipX, pistol1.barrelTipY, (gs1.muzzleFlashUntil - now) / 100);
    }
  } else {
    // Single pistol centered
    const pistolResult = drawPistol(ctx, canvasWidth, canvasHeight, state, cx, cy, hasAim);
    if (hasAim || state.phase !== "playing") {
      drawCrosshair(ctx, cx, cy, t);
    }
    if (now < state.muzzleFlashUntil) {
      const flashProgress = (state.muzzleFlashUntil - now) / 100;
      drawMuzzleFlash(ctx, pistolResult.barrelTipX, pistolResult.barrelTipY, flashProgress);
    }
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

  // Red flash on fish penalty
  if (now < state.fishPenaltyFlashUntil) {
    const flashAlpha = 0.25 * ((state.fishPenaltyFlashUntil - now) / FISH_PENALTY_FLASH_MS);
    ctx.fillStyle = `rgba(255, 40, 40, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Gold flash on combo milestone
  if (now < state.comboFlashUntil) {
    const flashAlpha = 0.2 * ((state.comboFlashUntil - now) / 300);
    ctx.fillStyle = `rgba(255, 209, 102, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Snap-to-clear shockwave
  if (now < state.snapClearFlashUntil) {
    const elapsed = SNAP_CLEAR_FLASH_MS - (state.snapClearFlashUntil - now);
    const progress = elapsed / SNAP_CLEAR_FLASH_MS;

    // Expanding ring from hand position
    const maxRadius = Math.max(canvasWidth, canvasHeight);
    const radius = maxRadius * progress;
    const ringWidth = 6 * (1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(0, 255, 200, ${0.7 * (1 - progress)})`;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(state.snapClearOriginX, state.snapClearOriginY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Brief screen flash (first 100ms)
    if (elapsed < 100) {
      const flashAlpha = 0.3 * (1 - elapsed / 100);
      ctx.fillStyle = `rgba(200, 255, 240, ${flashAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }

  // Tsunami wave effect
  if (now < state.tsunamiEffectUntil) {
    const elapsed = TSUNAMI_EFFECT_MS - (state.tsunamiEffectUntil - now);
    const progress = elapsed / TSUNAMI_EFFECT_MS;

    ctx.save();

    // Wave sweeps from right to left across the screen
    const waveX = canvasWidth * (1.3 - progress * 1.6); // starts off-screen right, exits left
    const waveWidth = canvasWidth * 0.35;

    // Draw multiple wave layers for depth
    for (let layer = 0; layer < 3; layer++) {
      const offset = layer * 25;
      const layerAlpha = (0.5 - layer * 0.15) * Math.min(1, (1 - progress) * 3);
      const r = layer === 0 ? 20 : layer === 1 ? 60 : 100;
      const g = layer === 0 ? 140 : layer === 1 ? 180 : 220;
      const b = 255;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layerAlpha})`;
      ctx.beginPath();
      ctx.moveTo(waveX + offset, 0);
      // Wavy leading edge
      for (let y = 0; y <= canvasHeight; y += 8) {
        const wobble = Math.sin(y * 0.025 + elapsed * 0.008 + layer * 2) * 40;
        ctx.lineTo(waveX + offset + wobble, y);
      }
      // Flat trailing edge
      ctx.lineTo(waveX + offset - waveWidth, canvasHeight);
      ctx.lineTo(waveX + offset - waveWidth, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Foam/spray particles along the wave front
    const foamCount = 20;
    for (let i = 0; i < foamCount; i++) {
      const seed = i * 7919 + 13;
      const fy = ((seed * 31) % canvasHeight);
      const wobble = Math.sin(fy * 0.025 + elapsed * 0.008) * 40;
      const fx = waveX + wobble + ((seed * 17) % 60) - 30;
      const fSize = 2 + ((seed * 23) % 4);
      const fAlpha = 0.6 * Math.min(1, (1 - progress) * 3);
      ctx.fillStyle = `rgba(200, 240, 255, ${fAlpha})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // White flash for the first 150ms
    if (elapsed < 150) {
      const flashAlpha = 0.4 * (1 - elapsed / 150);
      ctx.fillStyle = `rgba(180, 220, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Blue tint overlay that fades
    if (progress < 0.7) {
      const tintAlpha = 0.15 * (1 - progress / 0.7);
      ctx.fillStyle = `rgba(0, 80, 200, ${tintAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }

  // Time freeze overlay — blue tint while active, white flash on activation
  if (state.timeFreezeActive) {
    const activationTime = state.timeFreezeUntil - TIME_FREEZE_DURATION_MS;
    const msSinceActivation = now - activationTime;
    // White flash for the first 150ms
    if (msSinceActivation < 150) {
      const flashAlpha = 0.35 * (1 - msSinceActivation / 150);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    // Persistent blue tint
    ctx.fillStyle = "rgba(100, 180, 255, 0.12)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Desaturation overlay — ocean dying as health drops below 50
  if (state.health < 50) {
    // 0 at 50 health → ~0.85 at 0 health
    const desat = Math.min(0.85, (50 - state.health) / 50 * 0.85);
    ctx.fillStyle = `rgba(128, 128, 128, ${desat})`;
    ctx.globalCompositeOperation = "saturation";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.globalCompositeOperation = "source-over";
  }
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════════════════════════ */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, wave: number = 1): void {
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

  // Wave-progressive murky tint — water gets polluted as waves increase
  if (wave > 3) {
    // Gradually shift from 0 at wave 3 to max ~0.18 by wave 20+
    const murk = Math.min(0.18, (wave - 3) / 17 * 0.18);
    ctx.save();
    ctx.globalAlpha = murk;
    ctx.fillStyle = "rgba(60, 55, 30, 1)"; // brownish-green murk
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}


/* ═══════════════════════════════════════════════════════════════
   ZOMBIE — Type-based dispatcher
   ═══════════════════════════════════════════════════════════════ */

function drawTrashItem(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  drawTrashSprite(ctx, z, t);
  if ((z.trashType === "barrel" || z.trashType === "barge") && z.hp < z.maxHp) {
    drawTrashHPBar(ctx, z);
  }
}

/* ─── Trash Sprite Drawing ─── */
function drawTrashSprite(ctx: CanvasRenderingContext2D, z: TrashItem, t: number): void {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;
  const seed = getTrashSeed(z.id);
  const bob = Math.sin(t * 1.5 + seed * 3) * bh * 0.02;
  const sway = Math.sin(t * 0.8 + seed * 2) * 0.06;

  const sprite = trashSprites[z.trashType];
  ctx.save();
  ctx.translate(z.x, z.y + bob);
  ctx.rotate(sway);
  ctx.imageSmoothingEnabled = false; // pixel art crisp

  if (sprite) {
    ctx.drawImage(sprite, -bw / 2, -bh, bw, bh);
  } else {
    // Fallback colored rectangle while loading
    ctx.fillStyle = z.trashType === "barge" ? "#8B4513" : "#4488aa";
    ctx.fillRect(-bw / 2, -bh, bw, bh);
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
   SEA TURTLE
   ═══════════════════════════════════════════════════════════════ */

function drawSeaTurtle(ctx: CanvasRenderingContext2D, turtle: SeaTurtle, t: number): void {
  const s = turtle.screenScale;
  const w = TURTLE_BASE_WIDTH * s;
  const h = TURTLE_BASE_HEIGHT * s;

  const bob = Math.sin(t * 2.0 + turtle.x * 0.01) * h * 0.06;

  const isHurt = turtle.hurtAt > 0;
  const hurtAge = isHurt ? Date.now() - turtle.hurtAt : 0;
  const hurtAlpha = isHurt ? Math.max(0, 1 - hurtAge / TURTLE_HURT_DURATION_MS) : 1;
  const hurtSink = isHurt ? hurtAge * 0.03 : 0;

  ctx.save();
  ctx.globalAlpha = hurtAlpha;
  ctx.translate(turtle.x, turtle.y + bob + hurtSink);

  if (turtle.direction === -1) {
    ctx.scale(-1, 1);
  }

  ctx.imageSmoothingEnabled = false;

  if (turtleSprite) {
    ctx.drawImage(turtleSprite, -w / 2, -h / 2, w, h);
  } else {
    // Fallback: green oval with shell pattern
    ctx.fillStyle = "#2d8a4e";
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a6b3a";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = "#3aad64";
    ctx.beginPath();
    ctx.arc(w * 0.35, 0, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red tint flash when hurt
  if (isHurt && hurtAge < 300) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(255, 60, 60, 0.5)`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   SWIMMING FISH (friendly) — pixel art sprite sheet
   ═══════════════════════════════════════════════════════════════ */

let fishSpriteSheet: HTMLImageElement | null = null;
let fishSpriteLoading = false;

function loadFishSprites(): void {
  if (fishSpriteSheet || fishSpriteLoading || typeof window === "undefined") return;
  fishSpriteLoading = true;
  const img = new window.Image();
  img.src = "/fish-sprites.png";
  img.onload = () => { fishSpriteSheet = img; };
}

// Sprite sheet is 3 columns x 2 rows, with padding/background to crop out
// Each cell is roughly 1/3 width x 1/2 height of the image
const FISH_SPRITE_COLS = 3;
const FISH_SPRITE_ROWS = 2;
// Inset margins to crop the beige background padding (fraction of cell size)
const FISH_CELL_INSET_X = 0.08;
const FISH_CELL_INSET_Y = 0.06;

function drawSwimmingFish(ctx: CanvasRenderingContext2D, fish: SwimmingFish, t: number): void {
  loadFishSprites();

  const s = fish.screenScale;
  const w = FISH_BASE_WIDTH * s;
  const h = FISH_BASE_HEIGHT * s;

  const isHit = fish.hitAt > 0;
  const hitAge = isHit ? Date.now() - fish.hitAt : 0;
  const hitAlpha = isHit ? Math.max(0, 1 - hitAge / FISH_HURT_DURATION_MS) : 1;
  const hitSink = isHit ? hitAge * 0.04 : 0;

  const bob = Math.sin(t * 2.5 + fish.x * 0.01) * h * 0.08;
  const wiggle = Math.sin(t * 6 + fish.x * 0.02) * 0.06;

  ctx.save();
  ctx.globalAlpha = hitAlpha;
  ctx.translate(fish.x, fish.y + bob + hitSink);

  // Face direction of movement
  if (fish.direction === -1) {
    ctx.scale(-1, 1);
  }
  ctx.rotate(wiggle);
  ctx.imageSmoothingEnabled = false; // pixel art crisp

  if (fishSpriteSheet) {
    const col = fish.spriteIndex % FISH_SPRITE_COLS;
    const row = Math.floor(fish.spriteIndex / FISH_SPRITE_COLS);
    const cellW = fishSpriteSheet.naturalWidth / FISH_SPRITE_COLS;
    const cellH = fishSpriteSheet.naturalHeight / FISH_SPRITE_ROWS;
    // Crop insets to remove background padding
    const sx = col * cellW + cellW * FISH_CELL_INSET_X;
    const sy = row * cellH + cellH * FISH_CELL_INSET_Y;
    const sw = cellW * (1 - 2 * FISH_CELL_INSET_X);
    const sh = cellH * (1 - 2 * FISH_CELL_INSET_Y);

    ctx.drawImage(fishSpriteSheet, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  } else {
    // Fallback: simple orange circle while loading
    ctx.fillStyle = "#FFB020";
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red tint flash when hit
  if (isHit && hitAge < 200) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(255, 30, 30, 0.6)";
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   BOSS HP BAR
   ═══════════════════════════════════════════════════════════════ */

function drawBossHPBar(ctx: CanvasRenderingContext2D, boss: TrashItem, canvasWidth: number): void {
  const barWidth = canvasWidth * 0.65;
  const barHeight = 20;
  const barX = (canvasWidth - barWidth) / 2;
  const barY = 44;
  const fillRatio = boss.hp / boss.maxHp;
  const t = Date.now() / 1000;

  ctx.save();

  // Pulsing glow behind bar
  const glowAlpha = 0.15 + 0.1 * Math.sin(t * 3);
  ctx.shadowColor = "#FF3333";
  ctx.shadowBlur = 20;
  ctx.fillStyle = `rgba(0,0,0,${0.8 + glowAlpha * 0.2})`;
  ctx.beginPath(); ctx.roundRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 6); ctx.fill();
  ctx.shadowBlur = 0;

  // HP fill with animated gradient
  const hpGrad = ctx.createLinearGradient(barX, barY, barX + barWidth * fillRatio, barY);
  hpGrad.addColorStop(0, "#FF2222");
  hpGrad.addColorStop(0.5, "#FF6600");
  hpGrad.addColorStop(1, "#FFAA00");
  ctx.fillStyle = hpGrad;
  ctx.beginPath(); ctx.roundRect(barX, barY, barWidth * fillRatio, barHeight, 4); ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(barX, barY, barWidth, barHeight, 4); ctx.stroke();

  // Label
  ctx.font = "bold 14px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
  const label = `TRASH BARGE  ${boss.hp}/${boss.maxHp}`;
  ctx.strokeText(label, canvasWidth / 2, barY + barHeight + 18);
  ctx.fillText(label, canvasWidth / 2, barY + barHeight + 18);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   OCEAN CURRENT EFFECT
   ═══════════════════════════════════════════════════════════════ */

function drawCurrentEffect(ctx: CanvasRenderingContext2D, w: number, h: number, remaining: number): void {
  const alpha = Math.min(1, remaining / 600) * 0.4;
  ctx.save();
  ctx.globalAlpha = alpha;
  const waveCount = 6;
  for (let i = 0; i < waveCount; i++) {
    const progress = 1 - remaining / 600;
    const xOffset = (progress * w * 1.5 + i * w / waveCount) % (w * 1.2) - w * 0.1;
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.6 - i * 0.08})`;
    ctx.lineWidth = 3 - i * 0.3;
    ctx.beginPath();
    for (let y = 0; y < h; y += 20) {
      const wx = xOffset + Math.sin(y * 0.02 + i) * 30;
      if (y === 0) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   REEF DEFENDER
   ═══════════════════════════════════════════════════════════════ */

function drawReefDefender(ctx: CanvasRenderingContext2D, defender: ReefDefender, now: number): void {
  const s = defender.screenScale;
  const w = 40 * s;
  const h = 30 * s;
  const isAttacking = now - defender.lastAttackTime < 200;

  ctx.save();
  ctx.translate(defender.x, defender.y);

  // Glow when attacking
  if (isAttacking) {
    ctx.shadowColor = "#33CCFF";
    ctx.shadowBlur = 15;
  }

  // Fish body
  ctx.fillStyle = "#33AAFF";
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = "#2288DD";
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2 - w * 0.3, -h * 0.4);
  ctx.lineTo(-w / 2 - w * 0.3, h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(w * 0.2, -h * 0.1, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(w * 0.22, -h * 0.1, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // HP pips above
  const pipSize = 5 * s;
  const pipGap = 3 * s;
  const totalW = defender.maxHp * (pipSize + pipGap) - pipGap;
  const startX = -totalW / 2;
  for (let i = 0; i < defender.maxHp; i++) {
    ctx.fillStyle = i < defender.hp ? "#33FF66" : "rgba(255,255,255,0.2)";
    ctx.fillRect(startX + i * (pipSize + pipGap), -h / 2 - 10 * s, pipSize, pipSize);
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   COMBO DISPLAY
   ═══════════════════════════════════════════════════════════════ */

function drawComboDisplay(ctx: CanvasRenderingContext2D, combo: ComboState, canvasWidth: number, canvasHeight: number): void {
  const now = Date.now();
  // Position top-right, below the wave/pause bar to avoid webcam PIP overlap
  const isMobile = canvasWidth < 500;
  const x = isMobile ? canvasWidth - 50 : canvasWidth - 80;
  const y = isMobile ? 70 : 90;

  // Punch animation: scale up 1.3x on kill, spring back over 150ms
  const killAge = now - combo.lastKillTime;
  let punchScale = 1;
  if (killAge < 150) {
    const t = killAge / 150;
    // ease-out bounce: start at 1.3, spring back to 1.0
    punchScale = 1.3 - 0.3 * (t * t * (3 - 2 * t));
  }

  // Tier colors
  const tierColor = combo.multiplier >= 5 ? "#FF9900" : combo.multiplier >= 3 ? "#FFD166" : "#FFFFFF";

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(punchScale, punchScale);

  // Fire effects at 10+ streak
  if (combo.count >= 10) {
    const particleCount = Math.min(12, 5 + combo.count / 3);
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 137.5 + now * 0.003;
      const wobbleX = Math.sin(seed) * 25;
      const floatY = -((now * 0.08 + i * 30) % 60) - 20;
      const life = 1 - (((now * 0.08 + i * 30) % 60) / 60);
      const radius = (3 + i % 4) * life;
      const grad = ctx.createRadialGradient(wobbleX, floatY, 0, wobbleX, floatY, radius);
      grad.addColorStop(0, `rgba(255, 200, 50, ${0.8 * life})`);
      grad.addColorStop(0.5, `rgba(255, 100, 20, ${0.5 * life})`);
      grad.addColorStop(1, `rgba(200, 30, 0, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wobbleX, floatY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Kill counter (capped at 64px)
  const fontSize = Math.min(64, 48 + combo.count * 0.5);
  ctx.font = `bold ${Math.round(fontSize)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.strokeText(`${combo.count}`, 0, 0);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${combo.count}`, 0, 0);

  // Multiplier label
  ctx.font = "bold 16px Inter, system-ui, sans-serif";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 3;
  const multText = `x${combo.multiplier} COMBO`;
  ctx.strokeText(multText, 0, fontSize * 0.45);
  ctx.fillStyle = tierColor;
  ctx.fillText(multText, 0, fontSize * 0.45);

  // Tier progress bar
  const COMBO_TIERS_ORDERED = [
    { threshold: 5, multiplier: 2 },
    { threshold: 10, multiplier: 3 },
    { threshold: 20, multiplier: 5 },
  ];
  let nextThreshold = 0;
  let prevThreshold = 0;
  for (const tier of COMBO_TIERS_ORDERED) {
    if (combo.count < tier.threshold) {
      nextThreshold = tier.threshold;
      break;
    }
    prevThreshold = tier.threshold;
  }

  if (nextThreshold > 0) {
    const barW = 90;
    const barH = 5;
    const barY = fontSize * 0.45 + 14;
    const progress = (combo.count - prevThreshold) / (nextThreshold - prevThreshold);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = tierColor;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW * Math.min(1, progress), barH, 3);
    ctx.fill();
  }

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

function drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, centerColor?: string): void {
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
  ctx.fillStyle = centerColor ?? "rgba(255, 80, 80, 0.9)";
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
  const isMobile = canvasWidth < 500;
  const pipW = isMobile ? PIP_WIDTH_MOBILE : PIP_WIDTH;
  const pipH = isMobile ? PIP_HEIGHT_MOBILE : PIP_HEIGHT;
  const pipX = (canvasWidth - pipW) / 2;
  const pipY = PIP_MARGIN + 8;

  ctx.save();
  ctx.shadowColor = "rgba(11, 99, 255, 0.25)"; ctx.shadowBlur = 15;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath(); ctx.roundRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4, PIP_BORDER_RADIUS + 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.roundRect(pipX, pipY, pipW, pipH, PIP_BORDER_RADIUS); ctx.clip();
  ctx.translate(pipX + pipW, pipY); ctx.scale(-1, 1);
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const scale = Math.max(pipW / vw, pipH / vh);
  ctx.drawImage(video, (pipW - vw * scale) / 2, (pipH - vh * scale) / 2, vw * scale, vh * scale);
  ctx.restore();

  ctx.save(); ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(pipX, pipY, pipW, pipH, PIP_BORDER_RADIUS); ctx.stroke(); ctx.restore();

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
  aimX: number, aimY: number, hasAim: boolean,
  pivotXOverride?: number,
  handGunState?: HandGunState,
  flipX?: boolean
): PistolRenderResult {
  loadMonsterImage();

  const pivotX = pivotXOverride ?? canvasWidth / 2;
  const pivotY = canvasHeight * PISTOL_Y_OFFSET;

  // Angle toward aim, default straight up
  let angle = -Math.PI / 2;
  if (hasAim) {
    angle = Math.atan2(aimY - pivotY, aimX - pivotX);
    angle = Math.max(-Math.PI + 0.1, Math.min(-0.1, angle));
  }

  // Recoil animation — use per-hand state if provided
  const now = Date.now();
  let recoilProgress = 0;
  const recoilUntil = handGunState?.recoilUntil ?? state.recoilUntil;
  if (now < recoilUntil) {
    const elapsed = PISTOL_RECOIL_DURATION_MS - (recoilUntil - now);
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
  if (flipX) ctx.scale(-1, 1);

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

