import { describe, expect, it } from "vitest";
import { canTransition, GAME_PHASES, type GamePhase } from "./gamePhase";

describe("game phase machine", () => {
  const legal: [GamePhase, GamePhase][] = [
    ["splash", "menu"],
    ["menu", "loading"],
    ["loading", "playing"],
    ["loading", "menu"],
    ["playing", "paused"],
    ["playing", "menu"],
    ["paused", "playing"],
    ["paused", "menu"],
  ];

  it("allows every legal transition", () => {
    for (const [from, to] of legal) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    const legalSet = new Set(legal.map(([from, to]) => `${from}->${to}`));
    for (const from of GAME_PHASES) {
      for (const to of GAME_PHASES) {
        if (legalSet.has(`${from}->${to}`)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});
