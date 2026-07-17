import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LEVEL } from "@/config/constants";
import { clampLevel, useSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      level: 0,
      difficulty: "peaceful",
      musicEnabled: true,
      musicVolume: 0.7,
      sfxEnabled: true,
      sfxVolume: 0.8,
      mode: "single",
      touchLookSensitivity: 1,
      fogIntensity: 0.5,
    });
  });

  it("clamps level into 0..999", () => {
    const { setLevel } = useSettingsStore.getState();
    setLevel(-5);
    expect(useSettingsStore.getState().level).toBe(0);
    setLevel(500.7);
    expect(useSettingsStore.getState().level).toBe(501);
    setLevel(5000);
    expect(useSettingsStore.getState().level).toBe(MAX_LEVEL);
    setLevel(Number.NaN);
    expect(useSettingsStore.getState().level).toBe(0);
  });

  it("clamps volumes into 0..1", () => {
    const { setMusicVolume, setSfxVolume } = useSettingsStore.getState();
    setMusicVolume(4);
    setSfxVolume(-1);
    expect(useSettingsStore.getState().musicVolume).toBe(1);
    expect(useSettingsStore.getState().sfxVolume).toBe(0);
  });

  it("rejects unknown difficulties", () => {
    useSettingsStore.getState().setDifficulty("nightmare" as never);
    expect(useSettingsStore.getState().difficulty).toBe("peaceful");
    useSettingsStore.getState().setDifficulty("hard");
    expect(useSettingsStore.getState().difficulty).toBe("hard");
  });

  it("toggles audio flags", () => {
    useSettingsStore.getState().setMusicEnabled(false);
    useSettingsStore.getState().setSfxEnabled(false);
    expect(useSettingsStore.getState().musicEnabled).toBe(false);
    expect(useSettingsStore.getState().sfxEnabled).toBe(false);
  });

  it("exposes clampLevel for UI input parsing", () => {
    expect(clampLevel(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampLevel(42.4)).toBe(42);
  });

  it("clamps touch look sensitivity into 0.3..3", () => {
    const { setTouchLookSensitivity } = useSettingsStore.getState();
    setTouchLookSensitivity(0.01);
    expect(useSettingsStore.getState().touchLookSensitivity).toBe(0.3);
    setTouchLookSensitivity(10);
    expect(useSettingsStore.getState().touchLookSensitivity).toBe(3);
    setTouchLookSensitivity(1.5);
    expect(useSettingsStore.getState().touchLookSensitivity).toBe(1.5);
    setTouchLookSensitivity(Number.NaN);
    expect(useSettingsStore.getState().touchLookSensitivity).toBe(1);
  });

  it("clamps fog intensity into 0..1", () => {
    const { setFogIntensity } = useSettingsStore.getState();
    setFogIntensity(-0.5);
    expect(useSettingsStore.getState().fogIntensity).toBe(0);
    setFogIntensity(3);
    expect(useSettingsStore.getState().fogIntensity).toBe(1);
    setFogIntensity(0.8);
    expect(useSettingsStore.getState().fogIntensity).toBe(0.8);
    setFogIntensity(Number.NaN);
    expect(useSettingsStore.getState().fogIntensity).toBe(0);
  });
});
