"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { MAX_ACTIVE_ENTITIES } from "@/config/constants";
import { getEntityAppearance } from "@/engine/entities/catalog";
import type { EntitySystem } from "@/engine/entities";
import { entityGeometry, entityMaterial, ENTITY_APPEARANCE_IDS } from "./entityGeometry";

const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3(1, 1, 1);
const scratchMatrix = new THREE.Matrix4();

/** `wanderer` has no catalog entry (it predates the catalog) — its appearance id is itself. */
const appearanceIdFor = (definitionId: string): string =>
  getEntityAppearance(definitionId)?.appearanceId ?? definitionId;

export interface EntitiesFieldProps {
  entities: EntitySystem;
}

/**
 * Renders every live entity: one `InstancedMesh` per registered silhouette
 * (PLAN-4 §9.3), written every simulation frame from the `EntitySystem` the
 * caller owns. Extracted out of `PlayerRig` — that component's job is the
 * player simulation, not owning enemy meshes, and a single shared mesh
 * couldn't support more than one silhouette.
 */
export function EntitiesField({ entities }: EntitiesFieldProps) {
  const meshRefs = useRef(new Map<string, THREE.InstancedMesh>());

  useFrame(() => {
    const counts = new Map<string, number>();
    for (const [, entity] of entities.entries()) {
      const appearanceId = appearanceIdFor(entity.definitionId);
      const mesh = meshRefs.current.get(appearanceId);
      if (!mesh) continue;
      const i = counts.get(appearanceId) ?? 0;
      if (i >= MAX_ACTIVE_ENTITIES) continue;
      scratchPosition.set(entity.x, 0, entity.z);
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      mesh.setMatrixAt(i, scratchMatrix);
      counts.set(appearanceId, i + 1);
    }
    for (const appearanceId of ENTITY_APPEARANCE_IDS) {
      const mesh = meshRefs.current.get(appearanceId);
      if (!mesh) continue;
      const count = counts.get(appearanceId) ?? 0;
      mesh.count = count;
      if (count > 0) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {ENTITY_APPEARANCE_IDS.map((appearanceId) => (
        <instancedMesh
          key={appearanceId}
          ref={(mesh) => {
            if (mesh) meshRefs.current.set(appearanceId, mesh);
            else meshRefs.current.delete(appearanceId);
          }}
          args={[entityGeometry(appearanceId), entityMaterial(appearanceId), MAX_ACTIVE_ENTITIES]}
          // Instances follow the player far from the origin, but three caches
          // the InstancedMesh bounding sphere from the first render (count 0
          // -> empty sphere), which culls the mesh forever. Skipping culling
          // is free at this instance count.
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </>
  );
}
