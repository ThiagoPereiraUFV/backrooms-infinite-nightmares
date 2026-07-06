"use client";

import styles from "./ui.module.css";

export interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange(value: number): void;
}

export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  disabled = false,
  onChange,
}: SliderProps) {
  return (
    <input
      type="range"
      className={styles.slider}
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
