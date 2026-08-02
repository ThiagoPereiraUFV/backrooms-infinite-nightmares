import { describe, expect, it } from "vitest";
import { CELL_SIZE, PILLAR_SCALE } from "@/config/constants";
import { resolveMovement, type ObstacleAabb, type ObstacleWorld } from "./collision";

const RADIUS = 0.45;

const worldOf = (...obstacles: ObstacleAabb[]): ObstacleWorld => ({
  obstaclesIn: (minX, maxX, minZ, maxZ) =>
    obstacles.filter(
      (obs) => obs.minX < maxX && obs.maxX > minX && obs.minZ < maxZ && obs.maxZ > minZ,
    ),
});

/** Full-cell wall AABB at cell coordinates (cx, cz). */
const wallCell = (cx: number, cz: number): ObstacleAabb => ({
  minX: cx * CELL_SIZE,
  maxX: (cx + 1) * CELL_SIZE,
  minZ: cz * CELL_SIZE,
  maxZ: (cz + 1) * CELL_SIZE,
});

/** Pillar AABB centered in cell (cx, cz) at the rendered footprint. */
const pillarCell = (cx: number, cz: number): ObstacleAabb => {
  const half = (CELL_SIZE * PILLAR_SCALE) / 2;
  const centerX = (cx + 0.5) * CELL_SIZE;
  const centerZ = (cz + 0.5) * CELL_SIZE;
  return {
    minX: centerX - half,
    maxX: centerX + half,
    minZ: centerZ - half,
    maxZ: centerZ + half,
  };
};

const overlaps = (obs: ObstacleAabb, x: number, z: number): boolean =>
  x - RADIUS < obs.maxX && x + RADIUS > obs.minX && z - RADIUS < obs.maxZ && z + RADIUS > obs.minZ;

const emptyWorld = worldOf();
/** World with a single solid wall cell at cell coordinates (1, 0). */
const oneWall = worldOf(wallCell(1, 0));

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
    const wallSouth = worldOf(wallCell(0, 1));
    const result = resolveMovement(wallSouth, 2, 2, 0, 5, RADIUS);
    expect(result.z).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
    expect(result.x).toBe(2);
  });

  it("moving in -z is unaffected by an obstacle that starts behind the player", () => {
    // Broad-phase-visible (its top edge is within the query rect) but its
    // minZ already sits south of the player, so it can never block a move
    // toward smaller z: the dz < 0 resolution branch's condition is false.
    const obstacleBehind: ObstacleAabb = { minX: 0, maxX: 4, minZ: 2.3, maxZ: 4 };
    const result = resolveMovement(worldOf(obstacleBehind), 2, 2, 0, -1, RADIUS);
    expect(result.z).toBeCloseTo(1);
  });

  it("never tunnels through a wall on the z axis with repeated small steps", () => {
    const wallSouth = worldOf(wallCell(0, 1));
    let pos = { x: 2, z: 2 };
    for (let i = 0; i < 200; i++) {
      pos = resolveMovement(wallSouth, pos.x, pos.z, 0, 0.05, RADIUS);
    }
    expect(pos.z).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
  });

  it("never tunnels through with repeated small steps", () => {
    let pos = { x: 2, z: 2 };
    for (let i = 0; i < 200; i++) {
      pos = resolveMovement(oneWall, pos.x, pos.z, 0.05, 0, RADIUS);
    }
    expect(pos.x).toBeLessThanOrEqual(CELL_SIZE - RADIUS);
  });

  it("stays put when already flush against a wall", () => {
    const flushX = CELL_SIZE - RADIUS - 1e-3;
    const result = resolveMovement(oneWall, flushX, 2, 0.5, 0, RADIUS);
    expect(result.x).toBe(flushX);
  });

  describe("pillars (sub-cell obstacles)", () => {
    // Pillar in cell (1, 0): centered at (6, 2), spanning 5.2..6.8 on both axes.
    const pillar = pillarCell(1, 0);
    const onePillar = worldOf(pillar);

    it("blocks at the visual pillar face, well inside the cell", () => {
      const result = resolveMovement(onePillar, 2, 2, 8, 0, RADIUS);
      expect(result.x).toBeCloseTo(pillar.minX - RADIUS, 2);
      // Regression for the invisible-wall bug: the player must get past the
      // cell edge (x=4) before stopping at the pillar itself.
      expect(result.x).toBeGreaterThan(CELL_SIZE);
    });

    it("walks through the open band between pillar and cell edge", () => {
      // z = 0.6 keeps the player square fully north of the pillar (minZ = 1.2).
      const result = resolveMovement(onePillar, 2, 0.6, 8, 0, RADIUS);
      expect(result.x).toBeCloseTo(10);
      expect(result.z).toBe(0.6);
    });

    it("blocks from the far side", () => {
      const result = resolveMovement(onePillar, 10, 2, -8, 0, RADIUS);
      expect(result.x).toBeCloseTo(pillar.maxX + RADIUS, 2);
    });

    it("blocks and slides on the z axis", () => {
      const result = resolveMovement(onePillar, 6, -2, 0.3, 8, RADIUS);
      expect(result.x).toBeCloseTo(6.3);
      expect(result.z).toBeCloseTo(pillar.minZ - RADIUS, 2);
    });

    it("blocks when approaching in -z", () => {
      const result = resolveMovement(onePillar, 6, 6, 0, -8, RADIUS);
      expect(result.z).toBeCloseTo(pillar.maxZ + RADIUS, 2);
    });

    it("resolves a diagonal approach into a pillar corner without overlap", () => {
      const result = resolveMovement(onePillar, 4.2, 0.4, 2, 2, RADIUS);
      expect(overlaps(pillar, result.x, result.z)).toBe(false);
    });

    it("never overlaps the pillar under repeated small steps from any side", () => {
      for (const [dx, dz, startX, startZ] of [
        [0.05, 0, 2, 2],
        [-0.05, 0, 10, 2],
        [0, 0.05, 6, -2],
        [0.035, 0.035, 3, -1],
      ]) {
        let pos = { x: startX, z: startZ };
        for (let i = 0; i < 300; i++) {
          pos = resolveMovement(onePillar, pos.x, pos.z, dx, dz, RADIUS);
          expect(overlaps(pillar, pos.x, pos.z)).toBe(false);
        }
      }
    });

    it("slides between two adjacent pillars when the gap is wide enough", () => {
      // Neighboring pillar cells leave a 2.4m gap between footprints — walkable.
      const world = worldOf(pillarCell(1, 0), pillarCell(2, 0));
      const result = resolveMovement(world, 8, -2, 0, 8, RADIUS);
      expect(result.z).toBeCloseTo(6);
    });
  });
});
