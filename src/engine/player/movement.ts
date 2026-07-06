import { ACCELERATION, SPRINT_MULTIPLIER, WALK_SPEED } from "@/config/constants";

export interface MoveInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface MoveState {
  /** Velocity in world space, m/s. */
  vx: number;
  vz: number;
}

export const createMoveState = (): MoveState => ({ vx: 0, vz: 0 });

/** Camera-relative wish direction on the XZ plane, normalized. */
export function wishDirection(input: MoveInput, yaw: number): { x: number; z: number } {
  // three.js convention: yaw 0 looks down -Z; forward = (-sin yaw, -cos yaw).
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = -fz;
  const rz = fx;

  let x = 0;
  let z = 0;
  if (input.forward) {
    x += fx;
    z += fz;
  }
  if (input.backward) {
    x -= fx;
    z -= fz;
  }
  if (input.right) {
    x += rx;
    z += rz;
  }
  if (input.left) {
    x -= rx;
    z -= rz;
  }

  const length = Math.hypot(x, z);
  return length > 0 ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}

export interface MovementTick {
  isMoving: boolean;
  isSprinting: boolean;
  /** Current horizontal speed, m/s. */
  speed: number;
}

/**
 * Advances velocity toward the wished direction with exponential smoothing.
 * Framerate-independent for a fixed dt; mutates `state` in place (called at
 * simulation frequency — allocating here would churn the GC).
 */
export function stepMovement(
  state: MoveState,
  input: MoveInput,
  yaw: number,
  canSprint: boolean,
  dt: number,
): MovementTick {
  const wish = wishDirection(input, yaw);
  const wantsMove = wish.x !== 0 || wish.z !== 0;
  const isSprinting = input.sprint && canSprint && wantsMove;
  const targetSpeed = wantsMove ? WALK_SPEED * (isSprinting ? SPRINT_MULTIPLIER : 1) : 0;

  const blend = Math.min(1, ACCELERATION * dt);
  state.vx += (wish.x * targetSpeed - state.vx) * blend;
  state.vz += (wish.z * targetSpeed - state.vz) * blend;

  const speed = Math.hypot(state.vx, state.vz);
  return { isMoving: speed > 0.1, isSprinting, speed };
}
