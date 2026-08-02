import { CELL_SIZE, CHUNK_SIZE, PILLAR_SCALE, PLAYER_RADIUS } from "@/config/constants";
import { CELL_OPEN, CELL_PILLAR, CELL_WALL, cellIndex } from "../generation/cells";
import type { LevelProfile } from "../generation/levelProfile";
import type { Rng } from "../generation/rng";
import { FURNITURE_CATALOG, type FurnitureDef } from "./catalog";

/**
 * One placed furniture piece. Purely static scenery: it has no interaction
 * surface anywhere in the engine, so it can never be grabbed or moved.
 * min/max bounds are the world-space collision AABB (yaw-expanded footprint);
 * stacked pieces (y > 0) always fit inside their base's footprint, so only
 * ground pieces contribute colliders.
 */
export interface FurniturePlacement {
  defId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlaceFurnitureArgs {
  cells: Uint8Array;
  /** Border-contract gateway cells + chunk center — stay clear and connected. */
  anchors: readonly [number, number][];
  rng: Rng;
  profile: Pick<LevelProfile, "furnitureDensity" | "furnitureWeights" | "ceilingHeight">;
  originX: number;
  originZ: number;
}

/** Minimum walkable corridor a piece must leave to an open neighbor cell. */
const CLEARANCE = PLAYER_RADIUS * 2 + 0.3;
/** Pieces never touch cell edges — keeps them out of neighboring chunks too. */
const EDGE_INSET = 0.1;
/** Minimum air gap between separate pieces (cluster pieces sit this close). */
const PIECE_GAP = 0.05;
const YAW_JITTER = Math.PI / 18; // ±10°
const STACK_YAW_JITTER = Math.PI / 7.2; // ±25°
/** Walkability samples per cell axis for the connectivity safety net. */
const SUB = 4;
const PILLAR_HALF = (CELL_SIZE * PILLAR_SCALE) / 2;

interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const aabbsOverlap = (a: Aabb, b: Aabb, gap = 0): boolean =>
  a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minZ - gap < b.maxZ && a.maxZ + gap > b.minZ;

/** Half-extents of a piece's world AABB after rotating its footprint by yaw. */
const yawExpandedHalf = (def: FurnitureDef, yaw: number): { ex: number; ez: number } => {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  return { ex: c * def.halfX + s * def.halfZ, ez: s * def.halfX + c * def.halfZ };
};

/** Weighted pick over the catalog; returns null when nothing is eligible. */
const pickDef = (
  rng: Rng,
  weights: Record<string, number>,
  eligible: (def: FurnitureDef) => boolean,
  boostAffinity: boolean,
): FurnitureDef | null => {
  let total = 0;
  const entries: [FurnitureDef, number][] = [];
  for (const def of FURNITURE_CATALOG) {
    const base = Math.max(0, weights[def.id] ?? 0);
    const weight = boostAffinity ? base * def.clusterAffinity : base;
    if (weight <= 0 || !eligible(def)) continue;
    entries.push([def, weight]);
    total += weight;
  }
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const [def, weight] of entries) {
    roll -= weight;
    if (roll < 0) return def;
  }
  return entries[entries.length - 1][0];
};

/**
 * Deterministic furniture placement for one chunk. Pieces appear solo, in
 * adjacent clusters, or piled on stackable bases; every piece passes a fit
 * test (inside its open cell, no overlap, walkable corridor left) and every
 * committed group passes a sub-cell flood-fill so the chunk's connectivity
 * guarantee survives untouched.
 */
export function placeFurniture(args: PlaceFurnitureArgs): FurniturePlacement[] {
  const { cells, anchors, rng, profile, originX, originZ } = args;
  const density = profile.furnitureDensity;
  const weights = profile.furnitureWeights;
  const placements: FurniturePlacement[] = [];
  if (density <= 0) return placements;
  if (!FURNITURE_CATALOG.some((def) => (weights[def.id] ?? 0) > 0)) return placements;

  const anchorSet = new Set(anchors.map(([x, z]) => cellIndex(x, z)));
  const isCandidateCell = (x: number, z: number): boolean =>
    x >= 1 &&
    x <= CHUNK_SIZE - 2 &&
    z >= 1 &&
    z <= CHUNK_SIZE - 2 &&
    cells[cellIndex(x, z)] === CELL_OPEN &&
    !anchorSet.has(cellIndex(x, z));

  // Static walkability (walls + pillars) per sub-cell sample, computed once.
  const grid = CHUNK_SIZE * SUB;
  const step = CELL_SIZE / SUB;
  const staticWalkable = new Uint8Array(grid * grid);
  for (let gz = 0; gz < grid; gz++) {
    for (let gx = 0; gx < grid; gx++) {
      const cell = cells[cellIndex(Math.floor(gx / SUB), Math.floor(gz / SUB))];
      if (cell === CELL_WALL) continue;
      if (cell === CELL_PILLAR) {
        const centerX = (Math.floor(gx / SUB) + 0.5) * CELL_SIZE;
        const centerZ = (Math.floor(gz / SUB) + 0.5) * CELL_SIZE;
        const px = (gx + 0.5) * step;
        const pz = (gz + 0.5) * step;
        if (
          Math.abs(px - centerX) - PLAYER_RADIUS < PILLAR_HALF &&
          Math.abs(pz - centerZ) - PLAYER_RADIUS < PILLAR_HALF
        ) {
          continue;
        }
      }
      staticWalkable[gz * grid + gx] = 1;
    }
  }

  /** Player square at a sample center overlaps some furniture collider? */
  const furnitureBlocks = (gx: number, gz: number): boolean => {
    const sample: Aabb = {
      minX: (gx + 0.5) * step - PLAYER_RADIUS,
      maxX: (gx + 0.5) * step + PLAYER_RADIUS,
      minZ: (gz + 0.5) * step - PLAYER_RADIUS,
      maxZ: (gz + 0.5) * step + PLAYER_RADIUS,
    };
    for (const piece of placements) {
      if (piece.y > 0) continue;
      const local: Aabb = {
        minX: piece.minX - originX,
        maxX: piece.maxX - originX,
        minZ: piece.minZ - originZ,
        maxZ: piece.maxZ - originZ,
      };
      if (aabbsOverlap(sample, local)) return true;
    }
    return false;
  };

  /** Flood-fill safety net: all anchors still mutually reachable? */
  const anchorsConnected = (): boolean => {
    const visited = new Uint8Array(grid * grid);
    const stack: number[] = [];
    const [startX, startZ] = anchors[0];
    for (let sz = 0; sz < SUB; sz++) {
      for (let sx = 0; sx < SUB; sx++) {
        const gx = startX * SUB + sx;
        const gz = startZ * SUB + sz;
        if (staticWalkable[gz * grid + gx]) stack.push(gz * grid + gx);
      }
    }
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      if (visited[idx] || !staticWalkable[idx]) continue;
      const gx = idx % grid;
      const gz = (idx - gx) / grid;
      if (furnitureBlocks(gx, gz)) continue;
      visited[idx] = 1;
      if (gx > 0) stack.push(idx - 1);
      if (gx < grid - 1) stack.push(idx + 1);
      if (gz > 0) stack.push(idx - grid);
      if (gz < grid - 1) stack.push(idx + grid);
    }
    return anchors.every(([ax, az]) => {
      for (let sz = 0; sz < SUB; sz++) {
        for (let sx = 0; sx < SUB; sx++) {
          if (visited[(az * SUB + sz) * grid + ax * SUB + sx]) return true;
        }
      }
      return false;
    });
  };

  /** Existing ground colliders near a cell, in chunk-local coordinates. */
  const localColliders = (): Aabb[] =>
    placements
      .filter((piece) => piece.y === 0)
      .map((piece) => ({
        minX: piece.minX - originX,
        maxX: piece.maxX - originX,
        minZ: piece.minZ - originZ,
        maxZ: piece.maxZ - originZ,
      }));

  /** The piece must leave a clear corridor strip toward an open neighbor. */
  const corridorOk = (cellX: number, cellZ: number, aabb: Aabb, others: Aabb[]): boolean => {
    const x0 = cellX * CELL_SIZE;
    const z0 = cellZ * CELL_SIZE;
    const sides: [number, number, Aabb][] = [
      [-1, 0, { minX: x0, maxX: x0 + CLEARANCE, minZ: z0, maxZ: z0 + CELL_SIZE }],
      [
        1,
        0,
        { minX: x0 + CELL_SIZE - CLEARANCE, maxX: x0 + CELL_SIZE, minZ: z0, maxZ: z0 + CELL_SIZE },
      ],
      [0, -1, { minX: x0, maxX: x0 + CELL_SIZE, minZ: z0, maxZ: z0 + CLEARANCE }],
      [
        0,
        1,
        { minX: x0, maxX: x0 + CELL_SIZE, minZ: z0 + CELL_SIZE - CLEARANCE, maxZ: z0 + CELL_SIZE },
      ],
    ];
    return sides.some(([dx, dz, strip]) => {
      const nx = cellX + dx;
      const nz = cellZ + dz;
      // Every caller passes a cellX/cellZ from isCandidateCell's 1..CHUNK_SIZE-2
      // range, so a ±1 neighbor is always in [0, CHUNK_SIZE) — this guards a
      // narrower contract than the type allows, for any future caller.
      /* v8 ignore next */
      if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) return false;
      if (cells[cellIndex(nx, nz)] !== CELL_OPEN) return false;
      if (aabbsOverlap(strip, aabb)) return false;
      return others.every((other) => !aabbsOverlap(strip, other));
    });
  };

  /** Try to fit one piece inside an open cell; null if no attempt fits. */
  const tryPlacePiece = (
    def: FurnitureDef,
    cellX: number,
    cellZ: number,
  ): FurniturePlacement | null => {
    const others = localColliders();
    for (let attempt = 0; attempt < 4; attempt++) {
      const yaw = rng.int(0, 4) * (Math.PI / 2) + rng.range(-YAW_JITTER, YAW_JITTER);
      const { ex, ez } = yawExpandedHalf(def, yaw);
      const x0 = cellX * CELL_SIZE;
      const z0 = cellZ * CELL_SIZE;
      // No FURNITURE_CATALOG entry's footprint is close to CELL_SIZE today,
      // so this never trips — a guard against a future oversized piece.
      /* v8 ignore next */
      if (2 * ex > CELL_SIZE - 2 * EDGE_INSET || 2 * ez > CELL_SIZE - 2 * EDGE_INSET) return null;
      const x = rng.range(x0 + EDGE_INSET + ex, x0 + CELL_SIZE - EDGE_INSET - ex);
      const z = rng.range(z0 + EDGE_INSET + ez, z0 + CELL_SIZE - EDGE_INSET - ez);
      const aabb: Aabb = { minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez };
      if (others.some((other) => aabbsOverlap(aabb, other, PIECE_GAP))) continue;
      if (!corridorOk(cellX, cellZ, aabb, others)) continue;
      return {
        defId: def.id,
        x: originX + x,
        y: 0,
        z: originZ + z,
        yaw,
        minX: originX + aabb.minX,
        maxX: originX + aabb.maxX,
        minZ: originZ + aabb.minZ,
        maxZ: originZ + aabb.maxZ,
      };
    }
    return null;
  };

  /** Pile: pieces stacked on a stackable base, always inside its footprint. */
  const stackOn = (base: FurniturePlacement, baseDef: FurnitureDef): void => {
    let top = baseDef.height;
    const count = rng.int(1, 4);
    for (let i = 0; i < count; i++) {
      const yaw = rng.int(0, 4) * (Math.PI / 2) + rng.range(-STACK_YAW_JITTER, STACK_YAW_JITTER);
      const def = pickDef(
        rng,
        weights,
        (candidate) => {
          const { ex, ez } = yawExpandedHalf(candidate, yaw);
          return (
            ex <= (base.maxX - base.minX) / 2 - 0.02 &&
            ez <= (base.maxZ - base.minZ) / 2 - 0.02 &&
            top + candidate.height <= profile.ceilingHeight - 0.3
          );
        },
        true,
      );
      if (!def) return;
      const { ex, ez } = yawExpandedHalf(def, yaw);
      const slackX = (base.maxX - base.minX) / 2 - ex;
      const slackZ = (base.maxZ - base.minZ) / 2 - ez;
      const x = base.x + rng.range(-slackX, slackX);
      const z = base.z + rng.range(-slackZ, slackZ);
      placements.push({
        defId: def.id,
        x,
        y: top,
        z,
        yaw,
        minX: x - ex,
        maxX: x + ex,
        minZ: z - ez,
        maxZ: z + ez,
      });
      top += def.height;
    }
  };

  /** Cluster: a base piece plus neighbors dropped nearby (same/adjacent cell). */
  const placeCluster = (cellX: number, cellZ: number): void => {
    const baseDef = pickDef(rng, weights, () => true, false);
    // Unreachable: placeFurniture's entry guard already proved some catalog
    // def has positive weight, and this draw uses that same unrestricted,
    // unboosted weight table — pickDef can't return null here.
    /* v8 ignore next */
    if (!baseDef) return;
    const base = tryPlacePiece(baseDef, cellX, cellZ);
    if (!base) return;
    placements.push(base);
    const extra = rng.int(1, 4);
    for (let i = 0; i < extra; i++) {
      const def = pickDef(rng, weights, () => true, true);
      if (!def) return;
      const [dx, dz] = rng.pick<[number, number]>([
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
      const nx = cellX + dx;
      const nz = cellZ + dz;
      if (!(dx === 0 && dz === 0) && !isCandidateCell(nx, nz)) continue;
      const piece = tryPlacePiece(def, nx, nz);
      if (piece) placements.push(piece);
    }
  };

  for (let cellZ = 1; cellZ <= CHUNK_SIZE - 2; cellZ++) {
    for (let cellX = 1; cellX <= CHUNK_SIZE - 2; cellX++) {
      if (!isCandidateCell(cellX, cellZ)) continue;
      if (!rng.chance(density)) continue;

      const before = placements.length;
      const roll = rng.next();
      if (roll < 0.15) {
        const baseDef = pickDef(rng, weights, (def) => def.stackable, false);
        if (baseDef) {
          const base = tryPlacePiece(baseDef, cellX, cellZ);
          if (base) {
            placements.push(base);
            stackOn(base, baseDef);
          }
        }
      } else if (roll < 0.4) {
        placeCluster(cellX, cellZ);
      } else {
        const def = pickDef(rng, weights, () => true, false);
        // Unreachable: same unrestricted, unboosted draw as placeCluster's
        // base piece above — the entry guard already guarantees a hit.
        /* v8 ignore next */
        if (def) {
          const piece = tryPlacePiece(def, cellX, cellZ);
          if (piece) placements.push(piece);
        }
      }

      // Safety net: a group that pinches off any anchor is rolled back whole.
      if (placements.length > before && !anchorsConnected()) {
        placements.length = before;
      }
    }
  }

  return placements;
}
