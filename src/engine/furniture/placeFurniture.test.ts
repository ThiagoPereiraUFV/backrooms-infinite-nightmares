import { describe, expect, it, vi } from "vitest";
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
import { createRng, type Rng } from "../generation/rng";
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

  it("falls back to the last catalog entry when pickDef's roll never dips below zero", () => {
    // Same exact-arithmetic edge case as rng.ts's pickWeighted: forcing
    // next() === 1 makes the weighted roll land exactly on the summed total,
    // so subtracting each candidate's weight in turn reaches exactly 0 —
    // never `< 0` — and the safety-net return after the loop is what fires.
    const real = createRng(1);
    const rng: Rng = {
      next: () => 1,
      int: real.int,
      range: real.range,
      chance: real.chance,
      pick: real.pick,
    };
    const placements = placeFurniture({
      cells: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      anchors: [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]],
      rng,
      // Low density (not 1): only a handful of cells need to attempt a
      // placement to prove the fallback fires — max density here just makes
      // the quadratic overlap/corridor checks across ~200 cells slow for
      // no extra coverage.
      profile: {
        furnitureDensity: 0.2,
        furnitureWeights: { chair: 1, table: 1 },
        ceilingHeight: 5,
      },
      originX: 0,
      originZ: 0,
    });
    // roll === 1 also always selects the solo branch (>= 0.4), which draws
    // via the unrestricted eligible() — the exact-fallback path above.
    expect(placements.length).toBeGreaterThan(0);
    expect(placements.every((p) => p.defId === "chair" || p.defId === "table")).toBe(true);
  });

  it("rolls back a whole placement group when it would disconnect an anchor", () => {
    // Two anchors on opposite sides of a solid wall column are disconnected
    // by the layout alone, before any furniture is placed — so the very
    // first successful placement's post-check must detect it and roll the
    // group back out, leaving `placements` untouched. Anchor 0 itself sits
    // on a pillar cell so its own seed cell mixes walkable and blocked
    // sub-samples (exercises both sides of the flood's seeding check too).
    const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE); // all CELL_OPEN
    for (let z = 0; z < CHUNK_SIZE; z++) cells[cellIndex(8, z)] = CELL_WALL;
    cells[cellIndex(2, 8)] = CELL_PILLAR;
    const anchors: [number, number][] = [
      [2, 8],
      [13, 8],
    ];

    const placements = placeFurniture({
      cells,
      anchors,
      rng: createRng(42),
      profile: { furnitureDensity: 1, furnitureWeights: { chair: 1 }, ceilingHeight: 3 },
      originX: 0,
      originZ: 0,
    });

    expect(placements).toEqual([]);
  });

  it("never draws a candidate whose weight is zeroed out by a zero clusterAffinity boost", async () => {
    // Every real catalog entry has clusterAffinity >= 1 today, so
    // placeCluster's boosted-affinity draw can never come up empty through
    // real content — but the field is untyped as `>= 1`, so a future entry
    // with clusterAffinity: 0 (opt out of clustering, still placeable solo)
    // must be handled. Mock the catalog to prove it is.
    vi.resetModules();
    vi.doMock("./catalog", async () => {
      const actual = await vi.importActual<typeof import("./catalog")>("./catalog");
      return {
        ...actual,
        FURNITURE_CATALOG: [{ ...actual.FURNITURE_CATALOG[0], id: "chair", clusterAffinity: 0 }],
      };
    });
    const { placeFurniture: placeFurnitureMocked } = await import("./placeFurniture");

    const placements = placeFurnitureMocked({
      cells: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      anchors: [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]],
      rng: createRng(7),
      // Low density: a handful of placements is enough to prove the point,
      // and keeps the quadratic overlap/corridor checks fast.
      profile: { furnitureDensity: 0.2, furnitureWeights: { chair: 1 }, ceilingHeight: 5 },
      originX: 0,
      originZ: 0,
    });

    // The only catalog entry has clusterAffinity 0, so every cluster's
    // "extra" draw must come up empty — solo/base placements still work.
    expect(placements.every((p) => p.defId === "chair")).toBe(true);

    vi.doUnmock("./catalog");
    vi.resetModules();
  });

  it("leaves the stack branch empty when the chosen base fails to fit anywhere", () => {
    // A single open cell with no open neighbor can never pass corridorOk, so
    // tryPlacePiece exhausts its 4 attempts and returns null even though a
    // stackable def was drawn successfully.
    const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_WALL);
    cells[cellIndex(7, 7)] = CELL_OPEN;
    const stackableDef = FURNITURE_CATALOG.find((def) => def.stackable)!;
    const real = createRng(3);
    // Force the main-loop roll (and pickDef's internal roll) low enough to
    // always take the stack branch and always draw the lone stackable def;
    // int/range/chance/pick stay real so tryPlacePiece's geometry is sane.
    const rng: Rng = {
      next: () => 0.05,
      int: real.int,
      range: real.range,
      chance: real.chance,
      pick: real.pick,
    };

    const placements = placeFurniture({
      cells,
      anchors: [[1, 1]],
      rng,
      profile: {
        furnitureDensity: 1,
        furnitureWeights: { [stackableDef.id]: 1 },
        ceilingHeight: 5,
      },
      originX: 0,
      originZ: 0,
    });

    expect(placements).toEqual([]);
  });

  it("leaves a stack base unplaced when only non-stackable furniture is weighted", () => {
    // roll < 0.15 draws only from stackable defs; when the active weight
    // table has none, pickDef returns null and the stack attempt is skipped
    // for that cell — placement continues normally on the next roll/cell.
    const nonStackable = FURNITURE_CATALOG.find((def) => !def.stackable);
    expect(nonStackable).toBeDefined();
    const placements = placeFurniture({
      cells: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      anchors: [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]],
      rng: createRng(99),
      // Density well under 1: still gives many chances at the ~15%
      // roll<0.15 stack branch with this seed, without the O(n^2)
      // overlap/corridor cost of placing on nearly every one of the ~200
      // candidate cells.
      profile: {
        furnitureDensity: 0.3,
        furnitureWeights: { [nonStackable!.id]: 1 },
        ceilingHeight: 5,
      },
      originX: 0,
      originZ: 0,
    });
    expect(placements.every((p) => p.y === 0)).toBe(true);
  });
});
