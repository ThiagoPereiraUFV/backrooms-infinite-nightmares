import { describe, expect, it } from "vitest";
import { getLevelProfile, LEVELS } from "./levelProfile";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("LEVELS (the Main Nine roster)", () => {
  it("is non-empty with unique level numbers and unique, non-empty names", () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    const levelNumbers = LEVELS.map((profile) => profile.level);
    expect(new Set(levelNumbers).size).toBe(levelNumbers.length);
    const names = LEVELS.map((profile) => profile.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("produces a valid, self-consistent profile for every roster entry", () => {
    for (const profile of LEVELS) {
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
      expect(profile.furnitureDensity).toBeGreaterThanOrEqual(0);
      expect(profile.furnitureDensity).toBeLessThanOrEqual(1);
      for (const weight of Object.values(profile.furnitureWeights)) {
        expect(weight).toBeGreaterThanOrEqual(0);
      }
      expect(profile.itemSpawnDensity).toBeGreaterThanOrEqual(0);
      expect(profile.itemSpawnDensity).toBeLessThanOrEqual(1);
      expect(profile.spawnTable.length).toBeGreaterThan(0);
      for (const entry of profile.spawnTable) {
        expect(entry.id.length).toBeGreaterThan(0);
        expect(entry.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("gives canonical levels their lore identities", () => {
    expect(getLevelProfile(0).name).toBe("The Lobby");
    expect(getLevelProfile(1).name).toBe("Parking Zone");
    expect(getLevelProfile(6).name).toBe("Lights Out");
    // The abandoned office is the furniture-dense level.
    expect(getLevelProfile(4).furnitureDensity).toBeGreaterThan(
      getLevelProfile(0).furnitureDensity,
    );
    expect(getLevelProfile(4).furnitureWeights.chair).toBeGreaterThan(0);
    // Level 6 is nearly pitch black with heavy fog.
    expect(getLevelProfile(6).lightIntensity).toBeLessThan(0.1);
    expect(getLevelProfile(6).fogDensity).toBeGreaterThan(0.1);
    // Lights Out is the scariest level lore-wise: heaviest wanderer presence.
    const wandererWeight = (level: number) =>
      getLevelProfile(level).spawnTable.find((e) => e.id === "wanderer")?.weight ?? 0;
    expect(wandererWeight(6)).toBeGreaterThan(wandererWeight(0));
  });
});

describe("getLevelProfile", () => {
  it("is deterministic per level", () => {
    expect(getLevelProfile(4)).toEqual(getLevelProfile(4));
  });

  it("returns the identical object for every roster number", () => {
    for (const profile of LEVELS) {
      expect(getLevelProfile(profile.level)).toBe(profile);
    }
  });

  it("throws for a level number outside the roster", () => {
    expect(() => getLevelProfile(999)).toThrow();
    expect(() => getLevelProfile(-1)).toThrow();
    expect(() => getLevelProfile(9)).toThrow();
  });
});
