import { describe, expect, it } from "vitest";
import type { ChunkSpawn } from "../generation/cells";
import { entityRegistry } from "../entities";
import { activeItemSpawns, itemRegistry, type Item, type ItemContext } from "./index";

describe("item registry", () => {
  it("registers the three MVP items as consumable/toggle appropriately", () => {
    expect(itemRegistry.size).toBe(3);
    expect(itemRegistry.get("adrenaline")?.consumable).toBe(true);
    expect(itemRegistry.get("bandage")?.consumable).toBe(true);
    expect(itemRegistry.get("flashlight")?.consumable).toBe(false);
    expect(itemRegistry.get("flashlight")?.stackable).toBe(false);
  });

  it("registers the wanderer entity", () => {
    expect(entityRegistry.has("wanderer")).toBe(true);
  });

  const context = (): { context: ItemContext; calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      context: {
        healPlayer: (amount) => calls.push(`heal:${amount}`),
        boostStamina: (amount) => calls.push(`stamina:${amount}`),
        toggleFlashlight: () => calls.push("flashlight"),
      },
    };
  };

  it("adrenaline boosts stamina", () => {
    const { context: ctx, calls } = context();
    itemRegistry.get("adrenaline")?.use(ctx);
    expect(calls).toEqual(["stamina:60"]);
  });

  it("bandage heals", () => {
    const { context: ctx, calls } = context();
    itemRegistry.get("bandage")?.use(ctx);
    expect(calls).toEqual(["heal:35"]);
  });

  it("flashlight toggles rather than being consumed", () => {
    const { context: ctx, calls } = context();
    itemRegistry.get("flashlight")?.use(ctx);
    expect(calls).toEqual(["flashlight"]);
  });

  it("accepts an item definition end to end (registry wiring)", () => {
    const { context: ctx, calls } = context();
    const pill: Item = {
      id: "test-adrenaline",
      name: "Adrenaline Pill",
      description: "A burst of stamina.",
      stackable: true,
      consumable: true,
      use: (c) => c.boostStamina(50),
    };
    pill.use(ctx);
    expect(calls).toEqual(["stamina:50"]);
  });
});

describe("activeItemSpawns", () => {
  const spawns: ChunkSpawn[] = [
    { id: "bandage", cellX: 1, cellZ: 1 },
    { id: "adrenaline", cellX: 2, cellZ: 3 },
    { id: "wanderer", cellX: 4, cellZ: 5 }, // entity, must never be treated as an item
  ];

  it("excludes entity ids even at full scarcity relief", () => {
    const active = activeItemSpawns(0, 0, spawns, 0);
    expect(active.every((s) => s.id !== "wanderer")).toBe(true);
  });

  it("keeps everything eligible when scarcity is 0", () => {
    const active = activeItemSpawns(0, 0, spawns, 0);
    expect(active).toHaveLength(2);
  });

  it("keeps nothing when scarcity is 1", () => {
    const active = activeItemSpawns(0, 0, spawns, 1);
    expect(active).toHaveLength(0);
  });

  it("is deterministic for a given chunk/scarcity", () => {
    expect(activeItemSpawns(3, -2, spawns, 0.5)).toEqual(activeItemSpawns(3, -2, spawns, 0.5));
  });
});
