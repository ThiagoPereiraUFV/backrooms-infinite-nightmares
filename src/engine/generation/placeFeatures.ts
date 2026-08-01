import { CHUNK_SIZE } from "@/config/constants";
import { CELL_OPEN, CELL_WALL, cellIndex } from "./cells";
import type { LevelFeatureRates } from "./levelProfile";
import type { Rng } from "./rng";

export type FeatureKind = "doorway" | "wallBreach" | "ceilingOpening" | "ceilingRun";

export interface ChunkFeature {
  kind: FeatureKind;
  cellX: number;
  cellZ: number;
  /** 0 = the feature spans the X axis, 1 = the Z axis. */
  axis: 0 | 1;
}

export interface PlaceFeaturesArgs {
  /** Read-only — this pass never writes the grid. */
  cells: Uint8Array;
  /** Border-contract gateway cells + chunk center — kept clear, belt-and-braces. */
  anchors: readonly [number, number][];
  rng: Rng;
  rates: LevelFeatureRates;
  /** Cell indices that carry a ceiling light fixture (a lit cell is never a "missing tile"). */
  lights: readonly number[];
}

const inBounds = (x: number, z: number): boolean =>
  x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE;

const isOpen = (cells: Uint8Array, x: number, z: number): boolean =>
  inBounds(x, z) && cells[cellIndex(x, z)] === CELL_OPEN;

const isWall = (cells: Uint8Array, x: number, z: number): boolean =>
  inBounds(x, z) && cells[cellIndex(x, z)] === CELL_WALL;

/**
 * Detects a threshold: an open cell pinched by walls on one axis (X or Z)
 * with open space on the other axis — the shape of a doorway between two
 * rooms/corridors.
 */
const doorwayAxis = (cells: Uint8Array, x: number, z: number): 0 | 1 | null => {
  const wallsOnX = isWall(cells, x - 1, z) && isWall(cells, x + 1, z);
  const openOnZ = isOpen(cells, x, z - 1) && isOpen(cells, x, z + 1);
  if (wallsOnX && openOnZ) return 0;
  const wallsOnZ = isWall(cells, x, z - 1) && isWall(cells, x, z + 1);
  const openOnX = isOpen(cells, x - 1, z) && isOpen(cells, x + 1, z);
  if (wallsOnZ && openOnX) return 1;
  return null;
};

/**
 * Which axis an open neighbor sits on — shared by wall breaches (need an
 * open cell to face) and ceiling runs (need an open cell to span toward);
 * both eligibility checks are the same shape, just applied to different
 * cell types by the caller.
 */
const openNeighborAxis = (cells: Uint8Array, x: number, z: number): 0 | 1 | null => {
  if (isOpen(cells, x - 1, z) || isOpen(cells, x + 1, z)) return 0;
  if (isOpen(cells, x, z - 1) || isOpen(cells, x, z + 1)) return 1;
  return null;
};

/**
 * Read-only structural-feature detection over the *finished* grid: door
 * frames, wall breaches, ceiling openings and ceiling pipe/duct runs. This
 * pass never mutates `cells`, runs after `ensureConnectivity`, and emits no
 * colliders — see PLAN-4 §6.1/§6.2 for why that combination is what keeps it
 * structurally incapable of breaking the border contract or connectivity.
 */
export function placeFeatures(args: PlaceFeaturesArgs): ChunkFeature[] {
  const { cells, anchors, rng, rates, lights } = args;
  const features: ChunkFeature[] = [];
  const anchorSet = new Set(anchors.map(([x, z]) => cellIndex(x, z)));
  const litSet = new Set(lights);

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const idx = cellIndex(x, z);
      if (anchorSet.has(idx)) continue;
      const cell = cells[idx];

      if (cell === CELL_OPEN) {
        if (rates.doorway > 0) {
          const axis = doorwayAxis(cells, x, z);
          if (axis !== null && rng.chance(rates.doorway)) {
            features.push({ kind: "doorway", cellX: x, cellZ: z, axis });
          }
        }
        if (rates.ceilingOpening > 0 && !litSet.has(idx) && rng.chance(rates.ceilingOpening)) {
          features.push({ kind: "ceilingOpening", cellX: x, cellZ: z, axis: 0 });
        }
        if (rates.ceilingRun > 0) {
          const axis = openNeighborAxis(cells, x, z);
          if (axis !== null && rng.chance(rates.ceilingRun)) {
            features.push({ kind: "ceilingRun", cellX: x, cellZ: z, axis });
          }
        }
      } else if (cell === CELL_WALL && rates.wallBreach > 0) {
        const axis = openNeighborAxis(cells, x, z);
        if (axis !== null && rng.chance(rates.wallBreach)) {
          features.push({ kind: "wallBreach", cellX: x, cellZ: z, axis });
        }
      }
    }
  }

  return features;
}
