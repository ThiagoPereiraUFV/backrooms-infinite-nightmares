import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "./matchMediaTestUtils";
import { useIsCoarsePointer } from "./useIsCoarsePointer";

const QUERY = "(pointer: coarse), (hover: none)";

afterEach(() => {
  // @ts-expect-error test cleanup of a test-only global override
  delete window.matchMedia;
  Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
});

describe("useIsCoarsePointer", () => {
  it("is false on a fine-pointer, no-touch desktop", () => {
    mockMatchMedia({ [QUERY]: false });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const { result } = renderHook(() => useIsCoarsePointer());
    expect(result.current).toBe(false);
  });

  it("is true when the media query matches", () => {
    mockMatchMedia({ [QUERY]: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const { result } = renderHook(() => useIsCoarsePointer());
    expect(result.current).toBe(true);
  });

  it("is true via the maxTouchPoints tiebreaker even if the query reports fine", () => {
    mockMatchMedia({ [QUERY]: false });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    const { result } = renderHook(() => useIsCoarsePointer());
    expect(result.current).toBe(true);
  });

  it("updates when the media query changes", () => {
    const media = mockMatchMedia({ [QUERY]: false });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const { result } = renderHook(() => useIsCoarsePointer());
    expect(result.current).toBe(false);
    act(() => media.set(QUERY, true));
    expect(result.current).toBe(true);
  });
});
