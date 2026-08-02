import { describe, expect, it } from "vitest";
import { MANIFEST } from "./manifest";

describe("MANIFEST", () => {
  it("maps every entry through assetUrl (paths, not raw literals)", () => {
    const allPaths = [
      ...Object.values(MANIFEST.ambience),
      ...Object.values(MANIFEST.footsteps).flat(),
      ...Object.values(MANIFEST.entityCues),
      ...Object.values(MANIFEST.ui),
    ];
    expect(allPaths.length).toBeGreaterThan(0);
    for (const path of allPaths) {
      expect(path).toMatch(/^\/audio\//);
    }
  });

  it("leaves officeSilence/blackSilence ambience and carpet/pickup unmapped", () => {
    expect(MANIFEST.ambience.officeSilence).toBeUndefined();
    expect(MANIFEST.ambience.blackSilence).toBeUndefined();
    expect(MANIFEST.footsteps.carpet).toBeUndefined();
    expect(MANIFEST.ui.pickup).toBeUndefined();
  });
});
