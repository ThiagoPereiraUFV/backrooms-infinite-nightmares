import { describe, expect, it } from "vitest";
import { createRng } from "../generation/rng";
import { ENTITY_CATALOG, getEntityAppearance } from "./catalog";

const CUE_IDS = ["growl", "shriek", "chitter", "laugh"];

describe("ENTITY_CATALOG", () => {
  it("gives every entry a unique, non-empty id/name/appearanceId and a valid cue", () => {
    const ids = ENTITY_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ENTITY_CATALOG) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.appearanceId.length).toBeGreaterThan(0);
      expect(CUE_IDS).toContain(entry.cue);
    }
  });

  it("spawns a valid, independently-updatable EntityInstance for every entry", () => {
    for (const entry of ENTITY_CATALOG) {
      const instance = entry.spawn(1, 2, createRng(7));
      expect(instance.definitionId).toBe(entry.id);
      expect(instance.x).toBe(1);
      expect(instance.z).toBe(2);
      expect(typeof instance.update).toBe("function");
    }
  });
});

describe("getEntityAppearance", () => {
  it("returns appearance/cue metadata for a known catalog id", () => {
    const appearance = getEntityAppearance("hound");
    expect(appearance?.appearanceId).toBe("hound");
    expect(appearance?.cue).toBe("growl");
    expect(appearance?.name).toBe("Hound");
  });

  it("returns undefined for an id with no catalog entry (e.g. the generic wanderer)", () => {
    expect(getEntityAppearance("wanderer")).toBeUndefined();
    expect(getEntityAppearance("not-a-real-id")).toBeUndefined();
  });
});
