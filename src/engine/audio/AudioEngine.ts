import type { AmbienceId } from "../generation/levelProfile";

export type FootstepSurface = "carpet" | "hard";

/**
 * Everything gameplay code may do with audio. The MVP backend synthesizes
 * everything (ProceduralAudioEngine); swapping to mp3/ogg later means adding
 * a FileAudioEngine — no call site changes (dependency inversion).
 */
export interface AudioEngine {
  /** Starts (or switches) the looping level ambience. */
  startAmbience(ambience: AmbienceId): void;
  stopAmbience(): void;
  playFootstep(surface: FootstepSurface, sprinting: boolean): void;
  playUiClick(): void;
  playBreath(): void;
  /** One-shot chime when an item is picked up. */
  playPickup(): void;
  /** One-shot proximity cue when a hostile entity is first noticed nearby. */
  playGrowl(): void;
  setMusicVolume(volume: number): void;
  setSfxVolume(volume: number): void;
  /** Suspends output (pause menu). */
  suspend(): void;
  resume(): void;
  /** Tears down the audio context entirely (quit to menu). */
  dispose(): void;
}

/** Safe no-op backend for SSR, tests, and audio-less environments. */
export class NullAudioEngine implements AudioEngine {
  startAmbience(): void {}
  stopAmbience(): void {}
  playFootstep(): void {}
  playUiClick(): void {}
  playBreath(): void {}
  playPickup(): void {}
  playGrowl(): void {}
  setMusicVolume(): void {}
  setSfxVolume(): void {}
  suspend(): void {}
  resume(): void {}
  dispose(): void {}
}
