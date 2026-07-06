import { describe, expect, it } from "vitest";
import { MAX_LEVEL } from "@/config/constants";
import { createLevelProfile } from "./levelProfile";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("createLevelProfile", () => {
  it("is deterministic per level", () => {
    expect(createLevelProfile(37)).toEqual(createLevelProfile(37));
  });

  it("produces a valid profile for every level 0..999", () => {
    for (let level = 0; level <= MAX_LEVEL; level++) {
      const profile = createLevelProfile(level);

      expect(profile.level).toBe(level);
      expect(profile.name.length).toBeGreaterThan(0);

      for (const color of Object.values(profile.palette)) {
        expect(color).toMatch(HEX_COLOR);
      }

      const totalWeight = Object.values(profile.styleWeights).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBeGreaterThan(0);

      expect(profile.wallDensity).toBeGreaterThanOrEqual(0);
      expect(profile.wallDensity).toBeLessThanOrEqual(1);
      expect(profile.ceilingHeight).toBeGreaterThanOrEqual(2.5);
      expect(profile.ceilingHeight).toBeLessThanOrEqual(6.5);
      expect(profile.fogDensity).toBeGreaterThan(0);
      expect(profile.lightIntensity).toBeGreaterThanOrEqual(0);
      expect(profile.lightIntensity).toBeLessThanOrEqual(1);
      expect(profile.flickerAmount).toBeGreaterThanOrEqual(0);
      expect(profile.flickerAmount).toBeLessThanOrEqual(1);
      expect(profile.decay).toBeGreaterThanOrEqual(0);
      expect(profile.decay).toBeLessThanOrEqual(1);
      expect(Number.isInteger(profile.lightSpacing)).toBe(true);
      expect(profile.lightSpacing).toBeGreaterThanOrEqual(3);
      expect(profile.spawnTable).toEqual([]);
    }
  });

  it("gives canonical levels their lore identities", () => {
    expect(createLevelProfile(0).name).toBe("The Lobby");
    expect(createLevelProfile(1).name).toBe("Habitable Zone");
    expect(createLevelProfile(6).name).toBe("Lights Out");
    // Level 6 is nearly pitch black with heavy fog.
    expect(createLevelProfile(6).lightIntensity).toBeLessThan(0.1);
    expect(createLevelProfile(6).fogDensity).toBeGreaterThan(0.1);
  });

  it("varies characteristics across levels", () => {
    const names = new Set<string>();
    for (let level = 100; level < 200; level++) {
      names.add(createLevelProfile(level).name);
    }
    // Name pools allow collisions, but 100 levels should still be diverse.
    expect(names.size).toBeGreaterThan(50);
  });
});
