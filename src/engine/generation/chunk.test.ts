import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_SIZE } from "@/config/constants";
import {
  CELL_OPEN,
  CELL_WALL,
  cellIndex,
  edgeGateways,
  ensureConnectivity,
  generateChunk,
  type ChunkData,
} from "./chunk";
import { getLevelProfile } from "./levelProfile";

const WORLD_SEED = 0xdead;
const profile = getLevelProfile(0);

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

  // 9 levels x 7x7 chunks x (furniture + feature) passes is a heavy sweep;
  // v8 coverage instrumentation alone can push it past the default 5s
  // timeout, so it gets an explicit budget rather than a flaky one.
  it("keeps all gateways and the center mutually reachable", () => {
    const last = CHUNK_SIZE - 1;
    const center = CHUNK_SIZE >> 1;
    // Test across many chunks and every level profile in the roster.
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const levelProfile = getLevelProfile(level);
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
  }, 15_000);

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

  it("generates byte-identical cells and features end-to-end for the same seed", () => {
    // This is a determinism check on the whole generateChunk pipeline
    // (including the feature pass), not a mutation proof: two independent
    // calls happening to match doesn't rule out a deterministic in-place
    // write inside placeFeatures. The actual "placeFeatures never writes
    // `cells`" guarantee is a direct before/after diff on one call, in
    // placeFeatures.test.ts ("does not mutate the input grid").
    const a = generateChunk(WORLD_SEED, 2, 2, profile);
    const b = generateChunk(WORLD_SEED, 2, 2, profile);
    expect(a.cells).toEqual(b.cells);
    expect(a.features).toEqual(b.features);
  });

  it("produces features that differ across seeds", () => {
    const hotel = getLevelProfile(5); // high doorway rate, features are plentiful
    const a = generateChunk(WORLD_SEED, 3, 3, hotel);
    const b = generateChunk(WORLD_SEED + 1, 3, 3, hotel);
    expect(a.features).not.toEqual(b.features);
  });

  it("never places a feature on a border-contract anchor cell", () => {
    const hotel = getLevelProfile(5);
    const last = CHUNK_SIZE - 1;
    const center = CHUNK_SIZE >> 1;
    const chunk = generateChunk(WORLD_SEED, 6, -6, hotel);
    const anchors = new Set<number>();
    anchors.add(cellIndex(center, center));
    for (const row of edgeGateways(WORLD_SEED, 0, 6, -6)) {
      anchors.add(cellIndex(0, row));
      anchors.add(cellIndex(1, row));
    }
    for (const row of edgeGateways(WORLD_SEED, 0, 7, -6)) {
      anchors.add(cellIndex(last, row));
      anchors.add(cellIndex(last - 1, row));
    }
    for (const col of edgeGateways(WORLD_SEED, 1, 6, -6)) {
      anchors.add(cellIndex(col, 0));
      anchors.add(cellIndex(col, 1));
    }
    for (const col of edgeGateways(WORLD_SEED, 1, 6, -5)) {
      anchors.add(cellIndex(col, last));
      anchors.add(cellIndex(col, last - 1));
    }
    for (const feature of chunk.features) {
      expect(anchors.has(cellIndex(feature.cellX, feature.cellZ))).toBe(false);
    }
  });

  it("produces no light fixtures at all for a lighting: 'none' level", () => {
    const darkLevel = getLevelProfile(6); // Lights Out — lighting: "none"
    const chunk = generateChunk(WORLD_SEED, -2, 5, darkLevel);
    expect(chunk.lights.length).toBe(0);
  });

  it("still produces fixtures only on open cells for a fluorescentPanels level", () => {
    const officeLevel = getLevelProfile(4); // Abandoned Office — lighting: "fluorescentPanels"
    const chunk = generateChunk(WORLD_SEED, 4, 4, officeLevel);
    expect(chunk.lights.length).toBeGreaterThan(0);
    for (const idx of chunk.lights) {
      expect(chunk.cells[idx]).toBe(CELL_OPEN);
    }
  });
});

describe("ensureConnectivity (carve directions)", () => {
  // Real generation always makes anchors[0] the westmost gateway cell
  // (x = 0), so a disconnected anchor's x is never less than the target's —
  // the walk's x-increment direction can't fire through generateChunk.
  // Synthetic anchors exercise it (and the rarer z-decrement direction)
  // directly, all cells starting solid so every carve is actually needed.
  it("carves toward the target in every x/z direction the walk can take", () => {
    const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_WALL);
    const target: [number, number] = [10, 5];
    const anchors: [number, number][] = [
      target,
      [2, 5], // x < targetX: increment-x leg only
      [10, 12], // same x as target, z > targetZ: decrement-z leg only
    ];

    ensureConnectivity(cells, anchors);

    for (const [x, z] of anchors) {
      expect(cells[cellIndex(x, z)]).toBe(CELL_OPEN);
    }
    // Every anchor ends up mutually reachable, including via the carved paths.
    const region = reachableFrom({ cells } as ChunkData, ...target);
    for (const [x, z] of anchors) {
      expect(region.has(cellIndex(x, z))).toBe(true);
    }
  });
});
