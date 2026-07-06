export const DIFFICULTIES = ["peaceful", "easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyConfig {
  /** Stamina drained per second while sprinting (of 100 max). */
  staminaDrainPerSecond: number;
  /** Stamina regenerated per second while not sprinting. */
  staminaRegenPerSecond: number;
  /** Seconds after sprinting stops before regen begins. */
  staminaRegenDelaySeconds: number;
  /** Fraction of max stamina required to sprint again after exhaustion. */
  sprintUnlockFraction: number;
  /** Phase 2: multiplier on damage taken from entities. */
  damageTakenMultiplier: number;
  /** Phase 2: 0..1 — higher means fewer item spawns. */
  itemScarcity: number;
  /** Phase 2: 0..1 — entity aggression scaling. */
  enemyAggression: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  peaceful: {
    staminaDrainPerSecond: 10,
    staminaRegenPerSecond: 25,
    staminaRegenDelaySeconds: 0.5,
    sprintUnlockFraction: 0.2,
    damageTakenMultiplier: 0,
    itemScarcity: 0,
    enemyAggression: 0,
  },
  easy: {
    staminaDrainPerSecond: 14,
    staminaRegenPerSecond: 18,
    staminaRegenDelaySeconds: 1,
    sprintUnlockFraction: 0.25,
    damageTakenMultiplier: 0.5,
    itemScarcity: 0.25,
    enemyAggression: 0.3,
  },
  medium: {
    staminaDrainPerSecond: 18,
    staminaRegenPerSecond: 14,
    staminaRegenDelaySeconds: 1.5,
    sprintUnlockFraction: 0.3,
    damageTakenMultiplier: 1,
    itemScarcity: 0.5,
    enemyAggression: 0.6,
  },
  hard: {
    staminaDrainPerSecond: 24,
    staminaRegenPerSecond: 10,
    staminaRegenDelaySeconds: 2.5,
    sprintUnlockFraction: 0.4,
    damageTakenMultiplier: 1.5,
    itemScarcity: 0.75,
    enemyAggression: 1,
  },
};
