import type { MoveInput } from "@/engine/player/movement";

/**
 * Imperative singleton bridging TouchControls (a DOM overlay, sibling of the
 * Canvas) and PlayerRig (inside the Canvas) without React state — same
 * "mutable ref the sim loop reads every tick" pattern as useKeyboardInput,
 * just shared across the Canvas boundary instead of via a hook-owned ref.
 * There is exactly one active game session at a time, so a module-level
 * singleton is safe (mirrors the zustand stores' singleton lifetime).
 */
export interface TouchInputBus {
  move: MoveInput;
  /** Accumulated look delta (px) since PlayerRig last drained it this frame. */
  lookDX: number;
  lookDY: number;
}

const create = (): TouchInputBus => ({
  move: { forward: false, backward: false, left: false, right: false, sprint: false },
  lookDX: 0,
  lookDY: 0,
});

export const touchInputBus: TouchInputBus = create();

/** Called on session start/end so no input state leaks between sessions. */
export function resetTouchInputBus(): void {
  Object.assign(touchInputBus, create());
}
