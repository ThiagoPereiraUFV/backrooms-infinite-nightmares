import { create } from "zustand";
import type { ItemStack } from "@/engine/items";
import { MAX_HEALTH, MAX_STAMINA } from "@/engine/player/stats";

/**
 * Low-frequency snapshot of the simulation for the DOM HUD. The game loop
 * publishes here at ~10 Hz (HUD_UPDATE_HZ) — never per frame — so React
 * rendering can't affect the 3D framerate.
 */
export interface PlayerSnapshot {
  health: number;
  stamina: number;
  exhausted: boolean;
  sprinting: boolean;
  /** World position, for the chunk field and debugging. */
  x: number;
  z: number;
  /** Phase 2: collected items. Always empty in the MVP. */
  inventory: ItemStack[];
}

export interface PlayerState extends PlayerSnapshot {
  publish(snapshot: Partial<PlayerSnapshot>): void;
  reset(): void;
}

const INITIAL: PlayerSnapshot = {
  health: MAX_HEALTH,
  stamina: MAX_STAMINA,
  exhausted: false,
  sprinting: false,
  x: 0,
  z: 0,
  inventory: [],
};

export const usePlayerStore = create<PlayerState>()((set) => ({
  ...INITIAL,
  publish: (snapshot) => set(snapshot),
  reset: () => set(INITIAL),
}));
