import { create } from "zustand";
import { canTransition, type GamePhase } from "@/engine/gamePhase";

export interface GameState {
  phase: GamePhase;
  /** Seed for the current session's world; regenerated per run. */
  worldSeed: number;
  /**
   * Guarded transition — illegal moves are refused and return false, so flow
   * bugs surface immediately instead of corrupting state.
   */
  transition(to: GamePhase): boolean;
  /** menu -> loading with a fresh world seed. */
  startGame(): boolean;
  /** Resets to the menu from any phase (quit). */
  quitToMenu(): void;
}

const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff);

export const useGameStore = create<GameState>()((set, get) => ({
  phase: "splash",
  worldSeed: randomSeed(),
  transition: (to) => {
    if (!canTransition(get().phase, to)) return false;
    set({ phase: to });
    return true;
  },
  startGame: () => {
    if (!canTransition(get().phase, "loading")) return false;
    set({ phase: "loading", worldSeed: randomSeed() });
    return true;
  },
  quitToMenu: () => {
    const { phase, transition } = get();
    if (phase === "splash") {
      transition("menu");
    } else if (phase !== "menu") {
      set({ phase: "menu" });
    }
  },
}));
