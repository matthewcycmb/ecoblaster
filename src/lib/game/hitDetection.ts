import { Zombie, ZombieType } from "@/lib/types";

interface ZombieAABB {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

/**
 * Compute a generous AABB for a zombie that covers the full rendered body
 * including arms, claws, and head decorations.
 *
 * Renderer reference (drawZombieBody):
 *   - Head center: y = -bh*0.32, radius = bw*0.22 (boss: bw*0.25)
 *   - Boss horns extend to headR*1.5 above head center
 *   - Legs bottom: y = +bh*0.43
 *   - Arm reach: 0.48*bw (normal), 0.55*bw (boss) + claws ~8*s beyond
 *   - Body bob: up to bh*0.012 (covered by margin)
 *
 * All values include a 10% forgiving margin so near-misses still register.
 */
function getZombieAABB(z: Zombie): ZombieAABB {
  const s = z.screenScale;
  const bw = z.width * s;
  const bh = z.height * s;

  let halfW: number;
  let topOffset: number;   // distance above z.y
  const bottomOffset = bh * 0.45;  // legs + shadow

  const type: ZombieType = z.zombieType;

  if (type === "boss") {
    // Boss: wide arms + claws, horns above head
    const headR = bw * 0.25;
    halfW = bw * 0.65;
    topOffset = bh * 0.32 + headR * 1.6;
  } else if (type === "tank") {
    // Tank: bulkier shoulders + arms
    const headR = bw * 0.22;
    halfW = bw * 0.55;
    topOffset = bh * 0.32 + headR * 1.2;
  } else {
    // basic, fast, exploder — arms reach bw*0.48 + claws
    const headR = bw * 0.22;
    halfW = bw * 0.55;
    topOffset = bh * 0.32 + headR * 1.2;
  }

  // 10% forgiving margin
  halfW *= 1.10;
  const top = z.y - topOffset * 1.10;
  const bottom = z.y + bottomOffset * 1.10;

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
 * Find the closest zombie to a screen-space point (aimX, aimY).
 * Uses type-specific AABB matching the rendered zombie body.
 * Prefers the zombie closest to the aim point if multiple overlap.
 */
export function findClosestZombieAtPoint(
  zombies: Zombie[],
  aimX: number,
  aimY: number
): Zombie | null {
  let closest: Zombie | null = null;
  let closestDist = Infinity;

  for (const z of zombies) {
    if (!z.alive) continue;
    const bb = getZombieAABB(z);

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
 * Raycast from a point in a direction and find the first zombie hit.
 * Uses type-specific AABB matching the rendered zombie body.
 */
export function raycastFromPoint(
  zombies: Zombie[],
  originX: number,
  originY: number,
  dirX: number,
  dirY: number
): Zombie | null {
  let closest: Zombie | null = null;
  let closestT = Infinity;

  for (const z of zombies) {
    if (!z.alive) continue;
    const bb = getZombieAABB(z);

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
 * Find ALL zombies within a screen-space radius of a point.
 * Used for shotgun blast power-up.
 */
export function findZombiesInRadius(
  zombies: Zombie[],
  centerX: number,
  centerY: number,
  radius: number
): Zombie[] {
  const result: Zombie[] = [];
  for (const z of zombies) {
    if (!z.alive) continue;
    const bb = getZombieAABB(z);
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
