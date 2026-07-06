/**
 * Deterministic seeded randomness. Same seed => same sequence, on every
 * platform, forever. All world generation flows through this module so
 * worlds are reproducible (tests, shared seeds, future multiplayer sync).
 */

/** Mixes any number of integers into a well-distributed uint32. */
export function hashInts(...values: number[]): number {
  let h = 0x9e3779b9;
  for (const value of values) {
    let x = value | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    h = (Math.imul(h ^ x, 0x27d4eb2f) + 0x165667b1) | 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** Hashes a string (e.g. a user-provided seed phrase) into a uint32. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 — fast, high-quality 32-bit PRNG. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (minInclusive, maxExclusive) =>
      minInclusive + Math.floor(next() * (maxExclusive - minInclusive)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/**
 * Picks a key from a weight table. Deterministic given the rng state.
 * Zero/negative weights are never picked (unless all are, then first key wins).
 */
export function pickWeighted<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  let total = 0;
  for (const [, weight] of entries) total += Math.max(0, weight);
  if (total <= 0) return entries[0][0];
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}
