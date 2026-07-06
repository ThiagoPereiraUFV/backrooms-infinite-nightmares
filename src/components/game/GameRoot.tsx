"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import { NullAudioEngine, type AudioEngine } from "@/engine/audio/AudioEngine";
import { ProceduralAudioEngine } from "@/engine/audio/ProceduralAudioEngine";
import { ChunkManager } from "@/engine/generation/chunkManager";
import { createLevelProfile } from "@/engine/generation/levelProfile";
import { useGameStore } from "@/state/gameStore";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore, type SettingsState } from "@/state/settingsStore";
import { Hud } from "@/components/hud/Hud";
import { SettingsPanel } from "@/components/menu/SettingsPanel";
import { Button } from "@/components/ui/Button";
import { GameScene } from "@/components/scene/GameScene";
import styles from "@/components/menu/menu.module.css";

/**
 * The game session. Owns the world (chunk manager), the audio engine and the
 * phase flow around pointer lock:
 *
 *   loading  — world ready, waiting for the player to click "Enter" (locks pointer)
 *   playing  — pointer locked, simulation running
 *   paused   — pointer released (Esc), pause menu shown, audio suspended
 */
export default function GameRoot() {
  const router = useRouter();
  const phase = useGameStore((state) => state.phase);
  const worldSeed = useGameStore((state) => state.worldSeed);
  const level = useSettingsStore((state) => state.level);

  const profile = useMemo(() => createLevelProfile(level), [level]);
  const manager = useMemo(() => new ChunkManager(worldSeed, profile), [worldSeed, profile]);
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const audioRef = useRef<AudioEngine>(new NullAudioEngine());

  // Deep-linking directly to /play: walk the store into "loading" legally.
  useEffect(() => {
    const game = useGameStore.getState();
    if (game.phase === "splash") game.transition("menu");
    if (game.phase === "menu") game.startGame();
  }, []);

  // Audio follows the settings store for its entire lifetime.
  useEffect(() => {
    const applyVolumes = (settings: SettingsState) => {
      audioRef.current.setMusicVolume(settings.musicEnabled ? settings.musicVolume : 0);
      audioRef.current.setSfxVolume(settings.sfxEnabled ? settings.sfxVolume : 0);
    };
    applyVolumes(useSettingsStore.getState());
    const unsubscribe = useSettingsStore.subscribe(applyVolumes);
    const audio = audioRef.current;
    return () => {
      unsubscribe();
      audio.dispose();
      audioRef.current = new NullAudioEngine();
    };
  }, []);

  const getAudio = useCallback(() => audioRef.current, []);

  const enter = () => {
    // First entry is a user gesture: safe to create the AudioContext.
    if (audioRef.current instanceof NullAudioEngine) {
      try {
        const engine = new ProceduralAudioEngine();
        audioRef.current = engine;
        const settings = useSettingsStore.getState();
        engine.setMusicVolume(settings.musicEnabled ? settings.musicVolume : 0);
        engine.setSfxVolume(settings.sfxEnabled ? settings.sfxVolume : 0);
        engine.startAmbience(profile.ambience);
      } catch {
        // Audio stays on the null engine; the game itself must keep working.
      }
    }
    controlsRef.current?.lock();
  };

  const onLock = useCallback(() => {
    const game = useGameStore.getState();
    if (game.phase === "loading" || game.phase === "paused") {
      game.transition("playing");
      audioRef.current.resume();
    }
  }, []);

  const onUnlock = useCallback(() => {
    const game = useGameStore.getState();
    if (game.phase === "playing") {
      game.transition("paused");
      audioRef.current.suspend();
    }
  }, []);

  const quit = () => {
    audioRef.current.playUiClick();
    useGameStore.getState().quitToMenu();
    usePlayerStore.getState().reset();
    router.push("/menu");
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <GameScene
        manager={manager}
        profile={profile}
        audio={getAudio}
        onLock={onLock}
        onUnlock={onUnlock}
        controlsRef={controlsRef}
      />
      <Hud levelNumber={profile.level} levelName={profile.name} />

      {phase === "loading" && (
        <div className={styles.overlay} data-testid="enter-overlay">
          <div className={styles.overlayTitle}>
            Level {profile.level} — {profile.name}
          </div>
          <p className={styles.overlayHint}>
            Arrows / WASD to move · Mouse to look · Shift to run · Esc to pause
          </p>
          <Button variant="primary" onClick={enter} data-testid="enter-game">
            Enter
          </Button>
          <Button onClick={quit}>Back to menu</Button>
        </div>
      )}

      {phase === "paused" && (
        <div className={styles.overlay} data-testid="pause-menu">
          <div className={styles.overlayTitle}>Paused</div>
          <SettingsPanel compact />
          <div className={styles.actions}>
            <Button variant="primary" onClick={enter} data-testid="resume-game">
              Resume
            </Button>
            <Button onClick={quit} data-testid="quit-to-menu">
              Quit to menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
