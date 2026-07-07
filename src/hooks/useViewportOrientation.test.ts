import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "./matchMediaTestUtils";
import { useViewportOrientation } from "./useViewportOrientation";

const QUERY = "(orientation: portrait)";

afterEach(() => {
  // @ts-expect-error test cleanup of a test-only global override
  delete window.matchMedia;
});

describe("useViewportOrientation", () => {
  it("reports landscape when the media query does not match", () => {
    mockMatchMedia({ [QUERY]: false });
    const { result } = renderHook(() => useViewportOrientation());
    expect(result.current).toBe("landscape");
  });

  it("reports portrait when the media query matches on mount", () => {
    mockMatchMedia({ [QUERY]: true });
    const { result } = renderHook(() => useViewportOrientation());
    expect(result.current).toBe("portrait");
  });

  it("updates when the media query changes", () => {
    const media = mockMatchMedia({ [QUERY]: false });
    const { result } = renderHook(() => useViewportOrientation());
    expect(result.current).toBe("landscape");
    act(() => media.set(QUERY, true));
    expect(result.current).toBe("portrait");
    act(() => media.set(QUERY, false));
    expect(result.current).toBe("landscape");
  });
});
