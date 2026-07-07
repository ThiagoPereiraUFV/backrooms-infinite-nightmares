import { resolveMovement } from "../player/collision";
import type { EntityContext, EntityDefinition, EntityInstance } from "./index";

const ROAM_SPEED = 1.1;
const CHASE_SPEED_BASE = 1.8;
const CHASE_SPEED_MAX = 3.2;
const AGGRO_RADIUS = 7;
const DEAGGRO_RADIUS = 12;
const CONTACT_RADIUS = 0.75;
const CONTACT_DAMAGE_PER_SECOND = 14;
const ENTITY_RADIUS = 0.4;
const ROAM_PICK_RADIUS = 6;
const ROAM_ARRIVE_RADIUS = 0.5;

interface WandererState {
  roamTargetX: number;
  roamTargetZ: number;
  hasRoamTarget: boolean;
  aggroed: boolean;
}

/**
 * A hostile that roams idly until the player strays within AGGRO_RADIUS, then
 * chases (speed scaled by difficulty aggression) and deals continuous contact
 * damage. Movement is resolved against the same ObstacleWorld collision the
 * player uses, so it never clips through walls, pillars, or furniture.
 */
function updateWanderer(
  self: EntityInstance & { state: WandererState },
  context: EntityContext,
): void {
  const dx = context.playerPosition.x - self.x;
  const dz = context.playerPosition.z - self.z;
  const distToPlayer = Math.hypot(dx, dz);

  if (distToPlayer < AGGRO_RADIUS) self.state.aggroed = true;
  else if (distToPlayer > DEAGGRO_RADIUS) self.state.aggroed = false;

  let stepX = 0;
  let stepZ = 0;

  if (self.state.aggroed) {
    if (distToPlayer < CONTACT_RADIUS) {
      context.damagePlayer(CONTACT_DAMAGE_PER_SECOND * context.deltaSeconds);
    }
    if (distToPlayer > 1e-4) {
      const speed = CHASE_SPEED_BASE + (CHASE_SPEED_MAX - CHASE_SPEED_BASE) * context.aggression;
      stepX = (dx / distToPlayer) * speed * context.deltaSeconds;
      stepZ = (dz / distToPlayer) * speed * context.deltaSeconds;
    }
  } else {
    if (!self.state.hasRoamTarget) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * ROAM_PICK_RADIUS;
      self.state.roamTargetX = self.x + Math.cos(angle) * radius;
      self.state.roamTargetZ = self.z + Math.sin(angle) * radius;
      self.state.hasRoamTarget = true;
    }
    const tx = self.state.roamTargetX - self.x;
    const tz = self.state.roamTargetZ - self.z;
    const distToTarget = Math.hypot(tx, tz);
    if (distToTarget < ROAM_ARRIVE_RADIUS) {
      self.state.hasRoamTarget = false;
    } else {
      stepX = (tx / distToTarget) * ROAM_SPEED * context.deltaSeconds;
      stepZ = (tz / distToTarget) * ROAM_SPEED * context.deltaSeconds;
    }
  }

  const resolved = resolveMovement(context.world, self.x, self.z, stepX, stepZ, ENTITY_RADIUS);
  self.x = resolved.x;
  self.z = resolved.z;
}

export function createWandererDefinition(): EntityDefinition {
  return {
    id: "wanderer",
    spawn: (x, z) => {
      const instance: EntityInstance & { state: WandererState } = {
        definitionId: "wanderer",
        x,
        z,
        state: { roamTargetX: x, roamTargetZ: z, hasRoamTarget: false, aggroed: false },
        update(context) {
          updateWanderer(instance, context);
        },
      };
      return instance;
    },
  };
}
