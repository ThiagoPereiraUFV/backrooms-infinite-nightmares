import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";

/**
 * One merged geometry + one fixed material per entity silhouette for the
 * whole game — same cached-merged-box pattern as furniture/features, never
 * disposed. Deliberately **not** level-tinted (PLAN-4 §9.3): a level's
 * flavor comes from *which* entities its spawn table lists, not from
 * reskinning one entity per level, which would multiply meshes/materials for
 * a difference nobody sees through fog.
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

const BUILDERS: Record<string, (parts: THREE.BufferGeometry[]) => void> = {
  // The original generic hostile silhouette, unchanged.
  wanderer: (parts) => box(parts, 0.5, 1.8, 0.3, 0, 0, 0),
  hound: (parts) => {
    box(parts, 0.5, 0.55, 1.1, 0, 0, 0);
    box(parts, 0.3, 0.35, 0.3, 0, 0.4, 0.55);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(parts, 0.14, 0.5, 0.14, sx * 0.18, 0, sz * 0.45);
      }
    }
  },
  deathmoth: (parts) => {
    box(parts, 0.2, 0.2, 0.35, 0, 0.6, 0);
    for (const sx of [-1, 1]) {
      box(parts, 0.45, 0.03, 0.3, sx * 0.35, 0.68, 0);
    }
  },
  skinStealer: (parts) => {
    box(parts, 0.5, 1.9, 0.35, 0, 0, 0);
    box(parts, 0.3, 0.3, 0.3, 0, 1.9, 0);
  },
  smiler: (parts) => {
    box(parts, 0.45, 1.7, 0.3, 0, 0, 0);
    box(parts, 0.34, 0.3, 0.3, 0, 1.7, 0);
    box(parts, 0.28, 0.05, 0.08, 0, 1.78, 0.13); // a too-wide grin
  },
  aquaticThing: (parts) => {
    box(parts, 0.9, 0.7, 1.6, 0, 0, 0);
    box(parts, 0.3, 0.3, 0.6, 0, 0.15, -1.0);
  },
  caveDweller: (parts) => {
    box(parts, 0.4, 0.3, 0.6, 0, 0.3, 0);
    for (const sx of [-1, 1]) {
      box(parts, 0.5, 0.04, 0.3, sx * 0.35, 0.42, 0);
    }
  },
};

const MATERIALS: Record<string, THREE.Material> = {
  wanderer: new THREE.MeshStandardMaterial({
    color: "#150606",
    emissive: "#8a1414",
    emissiveIntensity: 0.8,
    roughness: 1,
  }),
  hound: new THREE.MeshStandardMaterial({
    color: "#1a1410",
    emissive: "#7a3a10",
    emissiveIntensity: 0.6,
    roughness: 1,
  }),
  deathmoth: new THREE.MeshStandardMaterial({
    color: "#2a2420",
    emissive: "#d8c890",
    emissiveIntensity: 0.5,
    roughness: 1,
  }),
  skinStealer: new THREE.MeshStandardMaterial({
    color: "#3a2a24",
    emissive: "#5a1414",
    emissiveIntensity: 0.4,
    roughness: 1,
  }),
  smiler: new THREE.MeshStandardMaterial({
    color: "#201818",
    emissive: "#e8e0c8",
    emissiveIntensity: 0.5,
    roughness: 1,
  }),
  aquaticThing: new THREE.MeshStandardMaterial({
    color: "#0e2a28",
    emissive: "#3fa89c",
    emissiveIntensity: 0.5,
    roughness: 1,
  }),
  caveDweller: new THREE.MeshStandardMaterial({
    color: "#241e18",
    emissive: "#8a6a3a",
    emissiveIntensity: 0.45,
    roughness: 1,
  }),
};

/** Every distinct silhouette the game renders — one fixed `InstancedMesh` per id (EntitiesField). */
export const ENTITY_APPEARANCE_IDS: readonly string[] = Object.keys(MATERIALS);

const geometryCache = new Map<string, THREE.BufferGeometry>();

export function entityGeometry(appearanceId: string): THREE.BufferGeometry {
  const cached = geometryCache.get(appearanceId);
  if (cached) return cached;
  const builder = BUILDERS[appearanceId];
  if (!builder) throw new Error(`entityGeometry: unknown appearance id "${appearanceId}"`);
  const parts: THREE.BufferGeometry[] = [];
  builder(parts);
  const merged = mergeBufferGeometries(parts);
  if (!merged) throw new Error(`entityGeometry: merge failed for "${appearanceId}"`);
  for (const part of parts) part.dispose();
  geometryCache.set(appearanceId, merged);
  return merged;
}

export function entityMaterial(appearanceId: string): THREE.Material {
  return MATERIALS[appearanceId] ?? MATERIALS.wanderer;
}

/** Every appearance id used by the catalog has a builder — checked once at module init in dev. */
if (process.env.NODE_ENV !== "production") {
  for (const id of Object.keys(MATERIALS)) {
    if (!BUILDERS[id]) throw new Error(`Missing entity geometry builder: "${id}"`);
  }
}
