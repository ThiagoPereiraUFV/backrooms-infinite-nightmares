"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import {
  ENEMY_GROWL_RADIUS,
  ENEMY_MIN_SPAWN_DISTANCE,
  FIXED_TIMESTEP,
  HUD_UPDATE_HZ,
  ITEM_PICKUP_RADIUS,
  MAX_ACTIVE_ENTITIES,
  MAX_FRAME_DELTA,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  SPAWN_SCAN_RADIUS_CHUNKS,
} from "@/config/constants";
import { DIFFICULTY_CONFIGS } from "@/config/difficulty";
import type { AudioEngine } from "@/engine/audio/AudioEngine";
import { activeEntitySpawns, entityRegistry, EntitySystem } from "@/engine/entities";
import type { ChunkData } from "@/engine/generation/chunk";
import type { ChunkManager } from "@/engine/generation/chunkManager";
import { spawnKey, spawnWorldPosition } from "@/engine/generation/spawnFilter";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { activeItemSpawns, itemRegistry } from "@/engine/items";
import { resolveMovement } from "@/engine/player/collision";
import { createMoveState, stepMovement } from "@/engine/player/movement";
import {
  applyDamage,
  boostStamina,
  canSprint,
  createStats,
  heal,
  tickStamina,
} from "@/engine/player/stats";
import { useGameStore } from "@/state/gameStore";
import { useCollectedStore } from "@/state/collectedStore";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useHotbarInput } from "@/hooks/useHotbarInput";
import { useIsCoarsePointer } from "@/hooks/useIsCoarsePointer";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { touchInputBus } from "@/hooks/touchInputBus";

export interface PlayerRigProps {
  manager: ChunkManager;
  profile: LevelProfile;
  audio: () => AudioEngine;
  onLock(): void;
  onUnlock(): void;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
}

// Enemy silhouette: one shared geometry/material for the whole game (never
// disposed, matches the flyweight pattern used for walls/pillars/furniture).
const ENEMY_HEIGHT = 1.8;
const ENEMY_GEOMETRY = new THREE.BoxGeometry(0.5, ENEMY_HEIGHT, 0.3);
const ENEMY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#150606",
  emissive: "#8a1414",
  emissiveIntensity: 0.8,
  roughness: 1,
});
const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3(1, 1, 1);
const scratchMatrix = new THREE.Matrix4();

// Touch drag-look: px-to-radians base rate (further scaled by the user's
// touchLookSensitivity setting, already folded into touchInputBus deltas).
const TOUCH_LOOK_RATE = 0.0028;
const MAX_PITCH = Math.PI / 2 - 0.05;

/**
 * First-person rig: pointer-lock mouse look plus a fixed-timestep simulation
 * (movement, collision, stamina, items, entities). Runs only in the
 * "playing" phase; publishes low-frequency snapshots for the HUD.
 */
export function PlayerRig({
  manager,
  profile,
  audio,
  onLock,
  onUnlock,
  controlsRef,
}: PlayerRigProps) {
  const camera = useThree((state) => state.camera);
  const inputRef = useKeyboardInput();
  const hotbarRef = useHotbarInput();
  const isCoarsePointer = useIsCoarsePointer();
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);

  // Mutable simulation state, deliberately outside React: the fixed-timestep
  // loop reads/writes it every tick without triggering renders.
  const simRef = useRef({
    move: createMoveState(),
    stats: createStats(),
    entities: new EntitySystem(),
    growledKeys: new Set<string>(),
    accumulator: 0,
    publishTimer: 0,
    strideDistance: 0,
    breathTimer: 0,
    position: new THREE.Vector3(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    spawnPoint: { x: 0, z: 0 },
  });

  // Spawn once per level/session at a guaranteed-open cell.
  useEffect(() => {
    const sim = simRef.current;
    const spawn = manager.findSpawn();
    sim.position.set(spawn.x, PLAYER_EYE_HEIGHT, spawn.z);
    sim.spawnPoint = { x: spawn.x, z: spawn.z };
    camera.position.copy(sim.position);
    usePlayerStore.getState().reset();
    usePlayerStore.getState().publish({ x: spawn.x, z: spawn.z });
  }, [manager, camera]);

  useFrame((_, rawDelta) => {
    if (useGameStore.getState().phase !== "playing") return;

    const sim = simRef.current;
    const difficulty = DIFFICULTY_CONFIGS[useSettingsStore.getState().difficulty];
    const surface = profile.ambience === "fluorescentHum" ? "carpet" : "hard";
    sim.accumulator += Math.min(rawDelta, MAX_FRAME_DELTA);

    // Desktop: PointerLockControls already wrote the camera's rotation from
    // native mousemove — just read it. Touch: PointerLockControls is never
    // locked, so drag deltas from TouchControls drive rotation here instead.
    if (isCoarsePointer) {
      const dx = touchInputBus.lookDX;
      const dy = touchInputBus.lookDY;
      touchInputBus.lookDX = 0;
      touchInputBus.lookDY = 0;
      sim.euler.setFromQuaternion(camera.quaternion);
      sim.euler.y -= dx * TOUCH_LOOK_RATE;
      sim.euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, sim.euler.x - dy * TOUCH_LOOK_RATE));
      camera.quaternion.setFromEuler(sim.euler);
    } else {
      sim.euler.setFromQuaternion(camera.quaternion);
    }
    const yaw = sim.euler.y;
    const moveInput = isCoarsePointer ? touchInputBus.move : inputRef.current;

    // Hotbar presses are discrete UI events: drained once per rendered
    // frame, not per fixed substep.
    const hotbarQueue = hotbarRef.current;
    if (hotbarQueue.length > 0) {
      for (const slot of hotbarQueue) {
        const stack = usePlayerStore.getState().inventory[slot - 1];
        const def = stack ? itemRegistry.get(stack.itemId) : undefined;
        if (!def) continue;
        if (def.consumable && !usePlayerStore.getState().consumeItem(stack.itemId)) continue;
        def.use({
          healPlayer: (amount) => heal(sim.stats, amount),
          boostStamina: (amount) => boostStamina(sim.stats, amount),
          toggleFlashlight: () => usePlayerStore.getState().toggleFlashlight(),
        });
        audio().playUiClick();
      }
      hotbarQueue.length = 0;
    }

    while (sim.accumulator >= FIXED_TIMESTEP) {
      sim.accumulator -= FIXED_TIMESTEP;

      const tick = stepMovement(sim.move, moveInput, yaw, canSprint(sim.stats), FIXED_TIMESTEP);
      tickStamina(sim.stats, tick.isSprinting, FIXED_TIMESTEP, difficulty);

      const resolved = resolveMovement(
        manager,
        sim.position.x,
        sim.position.z,
        sim.move.vx * FIXED_TIMESTEP,
        sim.move.vz * FIXED_TIMESTEP,
        PLAYER_RADIUS,
      );
      sim.position.x = resolved.x;
      sim.position.z = resolved.z;

      sim.entities.update({
        playerPosition: { x: resolved.x, z: resolved.z },
        damagePlayer: (amount) => applyDamage(sim.stats, amount, difficulty),
        deltaSeconds: FIXED_TIMESTEP,
        world: manager,
        aggression: difficulty.enemyAggression,
      });

      if (tick.isMoving) {
        sim.strideDistance += tick.speed * FIXED_TIMESTEP;
        const stride = tick.isSprinting ? 2.7 : 2.1;
        if (sim.strideDistance >= stride) {
          sim.strideDistance = 0;
          audio().playFootstep(surface, tick.isSprinting);
        }
      }

      if (sim.stats.exhausted) {
        sim.breathTimer -= FIXED_TIMESTEP;
        if (sim.breathTimer <= 0) {
          sim.breathTimer = 1.4;
          audio().playBreath();
        }
      }

      sim.publishTimer += FIXED_TIMESTEP;
      if (sim.publishTimer >= 1 / HUD_UPDATE_HZ) {
        sim.publishTimer = 0;

        const nearbyChunks: ChunkData[] = manager.chunksAround(
          sim.position.x,
          sim.position.z,
          SPAWN_SCAN_RADIUS_CHUNKS,
        );

        // --- Item pickups: walk over an active, uncollected spawn. ---
        for (const chunk of nearbyChunks) {
          const active = activeItemSpawns(
            chunk.cx,
            chunk.cz,
            chunk.spawns,
            difficulty.itemScarcity,
          );
          for (const spawn of active) {
            const key = spawnKey(chunk.cx, chunk.cz, spawn);
            if (useCollectedStore.getState().isCollected(key)) continue;
            const pos = spawnWorldPosition(chunk.cx, chunk.cz, spawn.cellX, spawn.cellZ);
            const dist = Math.hypot(pos.x - sim.position.x, pos.z - sim.position.z);
            if (dist <= ITEM_PICKUP_RADIUS) {
              useCollectedStore.getState().collect(key);
              usePlayerStore.getState().collectItem(spawn.id);
              audio().playPickup();
            }
          }
        }

        // --- Entity reconciliation: closest MAX_ACTIVE_ENTITIES stay alive. ---
        const candidates: { key: string; id: string; x: number; z: number; dist: number }[] = [];
        for (const chunk of nearbyChunks) {
          const active = activeEntitySpawns(
            chunk.cx,
            chunk.cz,
            chunk.spawns,
            difficulty.enemyAggression,
          );
          for (const spawn of active) {
            const pos = spawnWorldPosition(chunk.cx, chunk.cz, spawn.cellX, spawn.cellZ);
            const distFromPlayerSpawn = Math.hypot(
              pos.x - sim.spawnPoint.x,
              pos.z - sim.spawnPoint.z,
            );
            if (distFromPlayerSpawn < ENEMY_MIN_SPAWN_DISTANCE) continue;
            candidates.push({
              key: spawnKey(chunk.cx, chunk.cz, spawn),
              id: spawn.id,
              x: pos.x,
              z: pos.z,
              dist: Math.hypot(pos.x - sim.position.x, pos.z - sim.position.z),
            });
          }
        }
        candidates.sort((a, b) => a.dist - b.dist);
        const wantedKeys = new Set<string>();
        for (const candidate of candidates.slice(0, MAX_ACTIVE_ENTITIES)) {
          wantedKeys.add(candidate.key);
          if (!sim.entities.has(candidate.key)) {
            const definition = entityRegistry.get(candidate.id);
            if (definition)
              sim.entities.add(definition.spawn(candidate.x, candidate.z), candidate.key);
          }
        }
        for (const key of [...sim.entities.keys()]) {
          if (!wantedKeys.has(key)) {
            sim.entities.remove(key);
            sim.growledKeys.delete(key);
          }
        }

        // --- Growl cue: one-shot per approach, re-arms once the entity leaves range. ---
        for (const [key, entity] of sim.entities.entries()) {
          const dist = Math.hypot(entity.x - sim.position.x, entity.z - sim.position.z);
          const near = dist <= ENEMY_GROWL_RADIUS;
          if (near && !sim.growledKeys.has(key)) {
            sim.growledKeys.add(key);
            audio().playGrowl();
          } else if (!near && sim.growledKeys.has(key)) {
            sim.growledKeys.delete(key);
          }
        }

        usePlayerStore.getState().publish({
          health: sim.stats.health,
          stamina: sim.stats.stamina,
          exhausted: sim.stats.exhausted,
          sprinting: sim.move.vx !== 0 || sim.move.vz !== 0 ? tick.isSprinting : false,
          x: sim.position.x,
          z: sim.position.z,
        });
      }
    }

    camera.position.set(sim.position.x, PLAYER_EYE_HEIGHT, sim.position.z);

    const enemyMesh = enemyMeshRef.current;
    if (enemyMesh) {
      let i = 0;
      for (const [, entity] of sim.entities.entries()) {
        if (i >= MAX_ACTIVE_ENTITIES) break;
        scratchPosition.set(entity.x, ENEMY_HEIGHT / 2, entity.z);
        scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
        enemyMesh.setMatrixAt(i, scratchMatrix);
        i++;
      }
      enemyMesh.count = i;
      if (i > 0) enemyMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Touch never locks the pointer — and PointerLockControls attaches its
          own document-level click-to-lock listener even when idle, which
          would otherwise silently re-acquire lock (and revert phase back to
          "playing") on any tap, e.g. the on-screen pause button. */}
      {!isCoarsePointer && (
        <PointerLockControls
          ref={controlsRef}
          onLock={onLock}
          onUnlock={onUnlock}
          // Keep pitch clamped away from the poles to avoid gimbal flips.
          maxPolarAngle={Math.PI - 0.05}
          minPolarAngle={0.05}
        />
      )}
      <instancedMesh
        ref={enemyMeshRef}
        args={[ENEMY_GEOMETRY, ENEMY_MATERIAL, MAX_ACTIVE_ENTITIES]}
        // Instances follow the player far from the origin, but three caches the
        // InstancedMesh bounding sphere from the first render (count 0 → empty
        // sphere), which culls the mesh forever. Only MAX_ACTIVE_ENTITIES boxes,
        // so skipping culling is free.
        frustumCulled={false}
        dispose={null}
      />
    </>
  );
}
