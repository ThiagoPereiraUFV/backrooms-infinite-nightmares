import { create } from "zustand";

/**
 * Session-scoped set of collected item-spawn keys (see spawnFilter.spawnKey).
 * Not persisted: no save games, so a fresh session (GameRoot mount) starts
 * with everything uncollected again.
 */
export interface CollectedState {
  keys: Set<string>;
  collect(key: string): void;
  isCollected(key: string): boolean;
  reset(): void;
}

export const useCollectedStore = create<CollectedState>()((set, get) => ({
  keys: new Set(),
  collect: (key) =>
    set((state) => {
      if (state.keys.has(key)) return state;
      const keys = new Set(state.keys);
      keys.add(key);
      return { keys };
    }),
  isCollected: (key) => get().keys.has(key),
  reset: () => set({ keys: new Set() }),
}));
