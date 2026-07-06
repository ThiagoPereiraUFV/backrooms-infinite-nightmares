"use client";

import styles from "./ui.module.css";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
      onClick={() => onChange(!checked)}
    >
      {checked ? "On" : "Off"}
    </button>
  );
}
