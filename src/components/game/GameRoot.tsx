"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import { NullAudioEngine, type AudioEngine } from "@/engine/audio/AudioEngine";
import { ProceduralAudioEngine } from "@/engine/audio/ProceduralAudioEngine";
import { ChunkManager } from "@/engine/generation/chunkManager";
import { createLevelProfile } from "@/engine/generation/levelProfile";
import { useCollectedStore } from "@/state/collectedStore";
import { useGameStore } from "@/state/gameStore";
import { usePlayerStore } from "@/state/playerStore";
import { useSettingsStore, type SettingsState } from "@/state/settingsStore";
import { useIsCoarsePointer } from "@/hooks/useIsCoarsePointer";
import { useOrientationGate } from "@/hooks/useOrientationGate";
import { Hud } from "@/components/hud/Hud";
import { RotateOverlay } from "@/components/hud/RotateOverlay";
import { TouchControls } from "@/components/hud/TouchControls";
import { SettingsPanel } from "@/components/menu/SettingsPanel";
import { Button } from "@/components/ui/Button";
import { GameScene } from "@/components/scene/GameScene";
import styles from "@/components/menu/menu.module.css";

/**
 * Best-effort: iOS Safari has neither API, so both calls are no-ops there.
 * Sequenced (not fire-and-forget in parallel) because orientation.lock()
 * requires the document to already be in fullscreen on several platforms.
 */
async function claimFullscreenLandscape(container: HTMLElement | null): Promise<void> {
  try {
    await container?.requestFullscreen?.();
  } catch {
    // Fullscreen denied or unsupported; still worth trying orientation lock.
  }
  try {
    const orientation = screen.orientation as unknown as {
      lock?: (o: string) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    // No Screen Orientation API (iOS Safari) — RotateOverlay is the fallback.
  }
}

function releaseFullscreenLandscape(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  const orientation = screen.orientation as unknown as { unlock?: () => void };
  try {
    orientation.unlock?.();
  } catch {
    // Nothing to unlock.
  }
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioEngine>(new NullAudioEngine());
  const rotateBlocked = useOrientationGate(phase);
  const isCoarsePointer = useIsCoarsePointer();

  // Deep-linking directly to /play: walk the store into "loading" legally.
  useEffect(() => {
    // getState() snapshots are immutable — re-read between steps or the
    // second check sees the pre-transition phase and startGame never runs.
    if (useGameStore.getState().phase === "splash") {
      useGameStore.getState().transition("menu");
    }
    if (useGameStore.getState().phase === "menu") {
      useGameStore.getState().startGame();
    }
  }, []);

  // No save games: every session starts with nothing collected.
  useEffect(() => {
    useCollectedStore.getState().reset();
    return () => useCollectedStore.getState().reset();
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

  const startPlaying = useCallback(() => {
    const game = useGameStore.getState();
    if (game.phase === "loading" || game.phase === "paused") {
      game.transition("playing");
      audioRef.current.resume();
    }
  }, []);

  // Desktop: PointerLockControls calls this once the lock is actually
  // acquired. Touch never locks (there's no mouse to lock), so the touch
  // branch of enter() below calls startPlaying() directly instead.
  const onLock = startPlaying;

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
    if (isCoarsePointer) {
      startPlaying();
      void claimFullscreenLandscape(containerRef.current);
    } else {
      controlsRef.current?.lock();
    }
  };

  const onUnlock = useCallback(() => {
    const game = useGameStore.getState();
    if (game.phase === "playing") {
      game.transition("paused");
      audioRef.current.suspend();
    }
  }, []);

  // "P" pauses like Esc. Releasing pointer lock (when held) reuses the exact
  // Esc flow — the unlock event drives the phase transition — so the two keys
  // can never diverge; without a lock (touch) the handler is called directly.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyP") return;
      if (useGameStore.getState().phase !== "playing") return;
      if (document.pointerLockElement) document.exitPointerLock();
      else onUnlock();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onUnlock]);

  const quit = () => {
    audioRef.current.playUiClick();
    useGameStore.getState().quitToMenu();
    usePlayerStore.getState().reset();
    releaseFullscreenLandscape();
    router.push("/menu");
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        // Gesture defenses: a look-drag must never trigger pull-to-refresh
        // or an edge-swipe back navigation.
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
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
            {isCoarsePointer
              ? "Joystick to move · Drag to look · Hold Run to sprint · Pause button top-right"
              : "Arrows / WASD to move · Mouse to look · Shift to run · Esc or P to pause"}
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

      {isCoarsePointer && phase === "playing" && <TouchControls onPause={onUnlock} />}

      {rotateBlocked && <RotateOverlay />}
    </div>
  );
}
