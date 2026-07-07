import { vi } from "vitest";

/**
 * Installs a controllable window.matchMedia stub for one test: each query
 * string gets its own listener set, and `set(query, matches)` flips the
 * value and fires a "change" event, exactly like a real MediaQueryList.
 */
export function mockMatchMedia(initial: Record<string, boolean> = {}) {
  const state = new Map<string, boolean>(Object.entries(initial));
  const listeners = new Map<string, Set<(event: { matches: boolean }) => void>>();

  window.matchMedia = vi.fn((query: string) => {
    const list = {
      get matches() {
        return state.get(query) ?? false;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)?.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.get(query)?.delete(listener);
      },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    return list;
  }) as typeof window.matchMedia;

  return {
    set(query: string, matches: boolean) {
      state.set(query, matches);
      for (const listener of listeners.get(query) ?? []) listener({ matches });
    },
  };
}
