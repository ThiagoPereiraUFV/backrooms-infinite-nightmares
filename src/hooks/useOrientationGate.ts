"use client";

import { useEffect } from "react";
import type { GamePhase } from "@/engine/gamePhase";
import { useGameStore } from "@/state/gameStore";
import { useIsCoarsePointer } from "./useIsCoarsePointer";
import { useViewportOrientation } from "./useViewportOrientation";

/**
 * Blocks gameplay on portrait touch devices: auto-pauses when the phase is
 * "playing" and the viewport flips to portrait, and reports whether the
 * rotate-device advisory should be shown (portrait + coarse pointer, while
 * playing or paused — it sits above the pause menu until landscape returns).
 * Coarse-pointer gating means resizing a desktop window tall never triggers it.
 */
export function useOrientationGate(phase: GamePhase): boolean {
  const orientation = useViewportOrientation();
  const isCoarsePointer = useIsCoarsePointer();
  const portraitBlock = isCoarsePointer && orientation === "portrait";

  useEffect(() => {
    if (portraitBlock && useGameStore.getState().phase === "playing") {
      useGameStore.getState().transition("paused");
    }
  }, [portraitBlock]);

  return portraitBlock && (phase === "playing" || phase === "paused");
}
