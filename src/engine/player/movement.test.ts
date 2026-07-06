import { describe, expect, it } from "vitest";
import { SPRINT_MULTIPLIER, WALK_SPEED } from "@/config/constants";
import { createMoveState, stepMovement, wishDirection, type MoveInput } from "./movement";

const input = (overrides: Partial<MoveInput> = {}): MoveInput => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  ...overrides,
});

describe("wishDirection", () => {
  it("is zero without input", () => {
    expect(wishDirection(input(), 0)).toEqual({ x: 0, z: 0 });
  });

  it("points down -Z when facing forward at yaw 0", () => {
    const dir = wishDirection(input({ forward: true }), 0);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(-1);
  });

  it("cancels opposing keys", () => {
    expect(wishDirection(input({ forward: true, backward: true }), 1.3)).toEqual({ x: 0, z: 0 });
  });

  it("normalizes diagonals", () => {
    const dir = wishDirection(input({ forward: true, right: true }), 0);
    expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1);
  });

  it("rotates with yaw", () => {
    const dir = wishDirection(input({ forward: true }), Math.PI / 2);
    expect(dir.x).toBeCloseTo(-1);
    expect(dir.z).toBeCloseTo(0);
  });
});

describe("stepMovement", () => {
  const settle = (moveInput: MoveInput, canSprint: boolean) => {
    const state = createMoveState();
    let tick = stepMovement(state, moveInput, 0, canSprint, 1 / 120);
    for (let i = 0; i < 600; i++) {
      tick = stepMovement(state, moveInput, 0, canSprint, 1 / 120);
    }
    return { state, tick };
  };

  it("converges on walk speed", () => {
    const { tick } = settle(input({ forward: true }), true);
    expect(tick.speed).toBeCloseTo(WALK_SPEED, 1);
    expect(tick.isMoving).toBe(true);
    expect(tick.isSprinting).toBe(false);
  });

  it("converges on sprint speed when sprinting is allowed", () => {
    const { tick } = settle(input({ forward: true, sprint: true }), true);
    expect(tick.speed).toBeCloseTo(WALK_SPEED * SPRINT_MULTIPLIER, 1);
    expect(tick.isSprinting).toBe(true);
  });

  it("ignores sprint when not allowed (exhausted)", () => {
    const { tick } = settle(input({ forward: true, sprint: true }), false);
    expect(tick.speed).toBeCloseTo(WALK_SPEED, 1);
    expect(tick.isSprinting).toBe(false);
  });

  it("does not sprint while stationary", () => {
    const { tick } = settle(input({ sprint: true }), true);
    expect(tick.isSprinting).toBe(false);
    expect(tick.isMoving).toBe(false);
  });

  it("decelerates to rest when input stops", () => {
    const state = createMoveState();
    for (let i = 0; i < 300; i++) stepMovement(state, input({ forward: true }), 0, true, 1 / 120);
    for (let i = 0; i < 600; i++) stepMovement(state, input(), 0, true, 1 / 120);
    expect(Math.hypot(state.vx, state.vz)).toBeLessThan(0.05);
  });
});
