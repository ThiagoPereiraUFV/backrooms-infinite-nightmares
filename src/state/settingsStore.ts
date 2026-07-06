import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_LEVEL } from "@/config/constants";
import { DIFFICULTIES, type Difficulty } from "@/config/difficulty";

export type GameMode = "single" | "multiplayer";

export interface SettingsState {
  level: number;
  difficulty: Difficulty;
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  mode: GameMode;
  setLevel(level: number): void;
  setDifficulty(difficulty: Difficulty): void;
  setMusicEnabled(enabled: boolean): void;
  setMusicVolume(volume: number): void;
  setSfxEnabled(enabled: boolean): void;
  setSfxVolume(volume: number): void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampLevel = (level: number): number =>
  Number.isFinite(level) ? clamp(Math.round(level), 0, MAX_LEVEL) : 0;

const clampVolume = (volume: number): number => (Number.isFinite(volume) ? clamp(volume, 0, 1) : 1);

const DEFAULTS = {
  level: 0,
  difficulty: "peaceful" as Difficulty,
  musicEnabled: true,
  musicVolume: 0.7,
  sfxEnabled: true,
  sfxVolume: 0.8,
  mode: "single" as GameMode,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setLevel: (level) => set({ level: clampLevel(level) }),
      setDifficulty: (difficulty) =>
        set({ difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : DEFAULTS.difficulty }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume: clampVolume(musicVolume) }),
      setSfxEnabled: (sfxEnabled) => set({ sfxEnabled }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume: clampVolume(sfxVolume) }),
    }),
    {
      name: "bin-settings",
      // localStorage is user-editable: sanitize everything on rehydrate.
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          level: clampLevel(raw.level ?? DEFAULTS.level),
          difficulty: DIFFICULTIES.includes(raw.difficulty as Difficulty)
            ? (raw.difficulty as Difficulty)
            : DEFAULTS.difficulty,
          musicEnabled:
            typeof raw.musicEnabled === "boolean" ? raw.musicEnabled : DEFAULTS.musicEnabled,
          musicVolume: clampVolume(raw.musicVolume ?? DEFAULTS.musicVolume),
          sfxEnabled: typeof raw.sfxEnabled === "boolean" ? raw.sfxEnabled : DEFAULTS.sfxEnabled,
          sfxVolume: clampVolume(raw.sfxVolume ?? DEFAULTS.sfxVolume),
          // Multiplayer is "soon": never rehydrate into an unsupported mode.
          mode: "single",
        };
      },
    },
  ),
);
