"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import {
  FIXED_TIMESTEP,
  HUD_UPDATE_HZ,
  MAX_FRAME_DELTA,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
} from "@/config/constants";
import { DIFFICULTY_CONFIGS } from "@/config/difficulty";
import type { AudioEngine } from "@/engine/audio/AudioEngine";
import { EntitySystem } from "@/engine/entities";
import type { ChunkManager } from "@/engine/generation/chunkManager";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { resolveMovement } from "@/engine/player/collision";
import { createMoveState, stepMovement } from "@/engine/player/movement";
import { applyDamage, canSprint, createStats, tickStamina } from "@/engine/player/stats";
import { useGameStore } from "@/state/gameStore";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";

export interface PlayerRigProps {
  manager: ChunkManager;
  profile: LevelProfile;
  audio: () => AudioEngine;
  onLock(): void;
  onUnlock(): void;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
}

/**
 * First-person rig: pointer-lock mouse look plus a fixed-timestep simulation
 * (movement, collision, stamina, entity hook). Runs only in the "playing"
 * phase; publishes low-frequency snapshots for the HUD.
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

  // Mutable simulation state, deliberately outside React: the fixed-timestep
  // loop reads/writes it every tick without triggering renders.
  const simRef = useRef({
    move: createMoveState(),
    stats: createStats(),
    entities: new EntitySystem(),
    accumulator: 0,
    publishTimer: 0,
    strideDistance: 0,
    breathTimer: 0,
    position: new THREE.Vector3(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
  });

  // Spawn once per level/session at a guaranteed-open cell.
  useEffect(() => {
    const sim = simRef.current;
    const spawn = manager.findSpawn();
    sim.position.set(spawn.x, PLAYER_EYE_HEIGHT, spawn.z);
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

    sim.euler.setFromQuaternion(camera.quaternion);
    const yaw = sim.euler.y;

    while (sim.accumulator >= FIXED_TIMESTEP) {
      sim.accumulator -= FIXED_TIMESTEP;

      const tick = stepMovement(
        sim.move,
        inputRef.current,
        yaw,
        canSprint(sim.stats),
        FIXED_TIMESTEP,
      );
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

      // Phase 2 hook: entities tick inside the same fixed step.
      sim.entities.update({
        playerPosition: { x: resolved.x, z: resolved.z },
        damagePlayer: (amount) => applyDamage(sim.stats, amount, difficulty),
        deltaSeconds: FIXED_TIMESTEP,
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
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={onLock}
      onUnlock={onUnlock}
      // Keep pitch clamped away from the poles to avoid gimbal flips.
      maxPolarAngle={Math.PI - 0.05}
      minPolarAngle={0.05}
    />
  );
}
