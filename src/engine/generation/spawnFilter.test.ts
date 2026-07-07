import { describe, expect, it } from "vitest";
import type { ChunkSpawn } from "./cells";
import { filterSpawnsByKeepFraction, spawnKey } from "./spawnFilter";

const spawns: ChunkSpawn[] = Array.from({ length: 200 }, (_, i) => ({
  id: `item-${i % 4}`,
  cellX: i % 16,
  cellZ: Math.floor(i / 16),
}));

describe("filterSpawnsByKeepFraction", () => {
  it("keeps everything at keepFraction >= 1", () => {
    expect(filterSpawnsByKeepFraction(0, 0, spawns, 1)).toEqual(spawns);
  });

  it("keeps nothing at keepFraction <= 0", () => {
    expect(filterSpawnsByKeepFraction(0, 0, spawns, 0)).toEqual([]);
  });

  it("keeps roughly the requested fraction", () => {
    const kept = filterSpawnsByKeepFraction(3, -2, spawns, 0.5);
    const fraction = kept.length / spawns.length;
    expect(fraction).toBeGreaterThan(0.3);
    expect(fraction).toBeLessThan(0.7);
  });

  it("is deterministic for a given chunk and fraction", () => {
    expect(filterSpawnsByKeepFraction(3, -2, spawns, 0.5)).toEqual(
      filterSpawnsByKeepFraction(3, -2, spawns, 0.5),
    );
  });

  it("differs across chunks for the same spawn list", () => {
    const a = filterSpawnsByKeepFraction(0, 0, spawns, 0.5);
    const b = filterSpawnsByKeepFraction(99, -99, spawns, 0.5);
    expect(a).not.toEqual(b);
  });
});

describe("spawnKey", () => {
  it("is stable for identical inputs and unique per identity component", () => {
    const spawn: ChunkSpawn = { id: "bandage", cellX: 2, cellZ: 3 };
    expect(spawnKey(0, 0, spawn)).toBe(spawnKey(0, 0, spawn));
    expect(spawnKey(0, 0, spawn)).not.toBe(spawnKey(1, 0, spawn));
    expect(spawnKey(0, 0, spawn)).not.toBe(spawnKey(0, 0, { ...spawn, cellX: 5 }));
    expect(spawnKey(0, 0, spawn)).not.toBe(spawnKey(0, 0, { ...spawn, id: "adrenaline" }));
  });
});
