import type { ChunkSpawn } from "../generation/cells";
import { filterSpawnsByKeepFraction } from "../generation/spawnFilter";
import { Registry } from "../registry";

/**
 * Contract for collectible items (adrenaline pills, bandage, flashlight,
 * ...). Adding a new item is a registry entry plus a spawn-table weight on a
 * level profile — no core changes.
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
  /** False for toggles (flashlight): using it never removes it from inventory. */
  consumable: boolean;
  use(context: ItemContext): void;
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export const itemRegistry = new Registry<Item>();

itemRegistry.register({
  id: "adrenaline",
  name: "Adrenaline Pill",
  description: "An instant burst of stamina and an end to exhaustion.",
  stackable: true,
  consumable: true,
  use: (ctx) => ctx.boostStamina(60),
});

itemRegistry.register({
  id: "bandage",
  name: "Bandage",
  description: "Patches you up.",
  stackable: true,
  consumable: true,
  use: (ctx) => ctx.healPlayer(35),
});

itemRegistry.register({
  id: "flashlight",
  name: "Flashlight",
  description: "Toggle a beam to cut through the dark.",
  stackable: false,
  consumable: false,
  use: (ctx) => ctx.toggleFlashlight(),
});

/**
 * Item spawn points active this session: registry-filtered from the chunk's
 * full spawn list, then thinned by difficulty scarcity (1 - itemScarcity is
 * the fraction kept — higher scarcity means fewer items survive the filter).
 */
export function activeItemSpawns(
  cx: number,
  cz: number,
  spawns: readonly ChunkSpawn[],
  itemScarcity: number,
): ChunkSpawn[] {
  const items = spawns.filter((spawn) => itemRegistry.has(spawn.id));
  return filterSpawnsByKeepFraction(cx, cz, items, 1 - itemScarcity);
}
