import { CHUNK_SIZE } from "@/config/constants";
import type { GeometryStyle, LevelProfile } from "./levelProfile";
import { createRng, hashInts, pickWeighted, type Rng } from "./rng";

export const CELL_OPEN = 0;
export const CELL_WALL = 1;
export const CELL_PILLAR = 2;

export type Cell = typeof CELL_OPEN | typeof CELL_WALL | typeof CELL_PILLAR;

/** Phase 2: a spawned world object (item/entity) anchored to a cell. */
export interface ChunkSpawn {
  id: string;
  cellX: number;
  cellZ: number;
}

export interface ChunkData {
  cx: number;
  cz: number;
  /** CHUNK_SIZE * CHUNK_SIZE cells, row-major (index = z * CHUNK_SIZE + x). */
  cells: Uint8Array;
  /** Cell indices that carry a ceiling light fixture. */
  lights: number[];
  /** Phase 2: objects spawned in this chunk. Empty in MVP. */
  spawns: ChunkSpawn[];
}

export const cellIndex = (x: number, z: number): number => z * CHUNK_SIZE + x;

const isSolid = (cells: Uint8Array, x: number, z: number): boolean =>
  cells[cellIndex(x, z)] !== CELL_OPEN;

/**
 * Border contract: gateway rows for the shared edge between two chunks are
 * derived from a hash of the *edge's* absolute coordinates, so both neighbors
 * compute identical gateways without ever seeing each other. This is what
 * makes generation seamless and infinitely extensible.
 *
 * Vertical edges (between cx-1|cx at line x = cx) use orientation 0 and are
 * keyed by (cx, cz); horizontal edges (between cz-1|cz) use orientation 1.
 */
export function edgeGateways(
  worldSeed: number,
  orientation: 0 | 1,
  edgeA: number,
  edgeB: number,
): number[] {
  const rng = createRng(hashInts(worldSeed, 0xed6e, orientation, edgeA, edgeB));
  const count = rng.int(2, 4);
  const rows = new Set<number>();
  while (rows.size < count) {
    rows.add(rng.int(1, CHUNK_SIZE - 1));
  }
  return [...rows].sort((a, b) => a - b);
}

const fillPillarField = (cells: Uint8Array, rng: Rng): void => {
  const spacing = rng.int(3, 5);
  const offsetX = rng.int(0, spacing);
  const offsetZ = rng.int(0, spacing);
  for (let z = 1; z < CHUNK_SIZE - 1; z++) {
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      if ((x + offsetX) % spacing === 0 && (z + offsetZ) % spacing === 0 && !rng.chance(0.2)) {
        cells[cellIndex(x, z)] = CELL_PILLAR;
      }
    }
  }
};

const fillMaze = (cells: Uint8Array, rng: Rng, density: number): void => {
  // Recursive-division flavored: wall lines with door gaps, scaled by density.
  const lines = 2 + Math.round(density * 5);
  for (let i = 0; i < lines; i++) {
    const horizontal = rng.chance(0.5);
    const at = rng.int(2, CHUNK_SIZE - 2);
    const doorA = rng.int(1, CHUNK_SIZE - 1);
    const doorB = rng.int(1, CHUNK_SIZE - 1);
    for (let t = 1; t < CHUNK_SIZE - 1; t++) {
      if (t === doorA || t === doorB) continue;
      const idx = horizontal ? cellIndex(t, at) : cellIndex(at, t);
      cells[idx] = CELL_WALL;
    }
  }
};

const fillRooms = (cells: Uint8Array, rng: Rng, density: number): void => {
  const roomCount = 2 + Math.round(density * 4);
  for (let i = 0; i < roomCount; i++) {
    const w = rng.int(3, 7);
    const h = rng.int(3, 7);
    const x0 = rng.int(1, CHUNK_SIZE - 1 - w);
    const z0 = rng.int(1, CHUNK_SIZE - 1 - h);
    for (let z = z0; z < z0 + h; z++) {
      for (let x = x0; x < x0 + w; x++) {
        const onBorder = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + h - 1;
        if (onBorder) cells[cellIndex(x, z)] = CELL_WALL;
      }
    }
    // One or two doors per room, on random sides.
    const doors = rng.int(1, 3);
    for (let d = 0; d < doors; d++) {
      const side = rng.int(0, 4);
      const doorX = side < 2 ? x0 + rng.int(1, Math.max(2, w - 1)) : side === 2 ? x0 : x0 + w - 1;
      const doorZ = side >= 2 ? z0 + rng.int(1, Math.max(2, h - 1)) : side === 0 ? z0 : z0 + h - 1;
      cells[cellIndex(doorX, doorZ)] = CELL_OPEN;
    }
  }
};

const fillHalls = (cells: Uint8Array, rng: Rng, density: number): void => {
  // Long parallel walls forming corridors, with occasional gaps.
  const horizontal = rng.chance(0.5);
  const gapChance = 0.12 + (1 - density) * 0.2;
  const corridorWidth = rng.int(2, 4);
  for (let line = 1; line < CHUNK_SIZE - 1; line += corridorWidth + 1) {
    for (let t = 0; t < CHUNK_SIZE; t++) {
      if (rng.chance(gapChance)) continue;
      const idx = horizontal ? cellIndex(t, line) : cellIndex(line, t);
      cells[idx] = CELL_WALL;
    }
  }
};

const STYLE_FILLERS: Record<GeometryStyle, (cells: Uint8Array, rng: Rng, density: number) => void> =
  {
    pillarField: (cells, rng) => fillPillarField(cells, rng),
    maze: fillMaze,
    rooms: fillRooms,
    halls: fillHalls,
  };

interface Gateways {
  west: number[];
  east: number[];
  north: number[];
  south: number[];
}

const computeGateways = (worldSeed: number, cx: number, cz: number): Gateways => ({
  west: edgeGateways(worldSeed, 0, cx, cz),
  east: edgeGateways(worldSeed, 0, cx + 1, cz),
  north: edgeGateways(worldSeed, 1, cx, cz),
  south: edgeGateways(worldSeed, 1, cx, cz + 1),
});

/** Cells that the border contract forces open (edge cell + one inward). */
const gatewayCells = (gateways: Gateways): [number, number][] => {
  const cells: [number, number][] = [];
  const last = CHUNK_SIZE - 1;
  for (const row of gateways.west) cells.push([0, row], [1, row]);
  for (const row of gateways.east) cells.push([last, row], [last - 1, row]);
  for (const col of gateways.north) cells.push([col, 0], [col, 1]);
  for (const col of gateways.south) cells.push([col, last], [col, last - 1]);
  return cells;
};

/**
 * Flood-fills from the first anchor and, for every anchor left disconnected,
 * carves an L-shaped path toward the first anchor until the path touches the
 * connected region — guaranteeing all anchors are mutually reachable.
 */
const ensureConnectivity = (cells: Uint8Array, anchors: [number, number][]): void => {
  const region = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const stack: number[] = [];

  const flood = (startX: number, startZ: number): void => {
    stack.push(cellIndex(startX, startZ));
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      if (region[idx] || cells[idx] !== CELL_OPEN) continue;
      region[idx] = 1;
      const x = idx % CHUNK_SIZE;
      const z = (idx - x) / CHUNK_SIZE;
      if (x > 0) stack.push(idx - 1);
      if (x < CHUNK_SIZE - 1) stack.push(idx + 1);
      if (z > 0) stack.push(idx - CHUNK_SIZE);
      if (z < CHUNK_SIZE - 1) stack.push(idx + CHUNK_SIZE);
    }
  };

  const [targetX, targetZ] = anchors[0];
  cells[cellIndex(targetX, targetZ)] = CELL_OPEN;
  flood(targetX, targetZ);

  for (const [ax, az] of anchors.slice(1)) {
    cells[cellIndex(ax, az)] = CELL_OPEN;
    if (region[cellIndex(ax, az)]) continue;
    // Carve toward the first anchor; it is in the region, so the walk
    // always terminates on a region cell at the latest when it arrives.
    let x = ax;
    let z = az;
    while (!region[cellIndex(x, z)]) {
      cells[cellIndex(x, z)] = CELL_OPEN;
      if (x !== targetX) x += x < targetX ? 1 : -1;
      else if (z !== targetZ) z += z < targetZ ? 1 : -1;
    }
    flood(ax, az);
  }
};

/**
 * Deterministically generates one chunk. Chunk seed = hash(worldSeed, cx, cz);
 * the border contract (edgeGateways) guarantees seamless neighbors.
 */
export function generateChunk(
  worldSeed: number,
  cx: number,
  cz: number,
  profile: LevelProfile,
): ChunkData {
  const rng = createRng(hashInts(worldSeed, cx, cz));
  const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  const style = pickWeighted(rng, profile.styleWeights);
  STYLE_FILLERS[style](cells, rng, profile.wallDensity);

  // Sparse extra wall stubs so open styles still read as "rooms beyond rooms".
  const stubCount = Math.round(profile.wallDensity * 6);
  for (let i = 0; i < stubCount; i++) {
    const x = rng.int(2, CHUNK_SIZE - 2);
    const z = rng.int(2, CHUNK_SIZE - 2);
    const len = rng.int(2, 6);
    const horizontal = rng.chance(0.5);
    for (let t = 0; t < len; t++) {
      const wx = horizontal ? Math.min(CHUNK_SIZE - 2, x + t) : x;
      const wz = horizontal ? z : Math.min(CHUNK_SIZE - 2, z + t);
      cells[cellIndex(wx, wz)] = CELL_WALL;
    }
  }

  const gateways = computeGateways(worldSeed, cx, cz);
  const anchors = gatewayCells(gateways);
  for (const [gx, gz] of anchors) cells[cellIndex(gx, gz)] = CELL_OPEN;

  const center = CHUNK_SIZE >> 1;
  anchors.push([center, center]);
  ensureConnectivity(cells, anchors);

  // Ceiling lights on a spacing grid over open cells.
  const lights: number[] = [];
  const spacing = profile.lightSpacing;
  for (let z = 1; z < CHUNK_SIZE; z += spacing) {
    for (let x = 1; x < CHUNK_SIZE; x += spacing) {
      if (!isSolid(cells, x, z)) lights.push(cellIndex(x, z));
    }
  }

  return { cx, cz, cells, lights, spawns: [] };
}
