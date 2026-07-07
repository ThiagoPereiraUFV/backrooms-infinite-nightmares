"use client";

import { useEffect, useState } from "react";

/**
 * Capability-based mobile/touch detection — never UA sniffing. Primary
 * signal is the CSS media features; navigator.maxTouchPoints is an OR'd
 * tiebreaker so an iPad reporting a desktop-like fine pointer (trackpad
 * connected) still counts as touch-capable.
 */
export function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (hover: none)");
    const hasTouchPoints = navigator.maxTouchPoints > 0;
    const apply = (matches: boolean) => setCoarse(matches || hasTouchPoints);
    apply(query.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return coarse;
}
