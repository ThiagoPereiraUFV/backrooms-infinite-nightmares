"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ChunkData } from "@/engine/generation/chunk";
import { spawnKey, spawnWorldPosition } from "@/engine/generation/spawnFilter";
import { activeItemSpawns } from "@/engine/items";
import { useCollectedStore } from "@/state/collectedStore";

// One shared geometry/material per item type for the whole game (flyweight,
// same rule as walls/pillars/furniture) — never disposed per chunk.
const ITEM_GEOMETRIES: Record<string, THREE.BufferGeometry> = {
  adrenaline: new THREE.SphereGeometry(0.16, 12, 12),
  bandage: new THREE.BoxGeometry(0.26, 0.1, 0.18),
  flashlight: new THREE.CylinderGeometry(0.055, 0.075, 0.3, 10),
};

const ITEM_MATERIALS: Record<string, THREE.Material> = {
  adrenaline: new THREE.MeshStandardMaterial({
    color: "#d94b4b",
    emissive: "#d94b4b",
    emissiveIntensity: 0.65,
  }),
  bandage: new THREE.MeshStandardMaterial({
    color: "#e8e2c8",
    emissive: "#e8e2c8",
    emissiveIntensity: 0.25,
  }),
  flashlight: new THREE.MeshStandardMaterial({
    color: "#c9b34a",
    emissive: "#c9b34a",
    emissiveIntensity: 0.5,
  }),
};

const BOB_HEIGHT = 0.9;

function ItemPickup({ defId, x, z }: { defId: string; x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  // Deterministic per-position phase (not Math.random) so every pickup bobs
  // out of sync without an impure call during render.
  const phase = ((x * 12.9898 + z * 78.233) % 1) * Math.PI * 2;

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime + phase;
    mesh.position.y = BOB_HEIGHT + Math.sin(t * 1.6) * 0.08;
    mesh.rotation.y = t * 0.8;
  });

  const geometry = ITEM_GEOMETRIES[defId];
  const material = ITEM_MATERIALS[defId];
  if (!geometry || !material) return null;

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[x, BOB_HEIGHT, z]}
      dispose={null}
    />
  );
}

export interface ItemsFieldProps {
  chunks: ChunkData[];
  itemScarcity: number;
}

/**
 * Renders every active, uncollected item spawn as a small bobbing pickup.
 * Picking one up (PlayerRig) marks it collected in the shared store, which
 * this component reacts to by simply no longer rendering it — no despawn
 * animation, no imperative removal needed.
 */
export function ItemsField({ chunks, itemScarcity }: ItemsFieldProps) {
  const collectedKeys = useCollectedStore((state) => state.keys);

  const items = useMemo(() => {
    const list: { key: string; defId: string; x: number; z: number }[] = [];
    for (const chunk of chunks) {
      const active = activeItemSpawns(chunk.cx, chunk.cz, chunk.spawns, itemScarcity);
      for (const spawn of active) {
        const key = spawnKey(chunk.cx, chunk.cz, spawn);
        if (collectedKeys.has(key)) continue;
        const pos = spawnWorldPosition(chunk.cx, chunk.cz, spawn.cellX, spawn.cellZ);
        list.push({ key, defId: spawn.id, x: pos.x, z: pos.z });
      }
    }
    return list;
  }, [chunks, itemScarcity, collectedKeys]);

  return (
    <>
      {items.map((item) => (
        <ItemPickup key={item.key} defId={item.defId} x={item.x} z={item.z} />
      ))}
    </>
  );
}
