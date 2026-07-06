import { describe, expect, it } from "vitest";
import { CELL_SIZE } from "@/config/constants";
import { resolveMovement, type SolidWorld } from "./collision";

const RADIUS = 0.45;

/** World with a single solid cell at cell coordinates (1, 0). */
const oneWall: SolidWorld = {
  isSolidAt: (x, z) => Math.floor(x / CELL_SIZE) === 1 && Math.floor(z / CELL_SIZE) === 0,
};

const emptyWorld: SolidWorld = { isSolidAt: () => false };

describe("resolveMovement", () => {
  it("moves freely in open space", () => {
    const result = resolveMovement(emptyWorld, 1, 1, 0.5, -0.25, RADIUS);
    expect(result.x).toBeCloseTo(1.5);
    expect(result.z).toBeCloseTo(0.75);
  });

  it("blocks movement into a wall and clamps flush against it", () => {
    // Start left of the wall cell (which spans x: 4..8, z: 0..4).
    const result = resolveMovement(oneWall, 2, 2, 5, 0, RADIUS);
    expect(result.x).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
    expect(result.x).toBeGreaterThan(2);
    expect(result.z).toBe(2);
  });

  it("slides along a wall when moving diagonally into it", () => {
    const result = resolveMovement(oneWall, 2, 2, 5, 1.5, RADIUS);
    expect(result.x).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
    expect(result.z).toBeCloseTo(3.5); // z movement unaffected
  });

  it("blocks from the other side too", () => {
    const result = resolveMovement(oneWall, 10, 2, -5, 0, RADIUS);
    expect(result.x).toBeGreaterThanOrEqual(2 * CELL_SIZE + RADIUS);
  });

  it("blocks on the z axis", () => {
    const wallSouth: SolidWorld = {
      isSolidAt: (x, z) => Math.floor(x / CELL_SIZE) === 0 && Math.floor(z / CELL_SIZE) === 1,
    };
    const result = resolveMovement(wallSouth, 2, 2, 0, 5, RADIUS);
    expect(result.z).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
    expect(result.x).toBe(2);
  });

  it("never tunnels through with repeated small steps", () => {
    let pos = { x: 2, z: 2 };
    for (let i = 0; i < 200; i++) {
      pos = resolveMovement(oneWall, pos.x, pos.z, 0.05, 0, RADIUS);
    }
    expect(pos.x).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
  });
});
