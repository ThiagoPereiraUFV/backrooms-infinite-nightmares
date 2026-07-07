import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "./playerStore";

beforeEach(() => {
  usePlayerStore.getState().reset();
});

describe("playerStore inventory", () => {
  it("collects a stackable item, incrementing quantity on repeat pickups", () => {
    usePlayerStore.getState().collectItem("bandage");
    usePlayerStore.getState().collectItem("bandage");
    expect(usePlayerStore.getState().inventory).toEqual([{ itemId: "bandage", quantity: 2 }]);
  });

  it("does not duplicate a non-stackable item already owned", () => {
    usePlayerStore.getState().collectItem("flashlight");
    usePlayerStore.getState().collectItem("flashlight");
    expect(usePlayerStore.getState().inventory).toEqual([{ itemId: "flashlight", quantity: 1 }]);
  });

  it("ignores unknown item ids", () => {
    usePlayerStore.getState().collectItem("does-not-exist");
    expect(usePlayerStore.getState().inventory).toEqual([]);
  });

  it("consumes a consumable item, removing the stack at zero", () => {
    usePlayerStore.getState().collectItem("bandage");
    expect(usePlayerStore.getState().consumeItem("bandage")).toBe(true);
    expect(usePlayerStore.getState().inventory).toEqual([]);
  });

  it("decrements without removing when quantity remains", () => {
    usePlayerStore.getState().collectItem("bandage");
    usePlayerStore.getState().collectItem("bandage");
    usePlayerStore.getState().consumeItem("bandage");
    expect(usePlayerStore.getState().inventory).toEqual([{ itemId: "bandage", quantity: 1 }]);
  });

  it("refuses to consume an unowned item", () => {
    expect(usePlayerStore.getState().consumeItem("bandage")).toBe(false);
  });

  it("refuses to consume a non-consumable item (flashlight)", () => {
    usePlayerStore.getState().collectItem("flashlight");
    expect(usePlayerStore.getState().consumeItem("flashlight")).toBe(false);
    expect(usePlayerStore.getState().inventory).toEqual([{ itemId: "flashlight", quantity: 1 }]);
  });

  it("toggles the flashlight only once owned", () => {
    expect(usePlayerStore.getState().flashlightOn).toBe(false);
    usePlayerStore.getState().toggleFlashlight();
    expect(usePlayerStore.getState().flashlightOn).toBe(false); // not owned yet
    usePlayerStore.getState().collectItem("flashlight");
    usePlayerStore.getState().toggleFlashlight();
    expect(usePlayerStore.getState().flashlightOn).toBe(true);
    usePlayerStore.getState().toggleFlashlight();
    expect(usePlayerStore.getState().flashlightOn).toBe(false);
  });

  it("reset clears inventory and flashlight state", () => {
    usePlayerStore.getState().collectItem("flashlight");
    usePlayerStore.getState().toggleFlashlight();
    usePlayerStore.getState().reset();
    expect(usePlayerStore.getState().inventory).toEqual([]);
    expect(usePlayerStore.getState().flashlightOn).toBe(false);
  });
});
