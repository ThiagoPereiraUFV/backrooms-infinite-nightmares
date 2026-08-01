import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CHUNK_SIZE } from "@/config/constants";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { SURFACE_PAINTERS } from "./proceduralTextures";

export interface LevelMaterials {
  wall: THREE.Material;
  floor: THREE.Material;
  ceiling: THREE.Material;
  lightFixture: THREE.Material;
  furnitureWood: THREE.Material;
  furnitureFabric: THREE.Material;
  furnitureMetal: THREE.Material;
  furnitureStone: THREE.Material;
  doorFrame: THREE.Material;
  breach: THREE.Material;
  voidDark: THREE.Material;
}

/**
 * One material set per level, shared by every chunk (flyweight) — draw-call
 * and memory cost is constant regardless of how far the player wanders.
 * Everything created here is disposed when the level unmounts.
 */
export function useLevelMaterials(profile: LevelProfile): LevelMaterials {
  const materials = useMemo<LevelMaterials>(() => {
    const painter = SURFACE_PAINTERS[profile.surfaceStyle];
    const wallTexture = painter.wall(profile.palette, profile.decay);

    const floorTexture = painter.floor(profile.palette, profile.decay);
    floorTexture.repeat.set(CHUNK_SIZE, CHUNK_SIZE);

    const ceilingTexture = painter.ceiling(profile.palette, profile.decay);
    ceilingTexture.repeat.set(CHUNK_SIZE, CHUNK_SIZE);

    // Furniture/feature tints sit in the level's color world: the palette
    // accent pulled toward a material tone, darkened by decay.
    const decayShade = 1 - profile.decay * 0.3;
    const tint = (toward: string, amount: number): THREE.Color =>
      new THREE.Color(profile.palette.accent)
        .lerp(new THREE.Color(toward), amount)
        .multiplyScalar(decayShade);
    const wood = tint("#6b4a2f", 0.6);
    const fabric = tint("#7a7268", 0.35);
    const metal = tint("#8a8f94", 0.65);
    const stone = tint("#5f584c", 0.5);

    return {
      wall: new THREE.MeshLambertMaterial({ map: wallTexture }),
      floor: new THREE.MeshLambertMaterial({ map: floorTexture }),
      ceiling: new THREE.MeshLambertMaterial({ map: ceilingTexture }),
      // Basic material: fixtures glow regardless of scene light.
      lightFixture: new THREE.MeshBasicMaterial({ color: profile.palette.light }),
      furnitureWood: new THREE.MeshLambertMaterial({ color: wood }),
      furnitureFabric: new THREE.MeshLambertMaterial({ color: fabric }),
      furnitureMetal: new THREE.MeshLambertMaterial({ color: metal }),
      furnitureStone: new THREE.MeshLambertMaterial({ color: stone }),
      doorFrame: new THREE.MeshLambertMaterial({ color: wood }),
      breach: new THREE.MeshLambertMaterial({
        color: new THREE.Color(profile.palette.wall).multiplyScalar(0.35),
      }),
      voidDark: new THREE.MeshBasicMaterial({
        color: new THREE.Color(profile.palette.ceiling).multiplyScalar(0.1),
      }),
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
