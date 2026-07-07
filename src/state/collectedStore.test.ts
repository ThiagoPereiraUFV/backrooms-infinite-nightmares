import { beforeEach, describe, expect, it } from "vitest";
import { useCollectedStore } from "./collectedStore";

beforeEach(() => {
  useCollectedStore.getState().reset();
});

describe("collectedStore", () => {
  it("starts empty", () => {
    expect(useCollectedStore.getState().keys.size).toBe(0);
    expect(useCollectedStore.getState().isCollected("0,0,1,1,bandage")).toBe(false);
  });

  it("marks a key collected", () => {
    useCollectedStore.getState().collect("0,0,1,1,bandage");
    expect(useCollectedStore.getState().isCollected("0,0,1,1,bandage")).toBe(true);
    expect(useCollectedStore.getState().isCollected("0,0,2,2,bandage")).toBe(false);
  });

  it("is idempotent and does not create a new Set reference on a repeat collect", () => {
    useCollectedStore.getState().collect("k");
    const first = useCollectedStore.getState().keys;
    useCollectedStore.getState().collect("k");
    expect(useCollectedStore.getState().keys).toBe(first);
  });

  it("reset clears all collected keys", () => {
    useCollectedStore.getState().collect("k");
    useCollectedStore.getState().reset();
    expect(useCollectedStore.getState().keys.size).toBe(0);
  });
});
