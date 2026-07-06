import { Registry } from "../registry";

/**
 * Phase 2 contract for world entities (enemies, wanderers, ...). The game
 * loop already calls EntitySystem.update every simulation tick, so shipping
 * an enemy later means registering a definition — the loop doesn't change.
 */
export interface EntityContext {
  playerPosition: { x: number; z: number };
  /** Routed through the difficulty-scaled damage pipeline. */
  damagePlayer(amount: number): void;
  deltaSeconds: number;
}

export interface EntityDefinition {
  id: string;
  spawn(x: number, z: number): EntityInstance;
}

export interface EntityInstance {
  definitionId: string;
  x: number;
  z: number;
  update(context: EntityContext): void;
}

export const entityRegistry = new Registry<EntityDefinition>();

export class EntitySystem {
  private readonly entities: EntityInstance[] = [];

  add(entity: EntityInstance): void {
    this.entities.push(entity);
  }

  clear(): void {
    this.entities.length = 0;
  }

  get count(): number {
    return this.entities.length;
  }

  /** No-op while the registry is empty (MVP) — the hook point costs nothing. */
  update(context: EntityContext): void {
    for (const entity of this.entities) {
      entity.update(context);
    }
  }
}
