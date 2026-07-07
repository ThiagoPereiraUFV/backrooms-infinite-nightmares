"use client";

import { itemRegistry, type ItemStack } from "@/engine/items";
import { MAX_HEALTH, MAX_STAMINA } from "@/engine/player/stats";
import { usePlayerStore } from "@/state/playerStore";
import styles from "./Hud.module.css";

function Bar({
  label,
  value,
  max,
  fillClass,
}: {
  label: string;
  value: number;
  max: number;
  fillClass: string;
}) {
  const percent = Math.round((value / max) * 100);
  return (
    <div>
      <div className={styles.barLabel}>{label}</div>
      <div
        className={styles.barTrack}
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={fillClass} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Item initial shown on a hotbar tile — no icon assets in this architecture. */
const glyphFor = (itemId: string): string => itemRegistry.get(itemId)?.name.charAt(0) ?? "?";

function Hotbar({ inventory, flashlightOn }: { inventory: ItemStack[]; flashlightOn: boolean }) {
  if (inventory.length === 0) return null;
  return (
    <div className={styles.hotbar} data-testid="hotbar">
      {inventory.map((stack, index) => {
        const def = itemRegistry.get(stack.itemId);
        const active = stack.itemId === "flashlight" && flashlightOn;
        return (
          <div
            key={stack.itemId}
            className={active ? styles.hotbarSlotActive : styles.hotbarSlot}
            title={def?.description}
          >
            <span className={styles.hotbarKey}>{index + 1}</span>
            <span className={styles.hotbarGlyph}>{glyphFor(stack.itemId)}</span>
            {def?.stackable && <span className={styles.hotbarQuantity}>{stack.quantity}</span>}
          </div>
        );
      })}
    </div>
  );
}

export interface HudProps {
  levelNumber: number;
  levelName: string;
}

/**
 * DOM HUD layered above the canvas. Subscribes to the throttled player
 * snapshot store (~10 Hz), so it never taxes the render loop.
 */
export function Hud({ levelNumber, levelName }: HudProps) {
  const health = usePlayerStore((state) => state.health);
  const stamina = usePlayerStore((state) => state.stamina);
  const exhausted = usePlayerStore((state) => state.exhausted);
  const inventory = usePlayerStore((state) => state.inventory);
  const flashlightOn = usePlayerStore((state) => state.flashlightOn);

  return (
    <div className={styles.hud} data-testid="hud">
      <div className={styles.levelBadge}>
        Level <strong>{levelNumber}</strong> — {levelName}
      </div>
      <div className={styles.bars}>
        <Bar label="Health" value={health} max={MAX_HEALTH} fillClass={styles.healthFill} />
        <Bar
          label={exhausted ? "Stamina (exhausted)" : "Stamina"}
          value={stamina}
          max={MAX_STAMINA}
          fillClass={exhausted ? styles.staminaExhausted : styles.staminaFill}
        />
      </div>
      <Hotbar inventory={inventory} flashlightOn={flashlightOn} />
      <div className={styles.crosshair} aria-hidden="true" />
    </div>
  );
}
