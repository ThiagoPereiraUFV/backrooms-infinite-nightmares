import { create } from "zustand";
import { itemRegistry, type ItemStack } from "@/engine/items";
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
  /** Collected items. */
  inventory: ItemStack[];
}

export interface PlayerState extends PlayerSnapshot {
  /** Discrete (not throttled): whether the flashlight is currently lit. */
  flashlightOn: boolean;
  publish(snapshot: Partial<PlayerSnapshot>): void;
  reset(): void;
  /** Adds one unit of an item to inventory (no-op for an already-owned non-stackable). */
  collectItem(itemId: string): void;
  /** Consumes one unit if owned and consumable; returns whether it happened. */
  consumeItem(itemId: string): boolean;
  /** Flips the beam on/off; no-op if the flashlight was never picked up. */
  toggleFlashlight(): void;
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
  flashlightOn: false,
  publish: (snapshot) => set(snapshot),
  reset: () => set({ ...INITIAL, flashlightOn: false }),

  collectItem: (itemId) =>
    set((state) => {
      const def = itemRegistry.get(itemId);
      if (!def) return state;
      const existingIndex = state.inventory.findIndex((stack) => stack.itemId === itemId);
      if (existingIndex >= 0) {
        if (!def.stackable) return state;
        const inventory = [...state.inventory];
        inventory[existingIndex] = {
          ...inventory[existingIndex],
          quantity: inventory[existingIndex].quantity + 1,
        };
        return { inventory };
      }
      return { inventory: [...state.inventory, { itemId, quantity: 1 }] };
    }),

  consumeItem: (itemId) => {
    let consumed = false;
    set((state) => {
      const def = itemRegistry.get(itemId);
      if (!def?.consumable) return state;
      const index = state.inventory.findIndex((stack) => stack.itemId === itemId);
      if (index < 0) return state;
      consumed = true;
      const stack = state.inventory[index];
      const inventory = [...state.inventory];
      if (stack.quantity <= 1) inventory.splice(index, 1);
      else inventory[index] = { ...stack, quantity: stack.quantity - 1 };
      return { inventory };
    });
    return consumed;
  },

  toggleFlashlight: () =>
    set((state) =>
      state.inventory.some((stack) => stack.itemId === "flashlight")
        ? { flashlightOn: !state.flashlightOn }
        : state,
    ),
}));
