import { describe, expect, it } from "vitest";
import type { SurfaceStyle } from "@/engine/generation/levelProfile";
import { SURFACE_PAINTERS } from "./proceduralTextures";

// proceduralTextures.ts calls document.createElement("canvas").getContext("2d"),
// which is null in jsdom without the native `canvas` package (PLAN-4 §12.7) —
// so this only asserts what needs no canvas: that every SurfaceStyle has a
// painter. The `Record<SurfaceStyle, SurfacePainter>` type already makes this
// a compile-time guarantee; this is the matching runtime check.
const SURFACE_STYLES: readonly SurfaceStyle[] = [
  "dampWallpaper",
  "rawConcrete",
  "rivetedSteel",
  "rustedUtility",
  "officeDrywall",
  "hotelPaper",
  "voidBlack",
  "wetTile",
  "bareRock",
];

describe("SURFACE_PAINTERS", () => {
  it("has a painter with wall/floor/ceiling for every SurfaceStyle", () => {
    for (const style of SURFACE_STYLES) {
      const painter = SURFACE_PAINTERS[style];
      expect(painter).toBeDefined();
      expect(typeof painter.wall).toBe("function");
      expect(typeof painter.floor).toBe("function");
      expect(typeof painter.ceiling).toBe("function");
    }
    expect(Object.keys(SURFACE_PAINTERS).sort()).toEqual([...SURFACE_STYLES].sort());
  });
});
