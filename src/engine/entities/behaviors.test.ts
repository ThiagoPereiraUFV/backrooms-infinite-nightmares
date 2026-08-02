import { describe, expect, it } from "vitest";
import { createRng } from "../generation/rng";
import type { ObstacleWorld } from "../player/collision";
import { createChaser, createDrifter, createStalker } from "./behaviors";
import type { EntityContext } from "./index";

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

describe("createChaser", () => {
  const params = {
    roamSpeed: 1,
    chaseSpeedBase: 2,
    chaseSpeedMax: 3,
    aggroRadius: 8,
    deaggroRadius: 12,
    contactRadius: 0.7,
    damagePerSecond: 10,
    radius: 0.4,
  };

  it("closes distance to the player once inside aggroRadius", () => {
    const entity = createChaser("test", params)(0, 0, createRng(1));
    const context = baseContext({ playerPosition: { x: 5, z: 0 } });
    const startDist = Math.hypot(5 - entity.x, 0 - entity.z);
    for (let i = 0; i < 60; i++) entity.update(context);
    const endDist = Math.hypot(5 - entity.x, 0 - entity.z);
    expect(endDist).toBeLessThan(startDist);
  });

  it("stops chasing beyond deaggroRadius", () => {
    const entity = createChaser("test", params)(0, 0, createRng(2));
    const readAggroed = () => (entity as unknown as { state: { aggroed: boolean } }).state.aggroed;

    entity.update(baseContext({ playerPosition: { x: 5, z: 0 } }));
    expect(readAggroed()).toBe(true);

    entity.update(baseContext({ playerPosition: { x: 200, z: 0 } }));
    expect(readAggroed()).toBe(false);
  });

  it("accumulates contact damage at the configured rate", () => {
    const entity = createChaser("test", params)(0, 0, createRng(3));
    const damages: number[] = [];
    const context = baseContext({
      playerPosition: { x: 0.3, z: 0 },
      damagePlayer: (amount) => damages.push(amount),
      deltaSeconds: 1 / 60,
    });
    entity.update(context);
    expect(damages).toHaveLength(1);
    expect(damages[0]).toBeCloseTo(params.damagePerSecond / 60, 5);
  });

  it("does not move (and does not divide by zero) when aggroed exactly on top of the player", () => {
    const entity = createChaser("test", params)(0, 0, createRng(6));
    const context = baseContext({ playerPosition: { x: 0, z: 0 } });
    entity.update(context);
    expect(entity.x).toBe(0);
    expect(entity.z).toBe(0);
  });
});

describe("createStalker", () => {
  const params = {
    approachSpeed: 1,
    contactRadius: 0.5,
    damagePerSecond: 10,
    radius: 0.4,
    viewCosThreshold: 0.5,
  };

  it("advances toward the player when playerForward points away from it", () => {
    const entity = createStalker("test", params)(0, 0, createRng(1));
    // Player at (5, 0), facing away (+Z) — not looking at the entity.
    const context = baseContext({ playerPosition: { x: 5, z: 0 }, playerForward: { x: 0, z: 1 } });
    const startDist = Math.hypot(5 - entity.x, 0 - entity.z);
    for (let i = 0; i < 30; i++) entity.update(context);
    const endDist = Math.hypot(5 - entity.x, 0 - entity.z);
    expect(endDist).toBeLessThan(startDist);
  });

  it("freezes when playerForward points directly at it", () => {
    const entity = createStalker("test", params)(0, 0, createRng(1));
    // Player at (5, 0) looking back toward the origin (-X): directly at the entity.
    const context = baseContext({ playerPosition: { x: 5, z: 0 }, playerForward: { x: -1, z: 0 } });
    for (let i = 0; i < 30; i++) entity.update(context);
    expect(entity.x).toBe(0);
    expect(entity.z).toBe(0);
  });

  it("deals contact damage once within contactRadius of the player", () => {
    const entity = createStalker("test", params)(0, 0, createRng(1));
    const damages: number[] = [];
    const context = baseContext({
      playerPosition: { x: 0.2, z: 0 },
      damagePlayer: (amount) => damages.push(amount),
      deltaSeconds: 1 / 60,
    });
    entity.update(context);
    expect(damages).toHaveLength(1);
    expect(damages[0]).toBeCloseTo(params.damagePerSecond / 60, 5);
  });

  it("does not move (and does not divide by zero) exactly on top of the player", () => {
    const entity = createStalker("test", params)(0, 0, createRng(1));
    const context = baseContext({ playerPosition: { x: 0, z: 0 } });
    entity.update(context);
    expect(entity.x).toBe(0);
    expect(entity.z).toBe(0);
  });
});

describe("createDrifter", () => {
  it("never calls damagePlayer, no matter how close the player is", () => {
    const entity = createDrifter("test", { roamSpeed: 1, radius: 0.3 })(0, 0, createRng(4));
    let damaged = false;
    const context = baseContext({
      playerPosition: { x: 0.01, z: 0 },
      damagePlayer: () => {
        damaged = true;
      },
    });
    for (let i = 0; i < 200; i++) entity.update(context);
    expect(damaged).toBe(false);
  });

  it("wanders (position changes over time) with a seeded Rng, no Math.random", () => {
    const entity = createDrifter("test", { roamSpeed: 1, radius: 0.3 })(0, 0, createRng(5));
    const context = baseContext();
    for (let i = 0; i < 120; i++) entity.update(context);
    expect(entity.x !== 0 || entity.z !== 0).toBe(true);
  });
});
