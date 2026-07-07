import { describe, expect, it } from "vitest";
import { DIFFICULTY_CONFIGS } from "@/config/difficulty";
import {
  applyDamage,
  boostStamina,
  canSprint,
  createStats,
  heal,
  MAX_HEALTH,
  MAX_STAMINA,
  tickStamina,
} from "./stats";

const medium = DIFFICULTY_CONFIGS.medium;

describe("stamina", () => {
  it("drains while sprinting and hits exhaustion at zero", () => {
    const stats = createStats();
    const seconds = MAX_STAMINA / medium.staminaDrainPerSecond + 1;
    for (let t = 0; t < seconds * 120; t++) tickStamina(stats, true, 1 / 120, medium);
    expect(stats.stamina).toBe(0);
    expect(stats.exhausted).toBe(true);
    expect(canSprint(stats)).toBe(false);
  });

  it("waits for the regen delay before refilling", () => {
    const stats = createStats();
    tickStamina(stats, true, 1, medium); // drains and arms the cooldown
    const afterSprint = stats.stamina;
    tickStamina(stats, false, medium.staminaRegenDelaySeconds * 0.9, medium);
    expect(stats.stamina).toBe(afterSprint); // still cooling down
    tickStamina(stats, false, medium.staminaRegenDelaySeconds, medium); // finishes cooldown
    tickStamina(stats, false, 1, medium);
    expect(stats.stamina).toBeGreaterThan(afterSprint);
  });

  it("unlocks sprint only after refilling past the threshold", () => {
    const stats = createStats();
    stats.stamina = 0;
    stats.exhausted = true;
    stats.staminaRegenCooldown = 0;

    const thresholdSeconds =
      (medium.sprintUnlockFraction * MAX_STAMINA) / medium.staminaRegenPerSecond;
    tickStamina(stats, false, thresholdSeconds * 0.5, medium);
    expect(canSprint(stats)).toBe(false);
    tickStamina(stats, false, thresholdSeconds, medium);
    expect(stats.exhausted).toBe(false);
    expect(canSprint(stats)).toBe(true);
  });

  it("caps at max stamina", () => {
    const stats = createStats();
    tickStamina(stats, false, 100, medium);
    expect(stats.stamina).toBe(MAX_STAMINA);
  });

  it("drains per difficulty at different rates", () => {
    const easy = createStats();
    const hard = createStats();
    tickStamina(easy, true, 1, DIFFICULTY_CONFIGS.easy);
    tickStamina(hard, true, 1, DIFFICULTY_CONFIGS.hard);
    expect(hard.stamina).toBeLessThan(easy.stamina);
  });
});

describe("health (phase 2 pipeline)", () => {
  it("scales damage by difficulty and clamps at zero", () => {
    const stats = createStats();
    applyDamage(stats, 30, DIFFICULTY_CONFIGS.hard);
    expect(stats.health).toBe(MAX_HEALTH - 30 * DIFFICULTY_CONFIGS.hard.damageTakenMultiplier);
    applyDamage(stats, 10_000, DIFFICULTY_CONFIGS.hard);
    expect(stats.health).toBe(0);
  });

  it("never damages on peaceful", () => {
    const stats = createStats();
    applyDamage(stats, 9999, DIFFICULTY_CONFIGS.peaceful);
    expect(stats.health).toBe(MAX_HEALTH);
  });

  it("ignores negative damage and heal amounts", () => {
    const stats = createStats();
    applyDamage(stats, -50, DIFFICULTY_CONFIGS.hard);
    expect(stats.health).toBe(MAX_HEALTH);
    stats.health = 50;
    heal(stats, -20);
    expect(stats.health).toBe(50);
  });

  it("heals up to the cap", () => {
    const stats = createStats();
    stats.health = 40;
    heal(stats, 25);
    expect(stats.health).toBe(65);
    heal(stats, 1000);
    expect(stats.health).toBe(MAX_HEALTH);
  });
});

describe("boostStamina", () => {
  it("adds stamina up to the cap", () => {
    const stats = createStats();
    stats.stamina = 30;
    boostStamina(stats, 40);
    expect(stats.stamina).toBe(70);
    boostStamina(stats, 1000);
    expect(stats.stamina).toBe(MAX_STAMINA);
  });

  it("clears exhaustion and any pending regen cooldown", () => {
    const stats = createStats();
    stats.stamina = 0;
    stats.exhausted = true;
    stats.staminaRegenCooldown = 2;
    boostStamina(stats, 20);
    expect(stats.exhausted).toBe(false);
    expect(stats.staminaRegenCooldown).toBe(0);
    expect(canSprint(stats)).toBe(true);
  });

  it("ignores negative amounts", () => {
    const stats = createStats();
    stats.stamina = 50;
    boostStamina(stats, -30);
    expect(stats.stamina).toBe(50);
  });
});
