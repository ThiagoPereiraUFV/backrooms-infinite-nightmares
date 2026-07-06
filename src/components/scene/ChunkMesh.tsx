"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL_SIZE, CHUNK_SIZE, CHUNK_WORLD_SIZE } from "@/config/constants";
import { CELL_PILLAR, CELL_WALL, type ChunkData } from "@/engine/generation/chunk";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import type { LevelMaterials } from "./levelMaterials";

// Shared unit geometries (flyweight) — instances scale them per use, so the
// whole infinite world costs three geometries total. Never disposed per chunk.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const LIGHT_PLANE = new THREE.PlaneGeometry(CELL_SIZE * 0.55, CELL_SIZE * 0.3);

interface InstancePlacement {
  matrices: THREE.Matrix4[];
}

const buildPlacements = (
  chunk: ChunkData,
  ceilingHeight: number,
): { walls: InstancePlacement; pillars: InstancePlacement; lights: InstancePlacement } => {
  const walls: THREE.Matrix4[] = [];
  const pillars: THREE.Matrix4[] = [];
  const lights: THREE.Matrix4[] = [];
  const originX = chunk.cx * CHUNK_WORLD_SIZE;
  const originZ = chunk.cz * CHUNK_WORLD_SIZE;
  const compose = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rotX = 0,
  ): THREE.Matrix4 =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0)),
      new THREE.Vector3(sx, sy, sz),
    );

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
            CELL_SIZE * 0.4,
            ceilingHeight,
            CELL_SIZE * 0.4,
          ),
        );
      }
    }
  }

  for (const idx of chunk.lights) {
    const x = idx % CHUNK_SIZE;
    const z = (idx - x) / CHUNK_SIZE;
    lights.push(
      compose(
        originX + (x + 0.5) * CELL_SIZE,
        ceilingHeight - 0.02,
        originZ + (z + 0.5) * CELL_SIZE,
        1,
        1,
        1,
        Math.PI / 2,
      ),
    );
  }

  return {
    walls: { matrices: walls },
    pillars: { matrices: pillars },
    lights: { matrices: lights },
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

export interface ChunkMeshProps {
  chunk: ChunkData;
  profile: LevelProfile;
  materials: LevelMaterials;
}

/**
 * Renders one chunk: floor and ceiling planes plus instanced walls, pillars
 * and light fixtures. Unmounting frees only per-chunk instance buffers —
 * geometries and materials are shared across the whole level.
 */
export function ChunkMesh({ chunk, profile, materials }: ChunkMeshProps) {
  const placements = useMemo(
    () => buildPlacements(chunk, profile.ceilingHeight),
    [chunk, profile.ceilingHeight],
  );

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
      <Instances
        geometry={LIGHT_PLANE}
        material={materials.lightFixture}
        placement={placements.lights}
      />
    </group>
  );
}
