import { describe, expect, it } from "vitest";
import { CELL_SIZE, CHUNK_SIZE } from "@/config/constants";
import type { FurniturePlacement } from "../furniture/placeFurniture";
import { placeSpawns } from "./placeSpawns";
import { createRng, type Rng } from "./rng";

const openCells = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE); // all CELL_OPEN

const baseArgs = (overrides: Partial<Parameters<typeof placeSpawns>[0]> = {}) => ({
  cells: openCells(),
  anchors: [[CHUNK_SIZE >> 1, CHUNK_SIZE >> 1]] as [number, number][],
  furniture: [] as readonly FurniturePlacement[],
  rng: createRng(1),
  spawnTable: [{ id: "bandage", weight: 1 }],
  density: 1,
  originX: 0,
  originZ: 0,
  ...overrides,
});

describe("placeSpawns", () => {
  it("places nothing when density is zero or negative", () => {
    expect(placeSpawns(baseArgs({ density: 0 }))).toEqual([]);
    expect(placeSpawns(baseArgs({ density: -1 }))).toEqual([]);
  });

  it("places nothing when the spawn table's total weight is zero or negative", () => {
    expect(placeSpawns(baseArgs({ spawnTable: [] }))).toEqual([]);
    expect(placeSpawns(baseArgs({ spawnTable: [{ id: "bandage", weight: 0 }] }))).toEqual([]);
    expect(
      placeSpawns(
        baseArgs({
          spawnTable: [
            { id: "a", weight: -1 },
            { id: "b", weight: -2 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("never places on an anchor cell or a furniture-occupied cell", () => {
    const anchors: [number, number][] = [[8, 8]];
    // Furniture AABB centered exactly on cell (5,5)'s center.
    const cellCenter = (i: number) => (i + 0.5) * CELL_SIZE;
    const furniture: FurniturePlacement[] = [
      {
        defId: "chair",
        x: cellCenter(5),
        y: 0,
        z: cellCenter(5),
        yaw: 0,
        minX: cellCenter(5) - CELL_SIZE,
        maxX: cellCenter(5) + CELL_SIZE,
        minZ: cellCenter(5) - CELL_SIZE,
        maxZ: cellCenter(5) + CELL_SIZE,
      },
    ];
    const spawns = placeSpawns(baseArgs({ anchors, furniture }));
    expect(spawns.some((s) => s.cellX === 8 && s.cellZ === 8)).toBe(false);
    expect(spawns.some((s) => s.cellX === 5 && s.cellZ === 5)).toBe(false);
    expect(spawns.length).toBeGreaterThan(0);
  });

  it("only ever spawns registered ids from the table, weighted", () => {
    const spawns = placeSpawns(
      baseArgs({
        spawnTable: [
          { id: "a", weight: 1 },
          { id: "b", weight: 1 },
        ],
      }),
    );
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.every((s) => s.id === "a" || s.id === "b")).toBe(true);
  });

  it("falls back to the last table entry when pick()'s roll never dips below zero", () => {
    // Same exact-arithmetic edge case as rng.ts's pickWeighted and
    // placeFurniture's pickDef: next() === 1 lands the roll exactly on the
    // summed total, so subtracting each weight in turn reaches exactly 0.
    const real = createRng(1);
    const rng: Rng = {
      next: () => 1,
      int: real.int,
      range: real.range,
      chance: real.chance,
      pick: real.pick,
    };
    const spawns = placeSpawns(
      baseArgs({
        rng,
        spawnTable: [
          { id: "a", weight: 1 },
          { id: "b", weight: 1 },
        ],
      }),
    );
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns.every((s) => s.id === "b")).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const a = placeSpawns(baseArgs({ rng: createRng(42) }));
    const b = placeSpawns(baseArgs({ rng: createRng(42) }));
    expect(a).toEqual(b);
  });
});
