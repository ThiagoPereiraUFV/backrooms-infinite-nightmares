import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CHUNK_SIZE } from "@/config/constants";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { createCeilingTexture, createFloorTexture, createWallTexture } from "./proceduralTextures";

export interface LevelMaterials {
  wall: THREE.Material;
  floor: THREE.Material;
  ceiling: THREE.Material;
  lightFixture: THREE.Material;
}

/**
 * One material set per level, shared by every chunk (flyweight) — draw-call
 * and memory cost is constant regardless of how far the player wanders.
 * Everything created here is disposed when the level unmounts.
 */
export function useLevelMaterials(profile: LevelProfile): LevelMaterials {
  const materials = useMemo<LevelMaterials>(() => {
    const wallTexture = createWallTexture(profile.palette, profile.decay);

    const floorTexture = createFloorTexture(profile.palette, profile.decay);
    floorTexture.repeat.set(CHUNK_SIZE, CHUNK_SIZE);

    const ceilingTexture = createCeilingTexture(profile.palette, profile.decay);
    ceilingTexture.repeat.set(CHUNK_SIZE, CHUNK_SIZE);

    return {
      wall: new THREE.MeshLambertMaterial({ map: wallTexture }),
      floor: new THREE.MeshLambertMaterial({ map: floorTexture }),
      ceiling: new THREE.MeshLambertMaterial({ map: ceilingTexture }),
      // Basic material: fixtures glow regardless of scene light.
      lightFixture: new THREE.MeshBasicMaterial({ color: profile.palette.light }),
    };
  }, [profile]);

  useEffect(() => {
    return () => {
      for (const material of Object.values(materials)) {
        if (material instanceof THREE.MeshLambertMaterial && material.map) {
          material.map.dispose();
        }
        material.dispose();
      }
    };
  }, [materials]);

  return materials;
}
