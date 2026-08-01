"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import { CHUNK_WORLD_SIZE, PLAYER_EYE_HEIGHT, VIEW_DISTANCE_CHUNKS } from "@/config/constants";
import { DIFFICULTY_CONFIGS } from "@/config/difficulty";
import type { AudioEngine } from "@/engine/audio/AudioEngine";
import { EntitySystem } from "@/engine/entities";
import type { ChunkData } from "@/engine/generation/chunk";
import type { ChunkManager } from "@/engine/generation/chunkManager";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { flickerFactor } from "@/engine/lighting/flicker";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore } from "@/state/settingsStore";
import { ChunkMesh } from "./ChunkMesh";
import { EntitiesField } from "./EntitiesField";
import { ItemsField } from "./ItemsField";
import { useLevelMaterials } from "./levelMaterials";
import { PlayerRig } from "./PlayerRig";

/** Chunk ring around the player's last-published position, refreshed as they move. */
function useVisibleChunks(manager: ChunkManager): ChunkData[] {
  const [center, setCenter] = useState({ cx: 0, cz: 0 });

  useEffect(() => {
    const toChunk = (value: number) => Math.floor(value / CHUNK_WORLD_SIZE);
    const apply = (x: number, z: number) => {
      const cx = toChunk(x);
      const cz = toChunk(z);
      setCenter((current) => (current.cx === cx && current.cz === cz ? current : { cx, cz }));
    };
    const state = usePlayerStore.getState();
    apply(state.x, state.z);
    return usePlayerStore.subscribe((snapshot) => apply(snapshot.x, snapshot.z));
  }, []);

  return useMemo(
    () =>
      manager.chunksAround(
        (center.cx + 0.5) * CHUNK_WORLD_SIZE,
        (center.cz + 0.5) * CHUNK_WORLD_SIZE,
        VIEW_DISTANCE_CHUNKS,
      ),
    [manager, center],
  );
}

function ChunkField({ chunks, profile }: { chunks: ChunkData[]; profile: LevelProfile }) {
  const materials = useLevelMaterials(profile);
  return (
    <>
      {chunks.map((chunk) => (
        <ChunkMesh
          key={`${chunk.cx},${chunk.cz}`}
          chunk={chunk}
          profile={profile}
          materials={materials}
        />
      ))}
    </>
  );
}

/**
 * Ambient + hemisphere light, dimmed by the pure, seeded `flickerFactor`
 * (engine/lighting/flicker.ts) instead of a per-frame `Math.random` — the
 * whole level no longer blinks in lockstep once per-fixture flicker (M20 in
 * ChunkMesh) is layered on top of this.
 */
function LevelLighting({ profile, worldSeed }: { profile: LevelProfile; worldSeed: number }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const baseIntensity = 0.25 + profile.lightIntensity * 1.15;

  useFrame(({ clock }) => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    const factor = flickerFactor(
      profile.lighting,
      profile.flickerAmount,
      clock.elapsedTime,
      worldSeed,
    );
    ambient.intensity = baseIntensity * factor;
  });

  return (
    <>
      <ambientLight ref={ambientRef} color={profile.palette.light} intensity={baseIntensity} />
      <hemisphereLight
        color={profile.palette.light}
        groundColor={profile.palette.floor}
        intensity={0.25 + profile.lightIntensity * 0.35}
      />
    </>
  );
}

/** Dim point light carried by the player so pitch-black levels stay navigable. */
function PlayerLamp({ profile }: { profile: LevelProfile }) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    lightRef.current?.position.set(camera.position.x, PLAYER_EYE_HEIGHT, camera.position.z);
  });
  const intensity = 2.5 * (1 - profile.lightIntensity) + 0.4;
  return <pointLight ref={lightRef} intensity={intensity} distance={14} decay={1.6} />;
}

/** Spotlight following the camera, on only while the flashlight item is toggled on. */
function FlashlightBeam() {
  const on = usePlayerStore((state) => state.flashlightOn);
  const lightRef = useRef<THREE.SpotLight>(null);
  const spillRef = useRef<THREE.PointLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const direction = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const light = lightRef.current;
    spillRef.current?.position.copy(camera.position);
    if (!light) return;
    light.position.copy(camera.position);
    camera.getWorldDirection(direction.current);
    target.position.copy(camera.position).addScaledVector(direction.current, 6);
    light.target = target;
  });

  return (
    <>
      <primitive object={target} />
      {on && (
        <>
          <spotLight
            ref={lightRef}
            intensity={26}
            angle={0.32}
            penumbra={0.35}
            distance={28}
            decay={2}
            color="#fff6d8"
          />
          {/* Near-field spill from the housing/reflector — a real flashlight lights up
              what's right in front of it, not just the narrow beam target. */}
          <pointLight ref={spillRef} intensity={3} distance={4} decay={2} color="#fff6d8" />
        </>
      )}
    </>
  );
}

export interface GameSceneProps {
  manager: ChunkManager;
  profile: LevelProfile;
  worldSeed: number;
  audio: () => AudioEngine;
  onLock(): void;
  onUnlock(): void;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
}

export function GameScene({
  manager,
  profile,
  worldSeed,
  audio,
  onLock,
  onUnlock,
  controlsRef,
}: GameSceneProps) {
  const chunks = useVisibleChunks(manager);
  const difficulty = useSettingsStore((state) => state.difficulty);
  const itemScarcity = DIFFICULTY_CONFIGS[difficulty].itemScarcity;
  // User fog setting: 0 → no fog, 0.5 → the level's designed density, 1 → double.
  const fogIntensity = useSettingsStore((state) => state.fogIntensity);
  const fogDensity = profile.fogDensity * fogIntensity * 2;
  // One EntitySystem for the session, shared by the simulation (PlayerRig)
  // and the renderer (EntitiesField) — rendering is not the simulation's job.
  // `manager` is the intentional cache key (a new ChunkManager means a new
  // level/session), even though the factory itself doesn't read it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entities = useMemo(() => new EntitySystem(), [manager]);

  return (
    <Canvas
      camera={{ fov: 78, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.75]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[profile.palette.fog]} />
      <fogExp2 attach="fog" args={[profile.palette.fog, fogDensity]} />
      <LevelLighting profile={profile} worldSeed={worldSeed} />
      <PlayerLamp profile={profile} />
      <FlashlightBeam />
      <ChunkField chunks={chunks} profile={profile} />
      <ItemsField chunks={chunks} itemScarcity={itemScarcity} />
      <EntitiesField entities={entities} />
      <PlayerRig
        manager={manager}
        profile={profile}
        audio={audio}
        entities={entities}
        onLock={onLock}
        onUnlock={onUnlock}
        controlsRef={controlsRef}
      />
    </Canvas>
  );
}
