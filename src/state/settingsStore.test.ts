import { beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "@/engine/generation/levelProfile";
import { useSettingsStore } from "./settingsStore";

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

  it("accepts every roster level", () => {
    const { setLevel } = useSettingsStore.getState();
    for (const profile of LEVELS) {
      setLevel(profile.level);
      expect(useSettingsStore.getState().level).toBe(profile.level);
    }
  });

  it("falls back to the first roster level for a non-roster, negative, fractional or NaN level", () => {
    const { setLevel } = useSettingsStore.getState();
    const firstLevel = LEVELS[0].level;
    setLevel(137);
    expect(useSettingsStore.getState().level).toBe(firstLevel);
    setLevel(-5);
    expect(useSettingsStore.getState().level).toBe(firstLevel);
    setLevel(4.5);
    expect(useSettingsStore.getState().level).toBe(firstLevel);
    setLevel(Number.NaN);
    expect(useSettingsStore.getState().level).toBe(firstLevel);
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

  it("rehydrates a persisted out-of-roster level to the first roster level, keeping other settings", async () => {
    localStorage.setItem(
      "bin-settings",
      JSON.stringify({
        state: { level: 137, difficulty: "hard", musicVolume: 0.4 },
        version: 0,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().level).toBe(LEVELS[0].level);
    expect(useSettingsStore.getState().difficulty).toBe("hard");
    expect(useSettingsStore.getState().musicVolume).toBe(0.4);
  });
});
