import { TrashItem, TrashType } from "@/lib/types";

interface TrashAABB {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

// Global hit margin multiplier — set via setHitMarginMultiplier (e.g. 1.5 for easy mode)
let hitMarginMult = 1.0;

export function setHitMarginMultiplier(mult: number): void {
  hitMarginMult = mult;
}

/**
 * Compute a generous AABB for a trash item that covers the full rendered body.
 * Includes a base 10% forgiving margin, further scaled by hitMarginMult for easy mode.
 */
function getTrashAABB(z: TrashItem): TrashAABB {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;

  let halfW: number;
  let topOffset: number;   // distance above z.y
  const bottomOffset = bh * 0.45;  // legs + shadow

  const type: TrashType = z.trashType;

  if (type === "barge") {
    halfW = bw * 0.65;
    topOffset = bh * 0.32 + bw * 0.25 * 1.6;
  } else if (type === "barrel") {
    halfW = bw * 0.55;
    topOffset = bh * 0.32 + bw * 0.22 * 1.2;
  } else {
    halfW = bw * 0.55;
    topOffset = bh * 0.32 + bw * 0.22 * 1.2;
  }

  // Base 10% forgiving margin, scaled by hitMarginMult (1.0 normal, 1.5 easy)
  const margin = 1.10 * hitMarginMult;
  halfW *= margin;
  const top = z.y - topOffset * margin;
  const bottom = z.y + bottomOffset * margin;

  return {
    left: z.x - halfW,
    right: z.x + halfW,
    top,
    bottom,
    centerX: z.x,
    centerY: (top + bottom) / 2,
  };
}

/**
 * Find the closest trash item to a screen-space point (aimX, aimY).
 * Uses type-specific AABB matching the rendered body.
 * Prefers the item closest to the aim point if multiple overlap.
 */
export function findClosestTrashAtPoint(
  trashItems: TrashItem[],
  aimX: number,
  aimY: number
): TrashItem | null {
  let closest: TrashItem | null = null;
  let closestDist = Infinity;

  for (const z of trashItems) {
    if (!z.alive) continue;
    const bb = getTrashAABB(z);

    // AABB containment — point inside bounding box
    if (aimX >= bb.left && aimX <= bb.right &&
        aimY >= bb.top && aimY <= bb.bottom) {
      const dx = bb.centerX - aimX;
      const dy = bb.centerY - aimY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closest = z;
        closestDist = dist;
      }
      continue;
    }

    // Proximity fallback — allow slight near-misses
    const dx = bb.centerX - aimX;
    const dy = bb.centerY - aimY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const boxHalfDiag = Math.sqrt(
      ((bb.right - bb.left) / 2) ** 2 + ((bb.bottom - bb.top) / 2) ** 2
    );
    // Accept within 30% beyond the bounding box diagonal
    if (dist < boxHalfDiag * 1.30 && dist < closestDist) {
      closest = z;
      closestDist = dist;
    }
  }

  return closest;
}

/**
 * Raycast from a point in a direction and find the first trash item hit.
 * Uses type-specific AABB matching the rendered body.
 */
export function raycastFromPoint(
  trashItems: TrashItem[],
  originX: number,
  originY: number,
  dirX: number,
  dirY: number
): TrashItem | null {
  let closest: TrashItem | null = null;
  let closestT = Infinity;

  for (const z of trashItems) {
    if (!z.alive) continue;
    const bb = getTrashAABB(z);

    let tMin = 0;
    let tMax = 10000;

    if (Math.abs(dirX) > 1e-8) {
      let t1 = (bb.left - originX) / dirX;
      let t2 = (bb.right - originX) / dirX;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
    } else if (originX < bb.left || originX > bb.right) {
      continue;
    }

    if (Math.abs(dirY) > 1e-8) {
      let t1 = (bb.top - originY) / dirY;
      let t2 = (bb.bottom - originY) / dirY;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
    } else if (originY < bb.top || originY > bb.bottom) {
      continue;
    }

    if (tMin <= tMax && tMax > 0 && tMin < closestT) {
      closest = z;
      closestT = tMin;
    }
  }

  return closest;
}

/**
 * Find ALL trash items within a screen-space radius of a point.
 * Used for shotgun blast power-up.
 */
export function findTrashInRadius(
  trashItems: TrashItem[],
  centerX: number,
  centerY: number,
  radius: number
): TrashItem[] {
  const result: TrashItem[] = [];
  for (const z of trashItems) {
    if (!z.alive) continue;
    const bb = getTrashAABB(z);
    const dx = bb.centerX - centerX;
    const dy = bb.centerY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const boxHalfDiag = Math.sqrt(
      ((bb.right - bb.left) / 2) ** 2 + ((bb.bottom - bb.top) / 2) ** 2
    );
    if (dist < boxHalfDiag + radius) {
      result.push(z);
    }
  }
  return result;
}
