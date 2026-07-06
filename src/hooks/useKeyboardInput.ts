"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { MoveInput } from "@/engine/player/movement";

const KEY_BINDINGS: Record<string, keyof MoveInput> = {
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "forward",
  KeyS: "backward",
  KeyA: "left",
  KeyD: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

/**
 * Tracks movement keys in a mutable ref — the simulation loop reads it every
 * tick without a single React re-render. Listeners are cleaned up on unmount.
 */
export function useKeyboardInput(): RefObject<MoveInput> {
  const inputRef = useRef<MoveInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean): void => {
      const binding = KEY_BINDINGS[event.code];
      if (!binding) return;
      // Arrows scroll the page by default; this game uses them for movement.
      if (event.code.startsWith("Arrow")) event.preventDefault();
      inputRef.current[binding] = pressed;
    };
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
    const onBlur = () => {
      // Dropped keyup events (alt-tab) must not leave keys stuck down.
      inputRef.current.forward = false;
      inputRef.current.backward = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.sprint = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return inputRef;
}
