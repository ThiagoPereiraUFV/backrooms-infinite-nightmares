import { hashInts } from "../generation/rng";

/**
 * Pure, deterministic light-flicker model — no three.js, no DOM, no
 * `Math.random`. Hashing `(seed, floor(timeSeconds * rate))` through the
 * existing `hashInts` gives a value that changes at a fixed rate and is
 * identical on every machine, which is what makes per-fixture flicker
 * (each fixture seeded by its own cell index) read as independent blinking
 * instead of the whole level pulsing in lockstep.
 */
import type { LightingMode } from "../generation/levelProfile";

const STEPS_PER_SECOND: Record<LightingMode, number> = {
  fluorescentPanels: 14, // fast enough to read as a stutter
  cagedIndustrial: 2, // slow brownout sag
  emergencyOnly: 1, // steady slow pulse
  none: 1, // never sampled meaningfully — nothing is on
};

/** uint32 -> float in [0, 1). */
const unitFloat = (h: number): number => h / 0xffffffff;

/**
 * Multiplier in [0, 1] applied to a fixture's or the ambient's base
 * intensity. `amount` is the level's `flickerAmount` (0..1); `seed` lets a
 * per-fixture caller (cell index) diverge from the level-wide ambient call.
 */
export function flickerFactor(
  mode: LightingMode,
  amount: number,
  timeSeconds: number,
  seed: number,
): number {
  if (mode === "none" || amount <= 0) return 1;

  const step = Math.floor(timeSeconds * STEPS_PER_SECOND[mode]);
  const roll = unitFloat(hashInts(seed, step, 0xf11c3e));

  switch (mode) {
    case "fluorescentPanels": {
      // Mostly steady at 1, with short stutters and rarer, deeper dropouts.
      if (roll > amount * 0.35) return 1;
      const depthRoll = unitFloat(hashInts(seed, step, 0xd3a7));
      return depthRoll < 0.2 ? 0.15 + depthRoll * 0.5 : 0.55 + depthRoll * 0.35;
    }
    case "cagedIndustrial": {
      // Slow sag/brownout: a smooth wave rather than a binary flicker.
      const wave = (Math.sin(step * 0.9 + seed * 0.013) + 1) / 2;
      return 1 - amount * 0.5 * wave;
    }
    case "emergencyOnly": {
      // Steady slow pulse between a dim floor and full.
      const wave = (Math.sin(step * 1.4 + seed * 0.021) + 1) / 2;
      return 0.6 + 0.4 * wave * (1 - amount * 0.3);
    }
    default:
      return 1;
  }
}
