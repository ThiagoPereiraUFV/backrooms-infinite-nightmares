import type { Rng } from "../generation/rng";
import { resolveMovement } from "../player/collision";
import type { EntityContext, EntityInstance } from "./index";

/**
 * Three shared behavior strategies (PLAN-4 §9.2) so five-plus lore entities
 * don't mean five-plus copies of roam/chase/freeze/contact-damage logic that
 * differ only in numbers. Each factory returns a `spawn(x, z, rng)` function
 * ready to become an `EntityDefinition.spawn` — seeded from the caller's
 * `Rng` rather than `Math.random`, so behavior is reproducible and
 * unit-testable without mocking a global (see PLAN-4 D5).
 */

interface RoamState {
  roamTargetX: number;
  roamTargetZ: number;
  hasRoamTarget: boolean;
}

const ROAM_PICK_RADIUS = 6;
const ROAM_ARRIVE_RADIUS = 0.5;

/** Picks a new roam target and steps toward the current one; shared by chaser (idle) and drifter. */
function stepRoam(
  x: number,
  z: number,
  state: RoamState,
  rng: Rng,
  roamSpeed: number,
  deltaSeconds: number,
): { stepX: number; stepZ: number } {
  if (!state.hasRoamTarget) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(0, ROAM_PICK_RADIUS);
    state.roamTargetX = x + Math.cos(angle) * radius;
    state.roamTargetZ = z + Math.sin(angle) * radius;
    state.hasRoamTarget = true;
  }
  const tx = state.roamTargetX - x;
  const tz = state.roamTargetZ - z;
  const distToTarget = Math.hypot(tx, tz);
  if (distToTarget < ROAM_ARRIVE_RADIUS) {
    state.hasRoamTarget = false;
    return { stepX: 0, stepZ: 0 };
  }
  return {
    stepX: (tx / distToTarget) * roamSpeed * deltaSeconds,
    stepZ: (tz / distToTarget) * roamSpeed * deltaSeconds,
  };
}

export interface ChaserParams {
  roamSpeed: number;
  chaseSpeedBase: number;
  chaseSpeedMax: number;
  aggroRadius: number;
  deaggroRadius: number;
  contactRadius: number;
  damagePerSecond: number;
  radius: number;
}

interface ChaserState extends RoamState {
  aggroed: boolean;
}

/** Roams idly until the player strays within `aggroRadius`, then chases and deals contact damage. */
export function createChaser(
  definitionId: string,
  params: ChaserParams,
): (x: number, z: number, rng: Rng) => EntityInstance {
  return (x, z, rng) => {
    const state: ChaserState = {
      roamTargetX: x,
      roamTargetZ: z,
      hasRoamTarget: false,
      aggroed: false,
    };
    const instance: EntityInstance & { state: ChaserState } = {
      definitionId,
      x,
      z,
      state,
      update(context: EntityContext) {
        const dx = context.playerPosition.x - instance.x;
        const dz = context.playerPosition.z - instance.z;
        const distToPlayer = Math.hypot(dx, dz);

        if (distToPlayer < params.aggroRadius) state.aggroed = true;
        else if (distToPlayer > params.deaggroRadius) state.aggroed = false;

        let stepX = 0;
        let stepZ = 0;

        if (state.aggroed) {
          if (distToPlayer < params.contactRadius) {
            context.damagePlayer(params.damagePerSecond * context.deltaSeconds);
          }
          if (distToPlayer > 1e-4) {
            const speed =
              params.chaseSpeedBase +
              (params.chaseSpeedMax - params.chaseSpeedBase) * context.aggression;
            stepX = (dx / distToPlayer) * speed * context.deltaSeconds;
            stepZ = (dz / distToPlayer) * speed * context.deltaSeconds;
          }
        } else {
          const step = stepRoam(
            instance.x,
            instance.z,
            state,
            rng,
            params.roamSpeed,
            context.deltaSeconds,
          );
          stepX = step.stepX;
          stepZ = step.stepZ;
        }

        const resolved = resolveMovement(
          context.world,
          instance.x,
          instance.z,
          stepX,
          stepZ,
          params.radius,
        );
        instance.x = resolved.x;
        instance.z = resolved.z;
      },
    };
    return instance;
  };
}

export interface StalkerParams {
  approachSpeed: number;
  contactRadius: number;
  damagePerSecond: number;
  radius: number;
  /** Dot-product threshold above which the player counts as "looking at it" (freezes it). cos(halfAngle). */
  viewCosThreshold: number;
}

/** Advances toward the player only while unobserved; freezes the instant it is looked at. */
export function createStalker(
  definitionId: string,
  params: StalkerParams,
): (x: number, z: number, rng: Rng) => EntityInstance {
  return (x, z) => {
    const instance: EntityInstance = {
      definitionId,
      x,
      z,
      update(context: EntityContext) {
        const dx = context.playerPosition.x - instance.x;
        const dz = context.playerPosition.z - instance.z;
        const dist = Math.hypot(dx, dz);

        if (dist < params.contactRadius) {
          context.damagePlayer(params.damagePerSecond * context.deltaSeconds);
        }

        let stepX = 0;
        let stepZ = 0;
        if (dist > 1e-4) {
          // Vector from the player toward this entity, compared against
          // where the player is looking: a high dot product means "observed".
          const towardEntityX = -dx / dist;
          const towardEntityZ = -dz / dist;
          const facingDot =
            context.playerForward.x * towardEntityX + context.playerForward.z * towardEntityZ;
          const observed = facingDot > params.viewCosThreshold;
          if (!observed) {
            stepX = (dx / dist) * params.approachSpeed * context.deltaSeconds;
            stepZ = (dz / dist) * params.approachSpeed * context.deltaSeconds;
          }
        }

        const resolved = resolveMovement(
          context.world,
          instance.x,
          instance.z,
          stepX,
          stepZ,
          params.radius,
        );
        instance.x = resolved.x;
        instance.z = resolved.z;
      },
    };
    return instance;
  };
}

export interface DrifterParams {
  roamSpeed: number;
  radius: number;
}

/** Wanders forever, never chases, never damages the player — ambient dread only. */
export function createDrifter(
  definitionId: string,
  params: DrifterParams,
): (x: number, z: number, rng: Rng) => EntityInstance {
  return (x, z, rng) => {
    const state: RoamState = { roamTargetX: x, roamTargetZ: z, hasRoamTarget: false };
    const instance: EntityInstance = {
      definitionId,
      x,
      z,
      update(context: EntityContext) {
        const { stepX, stepZ } = stepRoam(
          instance.x,
          instance.z,
          state,
          rng,
          params.roamSpeed,
          context.deltaSeconds,
        );
        const resolved = resolveMovement(
          context.world,
          instance.x,
          instance.z,
          stepX,
          stepZ,
          params.radius,
        );
        instance.x = resolved.x;
        instance.z = resolved.z;
      },
    };
    return instance;
  };
}
