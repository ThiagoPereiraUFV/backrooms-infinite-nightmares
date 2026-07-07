"use client";

import { useEffect, useState } from "react";

export type ViewportOrientation = "portrait" | "landscape";

/** Tracks viewport orientation via matchMedia; defaults to landscape until mounted. */
export function useViewportOrientation(): ViewportOrientation {
  const [orientation, setOrientation] = useState<ViewportOrientation>("landscape");

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const apply = (matches: boolean) => setOrientation(matches ? "portrait" : "landscape");
    apply(query.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return orientation;
}
