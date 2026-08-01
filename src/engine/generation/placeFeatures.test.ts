import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "@/config/constants";
import { CELL_OPEN, CELL_WALL, cellIndex } from "./cells";
import { createRng } from "./rng";
import { placeFeatures, type FeatureKind } from "./placeFeatures";
import type { LevelFeatureRates } from "./levelProfile";

const ZERO_RATES: LevelFeatureRates = {
  doorway: 0,
  wallBreach: 0,
  ceilingOpening: 0,
  ceilingRun: 0,
};

/** An all-open grid, cheap for the "everything is eligible" cases below. */
const openGrid = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_OPEN);

const withRate = (kind: keyof LevelFeatureRates, value: number): LevelFeatureRates => ({
  ...ZERO_RATES,
  [kind]: value,
});

const countKind = (features: readonly { kind: FeatureKind }[], kind: FeatureKind): number =>
  features.filter((f) => f.kind === kind).length;

describe("placeFeatures", () => {
  it("detects a threshold cell (walls on ±X, open on ±Z) as a doorway", () => {
    const cells = openGrid();
    const x = 5;
    const z = 5;
    cells[cellIndex(x - 1, z)] = CELL_WALL;
    cells[cellIndex(x + 1, z)] = CELL_WALL;

    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(1),
      rates: withRate("doorway", 1),
      lights: [],
    });
    const doorway = features.find((f) => f.kind === "doorway" && f.cellX === x && f.cellZ === z);
    expect(doorway).toBeDefined();
    expect(doorway?.axis).toBe(0);
  });

  it("does not detect a 4-way-open cell as a doorway", () => {
    const cells = openGrid();
    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(1),
      rates: withRate("doorway", 1),
      lights: [],
    });
    expect(countKind(features, "doorway")).toBe(0);
  });

  it("gives the doorway the Z axis when walls are ±Z and open ±X", () => {
    const cells = openGrid();
    const x = 6;
    const z = 6;
    cells[cellIndex(x, z - 1)] = CELL_WALL;
    cells[cellIndex(x, z + 1)] = CELL_WALL;

    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(2),
      rates: withRate("doorway", 1),
      lights: [],
    });
    const doorway = features.find((f) => f.kind === "doorway" && f.cellX === x && f.cellZ === z);
    expect(doorway?.axis).toBe(1);
  });

  it("marks a wall cell with an open neighbor as breach-eligible, and an interior wall cell as not", () => {
    const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_WALL);
    // A 3x3 open pocket in the middle, so its center wall neighbors are
    // breach-eligible while a wall cell far from the pocket is not.
    for (let z = 6; z <= 8; z++) {
      for (let x = 6; x <= 8; x++) {
        cells[cellIndex(x, z)] = CELL_OPEN;
      }
    }
    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(3),
      rates: withRate("wallBreach", 1),
      lights: [],
    });
    const edgeWall = features.find((f) => f.cellX === 5 && f.cellZ === 7);
    expect(edgeWall?.kind).toBe("wallBreach");
    const interiorWall = features.find((f) => f.cellX === 1 && f.cellZ === 1);
    expect(interiorWall).toBeUndefined();
  });

  it("produces zero features when every rate is 0", () => {
    const cells = openGrid();
    cells[cellIndex(4, 4)] = CELL_WALL;
    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(4),
      rates: ZERO_RATES,
      lights: [],
    });
    expect(features).toEqual([]);
  });

  it("produces one feature per eligible cell at rate 1", () => {
    const cells = openGrid();
    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(5),
      rates: withRate("ceilingOpening", 1),
      lights: [],
    });
    // Every open, non-anchor, unlit cell is eligible for a ceiling opening.
    const expectedEligible = CHUNK_SIZE * CHUNK_SIZE;
    expect(countKind(features, "ceilingOpening")).toBe(expectedEligible);
  });

  it("skips cells with a light fixture for ceilingOpening", () => {
    const cells = openGrid();
    const lit = cellIndex(3, 3);
    const features = placeFeatures({
      cells,
      anchors: [],
      rng: createRng(6),
      rates: withRate("ceilingOpening", 1),
      lights: [lit],
    });
    expect(features.some((f) => f.cellX === 3 && f.cellZ === 3)).toBe(false);
  });

  it("never places a feature on an anchor cell", () => {
    const cells = openGrid();
    cells[cellIndex(3, 3)] = CELL_WALL;
    cells[cellIndex(3, 5)] = CELL_WALL;
    const rates: LevelFeatureRates = {
      doorway: 1,
      wallBreach: 1,
      ceilingOpening: 1,
      ceilingRun: 1,
    };
    const anchors: [number, number][] = [
      [4, 4],
      [3, 3],
      [3, 5],
    ];
    const features = placeFeatures({ cells, anchors, rng: createRng(7), rates, lights: [] });
    for (const anchor of anchors) {
      expect(features.some((f) => f.cellX === anchor[0] && f.cellZ === anchor[1])).toBe(false);
    }
  });

  it("is deterministic across regeneration and differs across seeds", () => {
    const cells = openGrid();
    // Many isolated wall cells (each with an open neighbor) so the pass rolls
    // enough independent chances that two different seeds are astronomically
    // unlikely to coincidentally agree on all of them.
    for (let i = 2; i < CHUNK_SIZE - 2; i += 2) {
      cells[cellIndex(i, 1)] = CELL_WALL;
      cells[cellIndex(i, 3)] = CELL_WALL;
    }
    const rates = withRate("wallBreach", 0.5);
    const a = placeFeatures({ cells, anchors: [], rng: createRng(11), rates, lights: [] });
    const b = placeFeatures({ cells, anchors: [], rng: createRng(11), rates, lights: [] });
    expect(a).toEqual(b);
    const c = placeFeatures({ cells, anchors: [], rng: createRng(12), rates, lights: [] });
    expect(c).not.toEqual(a);
  });

  it("gives a ceiling run the correct axis for both orientations", () => {
    const cellsX = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_WALL);
    cellsX[cellIndex(5, 5)] = CELL_OPEN;
    cellsX[cellIndex(6, 5)] = CELL_OPEN;
    const featuresX = placeFeatures({
      cells: cellsX,
      anchors: [],
      rng: createRng(8),
      rates: withRate("ceilingRun", 1),
      lights: [],
    });
    const runX = featuresX.find((f) => f.kind === "ceilingRun" && f.cellX === 5 && f.cellZ === 5);
    expect(runX?.axis).toBe(0);

    const cellsZ = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(CELL_WALL);
    cellsZ[cellIndex(5, 5)] = CELL_OPEN;
    cellsZ[cellIndex(5, 6)] = CELL_OPEN;
    const featuresZ = placeFeatures({
      cells: cellsZ,
      anchors: [],
      rng: createRng(9),
      rates: withRate("ceilingRun", 1),
      lights: [],
    });
    const runZ = featuresZ.find((f) => f.kind === "ceilingRun" && f.cellX === 5 && f.cellZ === 5);
    expect(runZ?.axis).toBe(1);
  });

  it("does not mutate the input grid", () => {
    const cells = openGrid();
    cells[cellIndex(4, 4)] = CELL_WALL;
    const before = cells.slice();
    placeFeatures({
      cells,
      anchors: [],
      rng: createRng(10),
      rates: { doorway: 1, wallBreach: 1, ceilingOpening: 1, ceilingRun: 1 },
      lights: [],
    });
    expect(cells).toEqual(before);
  });
});
