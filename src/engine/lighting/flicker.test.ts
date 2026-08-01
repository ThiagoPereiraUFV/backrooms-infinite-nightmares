import { describe, expect, it } from "vitest";
import type { LightingMode } from "../generation/levelProfile";
import { flickerFactor } from "./flicker";

const MODES: LightingMode[] = ["fluorescentPanels", "cagedIndustrial", "emergencyOnly", "none"];

describe("flickerFactor", () => {
  it("is deterministic for a given (mode, amount, time, seed)", () => {
    for (const mode of MODES) {
      const a = flickerFactor(mode, 0.6, 12.34, 7);
      const b = flickerFactor(mode, 0.6, 12.34, 7);
      expect(a).toBe(b);
    }
  });

  it("is always within 0..1", () => {
    for (const mode of MODES) {
      for (let seed = 0; seed < 20; seed++) {
        for (let t = 0; t < 20; t += 0.7) {
          const value = flickerFactor(mode, 1, t, seed);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("amount === 0 returns exactly 1", () => {
    for (const mode of MODES) {
      expect(flickerFactor(mode, 0, 5, 1)).toBe(1);
      expect(flickerFactor(mode, 0, 500, 99)).toBe(1);
    }
  });

  it("mode 'none' returns 1 regardless of amount", () => {
    for (let amount = 0; amount <= 1; amount += 0.25) {
      expect(flickerFactor("none", amount, 3, 42)).toBe(1);
    }
  });

  it("two different seeds diverge at the same timestamp", () => {
    for (const mode of ["fluorescentPanels", "cagedIndustrial", "emergencyOnly"] as const) {
      let sawDivergence = false;
      for (let t = 0; t < 30; t += 1) {
        const a = flickerFactor(mode, 0.8, t, 1);
        const b = flickerFactor(mode, 0.8, t, 2);
        if (a !== b) {
          sawDivergence = true;
          break;
        }
      }
      expect(sawDivergence).toBe(true);
    }
  });
});
