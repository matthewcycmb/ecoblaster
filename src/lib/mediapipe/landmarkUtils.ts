export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// MediaPipe hand landmark indices
export const WRIST = 0;
export const THUMB_CMC = 1;
export const THUMB_MCP = 2;
export const THUMB_IP = 3;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const INDEX_PIP = 6;
export const INDEX_DIP = 7;
export const INDEX_TIP = 8;
export const MIDDLE_MCP = 9;
export const MIDDLE_PIP = 10;
export const MIDDLE_DIP = 11;
export const MIDDLE_TIP = 12;
export const RING_MCP = 13;
export const RING_PIP = 14;
export const RING_DIP = 15;
export const RING_TIP = 16;
export const PINKY_MCP = 17;
export const PINKY_PIP = 18;
export const PINKY_DIP = 19;
export const PINKY_TIP = 20;

/** Compute angle (in radians) at joint B formed by segments A→B and B→C */
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const baz = a.z - b.z;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;
  const dot = bax * bcx + bay * bcy + baz * bcz;
  const magA = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const magC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);
  if (magA < 1e-8 || magC < 1e-8) return Math.PI;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return Math.acos(cosAngle);
}

/** Distance between two landmarks */
function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Extended = joint angles at PIP and DIP are relatively straight (> 140 degrees)
 * AND tip is farther from wrist than MCP is (finger is reaching outward).
 * Works regardless of hand rotation.
 */
export function isFingerExtended(
  tip: Landmark,
  dip: Landmark,
  pip: Landmark,
  mcp: Landmark,
  wrist?: Landmark
): boolean {
  const pipAngle = angleBetween(mcp, pip, dip);
  const dipAngle = angleBetween(pip, dip, tip);
  // Both joints should be relatively straight (> ~140 degrees = 2.44 rad)
  const straight = pipAngle > 2.3 && dipAngle > 2.3;
  // Tip should be farther from MCP than PIP is (finger is reaching out, not folded back)
  const tipOutward = dist(tip, mcp) > dist(pip, mcp) * 0.85;
  return straight && tipOutward;
}

/**
 * Curled = PIP joint angle is acute (< 120 degrees) and tip is close to palm.
 * Works regardless of hand rotation.
 */
export function isFingerCurled(
  tip: Landmark,
  dip: Landmark,
  pip: Landmark,
  mcp?: Landmark,
  wrist?: Landmark
): boolean {
  const pipAngle = angleBetween(mcp ?? dip, pip, dip);
  // If we have MCP, check the angle at PIP formed by MCP→PIP→DIP
  if (mcp) {
    const angle = angleBetween(mcp, pip, dip);
    // Also check tip is closer to MCP than a fully extended finger would be
    const tipToMcp = dist(tip, mcp);
    const pipToMcp = dist(pip, mcp);
    return angle < 2.4 && tipToMcp < pipToMcp * 1.3;
  }
  // Fallback: PIP angle alone
  return pipAngle < 2.2;
}

/**
 * Smooth landmarks with exponential moving average.
 * Returns new smoothed array.
 */
export function smoothLandmarks(
  prev: Landmark[] | null,
  current: Landmark[],
  alpha: number
): Landmark[] {
  if (!prev || prev.length !== current.length) {
    return current.map((l) => ({ ...l }));
  }
  return current.map((c, i) => ({
    x: prev[i].x + alpha * (c.x - prev[i].x),
    y: prev[i].y + alpha * (c.y - prev[i].y),
    z: prev[i].z + alpha * (c.z - prev[i].z),
  }));
}

export function computeVelocityY(history: number[]): number {
  if (history.length < 2) return 0;
  const n = Math.min(history.length, 5);
  const recent = history.slice(-n);
  let totalDelta = 0;
  for (let i = 1; i < recent.length; i++) {
    totalDelta += recent[i] - recent[i - 1];
  }
  return totalDelta / (recent.length - 1);
}
