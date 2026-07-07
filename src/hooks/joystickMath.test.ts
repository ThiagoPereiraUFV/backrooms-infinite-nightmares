import { describe, expect, it } from "vitest";
import { clampToRadius, normalizeStick, stickToMoveFlags } from "./joystickMath";

describe("clampToRadius", () => {
  it("leaves vectors inside the radius untouched", () => {
    expect(clampToRadius(3, 4, 10)).toEqual({ x: 3, y: 4 });
  });

  it("clamps vectors outside the radius, preserving direction", () => {
    const result = clampToRadius(3, 4, 5); // dist is already exactly 5
    expect(result.x).toBeCloseTo(3);
    expect(result.y).toBeCloseTo(4);
    const clamped = clampToRadius(6, 8, 5); // dist 10, scale 0.5
    expect(clamped.x).toBeCloseTo(3);
    expect(clamped.y).toBeCloseTo(4);
  });

  it("leaves the zero vector untouched", () => {
    expect(clampToRadius(0, 0, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe("normalizeStick", () => {
  const RADIUS = 50;
  const DEADZONE = 10;

  it("returns zero inside the dead zone", () => {
    expect(normalizeStick(5, 0, RADIUS, DEADZONE)).toEqual({ x: 0, y: 0 });
    expect(normalizeStick(0, 0, RADIUS, DEADZONE)).toEqual({ x: 0, y: 0 });
  });

  it("reaches exactly 1 at the radius (no dead-zone jump)", () => {
    const result = normalizeStick(RADIUS, 0, RADIUS, DEADZONE);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });

  it("reaches exactly 1 just past the dead zone boundary, not a jump", () => {
    const justInside = normalizeStick(DEADZONE + 0.01, 0, RADIUS, DEADZONE);
    expect(Math.hypot(justInside.x, justInside.y)).toBeCloseTo(0, 1);
  });

  it("clamps offsets beyond the radius to magnitude 1", () => {
    const result = normalizeStick(RADIUS * 2, 0, RADIUS, DEADZONE);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });

  it("preserves direction", () => {
    const result = normalizeStick(0, -30, RADIUS, DEADZONE);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeLessThan(0);
  });

  it("degrades gracefully when radius <= deadzone", () => {
    expect(normalizeStick(20, 0, 5, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe("stickToMoveFlags", () => {
  it("is all-false near center", () => {
    expect(stickToMoveFlags(0, 0)).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
    });
  });

  it("maps negative y (drag up) to forward", () => {
    expect(stickToMoveFlags(0, -1)).toMatchObject({ forward: true, backward: false });
  });

  it("maps positive y (drag down) to backward", () => {
    expect(stickToMoveFlags(0, 1)).toMatchObject({ forward: false, backward: true });
  });

  it("maps negative x to left, positive x to right", () => {
    expect(stickToMoveFlags(-1, 0)).toMatchObject({ left: true, right: false });
    expect(stickToMoveFlags(1, 0)).toMatchObject({ left: false, right: true });
  });

  it("allows diagonals (two flags true at once)", () => {
    expect(stickToMoveFlags(0.8, -0.8)).toEqual({
      forward: true,
      backward: false,
      left: false,
      right: true,
    });
  });

  it("respects a custom threshold", () => {
    expect(stickToMoveFlags(0.2, 0, 0.35).right).toBe(false);
    expect(stickToMoveFlags(0.2, 0, 0.1).right).toBe(true);
  });
});
