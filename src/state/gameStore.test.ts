import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./gameStore";

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.setState({ phase: "splash" });
  });

  it("walks the happy path splash -> menu -> loading -> playing", () => {
    const store = useGameStore.getState();
    expect(store.transition("menu")).toBe(true);
    expect(useGameStore.getState().startGame()).toBe(true);
    expect(useGameStore.getState().transition("playing")).toBe(true);
    expect(useGameStore.getState().phase).toBe("playing");
  });

  it("refuses illegal transitions without changing state", () => {
    expect(useGameStore.getState().transition("playing")).toBe(false);
    expect(useGameStore.getState().phase).toBe("splash");
    expect(useGameStore.getState().startGame()).toBe(false);
    expect(useGameStore.getState().phase).toBe("splash");
  });

  it("regenerates the world seed on startGame", () => {
    useGameStore.getState().transition("menu");
    const before = useGameStore.getState().worldSeed;
    // A 32-bit seed colliding across a few runs is astronomically unlikely,
    // but retry once to make the test deterministic in spirit.
    useGameStore.getState().startGame();
    let after = useGameStore.getState().worldSeed;
    if (after === before) {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().startGame();
      after = useGameStore.getState().worldSeed;
    }
    expect(after).not.toBe(before);
  });

  it("supports pause and resume", () => {
    useGameStore.setState({ phase: "playing" });
    expect(useGameStore.getState().transition("paused")).toBe(true);
    expect(useGameStore.getState().transition("playing")).toBe(true);
  });

  it("quits to menu from any phase", () => {
    for (const phase of ["splash", "loading", "playing", "paused"] as const) {
      useGameStore.setState({ phase });
      useGameStore.getState().quitToMenu();
      expect(useGameStore.getState().phase).toBe("menu");
    }
  });

  it("is a no-op when already at menu", () => {
    useGameStore.setState({ phase: "menu" });
    useGameStore.getState().quitToMenu();
    expect(useGameStore.getState().phase).toBe("menu");
  });
});
