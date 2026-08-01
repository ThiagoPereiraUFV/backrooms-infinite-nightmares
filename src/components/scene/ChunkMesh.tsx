"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL_SIZE, CHUNK_SIZE, CHUNK_WORLD_SIZE, PILLAR_SCALE } from "@/config/constants";
import { furnitureRegistry } from "@/engine/furniture/catalog";
import {
  CELL_PILLAR,
  CELL_WALL,
  type ChunkData,
  type FeatureKind,
} from "@/engine/generation/chunk";
import type { LevelProfile, LightingMode } from "@/engine/generation/levelProfile";
import { hashInts } from "@/engine/generation/rng";
import { flickerFactor } from "@/engine/lighting/flicker";
import { featureGeometry } from "./featureGeometry";
import { furnitureGeometry } from "./furnitureGeometry";
import type { LevelMaterials } from "./levelMaterials";

// Shared unit geometries (flyweight) — instances scale them per use, so the
// whole infinite world costs a handful of geometries total. Never disposed
// per chunk.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const LIGHT_PLANE = new THREE.PlaneGeometry(CELL_SIZE * 0.55, CELL_SIZE * 0.3);
const CAGED_FIXTURE = new THREE.BoxGeometry(CELL_SIZE * 0.22, CELL_SIZE * 0.16, CELL_SIZE * 0.22);
const EMERGENCY_FIXTURE = new THREE.ConeGeometry(CELL_SIZE * 0.09, CELL_SIZE * 0.12, 8);

/**
 * Fixture shape per lighting mode — a plain lookup table (four inert data
 * rows), not a class hierarchy: one consumer, no behavior, so a strategy
 * object here would be pattern theater (PLAN-4 §7.4/D2). `none` is never
 * actually rendered (chunk.lights is always empty for it) but needs an entry
 * for the `Record`'s exhaustiveness.
 */
const FIXTURE_SHAPES: Record<
  LightingMode,
  { geometry: THREE.BufferGeometry; offsetY: number; rotX: number }
> = {
  fluorescentPanels: { geometry: LIGHT_PLANE, offsetY: -0.02, rotX: Math.PI / 2 },
  cagedIndustrial: { geometry: CAGED_FIXTURE, offsetY: -0.09, rotX: 0 },
  emergencyOnly: { geometry: EMERGENCY_FIXTURE, offsetY: -0.08, rotX: Math.PI },
  none: { geometry: LIGHT_PLANE, offsetY: -0.02, rotX: Math.PI / 2 },
};

/** Per-fixture flicker (§7.3) is worth the update cost only where fixtures visibly stutter/sag. */
const PER_FIXTURE_FLICKER_MODES: ReadonlySet<LightingMode> = new Set([
  "fluorescentPanels",
  "cagedIndustrial",
]);

interface InstancePlacement {
  matrices: THREE.Matrix4[];
}

/** Feature kinds whose geometry is authored relative to the ceiling plane, not the floor. */
const CEILING_RELATIVE_FEATURES: ReadonlySet<FeatureKind> = new Set([
  "ceilingOpening",
  "ceilingRun",
]);

const compose = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotX = 0,
  rotY = 0,
): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0)),
    new THREE.Vector3(sx, sy, sz),
  );

const buildPlacements = (
  chunk: ChunkData,
  profile: Pick<LevelProfile, "ceilingHeight" | "lighting">,
): {
  walls: InstancePlacement;
  pillars: InstancePlacement;
  lights: InstancePlacement;
  lightSeeds: number[];
  furniture: Map<string, InstancePlacement>;
  features: Map<FeatureKind, InstancePlacement>;
} => {
  const { ceilingHeight, lighting } = profile;
  const walls: THREE.Matrix4[] = [];
  const pillars: THREE.Matrix4[] = [];
  const lights: THREE.Matrix4[] = [];
  const lightSeeds: number[] = [];
  const originX = chunk.cx * CHUNK_WORLD_SIZE;
  const originZ = chunk.cz * CHUNK_WORLD_SIZE;

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const cell = chunk.cells[z * CHUNK_SIZE + x];
      const worldX = originX + (x + 0.5) * CELL_SIZE;
      const worldZ = originZ + (z + 0.5) * CELL_SIZE;
      if (cell === CELL_WALL) {
        walls.push(compose(worldX, ceilingHeight / 2, worldZ, CELL_SIZE, ceilingHeight, CELL_SIZE));
      } else if (cell === CELL_PILLAR) {
        pillars.push(
          compose(
            worldX,
            ceilingHeight / 2,
            worldZ,
            CELL_SIZE * PILLAR_SCALE,
            ceilingHeight,
            CELL_SIZE * PILLAR_SCALE,
          ),
        );
      }
    }
  }

  const fixture = FIXTURE_SHAPES[lighting];
  for (const idx of chunk.lights) {
    const x = idx % CHUNK_SIZE;
    const z = (idx - x) / CHUNK_SIZE;
    lights.push(
      compose(
        originX + (x + 0.5) * CELL_SIZE,
        ceilingHeight + fixture.offsetY,
        originZ + (z + 0.5) * CELL_SIZE,
        1,
        1,
        1,
        fixture.rotX,
      ),
    );
    lightSeeds.push(hashInts(chunk.cx, chunk.cz, idx));
  }

  // Furniture: geometries are already true-size, so scale stays 1 and the
  // instance matrix carries only the placement position and yaw.
  const furniture = new Map<string, InstancePlacement>();
  for (const piece of chunk.furniture) {
    let group = furniture.get(piece.defId);
    if (!group) {
      group = { matrices: [] };
      furniture.set(piece.defId, group);
    }
    group.matrices.push(compose(piece.x, piece.y, piece.z, 1, 1, 1, 0, piece.yaw));
  }

  // Structural features: cosmetic-only, positioned at cell centers. Doorways
  // and breaches sit at the floor; ceiling openings and pipe runs are
  // authored relative to the ceiling plane (see featureGeometry.ts), so they
  // are placed at the ceiling height itself rather than 0.
  const features = new Map<FeatureKind, InstancePlacement>();
  for (const feature of chunk.features) {
    let group = features.get(feature.kind);
    if (!group) {
      group = { matrices: [] };
      features.set(feature.kind, group);
    }
    const worldX = originX + (feature.cellX + 0.5) * CELL_SIZE;
    const worldZ = originZ + (feature.cellZ + 0.5) * CELL_SIZE;
    const y = CEILING_RELATIVE_FEATURES.has(feature.kind) ? ceilingHeight : 0;
    const rotY = feature.axis === 1 ? Math.PI / 2 : 0;
    group.matrices.push(compose(worldX, y, worldZ, 1, 1, 1, 0, rotY));
  }

  return {
    walls: { matrices: walls },
    pillars: { matrices: pillars },
    lights: { matrices: lights },
    lightSeeds,
    furniture,
    features,
  };
};

function Instances({
  geometry,
  material,
  placement,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placement: InstancePlacement;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placement.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placement]);

  if (placement.matrices.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, placement.matrices.length]}
      // Shared resources must survive unmount; instancedMesh itself is cheap.
      dispose={null}
    />
  );
}

/**
 * Light fixtures, with optional per-fixture flicker: each fixture's
 * `instanceColor` is rewritten at ~10 Hz (never per frame — same discipline
 * as the HUD's throttled snapshots) from the pure `flickerFactor`, seeded by
 * the fixture's own cell index so panels in one chunk blink independently
 * rather than all together.
 */
function LightFixtureInstances({
  geometry,
  material,
  placement,
  seeds,
  mode,
  flickerAmount,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placement: InstancePlacement;
  seeds: number[];
  mode: LightingMode;
  flickerAmount: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const updateTimer = useRef(0);
  const animated = PER_FIXTURE_FLICKER_MODES.has(mode) && flickerAmount > 0;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placement.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (animated) {
      const colors = new Float32Array(placement.matrices.length * 3).fill(1);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    } else {
      mesh.instanceColor = null;
    }
  }, [placement, animated]);

  useFrame(({ clock }, delta) => {
    if (!animated) return;
    const mesh = ref.current;
    if (!mesh?.instanceColor) return;
    updateTimer.current += delta;
    if (updateTimer.current < 0.1) return;
    updateTimer.current = 0;
    const t = clock.elapsedTime;
    for (let i = 0; i < seeds.length; i++) {
      const value = flickerFactor(mode, flickerAmount, t, seeds[i]);
      mesh.instanceColor.setXYZ(i, value, value, value);
    }
    mesh.instanceColor.needsUpdate = true;
  });

  if (placement.matrices.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, placement.matrices.length]}
      dispose={null}
    />
  );
}

const FURNITURE_MATERIAL_KEY: Record<string, keyof LevelMaterials> = {
  fabric: "furnitureFabric",
  metal: "furnitureMetal",
  stone: "furnitureStone",
  wood: "furnitureWood",
};

const FEATURE_MATERIAL_KEY: Record<FeatureKind, keyof LevelMaterials> = {
  doorway: "doorFrame",
  wallBreach: "breach",
  ceilingOpening: "voidDark",
  ceilingRun: "furnitureMetal",
};

export interface ChunkMeshProps {
  chunk: ChunkData;
  profile: LevelProfile;
  materials: LevelMaterials;
}

/**
 * Renders one chunk: floor and ceiling planes plus instanced walls, pillars,
 * light fixtures, furniture and structural features. Unmounting frees only
 * per-chunk instance buffers — geometries and materials are shared across
 * the whole level.
 */
export function ChunkMesh({ chunk, profile, materials }: ChunkMeshProps) {
  const placements = useMemo(() => buildPlacements(chunk, profile), [chunk, profile]);
  const fixture = FIXTURE_SHAPES[profile.lighting];

  const centerX = (chunk.cx + 0.5) * CHUNK_WORLD_SIZE;
  const centerZ = (chunk.cz + 0.5) * CHUNK_WORLD_SIZE;

  return (
    <group>
      <mesh
        geometry={UNIT_PLANE}
        material={materials.floor}
        position={[centerX, 0, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[CHUNK_WORLD_SIZE, CHUNK_WORLD_SIZE, 1]}
        dispose={null}
      />
      <mesh
        geometry={UNIT_PLANE}
        material={materials.ceiling}
        position={[centerX, profile.ceilingHeight, centerZ]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[CHUNK_WORLD_SIZE, CHUNK_WORLD_SIZE, 1]}
        dispose={null}
      />
      <Instances geometry={UNIT_BOX} material={materials.wall} placement={placements.walls} />
      <Instances geometry={UNIT_BOX} material={materials.wall} placement={placements.pillars} />
      <LightFixtureInstances
        geometry={fixture.geometry}
        material={materials.lightFixture}
        placement={placements.lights}
        seeds={placements.lightSeeds}
        mode={profile.lighting}
        flickerAmount={profile.flickerAmount}
      />
      {[...placements.furniture.entries()].map(([defId, placement]) => (
        <Instances
          key={defId}
          geometry={furnitureGeometry(defId)}
          material={
            materials[FURNITURE_MATERIAL_KEY[furnitureRegistry.get(defId)?.materialRole ?? "wood"]]
          }
          placement={placement}
        />
      ))}
      {[...placements.features.entries()].map(([kind, placement]) => (
        <Instances
          key={kind}
          geometry={featureGeometry(kind)}
          material={materials[FEATURE_MATERIAL_KEY[kind]]}
          placement={placement}
        />
      ))}
    </group>
  );
}
