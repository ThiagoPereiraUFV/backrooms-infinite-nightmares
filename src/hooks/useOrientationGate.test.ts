import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/state/gameStore";
import { mockMatchMedia } from "./matchMediaTestUtils";
import { useOrientationGate } from "./useOrientationGate";

const ORIENTATION_QUERY = "(orientation: portrait)";
const POINTER_QUERY = "(pointer: coarse), (hover: none)";

beforeEach(() => {
  Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
});

afterEach(() => {
  // @ts-expect-error test cleanup of a test-only global override
  delete window.matchMedia;
  useGameStore.setState({ phase: "splash" });
});

describe("useOrientationGate", () => {
  it("never blocks on a fine-pointer desktop, even in a tall window", () => {
    mockMatchMedia({ [ORIENTATION_QUERY]: true, [POINTER_QUERY]: false });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    useGameStore.setState({ phase: "playing" });
    const { result } = renderHook(() => useOrientationGate("playing"));
    expect(result.current).toBe(false);
  });

  it("blocks on a portrait touch device while playing", () => {
    mockMatchMedia({ [ORIENTATION_QUERY]: true, [POINTER_QUERY]: true });
    useGameStore.setState({ phase: "playing" });
    const { result } = renderHook(() => useOrientationGate("playing"));
    expect(result.current).toBe(true);
  });

  it("blocks on a portrait touch device while paused too", () => {
    mockMatchMedia({ [ORIENTATION_QUERY]: true, [POINTER_QUERY]: true });
    useGameStore.setState({ phase: "paused" });
    const { result } = renderHook(() => useOrientationGate("paused"));
    expect(result.current).toBe(true);
  });

  it("does not block loading/menu even in portrait on touch", () => {
    mockMatchMedia({ [ORIENTATION_QUERY]: true, [POINTER_QUERY]: true });
    useGameStore.setState({ phase: "loading" });
    const { result } = renderHook(() => useOrientationGate("loading"));
    expect(result.current).toBe(false);
  });

  it("auto-pauses the game when portrait+touch is detected while playing", () => {
    const media = mockMatchMedia({ [ORIENTATION_QUERY]: false, [POINTER_QUERY]: true });
    useGameStore.setState({ phase: "playing" });
    renderHook(() => useOrientationGate("playing"));
    expect(useGameStore.getState().phase).toBe("playing");
    act(() => media.set(ORIENTATION_QUERY, true));
    expect(useGameStore.getState().phase).toBe("paused");
  });

  it("clears once the device returns to landscape", () => {
    const media = mockMatchMedia({ [ORIENTATION_QUERY]: true, [POINTER_QUERY]: true });
    useGameStore.setState({ phase: "playing" });
    const { result, rerender } = renderHook(({ phase }) => useOrientationGate(phase), {
      initialProps: { phase: useGameStore.getState().phase },
    });
    expect(result.current).toBe(true);
    act(() => media.set(ORIENTATION_QUERY, false));
    rerender({ phase: useGameStore.getState().phase });
    expect(result.current).toBe(false);
  });
});
