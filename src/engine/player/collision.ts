import { CELL_SIZE } from "@/config/constants";

/** Minimal world surface the collider needs — satisfied by ChunkManager. */
export interface SolidWorld {
  isSolidAt(worldX: number, worldZ: number): boolean;
}

const EPSILON = 1e-3;

const blockedAt = (world: SolidWorld, x: number, z: number, radius: number): boolean =>
  world.isSolidAt(x - radius, z - radius) ||
  world.isSolidAt(x + radius, z - radius) ||
  world.isSolidAt(x - radius, z + radius) ||
  world.isSolidAt(x + radius, z + radius);

/**
 * Axis-separated AABB collision against the wall grid. Resolving x and z
 * independently gives natural wall sliding. On a blocked axis the position is
 * clamped flush to the cell boundary rather than cancelled, so movement into
 * a wall at an angle stays smooth.
 */
export function resolveMovement(
  world: SolidWorld,
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
): { x: number; z: number } {
  let nextX = x + dx;
  if (dx !== 0 && blockedAt(world, nextX, z, radius)) {
    const boundary =
      dx > 0
        ? Math.floor((nextX + radius) / CELL_SIZE) * CELL_SIZE
        : Math.ceil((nextX - radius) / CELL_SIZE) * CELL_SIZE;
    nextX = dx > 0 ? boundary - radius - EPSILON : boundary + radius + EPSILON;
    if (blockedAt(world, nextX, z, radius)) nextX = x;
  }

  let nextZ = z + dz;
  if (dz !== 0 && blockedAt(world, nextX, nextZ, radius)) {
    const boundary =
      dz > 0
        ? Math.floor((nextZ + radius) / CELL_SIZE) * CELL_SIZE
        : Math.ceil((nextZ - radius) / CELL_SIZE) * CELL_SIZE;
    nextZ = dz > 0 ? boundary - radius - EPSILON : boundary + radius + EPSILON;
    if (blockedAt(world, nextX, nextZ, radius)) nextZ = z;
  }

  return { x: nextX, z: nextZ };
}
