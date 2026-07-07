export interface Vec2 {
  x: number;
  y: number;
}

/** Clamps a 2D vector to within maxRadius, preserving direction. */
export function clampToRadius(x: number, y: number, maxRadius: number): Vec2 {
  const dist = Math.hypot(x, y);
  if (dist <= maxRadius || dist === 0) return { x, y };
  const scale = maxRadius / dist;
  return { x: x * scale, y: y * scale };
}

/**
 * Normalizes a stick offset (same units as maxRadius, screen pixels) to a
 * -1..1 vector with a dead zone: offsets inside the dead zone are zero;
 * offsets beyond it are rescaled so the stick still reaches exactly 1 at
 * maxRadius (no dead-zone-shaped jump at the boundary).
 */
export function normalizeStick(x: number, y: number, maxRadius: number, deadzone: number): Vec2 {
  if (maxRadius <= deadzone) return { x: 0, y: 0 };
  const dist = Math.hypot(x, y);
  if (dist <= deadzone) return { x: 0, y: 0 };
  const clamped = clampToRadius(x, y, maxRadius);
  const clampedDist = Math.hypot(clamped.x, clamped.y);
  const scale = (clampedDist - deadzone) / (maxRadius - deadzone) / clampedDist;
  return { x: clamped.x * scale, y: clamped.y * scale };
}

export interface StickMoveFlags {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Independent-axis thresholding of a normalized stick vector into the same
 * directional flags WASD produces — diagonals fall out naturally since two
 * flags can be true at once, just like pressing two keys.
 *
 * Screen-space convention: y is pixel-down-positive, so dragging the thumb
 * up (finger moves toward the top of the screen, y negative) means forward.
 */
export function stickToMoveFlags(x: number, y: number, threshold = 0.35): StickMoveFlags {
  return {
    forward: y < -threshold,
    backward: y > threshold,
    left: x < -threshold,
    right: x > threshold,
  };
}
