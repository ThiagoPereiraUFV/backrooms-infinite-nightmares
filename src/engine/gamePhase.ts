/**
 * Explicit game-flow state machine. Transitions not listed here are illegal;
 * the store refuses them, which makes flow bugs loud and testable.
 */
export const GAME_PHASES = ["splash", "menu", "loading", "playing", "paused"] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

const TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  splash: ["menu"],
  menu: ["loading"],
  loading: ["playing", "menu"],
  playing: ["paused", "menu"],
  paused: ["playing", "menu"],
};

export const canTransition = (from: GamePhase, to: GamePhase): boolean =>
  TRANSITIONS[from].includes(to);
