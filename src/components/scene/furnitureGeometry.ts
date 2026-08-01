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

/** Upright cylinder, base at y (local space), matching `box`'s calling shape. */
const cylinder = (
  parts: THREE.BufferGeometry[],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  x: number,
  y: number,
  z: number,
): void => {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 10);
  geometry.translate(x, y + height / 2, z);
  parts.push(geometry);
};

/** A pipe lying on its side, centered at (x, y, z), spanning `length` along the given axis. */
const horizontalPipe = (
  parts: THREE.BufferGeometry[],
  radius: number,
  length: number,
  x: number,
  y: number,
  z: number,
  axis: "x" | "z",
): void => {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  geometry.rotateZ(axis === "x" ? Math.PI / 2 : 0);
  geometry.rotateX(axis === "z" ? Math.PI / 2 : 0);
  geometry.translate(x, y, z);
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
  barrel: ({ halfX, height }, parts) => {
    cylinder(parts, halfX * 0.95, halfX, height, 0, 0, 0);
    cylinder(parts, halfX * 0.4, halfX * 0.4, 0.03, 0, height * 0.55, 0);
  },
  pipeStack: ({ halfX, halfZ, height }, parts) => {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const y = (i + 0.5) * (height / count);
      horizontalPipe(parts, halfZ * 0.85, halfX * 2, 0, y, 0, "x");
    }
  },
  valveWheel: ({ halfX, height }, parts) => {
    cylinder(parts, halfX * 0.5, halfX * 0.55, height * 0.55, 0, 0, 0);
    horizontalPipe(parts, halfX * 0.08, halfX * 1.6, 0, height * 0.75, 0, "x");
    horizontalPipe(parts, halfX * 0.08, halfX * 1.6, 0, height * 0.75, 0, "z");
  },
  transformer: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height * 0.75, halfZ * 2, 0, 0, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        cylinder(
          parts,
          halfX * 0.12,
          halfX * 0.12,
          height * 0.25,
          sx * halfX * 0.6,
          height * 0.75,
          sz * halfZ * 0.6,
        );
      }
    }
  },
  electricalPanel: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height, halfZ * 2, 0, 0, 0);
    box(parts, halfX * 1.5, height * 0.5, 0.03, 0, height * 0.3, halfZ - 0.01);
  },
  vendingMachine: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height, halfZ * 2, 0, 0, 0);
    box(parts, halfX * 1.5, height * 0.55, 0.03, 0, height * 0.3, halfZ - 0.01);
    box(parts, halfX * 1.5, height * 0.15, 0.03, 0, height * 0.05, halfZ - 0.01);
  },
  waterCooler: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height * 0.6, halfZ * 2, 0, 0, 0);
    cylinder(parts, halfX * 0.85, halfX * 0.6, height * 0.4, 0, height * 0.6, 0);
  },
  luggageCart: ({ halfX, halfZ, height }, parts) => {
    box(parts, halfX * 2, height * 0.08, halfZ * 2, 0, 0, 0);
    for (const sx of [-1, 1]) {
      cylinder(parts, height * 0.08, height * 0.08, height * 0.16, sx * (halfX - 0.1), 0, 0);
    }
    box(parts, 0.05, height, 0.05, -halfX + 0.05, height * 0.08, -halfZ + 0.05);
    box(parts, 0.05, height, 0.05, -halfX + 0.05, height * 0.08, halfZ - 0.05);
    box(parts, halfX * 0.4, 0.05, halfZ * 2, -halfX + 0.1, height - 0.05, 0);
  },
  rubblePile: ({ halfX, halfZ, height }, parts) => {
    // An irregular heap: box fragments at varied scale/offset/yaw so it never
    // reads as a neat stack.
    const fragments: [number, number, number, number, number][] = [
      [0.6, 0.5, 0, 0, 0.15],
      [0.4, 0.35, 0.35, 0.1, 0.35],
      [0.35, 0.3, -0.3, -0.15, 0.55],
      [0.25, 0.25, -0.1, 0.3, 0.75],
    ];
    for (const [sx, sz, ox, oz, angle] of fragments) {
      const geometry = new THREE.BoxGeometry(halfX * sx, height * sz, halfZ * sx);
      geometry.rotateY(angle);
      geometry.translate(ox * halfX, (height * sz) / 2, oz * halfZ);
      parts.push(geometry);
    }
  },
  stalagmite: ({ halfX, halfZ, height }, parts) => {
    const geometry = new THREE.ConeGeometry(Math.max(halfX, halfZ) * 0.9, height, 7);
    geometry.translate(0, height / 2, 0);
    parts.push(geometry);
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
