import {
  CELL_SIZE,
  CHUNK_CACHE_SIZE,
  CHUNK_SIZE,
  CHUNK_WORLD_SIZE,
  PILLAR_SCALE,
} from "@/config/constants";
import type { ObstacleAabb, ObstacleWorld } from "@/engine/player/collision";
import {
  CELL_OPEN,
  CELL_PILLAR,
  CELL_WALL,
  cellIndex,
  generateChunk,
  type Cell,
  type ChunkData,
} from "./chunk";
import type { LevelProfile } from "./levelProfile";

const PILLAR_HALF_EXTENT = (CELL_SIZE * PILLAR_SCALE) / 2;

/**
 * Generates chunks on demand and keeps a bounded LRU cache of their data
 * (plain typed arrays — meshes are the renderer's concern). Revisited areas
 * come back instantly; memory stays bounded no matter how far the player goes.
 */
export class ChunkManager implements ObstacleWorld {
  private readonly cache = new Map<string, ChunkData>();

  constructor(
    private readonly worldSeed: number,
    private readonly profile: LevelProfile,
    private readonly cacheSize: number = CHUNK_CACHE_SIZE,
  ) {}

  getChunk(cx: number, cz: number): ChunkData {
    const key = `${cx},${cz}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh recency: Map preserves insertion order, so re-set moves it last.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const chunk = generateChunk(this.worldSeed, cx, cz, this.profile);
    this.cache.set(key, chunk);
    if (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }
    return chunk;
  }

  /** All chunks in a square ring of the given radius around a world position. */
  chunksAround(worldX: number, worldZ: number, radius: number): ChunkData[] {
    const centerCx = Math.floor(worldX / CHUNK_WORLD_SIZE);
    const centerCz = Math.floor(worldZ / CHUNK_WORLD_SIZE);
    const chunks: ChunkData[] = [];
    for (let cz = centerCz - radius; cz <= centerCz + radius; cz++) {
      for (let cx = centerCx - radius; cx <= centerCx + radius; cx++) {
        chunks.push(this.getChunk(cx, cz));
      }
    }
    return chunks;
  }

  /** Cell type at an absolute world position (meters). */
  cellAtWorld(worldX: number, worldZ: number): Cell {
    const cellX = Math.floor(worldX / CELL_SIZE);
    const cellZ = Math.floor(worldZ / CELL_SIZE);
    const cx = Math.floor(cellX / CHUNK_SIZE);
    const cz = Math.floor(cellZ / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    const localX = cellX - cx * CHUNK_SIZE;
    const localZ = cellZ - cz * CHUNK_SIZE;
    return chunk.cells[cellIndex(localX, localZ)] as Cell;
  }

  isSolidAt(worldX: number, worldZ: number): boolean {
    return this.cellAtWorld(worldX, worldZ) !== CELL_OPEN;
  }

  /**
   * Collision obstacles overlapping the query rect. Walls fill their whole
   * cell; pillars contribute only their rendered footprint (PILLAR_SCALE of
   * the cell, centered) and furniture its placed AABB, so collision always
   * matches what the player sees.
   */
  obstaclesIn(minX: number, maxX: number, minZ: number, maxZ: number): ObstacleAabb[] {
    const obstacles: ObstacleAabb[] = [];
    const cellMinX = Math.floor(minX / CELL_SIZE);
    const cellMaxX = Math.floor(maxX / CELL_SIZE);
    const cellMinZ = Math.floor(minZ / CELL_SIZE);
    const cellMaxZ = Math.floor(maxZ / CELL_SIZE);
    for (let cz = cellMinZ; cz <= cellMaxZ; cz++) {
      for (let cx = cellMinX; cx <= cellMaxX; cx++) {
        const cell = this.cellAtWorld((cx + 0.5) * CELL_SIZE, (cz + 0.5) * CELL_SIZE);
        if (cell === CELL_WALL) {
          obstacles.push({
            minX: cx * CELL_SIZE,
            maxX: (cx + 1) * CELL_SIZE,
            minZ: cz * CELL_SIZE,
            maxZ: (cz + 1) * CELL_SIZE,
          });
        } else if (cell === CELL_PILLAR) {
          const centerX = (cx + 0.5) * CELL_SIZE;
          const centerZ = (cz + 0.5) * CELL_SIZE;
          obstacles.push({
            minX: centerX - PILLAR_HALF_EXTENT,
            maxX: centerX + PILLAR_HALF_EXTENT,
            minZ: centerZ - PILLAR_HALF_EXTENT,
            maxZ: centerZ + PILLAR_HALF_EXTENT,
          });
        }
      }
    }

    // Furniture colliders from every chunk the rect touches. Stacked pieces
    // (y > 0) sit inside their base's footprint and add no collider.
    const chunkMinX = Math.floor(minX / CHUNK_WORLD_SIZE);
    const chunkMaxX = Math.floor(maxX / CHUNK_WORLD_SIZE);
    const chunkMinZ = Math.floor(minZ / CHUNK_WORLD_SIZE);
    const chunkMaxZ = Math.floor(maxZ / CHUNK_WORLD_SIZE);
    for (let cz = chunkMinZ; cz <= chunkMaxZ; cz++) {
      for (let cx = chunkMinX; cx <= chunkMaxX; cx++) {
        for (const piece of this.getChunk(cx, cz).furniture) {
          if (piece.y > 0) continue;
          if (piece.minX < maxX && piece.maxX > minX && piece.minZ < maxZ && piece.maxZ > minZ) {
            obstacles.push({
              minX: piece.minX,
              maxX: piece.maxX,
              minZ: piece.minZ,
              maxZ: piece.maxZ,
            });
          }
        }
      }
    }
    return obstacles;
  }

  /**
   * Finds a safe spawn point near the world origin: the center of the first
   * open cell scanning outward from the chunk (0,0) center.
   */
  findSpawn(): { x: number; z: number } {
    const chunk = this.getChunk(0, 0);
    const center = CHUNK_SIZE >> 1;
    for (let ring = 0; ring < center; ring++) {
      for (let z = center - ring; z <= center + ring; z++) {
        for (let x = center - ring; x <= center + ring; x++) {
          // ring 0 checks only the center cell, always open (see below) —
          // the scan-outward fallback for other rings never actually runs.
          /* v8 ignore next 3 */
          if (chunk.cells[cellIndex(x, z)] === CELL_OPEN) {
            return { x: (x + 0.5) * CELL_SIZE, z: (z + 0.5) * CELL_SIZE };
          }
        }
      }
    }
    // Unreachable: generation guarantees the chunk center is open.
    /* v8 ignore next */
    return { x: (center + 0.5) * CELL_SIZE, z: (center + 0.5) * CELL_SIZE };
  }
}
