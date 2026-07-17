"use client";

import { useMemo } from "react";
import { MAX_LEVEL } from "@/config/constants";
import { DIFFICULTIES, type Difficulty } from "@/config/difficulty";
import { createLevelProfile } from "@/engine/generation/levelProfile";
import { useIsCoarsePointer } from "@/hooks/useIsCoarsePointer";
import { clampLevel, useSettingsStore } from "@/state/settingsStore";
import { Field } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import styles from "./menu.module.css";

export interface SettingsPanelProps {
  /** The pause menu shows a reduced set (no level/mode changes mid-run). */
  compact?: boolean;
}

export function SettingsPanel({ compact = false }: SettingsPanelProps) {
  const settings = useSettingsStore();
  const preview = useMemo(() => createLevelProfile(settings.level), [settings.level]);
  const isCoarsePointer = useIsCoarsePointer();

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>Settings</div>

      {!compact && (
        <>
          <Field label="Level">
            <span className={styles.levelRow}>
              <button
                type="button"
                className={styles.stepButton}
                aria-label="Previous level"
                onClick={() => settings.setLevel(settings.level - 1)}
              >
                −
              </button>
              <input
                type="number"
                className={styles.levelInput}
                aria-label="Level number"
                min={0}
                max={MAX_LEVEL}
                value={settings.level}
                onChange={(event) => settings.setLevel(clampLevel(Number(event.target.value)))}
              />
              <button
                type="button"
                className={styles.stepButton}
                aria-label="Next level"
                onClick={() => settings.setLevel(settings.level + 1)}
              >
                +
              </button>
            </span>
          </Field>
          <p className={styles.levelPreview}>
            <strong>{preview.name}</strong> —{" "}
            {preview.ambience.replace(/([A-Z])/g, " $1").toLowerCase()},{" "}
            {preview.decay > 0.6 ? "decayed" : preview.decay > 0.3 ? "worn" : "pristine"}
          </p>

          <Field label="Mode">
            <span className={styles.levelRow}>
              <span>Single player</span>
              <span className={styles.soonTag}>multiplayer soon</span>
            </span>
          </Field>
        </>
      )}

      <Field label="Difficulty">
        <select
          className={styles.select}
          aria-label="Difficulty"
          value={settings.difficulty}
          onChange={(event) => settings.setDifficulty(event.target.value as Difficulty)}
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fog">
        <Slider
          label="Fog intensity"
          value={settings.fogIntensity}
          onChange={settings.setFogIntensity}
        />
      </Field>

      <Field label="Music">
        <Toggle label="Music" checked={settings.musicEnabled} onChange={settings.setMusicEnabled} />
        <Slider
          label="Music volume"
          value={settings.musicVolume}
          disabled={!settings.musicEnabled}
          onChange={settings.setMusicVolume}
        />
      </Field>

      <Field label="Sound FX">
        <Toggle
          label="Sound effects"
          checked={settings.sfxEnabled}
          onChange={settings.setSfxEnabled}
        />
        <Slider
          label="Sound effects volume"
          value={settings.sfxVolume}
          disabled={!settings.sfxEnabled}
          onChange={settings.setSfxVolume}
        />
      </Field>

      {isCoarsePointer && (
        <Field label="Look sensitivity">
          <Slider
            label="Touch look sensitivity"
            value={settings.touchLookSensitivity}
            min={0.3}
            max={3}
            step={0.1}
            onChange={settings.setTouchLookSensitivity}
          />
        </Field>
      )}
    </div>
  );
}
