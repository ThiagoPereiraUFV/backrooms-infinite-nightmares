import type { ChunkSpawn } from "../generation/cells";
import { filterSpawnsByKeepFraction } from "../generation/spawnFilter";
import type { Rng } from "../generation/rng";
import type { ObstacleWorld } from "../player/collision";
import { Registry } from "../registry";
import { ENTITY_CATALOG } from "./catalog";
import { createWandererDefinition } from "./wanderer";

/**
 * Contract for world entities (enemies, wanderers, ...). The game loop
 * already calls EntitySystem.update every simulation tick, so shipping a new
 * enemy means registering a definition — the loop doesn't change.
 */
export interface EntityContext {
  playerPosition: { x: number; z: number };
  /** Unit vector of the player's facing direction (XZ) — lets a `createStalker` freeze when observed. */
  playerForward: { x: number; z: number };
  /** Routed through the difficulty-scaled damage pipeline. */
  damagePlayer(amount: number): void;
  deltaSeconds: number;
  /** Same collision surface (walls, pillars, furniture) the player resolves against. */
  world: ObstacleWorld;
  /** 0..1 difficulty.enemyAggression — scales chase speed/aggro behavior. */
  aggression: number;
}

export interface EntityDefinition {
  id: string;
  /** Seeded so entity motion is reproducible and unit-testable with no `Math.random` mocking. */
  spawn(x: number, z: number, rng: Rng): EntityInstance;
}

export interface EntityInstance {
  definitionId: string;
  x: number;
  z: number;
  update(context: EntityContext): void;
}

export const entityRegistry = new Registry<EntityDefinition>();

export class EntitySystem {
  private readonly entities = new Map<string, EntityInstance>();
  private autoKeyCounter = 0;

  /** Adds an entity under an explicit key (for reconciliation) or an auto key. */
  add(entity: EntityInstance, key?: string): void {
    this.entities.set(key ?? `auto:${this.autoKeyCounter++}`, entity);
  }

  remove(key: string): void {
    this.entities.delete(key);
  }

  has(key: string): boolean {
    return this.entities.has(key);
  }

  keys(): IterableIterator<string> {
    return this.entities.keys();
  }

  entries(): IterableIterator<[string, EntityInstance]> {
    return this.entities.entries();
  }

  clear(): void {
    this.entities.clear();
  }

  get count(): number {
    return this.entities.size;
  }

  /** No-op while empty — the hook point costs nothing when nothing is spawned. */
  update(context: EntityContext): void {
    for (const entity of this.entities.values()) {
      entity.update(context);
    }
  }
}

/**
 * Entity spawn points active this session: registry-filtered from the
 * chunk's full spawn list, then thinned by difficulty aggression (0
 * aggression — peaceful — always yields none, satisfying the "peaceful
 * spawns nothing" invariant without special-casing it).
 */
export function activeEntitySpawns(
  cx: number,
  cz: number,
  spawns: readonly ChunkSpawn[],
  aggression: number,
): ChunkSpawn[] {
  const entities = spawns.filter((spawn) => entityRegistry.has(spawn.id));
  return filterSpawnsByKeepFraction(cx, cz, entities, aggression);
}

// `wanderer` is the generic fallback so no spawn table is ever empty
// mid-refactor; it stays registered even though most levels now list a named
// lore entity instead (PLAN-4 §9.2/§9.5).
entityRegistry.register(createWandererDefinition());
for (const definition of ENTITY_CATALOG) entityRegistry.register(definition);
