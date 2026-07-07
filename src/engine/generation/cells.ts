import { CHUNK_SIZE } from "@/config/constants";

export const CELL_OPEN = 0;
export const CELL_WALL = 1;
export const CELL_PILLAR = 2;

export type Cell = typeof CELL_OPEN | typeof CELL_WALL | typeof CELL_PILLAR;

export const cellIndex = (x: number, z: number): number => z * CHUNK_SIZE + x;
