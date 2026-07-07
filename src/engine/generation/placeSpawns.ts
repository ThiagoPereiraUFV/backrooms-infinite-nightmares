import type { FurniturePlacement } from "../furniture/placeFurniture";
import { CELL_SIZE, CHUNK_SIZE } from "@/config/constants";
import { CELL_OPEN, cellIndex, type ChunkSpawn } from "./cells";
import type { Rng } from "./rng";
import type { SpawnTableEntry } from "./levelProfile";

export interface PlaceSpawnsArgs {
  cells: Uint8Array;
  /** Border-contract gateway cells + chunk center — never spawn on these. */
  anchors: readonly [number, number][];
  furniture: readonly FurniturePlacement[];
  rng: Rng;
  spawnTable: readonly SpawnTableEntry[];
  /** 0..1 — chance a candidate open cell gets a spawn point. */
  density: number;
  originX: number;
  originZ: number;
}

/**
 * Deterministically places point spawns (items, entities — anything keyed by
 * id in a level's spawn table) on open, non-anchor cells clear of furniture.
 * Type (item vs. entity) is not this module's concern: it just places
 * whatever the table lists, by weight. Consumers filter by registry + apply
 * difficulty scarcity/aggression at read time (see spawnFilter.ts).
 */
export function placeSpawns(args: PlaceSpawnsArgs): ChunkSpawn[] {
  const { cells, anchors, furniture, rng, spawnTable, density, originX, originZ } = args;
  const spawns: ChunkSpawn[] = [];
  if (density <= 0) return spawns;
  const totalWeight = spawnTable.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) return spawns;

  const anchorSet = new Set(anchors.map(([x, z]) => cellIndex(x, z)));
  const pick = (): string => {
    let roll = rng.next() * totalWeight;
    for (const entry of spawnTable) {
      roll -= Math.max(0, entry.weight);
      if (roll < 0) return entry.id;
    }
    return spawnTable[spawnTable.length - 1].id;
  };

  const occupiedByFurniture = (cellX: number, cellZ: number): boolean => {
    const centerX = originX + (cellX + 0.5) * CELL_SIZE;
    const centerZ = originZ + (cellZ + 0.5) * CELL_SIZE;
    return furniture.some(
      (piece) =>
        piece.y === 0 &&
        centerX >= piece.minX &&
        centerX <= piece.maxX &&
        centerZ >= piece.minZ &&
        centerZ <= piece.maxZ,
    );
  };

  for (let z = 1; z <= CHUNK_SIZE - 2; z++) {
    for (let x = 1; x <= CHUNK_SIZE - 2; x++) {
      if (cells[cellIndex(x, z)] !== CELL_OPEN) continue;
      if (anchorSet.has(cellIndex(x, z))) continue;
      if (!rng.chance(density)) continue;
      if (occupiedByFurniture(x, z)) continue;
      spawns.push({ id: pick(), cellX: x, cellZ: z });
    }
  }

  return spawns;
}
