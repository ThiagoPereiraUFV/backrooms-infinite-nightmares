import type { DifficultyConfig } from "@/config/difficulty";

export const MAX_HEALTH = 100;
export const MAX_STAMINA = 100;

export interface PlayerStats {
  health: number;
  stamina: number;
  /** Seconds left before stamina regen resumes. */
  staminaRegenCooldown: number;
  /** True after hitting 0 stamina, until refilled past the unlock fraction. */
  exhausted: boolean;
}

export const createStats = (): PlayerStats => ({
  health: MAX_HEALTH,
  stamina: MAX_STAMINA,
  staminaRegenCooldown: 0,
  exhausted: false,
});

export const canSprint = (stats: PlayerStats): boolean => !stats.exhausted && stats.stamina > 0;

/** Advances stamina one tick. Mutates in place (simulation-frequency hot path). */
export function tickStamina(
  stats: PlayerStats,
  sprinting: boolean,
  dt: number,
  config: DifficultyConfig,
): void {
  if (sprinting) {
    stats.stamina = Math.max(0, stats.stamina - config.staminaDrainPerSecond * dt);
    stats.staminaRegenCooldown = config.staminaRegenDelaySeconds;
    if (stats.stamina === 0) stats.exhausted = true;
    return;
  }

  if (stats.staminaRegenCooldown > 0) {
    stats.staminaRegenCooldown = Math.max(0, stats.staminaRegenCooldown - dt);
    return;
  }

  stats.stamina = Math.min(MAX_STAMINA, stats.stamina + config.staminaRegenPerSecond * dt);
  if (stats.exhausted && stats.stamina >= config.sprintUnlockFraction * MAX_STAMINA) {
    stats.exhausted = false;
  }
}

/**
 * Phase 2 damage pipeline — wired now so entities/items plug in later.
 * Peaceful difficulty has damageTakenMultiplier 0 and can never hurt the player.
 */
export function applyDamage(stats: PlayerStats, amount: number, config: DifficultyConfig): void {
  const scaled = amount * config.damageTakenMultiplier;
  stats.health = Math.max(0, stats.health - Math.max(0, scaled));
}

export function heal(stats: PlayerStats, amount: number): void {
  stats.health = Math.min(MAX_HEALTH, stats.health + Math.max(0, amount));
}

/** Adrenaline-style instant stamina burst; clears exhaustion so sprint is immediately available. */
export function boostStamina(stats: PlayerStats, amount: number): void {
  stats.stamina = Math.min(MAX_STAMINA, stats.stamina + Math.max(0, amount));
  if (stats.stamina > 0) {
    stats.exhausted = false;
    stats.staminaRegenCooldown = 0;
  }
}
