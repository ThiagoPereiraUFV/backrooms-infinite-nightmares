"use client";

import styles from "./RotateOverlay.module.css";

/**
 * Blocking advisory shown on portrait touch devices during play/pause.
 * Purely presentational — useOrientationGate decides when to mount this.
 */
export function RotateOverlay() {
  return (
    <div className={styles.overlay} data-testid="rotate-overlay" role="alert">
      <div className={styles.glyph} aria-hidden="true">
        ⟳
      </div>
      <p className={styles.message}>Rotate your device to play</p>
    </div>
  );
}
