"use client";

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
      <div className={styles.crosshair} aria-hidden="true" />
    </div>
  );
}
