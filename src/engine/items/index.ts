import { Registry } from "../registry";

/**
 * Phase 2 contract for collectible items (adrenaline pills, bandage,
 * flashlight, ...). The registry ships empty in the MVP; adding an item is a
 * registry entry plus a spawn-table weight on a level profile — no core
 * changes.
 */
export interface ItemContext {
  /** Mutation hooks the item may use when consumed/activated. */
  healPlayer(amount: number): void;
  boostStamina(amount: number): void;
  toggleFlashlight(): void;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  use(context: ItemContext): void;
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export const itemRegistry = new Registry<Item>();
