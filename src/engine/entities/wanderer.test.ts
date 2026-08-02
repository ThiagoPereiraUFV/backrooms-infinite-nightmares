import { describe, expect, it } from "vitest";
import { createRng } from "../generation/rng";
import type { ObstacleAabb, ObstacleWorld } from "../player/collision";
import { activeEntitySpawns, EntitySystem, entityRegistry, type EntityContext } from "./index";
import { createWandererDefinition } from "./wanderer";

const emptyWorld: ObstacleWorld = { obstaclesIn: () => [] };

const baseContext = (overrides: Partial<EntityContext> = {}): EntityContext => ({
  playerPosition: { x: 1000, z: 1000 },
  playerForward: { x: 0, z: 1 },
  damagePlayer: () => {},
  deltaSeconds: 1 / 60,
  world: emptyWorld,
  aggression: 1,
  ...overrides,
});

const spawnWanderer = (x: number, z: number, seed = 1) =>
  createWandererDefinition().spawn(x, z, createRng(seed));

describe("wanderer entity", () => {
  it("is registered under id 'wanderer'", () => {
    expect(entityRegistry.has("wanderer")).toBe(true);
    expect(entityRegistry.get("wanderer")?.id).toBe("wanderer");
  });

  it("roams when the player is far away, without dealing damage", () => {
    const entity = spawnWanderer(0, 0);
    const damages: number[] = [];
    const context = baseContext({ damagePlayer: (amount) => damages.push(amount) });
    for (let i = 0; i < 200; i++) entity.update(context);
    expect(Number.isFinite(entity.x)).toBe(true);
    expect(Number.isFinite(entity.z)).toBe(true);
    expect(entity.x !== 0 || entity.z !== 0).toBe(true);
    expect(damages).toHaveLength(0);
  });

  it("chases and deals contact damage once the player is within aggro range", () => {
    const entity = spawnWanderer(0, 0);
    const damages: number[] = [];
    const context = baseContext({
      playerPosition: { x: 3, z: 0 },
      damagePlayer: (amount) => damages.push(amount),
    });
    for (let i = 0; i < 300; i++) entity.update(context);
    const finalDistance = Math.hypot(3 - entity.x, 0 - entity.z);
    expect(finalDistance).toBeLessThan(1);
    expect(damages.length).toBeGreaterThan(0);
    expect(damages.every((d) => d > 0)).toBe(true);
  });

  it("de-aggros once the player retreats past DEAGGRO_RADIUS", () => {
    const entity = spawnWanderer(0, 0);
    const readAggroed = () => (entity as unknown as { state: { aggroed: boolean } }).state.aggroed;

    entity.update(baseContext({ playerPosition: { x: 3, z: 0 } }));
    expect(readAggroed()).toBe(true);

    entity.update(baseContext({ playerPosition: { x: 20, z: 0 } }));
    expect(readAggroed()).toBe(false);
  });

  it("stays aggroed while the player is between the aggro and de-aggro radii", () => {
    const entity = spawnWanderer(0, 0);
    const readAggroed = () => (entity as unknown as { state: { aggroed: boolean } }).state.aggroed;

    entity.update(baseContext({ playerPosition: { x: 3, z: 0 } }));
    expect(readAggroed()).toBe(true);

    // Between AGGRO_RADIUS (7) and DEAGGRO_RADIUS (12): neither condition
    // fires, so the sticky aggro flag must be left unchanged.
    entity.update(baseContext({ playerPosition: { x: 9, z: 0 } }));
    expect(readAggroed()).toBe(true);
  });

  it("chases faster at higher aggression", () => {
    const lowAgg = spawnWanderer(0, 0);
    const highAgg = spawnWanderer(0, 0);
    // Within AGGRO_RADIUS (7) but well outside CONTACT_RADIUS, so both chase.
    const playerPosition = { x: 5, z: 0 };
    lowAgg.update(baseContext({ playerPosition, aggression: 0 }));
    highAgg.update(baseContext({ playerPosition, aggression: 1 }));
    expect(Math.abs(highAgg.x)).toBeGreaterThan(Math.abs(lowAgg.x));
  });

  it("never tunnels through an obstacle while chasing", () => {
    // A wall spanning the full path between spawn and player.
    const wall: ObstacleAabb = { minX: 1.9, maxX: 2.1, minZ: -10, maxZ: 10 };
    const world: ObstacleWorld = { obstaclesIn: () => [wall] };
    const entity = spawnWanderer(0, 0);
    const context = baseContext({ playerPosition: { x: 5, z: 0 }, world });
    for (let i = 0; i < 400; i++) {
      entity.update(context);
      const overlaps = entity.x - 0.4 < wall.maxX && entity.x + 0.4 > wall.minX;
      expect(overlaps).toBe(false);
    }
  });
});

describe("activeEntitySpawns", () => {
  const spawns = [
    { id: "wanderer", cellX: 1, cellZ: 1 },
    { id: "bandage", cellX: 2, cellZ: 2 }, // item, must never be treated as an entity
  ];

  it("yields nothing at zero aggression (peaceful invariant)", () => {
    expect(activeEntitySpawns(0, 0, spawns, 0)).toEqual([]);
  });

  it("excludes item ids even at full aggression", () => {
    const active = activeEntitySpawns(0, 0, spawns, 1);
    expect(active.every((s) => s.id === "wanderer")).toBe(true);
  });
});

describe("EntitySystem", () => {
  it("reconciles by key: add, has, remove", () => {
    const system = new EntitySystem();
    const entity = spawnWanderer(0, 0);
    system.add(entity, "chunk:0,0:wanderer:1,1");
    expect(system.has("chunk:0,0:wanderer:1,1")).toBe(true);
    expect(system.count).toBe(1);
    expect([...system.keys()]).toEqual(["chunk:0,0:wanderer:1,1"]);
    system.remove("chunk:0,0:wanderer:1,1");
    expect(system.has("chunk:0,0:wanderer:1,1")).toBe(false);
    expect(system.count).toBe(0);
  });

  it("still supports unkeyed add for backward compatibility", () => {
    const system = new EntitySystem();
    system.add(spawnWanderer(0, 0));
    system.add(spawnWanderer(1, 1));
    expect(system.count).toBe(2);
    system.clear();
    expect(system.count).toBe(0);
  });

  it("exposes [key, entity] pairs via entries() and ticks every entity on update()", () => {
    const system = new EntitySystem();
    const entity = spawnWanderer(5, 5);
    let ticks = 0;
    entity.update = () => {
      ticks++;
    };
    system.add(entity, "chunk:5,5:wanderer:1,1");
    expect([...system.entries()]).toEqual([["chunk:5,5:wanderer:1,1", entity]]);

    system.update(baseContext());
    expect(ticks).toBe(1);
  });
});
