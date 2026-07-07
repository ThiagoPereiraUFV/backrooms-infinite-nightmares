import { CELL_SIZE, CHUNK_WORLD_SIZE } from "@/config/constants";
import type { ChunkSpawn } from "./cells";
import { hashInts, hashString } from "./rng";

/**
 * Deterministically thins a spawn list to roughly `keepFraction` of its
 * entries, keyed by chunk + spawn identity so the same seed/level/fraction
 * always yields the same active set (items: keepFraction = 1 - scarcity;
 * entities: keepFraction = aggression, so peaceful's aggression 0 yields none).
 */
export function filterSpawnsByKeepFraction(
  cx: number,
  cz: number,
  spawns: readonly ChunkSpawn[],
  keepFraction: number,
): ChunkSpawn[] {
  if (keepFraction >= 1) return [...spawns];
  if (keepFraction <= 0) return [];
  return spawns.filter((spawn) => {
    const h = hashInts(cx, cz, spawn.cellX, spawn.cellZ, hashString(spawn.id));
    return h / 0xffffffff < keepFraction;
  });
}

/** Stable identity for a spawn within a session — used to track pickups. */
export const spawnKey = (cx: number, cz: number, spawn: ChunkSpawn): string =>
  `${cx},${cz},${spawn.cellX},${spawn.cellZ},${spawn.id}`;

/** World-space center of a spawn point's cell. */
export const spawnWorldPosition = (
  cx: number,
  cz: number,
  cellX: number,
  cellZ: number,
): { x: number; z: number } => ({
  x: cx * CHUNK_WORLD_SIZE + (cellX + 0.5) * CELL_SIZE,
  z: cz * CHUNK_WORLD_SIZE + (cellZ + 0.5) * CELL_SIZE,
});
