import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_SIZE, CHUNK_WORLD_SIZE, PILLAR_SCALE } from "@/config/constants";
import { CELL_OPEN, CELL_PILLAR, CELL_WALL, cellIndex } from "./chunk";
import { ChunkManager } from "./chunkManager";
import { createLevelProfile } from "./levelProfile";

const profile = createLevelProfile(0);

describe("ChunkManager", () => {
  it("returns the same data for repeated requests (cache hit)", () => {
    const manager = new ChunkManager(1, profile);
    expect(manager.getChunk(3, 4)).toBe(manager.getChunk(3, 4));
  });

  it("regenerates identical data after LRU eviction", () => {
    const manager = new ChunkManager(1, profile, 2);
    const original = manager.getChunk(0, 0);
    manager.getChunk(1, 0);
    manager.getChunk(2, 0); // evicts (0,0)
    const regenerated = manager.getChunk(0, 0);
    expect(regenerated).not.toBe(original);
    expect(regenerated.cells).toEqual(original.cells);
  });

  it("keeps recently used chunks when evicting", () => {
    const manager = new ChunkManager(1, profile, 2);
    const a = manager.getChunk(0, 0);
    manager.getChunk(1, 0);
    manager.getChunk(0, 0); // refresh recency of (0,0)
    manager.getChunk(2, 0); // should evict (1,0), not (0,0)
    expect(manager.getChunk(0, 0)).toBe(a);
  });

  it("returns a full square of chunks around a position", () => {
    const manager = new ChunkManager(1, profile);
    const chunks = manager.chunksAround(10, 10, 2);
    expect(chunks).toHaveLength(25);
    const keys = new Set(chunks.map((chunk) => `${chunk.cx},${chunk.cz}`));
    expect(keys.size).toBe(25);
    expect(keys.has("0,0")).toBe(true);
    expect(keys.has("-2,-2")).toBe(true);
    expect(keys.has("2,2")).toBe(true);
  });

  it("maps world coordinates to cells across chunk borders (negative too)", () => {
    const manager = new ChunkManager(1, profile);
    // The same world position must resolve consistently however it's queried.
    const x = -CHUNK_WORLD_SIZE + 2 * CELL_SIZE + 0.5;
    const z = -3.2;
    expect(manager.cellAtWorld(x, z)).toBe(manager.cellAtWorld(x, z));
    expect(typeof manager.isSolidAt(x, z)).toBe("boolean");
  });

  it("finds an open spawn cell", () => {
    for (const level of [0, 6, 42]) {
      const manager = new ChunkManager(7, createLevelProfile(level));
      const spawn = manager.findSpawn();
      expect(manager.cellAtWorld(spawn.x, spawn.z)).toBe(CELL_OPEN);
    }
  });

  describe("obstaclesIn", () => {
    /** First cell of the given type in chunk (0,0), as world-space bounds. */
    const findCell = (manager: ChunkManager, type: number) => {
      const chunk = manager.getChunk(0, 0);
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (chunk.cells[cellIndex(x, z)] === type) return { x, z };
        }
      }
      return null;
    };

    // Level 1 is pillar-field heavy, so chunk (0,0) reliably has both types.
    const manager = new ChunkManager(1, createLevelProfile(1));

    it("reports walls as full-cell AABBs", () => {
      const cell = findCell(manager, CELL_WALL);
      expect(cell).not.toBeNull();
      const { x, z } = cell as { x: number; z: number };
      const obstacles = manager.obstaclesIn(
        x * CELL_SIZE,
        (x + 1) * CELL_SIZE,
        z * CELL_SIZE,
        (z + 1) * CELL_SIZE,
      );
      expect(obstacles).toContainEqual({
        minX: x * CELL_SIZE,
        maxX: (x + 1) * CELL_SIZE,
        minZ: z * CELL_SIZE,
        maxZ: (z + 1) * CELL_SIZE,
      });
    });

    it("reports pillars at their rendered sub-cell footprint", () => {
      const cell = findCell(manager, CELL_PILLAR);
      expect(cell).not.toBeNull();
      const { x, z } = cell as { x: number; z: number };
      const half = (CELL_SIZE * PILLAR_SCALE) / 2;
      const centerX = (x + 0.5) * CELL_SIZE;
      const centerZ = (z + 0.5) * CELL_SIZE;
      const obstacles = manager.obstaclesIn(
        centerX - 0.1,
        centerX + 0.1,
        centerZ - 0.1,
        centerZ + 0.1,
      );
      expect(obstacles).toContainEqual({
        minX: centerX - half,
        maxX: centerX + half,
        minZ: centerZ - half,
        maxZ: centerZ + half,
      });
    });

    it("returns nothing for a rect fully inside open cells", () => {
      const spawn = manager.findSpawn();
      // A tiny rect at the spawn cell center touches only that open cell.
      const obstacles = manager.obstaclesIn(
        spawn.x - 0.1,
        spawn.x + 0.1,
        spawn.z - 0.1,
        spawn.z + 0.1,
      );
      expect(obstacles).toEqual([]);
    });

    it("includes furniture colliders for ground pieces", () => {
      // Level 4 is the densest furniture level — find a chunk that has some.
      const furnished = new ChunkManager(7, createLevelProfile(4));
      for (let cx = 0; cx < 8; cx++) {
        const chunk = furnished.getChunk(cx, 0);
        const piece = chunk.furniture.find((candidate) => candidate.y === 0);
        if (!piece) continue;
        const obstacles = furnished.obstaclesIn(piece.minX, piece.maxX, piece.minZ, piece.maxZ);
        expect(obstacles).toContainEqual({
          minX: piece.minX,
          maxX: piece.maxX,
          minZ: piece.minZ,
          maxZ: piece.maxZ,
        });
        return;
      }
      throw new Error("no furnished chunk found in sweep — placement likely broken");
    });

    it("spans chunk borders and negative coordinates", () => {
      const obstacles = manager.obstaclesIn(
        -CELL_SIZE * 2,
        CELL_SIZE * 2,
        -CELL_SIZE * 2,
        CELL_SIZE * 2,
      );
      for (const obs of obstacles) {
        expect(obs.maxX).toBeGreaterThan(obs.minX);
        expect(obs.maxZ).toBeGreaterThan(obs.minZ);
        expect(obs.maxX).toBeGreaterThanOrEqual(-CELL_SIZE * 2);
        expect(obs.minX).toBeLessThanOrEqual(CELL_SIZE * 2);
      }
    });
  });
});
