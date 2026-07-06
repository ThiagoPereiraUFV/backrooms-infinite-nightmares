import { describe, expect, it } from "vitest";
import { EntitySystem, type EntityContext, type EntityInstance } from "./entities";
import { Registry } from "./registry";

describe("Registry", () => {
  it("registers and looks up by id", () => {
    const registry = new Registry<{ id: string; value: number }>();
    registry.register({ id: "pill", value: 1 });
    expect(registry.get("pill")?.value).toBe(1);
    expect(registry.has("pill")).toBe(true);
    expect(registry.has("ghost")).toBe(false);
    expect(registry.get("ghost")).toBeUndefined();
    expect(registry.all()).toHaveLength(1);
    expect(registry.size).toBe(1);
  });

  it("rejects duplicate ids", () => {
    const registry = new Registry<{ id: string }>();
    registry.register({ id: "x" });
    expect(() => registry.register({ id: "x" })).toThrow(/duplicate/);
  });
});

describe("EntitySystem", () => {
  const context: EntityContext = {
    playerPosition: { x: 0, z: 0 },
    damagePlayer: () => {},
    deltaSeconds: 1 / 120,
  };

  it("updates every entity and supports clearing", () => {
    const system = new EntitySystem();
    let updates = 0;
    const entity: EntityInstance = {
      definitionId: "test",
      x: 0,
      z: 0,
      update: () => {
        updates++;
      },
    };
    system.add(entity);
    system.add({ ...entity });
    system.update(context);
    expect(updates).toBe(2);
    expect(system.count).toBe(2);
    system.clear();
    system.update(context);
    expect(updates).toBe(2);
    expect(system.count).toBe(0);
  });
});
