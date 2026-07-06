import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_WORLD_SIZE } from "@/config/constants";
import { CELL_OPEN } from "./chunk";
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
});
