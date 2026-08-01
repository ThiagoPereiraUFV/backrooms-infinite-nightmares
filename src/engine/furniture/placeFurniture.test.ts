import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_SIZE, PILLAR_SCALE, PLAYER_RADIUS } from "@/config/constants";
import {
  CELL_OPEN,
  CELL_PILLAR,
  CELL_WALL,
  cellIndex,
  edgeGateways,
  generateChunk,
  type ChunkData,
} from "../generation/chunk";
import { getLevelProfile } from "../generation/levelProfile";
import { createRng } from "../generation/rng";
import { FURNITURE_CATALOG, furnitureRegistry } from "./catalog";
import { placeFurniture, type FurniturePlacement } from "./placeFurniture";

/** Mirrors the generator's anchor set from the public border contract. */
const anchorCells = (worldSeed: number, cx: number, cz: number): [number, number][] => {
  const last = CHUNK_SIZE - 1;
  const cells: [number, number][] = [];
  for (const row of edgeGateways(worldSeed, 0, cx, cz)) cells.push([0, row], [1, row]);
  for (const row of edgeGateways(worldSeed, 0, cx + 1, cz))
    cells.push([last, row], [last - 1, row]);
  for (const col of edgeGateways(worldSeed, 1, cx, cz)) cells.push([col, 0], [col, 1]);
  for (const col of edgeGateways(worldSeed, 1, cx, cz + 1))
    cells.push([col, last], [col, last - 1]);
  cells.push([CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]);
  return cells;
};

/**
 * Independent connectivity checker at a finer resolution (0.5m samples) than
 * the placer's internal safety net, so it actually validates it.
 */
const anchorsReachable = (chunk: ChunkData, anchors: [number, number][]): boolean => {
  const SUB = 8;
  const grid = CHUNK_SIZE * SUB;
  const step = CELL_SIZE / SUB;
  const pillarHalf = (CELL_SIZE * PILLAR_SCALE) / 2;
  const originX = chunk.cx * CHUNK_SIZE * CELL_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE * CELL_SIZE;

  const walkable = (gx: number, gz: number): boolean => {
    const cellX = Math.floor(gx / SUB);
    const cellZ = Math.floor(gz / SUB);
    const cell = chunk.cells[cellIndex(cellX, cellZ)];
    if (cell === CELL_WALL) return false;
    const px = (gx + 0.5) * step;
    const pz = (gz + 0.5) * step;
    if (cell === CELL_PILLAR) {
      const centerX = (cellX + 0.5) * CELL_SIZE;
      const centerZ = (cellZ + 0.5) * CELL_SIZE;
      if (
        Math.abs(px - centerX) - PLAYER_RADIUS < pillarHalf &&
        Math.abs(pz - centerZ) - PLAYER_RADIUS < pillarHalf
      ) {
        return false;
      }
    }
    return !chunk.furniture.some(
      (piece) =>
        piece.y === 0 &&
        px - PLAYER_RADIUS < piece.maxX - originX &&
        px + PLAYER_RADIUS > piece.minX - originX &&
        pz - PLAYER_RADIUS < piece.maxZ - originZ &&
        pz + PLAYER_RADIUS > piece.minZ - originZ,
    );
  };

  const visited = new Uint8Array(grid * grid);
  const stack: number[] = [];
  const [ax, az] = anchors[0];
  for (let s = 0; s < SUB * SUB; s++) {
    stack.push((az * SUB + Math.floor(s / SUB)) * grid + ax * SUB + (s % SUB));
  }
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    if (visited[idx]) continue;
    const gx = idx % grid;
    const gz = (idx - gx) / grid;
    if (!walkable(gx, gz)) continue;
    visited[idx] = 1;
    if (gx > 0) stack.push(idx - 1);
    if (gx < grid - 1) stack.push(idx + 1);
    if (gz > 0) stack.push(idx - grid);
    if (gz < grid - 1) stack.push(idx + grid);
  }
  return anchors.every(([x, z]) => {
    for (let sz = 0; sz < SUB; sz++) {
      for (let sx = 0; sx < SUB; sx++) {
        if (visited[(z * SUB + sz) * grid + x * SUB + sx]) return true;
      }
    }
    return false;
  });
};

const groundPieces = (chunk: ChunkData): FurniturePlacement[] =>
  chunk.furniture.filter((piece) => piece.y === 0);

// Level 4 ("Abandoned Office") has the densest furniture table. Sweep the
// full Main Nine roster.
const SAMPLED = [0, 1, 2, 3, 4, 5, 6, 7, 8];

describe("placeFurniture", () => {
  it("is deterministic: same seed and level produce identical furniture", () => {
    const profile = getLevelProfile(4);
    const a = generateChunk(99, 2, -3, profile);
    const b = generateChunk(99, 2, -3, profile);
    expect(a.furniture).toEqual(b.furniture);
  });

  it("produces furniture on furnished levels", () => {
    const profile = getLevelProfile(4);
    const total = [0, 1, 2, 3].reduce(
      (sum, cx) => sum + generateChunk(7, cx, 0, profile).furniture.length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });

  it("places nothing when density is zero or weights are empty", () => {
    const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const anchors: [number, number][] = [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]];
    const base = { cells, anchors, originX: 0, originZ: 0 };
    expect(
      placeFurniture({
        ...base,
        rng: createRng(1),
        profile: { furnitureDensity: 0, furnitureWeights: { chair: 1 }, ceilingHeight: 3 },
      }),
    ).toEqual([]);
    expect(
      placeFurniture({
        ...base,
        rng: createRng(1),
        profile: { furnitureDensity: 0.5, furnitureWeights: {}, ceilingHeight: 3 },
      }),
    ).toEqual([]);
  });

  it("pickDef's weighted draw is unaffected by catalog size: explicit zero-weight entries change nothing", () => {
    // PLAN-4 added ~10 new catalog entries. `pickDef` filters out any entry
    // whose weight is <= 0 *before* drawing and rolls exactly one
    // `rng.next()` regardless of how many entries survive the filter — so a
    // level whose `furnitureWeights` never mentions a new id must produce
    // byte-identical output whether or not that id even exists in
    // FURNITURE_CATALOG. Proven here by explicitly zeroing every catalog id
    // not already in the active weight table and asserting the output is
    // unchanged; if `pickDef` ever regressed to rolling once per catalog
    // entry, or let an explicit-zero entry leak into the weighted draw, the
    // two runs below would diverge (PLAN-4 §8/§16).
    const activeWeights = { chair: 2, table: 1, crate: 0.5 };
    const wideWeights: Record<string, number> = { ...activeWeights };
    for (const def of FURNITURE_CATALOG) {
      if (!(def.id in wideWeights)) wideWeights[def.id] = 0;
    }
    expect(Object.keys(wideWeights).length).toBeGreaterThan(Object.keys(activeWeights).length);

    const buildArgs = (weights: Record<string, number>) => ({
      cells: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      anchors: [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]] as [number, number][],
      rng: createRng(2024),
      profile: { furnitureDensity: 0.3, furnitureWeights: weights, ceilingHeight: 3 },
      originX: 0,
      originZ: 0,
    });

    const narrow = placeFurniture(buildArgs(activeWeights));
    const wide = placeFurniture(buildArgs(wideWeights));
    expect(wide).toEqual(narrow);
    expect(narrow.length).toBeGreaterThan(0);
  });

  it("pins a determinism fixture for one roster level's furniture at a fixed seed (regression guard)", () => {
    // A snapshot is the pinned fixture the plan asks for: any future change
    // to placement order, pickDef's draw, or the shared catalog that alters
    // this level's output will fail this test, even though nothing else
    // in the suite happens to exercise this exact seed/chunk.
    const level0 = getLevelProfile(0);
    const chunk = generateChunk(0xf17ce5, 2, -5, level0);
    expect(chunk.furniture).toMatchSnapshot();
  });

  it("every placement is valid across levels and chunks", () => {
    for (const level of SAMPLED) {
      const profile = getLevelProfile(level);
      for (const [cx, cz] of [
        [0, 0],
        [3, -2],
        [-1, 5],
      ]) {
        const chunk = generateChunk(1234, cx, cz, profile);
        const anchors = new Set(anchorCells(1234, cx, cz).map(([x, z]) => cellIndex(x, z)));
        const originX = cx * CHUNK_SIZE * CELL_SIZE;
        const originZ = cz * CHUNK_SIZE * CELL_SIZE;

        for (const piece of chunk.furniture) {
          // Registered id and a sane AABB around the position.
          expect(furnitureRegistry.has(piece.defId)).toBe(true);
          expect(piece.maxX).toBeGreaterThan(piece.minX);
          expect(piece.maxZ).toBeGreaterThan(piece.minZ);
          expect(piece.x).toBeGreaterThanOrEqual(piece.minX);
          expect(piece.x).toBeLessThanOrEqual(piece.maxX);

          if (piece.y === 0) {
            // Ground pieces sit fully inside one open, interior, non-anchor cell.
            const cellX = Math.floor((piece.x - originX) / CELL_SIZE);
            const cellZ = Math.floor((piece.z - originZ) / CELL_SIZE);
            expect(chunk.cells[cellIndex(cellX, cellZ)]).toBe(CELL_OPEN);
            expect(anchors.has(cellIndex(cellX, cellZ))).toBe(false);
            expect(piece.minX - originX).toBeGreaterThanOrEqual(cellX * CELL_SIZE);
            expect(piece.maxX - originX).toBeLessThanOrEqual((cellX + 1) * CELL_SIZE);
            expect(piece.minZ - originZ).toBeGreaterThanOrEqual(cellZ * CELL_SIZE);
            expect(piece.maxZ - originZ).toBeLessThanOrEqual((cellZ + 1) * CELL_SIZE);
          }
        }

        // Ground pieces never overlap each other.
        const ground = groundPieces(chunk);
        for (let i = 0; i < ground.length; i++) {
          for (let j = i + 1; j < ground.length; j++) {
            const a = ground[i];
            const b = ground[j];
            const overlap =
              a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
            expect(overlap).toBe(false);
          }
        }

        // Stacked pieces sit fully inside a stackable ground base below them.
        for (const piece of chunk.furniture) {
          if (piece.y === 0) continue;
          const base = ground.find(
            (candidate) =>
              piece.minX >= candidate.minX - 1e-6 &&
              piece.maxX <= candidate.maxX + 1e-6 &&
              piece.minZ >= candidate.minZ - 1e-6 &&
              piece.maxZ <= candidate.maxZ + 1e-6,
          );
          expect(base).toBeDefined();
          expect(furnitureRegistry.get((base as FurniturePlacement).defId)?.stackable).toBe(true);
        }
      }
    }
  });

  it("preserves the connectivity guarantee between all border anchors", () => {
    for (const level of SAMPLED) {
      const profile = getLevelProfile(level);
      for (let cx = 0; cx < 3; cx++) {
        const chunk = generateChunk(555, cx, 1, profile);
        expect(anchorsReachable(chunk, anchorCells(555, cx, 1))).toBe(true);
      }
    }
  });
});
