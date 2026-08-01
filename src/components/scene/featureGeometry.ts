import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { CELL_SIZE } from "@/config/constants";
import type { FeatureKind } from "@/engine/generation/placeFeatures";

/**
 * One merged geometry per structural-feature kind for the whole game — the
 * exact structural twin of furnitureGeometry.ts: module-level `Map` cache,
 * merged unit-box builders, never disposed. Every geometry is authored for
 * `axis === 0`; `ChunkMesh` rotates 90° for `axis === 1` via the instance
 * matrix, the same way furniture yaw is applied, so there is only one
 * geometry per kind rather than two.
 *
 * `ceilingOpening` and `ceilingRun` are built with y = 0 at the *ceiling*
 * (not the floor) because their world height depends on the level's
 * `ceilingHeight`, which this module-level cache cannot know — `ChunkMesh`
 * offsets them down from the ceiling plane at placement time, exactly like
 * the existing light-fixture plane.
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
  geometry.translate(x, y, z);
  parts.push(geometry);
};

const DOOR_HEIGHT = 2.15;
const JAMB_THICKNESS = 0.14;

/** Frame (two jambs + head) plus a leaf swung open flat against one jamb. */
const buildDoorway = (parts: THREE.BufferGeometry[]): void => {
  const halfCell = CELL_SIZE / 2;
  for (const side of [-1, 1]) {
    box(
      parts,
      JAMB_THICKNESS,
      DOOR_HEIGHT,
      0.6,
      side * (halfCell - JAMB_THICKNESS / 2),
      DOOR_HEIGHT / 2,
      0,
    );
  }
  box(parts, CELL_SIZE - JAMB_THICKNESS * 2, JAMB_THICKNESS, 0.6, 0, DOOR_HEIGHT, 0);
  // Leaf swung open ~100° against the +X jamb, reading as an opened door.
  box(
    parts,
    0.04,
    DOOR_HEIGHT - 0.1,
    0.85,
    halfCell - JAMB_THICKNESS - 0.42,
    (DOOR_HEIGHT - 0.1) / 2,
    0.42,
  );
};

/** Recessed dark panel with a couple of jittered broken-edge fragments. */
const buildWallBreach = (parts: THREE.BufferGeometry[]): void => {
  box(parts, CELL_SIZE * 0.5, CELL_SIZE * 0.5, 0.1, 0, CELL_SIZE * 0.35, 0);
  const fragment = new THREE.BoxGeometry(0.5, 0.4, 0.12);
  fragment.rotateZ(0.3);
  fragment.translate(CELL_SIZE * 0.18, CELL_SIZE * 0.2, 0);
  parts.push(fragment);
  const fragment2 = new THREE.BoxGeometry(0.35, 0.3, 0.1);
  fragment2.rotateZ(-0.25);
  fragment2.translate(-CELL_SIZE * 0.15, CELL_SIZE * 0.55, 0);
  parts.push(fragment2);
};

/**
 * A dark quad just under the ceiling plane with a thin frame — visually
 * indistinguishable from a missing tile from below, at the cost of one
 * instance instead of cut ceiling geometry (deliberate illusion, see PLAN-4
 * §6.3). y = 0 here means "at the ceiling"; ChunkMesh offsets it down.
 */
const buildCeilingOpening = (parts: THREE.BufferGeometry[]): void => {
  const size = CELL_SIZE * 0.55;
  const panel = new THREE.BoxGeometry(size, 0.04, size);
  panel.translate(0, 0, 0);
  parts.push(panel);
  const frame = new THREE.BoxGeometry(size + 0.1, 0.05, size + 0.1);
  frame.translate(0, 0.03, 0);
  parts.push(frame);
};

/** Pipe/duct run spanning the cell along the X axis, hung just under the ceiling. */
const buildCeilingRun = (parts: THREE.BufferGeometry[]): void => {
  for (const offsetZ of [-0.5, 0, 0.5]) {
    const geometry = new THREE.CylinderGeometry(0.09, 0.09, CELL_SIZE, 8);
    geometry.rotateZ(Math.PI / 2);
    geometry.translate(0, -0.1 - Math.abs(offsetZ) * 0.05, offsetZ);
    parts.push(geometry);
  }
};

const BUILDERS: Record<FeatureKind, (parts: THREE.BufferGeometry[]) => void> = {
  doorway: buildDoorway,
  wallBreach: buildWallBreach,
  ceilingOpening: buildCeilingOpening,
  ceilingRun: buildCeilingRun,
};

const cache = new Map<FeatureKind, THREE.BufferGeometry>();

export function featureGeometry(kind: FeatureKind): THREE.BufferGeometry {
  const cached = cache.get(kind);
  if (cached) return cached;
  const parts: THREE.BufferGeometry[] = [];
  BUILDERS[kind](parts);
  const merged = mergeBufferGeometries(parts);
  if (!merged) throw new Error(`featureGeometry: merge failed for "${kind}"`);
  for (const part of parts) part.dispose();
  cache.set(kind, merged);
  return merged;
}

/** Every FeatureKind has a builder — checked once at module init in dev. */
if (process.env.NODE_ENV !== "production") {
  const kinds: FeatureKind[] = ["doorway", "wallBreach", "ceilingOpening", "ceilingRun"];
  for (const kind of kinds) {
    if (!BUILDERS[kind]) throw new Error(`Missing feature geometry builder: "${kind}"`);
  }
}
