import { describe, expect, it } from "vitest";
import { entityRegistry } from "../entities";
import { itemRegistry, type Item, type ItemContext } from "./index";

describe("phase 2 registries", () => {
  it("ship empty in the MVP", () => {
    expect(itemRegistry.size).toBe(0);
    expect(entityRegistry.size).toBe(0);
  });

  it("accept an item definition end to end (phase 2 readiness)", () => {
    const used: string[] = [];
    const context: ItemContext = {
      healPlayer: (amount) => used.push(`heal:${amount}`),
      boostStamina: (amount) => used.push(`stamina:${amount}`),
      toggleFlashlight: () => used.push("flashlight"),
    };
    const pill: Item = {
      id: "test-adrenaline",
      name: "Adrenaline Pill",
      description: "A burst of stamina.",
      stackable: true,
      use: (ctx) => ctx.boostStamina(50),
    };
    // Local registry semantics are covered in registry.test.ts; this checks
    // the item contract wiring.
    pill.use(context);
    expect(used).toEqual(["stamina:50"]);
  });
});
