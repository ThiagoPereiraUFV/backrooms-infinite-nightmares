import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import {
  FURNITURE_CATALOG,
  furnitureRegistry,
  type FurnitureDef,
} from "@/engine/furniture/catalog";

/**
 * One merged geometry per furniture type for the whole game (flyweight, like
 * the shared unit box/plane). Each is composed of translated boxes with its
 * base at y = 0 and always fits inside the catalog's collision footprint, so
 * what the player sees is exactly what blocks them. Never disposed per chunk.
 */

const box = (
  parts: THREE.BufferGeometry[],
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): void => {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y + height / 2, z);
  parts.push(geometry);
};

const BUILDERS: Record<string, (def: FurnitureDef, parts: THREE.BufferGeometry[]) => void> = {
  chair: ({ halfX, halfZ, height }, parts) => {
    const seatY = 0.42;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(parts, 0.06, seatY, 0.06, sx * (halfX - 0.05), 0, sz * (halfZ - 0.05));
      }
    }
    box(parts, halfX * 2, 0.07, halfZ * 2, 0, seatY, 0);
    box(parts, halfX * 2, height - seatY - 0.07, 0.07, 0, seatY + 0.07, -halfZ + 0.035);
  },
  table: ({ halfX, halfZ, height }, parts) => {
    const topThickness = 0.07;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(parts, 0.08, height - topThickness, 0.08, sx * (halfX - 0.07), 0, sz * (halfZ - 0.07));
      }
    }
    box(parts, halfX * 2, topThickness, halfZ * 2, 0, height - topThickness, 0);
  },
  couch: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, 0.35, halfZ * 2, 0, 0, 0);
    box(parts, halfX * 2, height - 0.35, 0.16, 0, 0.35, -halfZ + 0.08);
    for (const sx of [-1, 1]) {
      box(parts, 0.16, 0.25, halfZ * 2, sx * (halfX - 0.08), 0.35, 0);
    }
  },
  bed: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, 0.28, halfZ * 2, 0, 0, 0);
    box(parts, halfX * 2 - 0.1, 0.2, halfZ * 2 - 0.1, 0, 0.28, 0);
    box(parts, 0.08, height, halfZ * 2, -halfX + 0.04, 0, 0);
  },
  drawer: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height, halfZ * 2 - 0.06, 0, 0, -0.03);
    const faces = 3;
    for (let i = 0; i < faces; i++) {
      const faceHeight = (height - 0.16) / faces;
      box(parts, halfX * 2 - 0.12, faceHeight - 0.04, 0.04, 0, 0.08 + i * faceHeight, halfZ - 0.05);
    }
  },
  cabinet: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height, halfZ * 2, 0, 0, 0);
  },
  bookshelf: ({ halfX, halfZ, height }, parts) => {
    for (const sx of [-1, 1]) {
      box(parts, 0.05, height, halfZ * 2, sx * (halfX - 0.025), 0, 0);
    }
    box(parts, halfX * 2 - 0.1, height, 0.04, 0, 0, -halfZ + 0.02);
    const shelves = 5;
    for (let i = 0; i < shelves; i++) {
      const y = 0.05 + (i * (height - 0.15)) / (shelves - 1);
      box(parts, halfX * 2 - 0.1, 0.04, halfZ * 2 - 0.06, 0, y, 0.01);
    }
  },
  crate: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height - 0.05, halfZ * 2, 0, 0, 0);
    box(parts, halfX * 2 - 0.06, 0.05, halfZ * 2 - 0.06, 0, height - 0.05, 0);
  },
};

const cache = new Map<string, THREE.BufferGeometry>();

export function furnitureGeometry(defId: string): THREE.BufferGeometry {
  const cached = cache.get(defId);
  if (cached) return cached;
  const def = furnitureRegistry.get(defId);
  const builder = BUILDERS[defId];
  if (!def || !builder) {
    throw new Error(`furnitureGeometry: unknown furniture id "${defId}"`);
  }
  const parts: THREE.BufferGeometry[] = [];
  builder(def, parts);
  const merged = mergeBufferGeometries(parts);
  if (!merged) throw new Error(`furnitureGeometry: merge failed for "${defId}"`);
  for (const part of parts) part.dispose();
  cache.set(defId, merged);
  return merged;
}

/** Every catalog id has a builder — checked once at module init in dev. */
if (process.env.NODE_ENV !== "production") {
  for (const def of FURNITURE_CATALOG) {
    if (!BUILDERS[def.id]) throw new Error(`Missing furniture geometry builder: "${def.id}"`);
  }
}
