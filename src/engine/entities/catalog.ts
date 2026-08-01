import type { EntityCueId } from "../audio/AudioEngine";
import { createChaser, createDrifter, createStalker } from "./behaviors";
import type { EntityDefinition } from "./index";

/**
 * Lore entities as data (PLAN-4 §9.2/§9.5): a shared behavior + numeric
 * params, a silhouette id for the renderer (`entityGeometry.ts`), and an
 * audio cue id. Adding a lore entity is a registry entry here, not a
 * refactor — exactly the promise CLAUDE.md makes for Phase 2 content.
 * Which levels an entity inhabits is expressed by `LevelProfile.spawnTable`
 * weights alone; no per-level appearance override exists (YAGNI — nobody
 * would see a reskin through the fog anyway).
 */
export interface EntityCatalogEntry extends EntityDefinition {
  name: string;
  appearanceId: string;
  cue: EntityCueId;
}

export const ENTITY_CATALOG: readonly EntityCatalogEntry[] = [
  {
    id: "hound",
    name: "Hound",
    appearanceId: "hound",
    cue: "growl",
    spawn: createChaser("hound", {
      roamSpeed: 1.3,
      chaseSpeedBase: 2.4,
      chaseSpeedMax: 4.0,
      aggroRadius: 8,
      deaggroRadius: 13,
      contactRadius: 0.8,
      damagePerSecond: 16,
      radius: 0.42,
    }),
  },
  {
    // Docile per the wiki ("deathmoths spotted at the end of dark corridors");
    // ambient dread only, never chases or damages.
    id: "deathmoth",
    name: "Deathmoth",
    appearanceId: "deathmoth",
    cue: "chitter",
    spawn: createDrifter("deathmoth", { roamSpeed: 0.9, radius: 0.3 }),
  },
  {
    // "Incredibly skittish, constantly hiding" per the wiki — a stalker
    // freezes when observed rather than closing distance regardless.
    id: "skinStealer",
    name: "Skin-Stealer",
    appearanceId: "skinStealer",
    cue: "shriek",
    spawn: createStalker("skinStealer", {
      approachSpeed: 0.9,
      contactRadius: 0.85,
      damagePerSecond: 22,
      radius: 0.45,
      viewCosThreshold: 0.3,
    }),
  },
  {
    id: "smiler",
    name: "Smiler",
    appearanceId: "smiler",
    cue: "laugh",
    spawn: createStalker("smiler", {
      approachSpeed: 1.1,
      contactRadius: 0.75,
      damagePerSecond: 18,
      radius: 0.42,
      viewCosThreshold: 0.4,
    }),
  },
  {
    // "The Thing on Level 7" — a single named, slow-moving aquatic entity.
    id: "aquaticThing",
    name: "The Thing",
    appearanceId: "aquaticThing",
    cue: "growl",
    spawn: createChaser("aquaticThing", {
      roamSpeed: 0.6,
      chaseSpeedBase: 1.0,
      chaseSpeedMax: 1.6,
      aggroRadius: 9,
      deaggroRadius: 14,
      contactRadius: 0.9,
      damagePerSecond: 20,
      radius: 0.6,
    }),
  },
  {
    // Mortisdoptera — moth-like swarm predator recorded on Level 8.
    id: "caveDweller",
    name: "Mortisdoptera",
    appearanceId: "caveDweller",
    cue: "chitter",
    spawn: createChaser("caveDweller", {
      roamSpeed: 1.0,
      chaseSpeedBase: 1.8,
      chaseSpeedMax: 3.0,
      aggroRadius: 7,
      deaggroRadius: 12,
      contactRadius: 0.7,
      damagePerSecond: 14,
      radius: 0.35,
    }),
  },
];

const CATALOG_BY_ID = new Map(ENTITY_CATALOG.map((entry) => [entry.id, entry]));

/** Appearance/audio metadata for a catalog entity id, if it has one (e.g. `wanderer` does not). */
export function getEntityAppearance(
  id: string,
): Pick<EntityCatalogEntry, "appearanceId" | "cue" | "name"> | undefined {
  return CATALOG_BY_ID.get(id);
}
