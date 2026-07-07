"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import { CHUNK_WORLD_SIZE, PLAYER_EYE_HEIGHT, VIEW_DISTANCE_CHUNKS } from "@/config/constants";
import { DIFFICULTY_CONFIGS } from "@/config/difficulty";
import type { AudioEngine } from "@/engine/audio/AudioEngine";
import type { ChunkData } from "@/engine/generation/chunk";
import type { ChunkManager } from "@/engine/generation/chunkManager";
import type { LevelProfile } from "@/engine/generation/levelProfile";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore } from "@/state/settingsStore";
import { ChunkMesh } from "./ChunkMesh";
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

/** Ambient + hemisphere light with fluorescent flicker driven by the profile. */
function LevelLighting({ profile }: { profile: LevelProfile }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const baseIntensity = 0.25 + profile.lightIntensity * 1.15;
  const flickerState = useRef({ dimFrames: 0 });

  useFrame(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    const flicker = flickerState.current;
    if (flicker.dimFrames > 0) {
      flicker.dimFrames--;
      ambient.intensity = baseIntensity * (0.55 + Math.random() * 0.2);
    } else {
      ambient.intensity = baseIntensity;
      if (Math.random() < profile.flickerAmount * 0.015) {
        flicker.dimFrames = 2 + Math.floor(Math.random() * 5);
      }
    }
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
  const target = useMemo(() => new THREE.Object3D(), []);
  const direction = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const light = lightRef.current;
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
        <spotLight
          ref={lightRef}
          intensity={8}
          angle={0.34}
          penumbra={0.45}
          distance={20}
          decay={1.6}
          color="#fff6d8"
        />
      )}
    </>
  );
}

export interface GameSceneProps {
  manager: ChunkManager;
  profile: LevelProfile;
  audio: () => AudioEngine;
  onLock(): void;
  onUnlock(): void;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
}

export function GameScene({
  manager,
  profile,
  audio,
  onLock,
  onUnlock,
  controlsRef,
}: GameSceneProps) {
  const chunks = useVisibleChunks(manager);
  const difficulty = useSettingsStore((state) => state.difficulty);
  const itemScarcity = DIFFICULTY_CONFIGS[difficulty].itemScarcity;

  return (
    <Canvas
      camera={{ fov: 78, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.75]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[profile.palette.fog]} />
      <fogExp2 attach="fog" args={[profile.palette.fog, profile.fogDensity]} />
      <LevelLighting profile={profile} />
      <PlayerLamp profile={profile} />
      <FlashlightBeam />
      <ChunkField chunks={chunks} profile={profile} />
      <ItemsField chunks={chunks} itemScarcity={itemScarcity} />
      <PlayerRig
        manager={manager}
        profile={profile}
        audio={audio}
        onLock={onLock}
        onUnlock={onUnlock}
        controlsRef={controlsRef}
      />
    </Canvas>
  );
}
