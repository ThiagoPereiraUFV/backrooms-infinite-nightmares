import { createChaser } from "./behaviors";
import type { EntityDefinition } from "./index";

// Unchanged from the pre-PLAN-4 hardcoded constants — this is a reimplementation
// on the shared `createChaser` strategy, not a retune (PLAN-4 §14 file list:
// "Reimplemented on createChaser").
const ROAM_SPEED = 1.1;
const CHASE_SPEED_BASE = 1.8;
const CHASE_SPEED_MAX = 3.2;
const AGGRO_RADIUS = 7;
const DEAGGRO_RADIUS = 12;
const CONTACT_RADIUS = 0.75;
const CONTACT_DAMAGE_PER_SECOND = 14;
const ENTITY_RADIUS = 0.4;

/**
 * The generic hostile: roams idly until the player strays within
 * AGGRO_RADIUS, then chases (speed scaled by difficulty aggression) and
 * deals continuous contact damage. Kept registered as the fallback entity
 * (PLAN-4 §9.2) — most levels now list a named lore entity instead.
 */
export function createWandererDefinition(): EntityDefinition {
  return {
    id: "wanderer",
    spawn: createChaser("wanderer", {
      roamSpeed: ROAM_SPEED,
      chaseSpeedBase: CHASE_SPEED_BASE,
      chaseSpeedMax: CHASE_SPEED_MAX,
      aggroRadius: AGGRO_RADIUS,
      deaggroRadius: DEAGGRO_RADIUS,
      contactRadius: CONTACT_RADIUS,
      damagePerSecond: CONTACT_DAMAGE_PER_SECOND,
      radius: ENTITY_RADIUS,
    }),
  };
}
