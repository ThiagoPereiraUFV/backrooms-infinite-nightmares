/** Static axis-aligned obstacle footprint in world space (XZ plane). */
export interface ObstacleAabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Minimal world surface the collider needs — satisfied by ChunkManager.
 * Returns every obstacle that could intersect the query rect (broad-phase);
 * the resolver does the exact tests.
 */
export interface ObstacleWorld {
  obstaclesIn(minX: number, maxX: number, minZ: number, maxZ: number): ObstacleAabb[];
}

const EPSILON = 1e-3;

/**
 * Axis-separated AABB collision against arbitrary static obstacles. Resolving
 * x and z independently gives natural wall sliding. On a blocked axis the
 * position is clamped flush to the obstacle's face rather than cancelled, so
 * movement into an obstacle at an angle stays smooth. Obstacles are boxes of
 * any size (full wall cells, sub-cell pillars, furniture), so collision always
 * matches the rendered shape.
 */
export function resolveMovement(
  world: ObstacleWorld,
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
): { x: number; z: number } {
  const obstacles = world.obstaclesIn(
    Math.min(x, x + dx) - radius,
    Math.max(x, x + dx) + radius,
    Math.min(z, z + dz) - radius,
    Math.max(z, z + dz) + radius,
  );

  let nextX = x + dx;
  if (dx !== 0) {
    for (const obs of obstacles) {
      if (z - radius >= obs.maxZ || z + radius <= obs.minZ) continue;
      if (dx > 0 && obs.maxX > x && obs.minX < nextX + radius) {
        nextX = Math.min(nextX, obs.minX - radius - EPSILON);
      } else if (dx < 0 && obs.minX < x && obs.maxX > nextX - radius) {
        nextX = Math.max(nextX, obs.maxX + radius + EPSILON);
      }
    }
    // Never resolve backwards past the start (e.g. when already flush).
    if (dx > 0 ? nextX < x : nextX > x) nextX = x;
  }

  let nextZ = z + dz;
  if (dz !== 0) {
    for (const obs of obstacles) {
      if (nextX - radius >= obs.maxX || nextX + radius <= obs.minX) continue;
      if (dz > 0 && obs.maxZ > z && obs.minZ < nextZ + radius) {
        nextZ = Math.min(nextZ, obs.minZ - radius - EPSILON);
      } else if (dz < 0 && obs.minZ < z && obs.maxZ > nextZ - radius) {
        nextZ = Math.max(nextZ, obs.maxZ + radius + EPSILON);
      }
    }
    if (dz > 0 ? nextZ < z : nextZ > z) nextZ = z;
  }

  return { x: nextX, z: nextZ };
}
