import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_SIZE } from "@/config/constants";
import { CELL_OPEN, cellIndex, edgeGateways, generateChunk, type ChunkData } from "./chunk";
import { createLevelProfile } from "./levelProfile";

const WORLD_SEED = 0xdead;
const profile = createLevelProfile(0);

/** All open cells reachable from (startX, startZ) within one chunk. */
const reachableFrom = (chunk: ChunkData, startX: number, startZ: number): Set<number> => {
  const seen = new Set<number>();
  const stack = [cellIndex(startX, startZ)];
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    if (seen.has(idx) || chunk.cells[idx] !== CELL_OPEN) continue;
    seen.add(idx);
    const x = idx % CHUNK_SIZE;
    const z = (idx - x) / CHUNK_SIZE;
    if (x > 0) stack.push(idx - 1);
    if (x < CHUNK_SIZE - 1) stack.push(idx + 1);
    if (z > 0) stack.push(idx - CHUNK_SIZE);
    if (z < CHUNK_SIZE - 1) stack.push(idx + CHUNK_SIZE);
  }
  return seen;
};

describe("edgeGateways (border contract)", () => {
  it("is deterministic", () => {
    expect(edgeGateways(WORLD_SEED, 0, 3, -2)).toEqual(edgeGateways(WORLD_SEED, 0, 3, -2));
  });

  it("returns 2-3 distinct interior rows", () => {
    for (let i = -5; i <= 5; i++) {
      const rows = edgeGateways(WORLD_SEED, 1, i, i * 3);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(3);
      expect(new Set(rows).size).toBe(rows.length);
      for (const row of rows) {
        expect(row).toBeGreaterThanOrEqual(1);
        expect(row).toBeLessThan(CHUNK_SIZE - 1);
      }
    }
  });

  it("differs between orientations and edges", () => {
    expect(edgeGateways(WORLD_SEED, 0, 4, 4)).not.toEqual(edgeGateways(WORLD_SEED, 1, 4, 4));
  });
});

describe("generateChunk", () => {
  it("is deterministic", () => {
    const a = generateChunk(WORLD_SEED, 2, -3, profile);
    const b = generateChunk(WORLD_SEED, 2, -3, profile);
    expect(a.cells).toEqual(b.cells);
    expect(a.lights).toEqual(b.lights);
  });

  it("differs across seeds and coordinates", () => {
    const base = generateChunk(WORLD_SEED, 0, 0, profile);
    expect(generateChunk(WORLD_SEED + 1, 0, 0, profile).cells).not.toEqual(base.cells);
    expect(generateChunk(WORLD_SEED, 1, 0, profile).cells).not.toEqual(base.cells);
  });

  it("honors the border contract: adjacent chunks agree on gateway cells", () => {
    const last = CHUNK_SIZE - 1;
    for (const [cx, cz] of [
      [0, 0],
      [5, -7],
      [-3, 11],
    ] as const) {
      const chunk = generateChunk(WORLD_SEED, cx, cz, profile);
      const east = generateChunk(WORLD_SEED, cx + 1, cz, profile);
      for (const row of edgeGateways(WORLD_SEED, 0, cx + 1, cz)) {
        expect(chunk.cells[cellIndex(last, row)]).toBe(CELL_OPEN);
        expect(east.cells[cellIndex(0, row)]).toBe(CELL_OPEN);
      }
      const south = generateChunk(WORLD_SEED, cx, cz + 1, profile);
      for (const col of edgeGateways(WORLD_SEED, 1, cx, cz + 1)) {
        expect(chunk.cells[cellIndex(col, last)]).toBe(CELL_OPEN);
        expect(south.cells[cellIndex(col, 0)]).toBe(CELL_OPEN);
      }
    }
  });

  it("keeps all gateways and the center mutually reachable", () => {
    const last = CHUNK_SIZE - 1;
    const center = CHUNK_SIZE >> 1;
    // Test across many chunks and several level profiles.
    for (const level of [0, 2, 6, 123, 777]) {
      const levelProfile = createLevelProfile(level);
      for (let cx = -3; cx <= 3; cx++) {
        for (let cz = -3; cz <= 3; cz++) {
          const chunk = generateChunk(WORLD_SEED, cx, cz, levelProfile);
          const region = reachableFrom(chunk, center, center);
          expect(region.has(cellIndex(center, center))).toBe(true);

          for (const row of edgeGateways(WORLD_SEED, 0, cx, cz)) {
            expect(region.has(cellIndex(0, row))).toBe(true);
          }
          for (const row of edgeGateways(WORLD_SEED, 0, cx + 1, cz)) {
            expect(region.has(cellIndex(last, row))).toBe(true);
          }
          for (const col of edgeGateways(WORLD_SEED, 1, cx, cz)) {
            expect(region.has(cellIndex(col, 0))).toBe(true);
          }
          for (const col of edgeGateways(WORLD_SEED, 1, cx, cz + 1)) {
            expect(region.has(cellIndex(col, last))).toBe(true);
          }
        }
      }
    }
  });

  it("places ceiling lights only on open cells", () => {
    const chunk = generateChunk(WORLD_SEED, 4, 4, profile);
    expect(chunk.lights.length).toBeGreaterThan(0);
    for (const idx of chunk.lights) {
      expect(chunk.cells[idx]).toBe(CELL_OPEN);
    }
  });

  it("places spawns deterministically on open, non-anchor, unfurnished cells", () => {
    const last = CHUNK_SIZE - 1;
    const center = CHUNK_SIZE >> 1;
    for (const [cx, cz] of [
      [0, 0],
      [5, -7],
    ] as const) {
      const a = generateChunk(WORLD_SEED, cx, cz, profile);
      const b = generateChunk(WORLD_SEED, cx, cz, profile);
      expect(a.spawns).toEqual(b.spawns);

      const anchors = new Set<number>();
      anchors.add(cellIndex(center, center));
      for (const row of edgeGateways(WORLD_SEED, 0, cx, cz)) {
        anchors.add(cellIndex(0, row));
        anchors.add(cellIndex(1, row));
      }
      for (const row of edgeGateways(WORLD_SEED, 0, cx + 1, cz)) {
        anchors.add(cellIndex(last, row));
        anchors.add(cellIndex(last - 1, row));
      }
      for (const col of edgeGateways(WORLD_SEED, 1, cx, cz)) {
        anchors.add(cellIndex(col, 0));
        anchors.add(cellIndex(col, 1));
      }
      for (const col of edgeGateways(WORLD_SEED, 1, cx, cz + 1)) {
        anchors.add(cellIndex(col, last));
        anchors.add(cellIndex(col, last - 1));
      }

      const originX = cx * CHUNK_SIZE * CELL_SIZE;
      const originZ = cz * CHUNK_SIZE * CELL_SIZE;
      for (const spawn of a.spawns) {
        expect(a.cells[cellIndex(spawn.cellX, spawn.cellZ)]).toBe(CELL_OPEN);
        expect(anchors.has(cellIndex(spawn.cellX, spawn.cellZ))).toBe(false);
        const centerX = originX + (spawn.cellX + 0.5) * CELL_SIZE;
        const centerZ = originZ + (spawn.cellZ + 0.5) * CELL_SIZE;
        const onFurniture = a.furniture.some(
          (piece) =>
            piece.y === 0 &&
            centerX >= piece.minX &&
            centerX <= piece.maxX &&
            centerZ >= piece.minZ &&
            centerZ <= piece.maxZ,
        );
        expect(onFurniture).toBe(false);
      }
    }
  });

  it("produces spawns on levels with a populated spawn table", () => {
    const total = [0, 1, 2, 3].reduce(
      (sum, cx) => sum + generateChunk(WORLD_SEED, cx, 9, profile).spawns.length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });
});
