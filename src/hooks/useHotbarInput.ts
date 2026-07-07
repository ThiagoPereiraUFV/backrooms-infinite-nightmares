"use client";

import { useEffect, useRef, type RefObject } from "react";

const DIGIT_KEY = /^Digit([1-9])$/;

/**
 * Queues hotbar slot presses (1-9, edge-triggered) in a mutable ref — drained
 * by the simulation loop once per frame, same pattern as useKeyboardInput's
 * held-key ref, so React state never sits on the hot path.
 */
export function useHotbarInput(): RefObject<number[]> {
  const queueRef = useRef<number[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const match = DIGIT_KEY.exec(event.code);
      if (!match) return;
      queueRef.current.push(Number(match[1]));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return queueRef;
}
