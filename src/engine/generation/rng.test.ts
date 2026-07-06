import { describe, expect, it } from "vitest";
import { createRng, hashInts, hashString, pickWeighted } from "./rng";

describe("hashInts", () => {
  it("is deterministic", () => {
    expect(hashInts(1, 2, 3)).toBe(hashInts(1, 2, 3));
  });

  it("is order-sensitive", () => {
    expect(hashInts(1, 2)).not.toBe(hashInts(2, 1));
  });

  it("distinguishes negative coordinates", () => {
    expect(hashInts(-1, 5)).not.toBe(hashInts(1, 5));
    expect(hashInts(-3, -7)).not.toBe(hashInts(3, 7));
  });

  it("returns a uint32", () => {
    for (const value of [hashInts(0), hashInts(-99, 99), hashInts(123456789)]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("hashString", () => {
  it("is deterministic and distinguishes strings", () => {
    expect(hashString("backrooms")).toBe(hashString("backrooms"));
    expect(hashString("level0")).not.toBe(hashString("level1"));
  });
});

describe("createRng", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const sameCount = Array.from({ length: 20 }, () => a.next() === b.next()).filter(
      Boolean,
    ).length;
    expect(sameCount).toBeLessThan(3);
  });

  it("next() stays in [0, 1) with a sane mean", () => {
    const rng = createRng(42);
    let sum = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / n).toBeGreaterThan(0.47);
    expect(sum / n).toBeLessThan(0.53);
  });

  it("int() respects bounds and hits them", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(7);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]));
  });

  it("range() respects bounds", () => {
    const rng = createRng(9);
    for (let i = 0; i < 100; i++) {
      const value = rng.range(-2.5, 4.5);
      expect(value).toBeGreaterThanOrEqual(-2.5);
      expect(value).toBeLessThan(4.5);
    }
  });

  it("chance() approximates its probability", () => {
    const rng = createRng(11);
    let hits = 0;
    for (let i = 0; i < 10_000; i++) if (rng.chance(0.3)) hits++;
    expect(hits / 10_000).toBeGreaterThan(0.27);
    expect(hits / 10_000).toBeLessThan(0.33);
  });

  it("pick() only returns array members", () => {
    const rng = createRng(13);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});

describe("pickWeighted", () => {
  it("never picks zero-weight keys", () => {
    const rng = createRng(17);
    for (let i = 0; i < 500; i++) {
      expect(pickWeighted(rng, { a: 0, b: 1, c: 0 })).toBe("b");
    }
  });

  it("falls back to the first key when all weights are zero", () => {
    const rng = createRng(19);
    expect(pickWeighted(rng, { a: 0, b: 0 })).toBe("a");
  });

  it("distributes roughly by weight", () => {
    const rng = createRng(23);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) counts[pickWeighted(rng, { a: 1, b: 3 })]++;
    expect(counts.b / counts.a).toBeGreaterThan(2.5);
    expect(counts.b / counts.a).toBeLessThan(3.5);
  });
});
