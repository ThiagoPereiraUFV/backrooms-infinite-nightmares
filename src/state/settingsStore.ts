import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DIFFICULTIES, type Difficulty } from "@/config/difficulty";
import { LEVELS } from "@/engine/generation/levelProfile";

export type GameMode = "single" | "multiplayer";

export interface SettingsState {
  level: number;
  difficulty: Difficulty;
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  mode: GameMode;
  /** Touch drag-look sensitivity multiplier (mobile only). */
  touchLookSensitivity: number;
  /** 0..1 fog amount — 0 disables fog, 0.5 is the level's designed density, 1 doubles it. */
  fogIntensity: number;
  setLevel(level: number): void;
  setDifficulty(difficulty: Difficulty): void;
  setMusicEnabled(enabled: boolean): void;
  setMusicVolume(volume: number): void;
  setSfxEnabled(enabled: boolean): void;
  setSfxVolume(volume: number): void;
  setTouchLookSensitivity(sensitivity: number): void;
  setFogIntensity(intensity: number): void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// The roster is the only valid set of levels — anything else (a stale
// localStorage value, a fat-fingered call) falls back to the first level.
const sanitizeLevel = (level: number): number =>
  LEVELS.some((profile) => profile.level === level) ? level : LEVELS[0].level;

const clampVolume = (volume: number): number => (Number.isFinite(volume) ? clamp(volume, 0, 1) : 1);

const MIN_TOUCH_SENSITIVITY = 0.3;
const MAX_TOUCH_SENSITIVITY = 3;

const clampTouchSensitivity = (value: number): number =>
  Number.isFinite(value) ? clamp(value, MIN_TOUCH_SENSITIVITY, MAX_TOUCH_SENSITIVITY) : 1;

const DEFAULT_FOG_INTENSITY = 0.0;

const clampFogIntensity = (value: number): number =>
  Number.isFinite(value) ? clamp(value, 0, 1) : DEFAULT_FOG_INTENSITY;

const DEFAULTS = {
  level: 0,
  difficulty: "peaceful" as Difficulty,
  musicEnabled: true,
  musicVolume: 0.7,
  sfxEnabled: true,
  sfxVolume: 0.8,
  mode: "single" as GameMode,
  touchLookSensitivity: 1,
  fogIntensity: DEFAULT_FOG_INTENSITY,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setLevel: (level) => set({ level: sanitizeLevel(level) }),
      setDifficulty: (difficulty) =>
        set({ difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : DEFAULTS.difficulty }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume: clampVolume(musicVolume) }),
      setSfxEnabled: (sfxEnabled) => set({ sfxEnabled }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume: clampVolume(sfxVolume) }),
      setTouchLookSensitivity: (touchLookSensitivity) =>
        set({ touchLookSensitivity: clampTouchSensitivity(touchLookSensitivity) }),
      setFogIntensity: (fogIntensity) => set({ fogIntensity: clampFogIntensity(fogIntensity) }),
    }),
    {
      name: "bin-settings",
      // localStorage is user-editable: sanitize everything on rehydrate.
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          level: sanitizeLevel(raw.level ?? DEFAULTS.level),
          difficulty: DIFFICULTIES.includes(raw.difficulty as Difficulty)
            ? (raw.difficulty as Difficulty)
            : DEFAULTS.difficulty,
          musicEnabled:
            typeof raw.musicEnabled === "boolean" ? raw.musicEnabled : DEFAULTS.musicEnabled,
          musicVolume: clampVolume(raw.musicVolume ?? DEFAULTS.musicVolume),
          sfxEnabled: typeof raw.sfxEnabled === "boolean" ? raw.sfxEnabled : DEFAULTS.sfxEnabled,
          sfxVolume: clampVolume(raw.sfxVolume ?? DEFAULTS.sfxVolume),
          touchLookSensitivity: clampTouchSensitivity(
            raw.touchLookSensitivity ?? DEFAULTS.touchLookSensitivity,
          ),
          fogIntensity: clampFogIntensity(raw.fogIntensity ?? DEFAULTS.fogIntensity),
          // Multiplayer is "soon": never rehydrate into an unsupported mode.
          mode: "single",
        };
      },
    },
  ),
);
