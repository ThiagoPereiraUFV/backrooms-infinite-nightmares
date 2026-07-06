import type { ReactNode } from "react";
import styles from "./ui.module.css";

export interface FieldProps {
  label: string;
  children: ReactNode;
}

/** Labeled settings row: caption on the left, control(s) on the right. */
export function Field({ label, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>{children}</span>
    </div>
  );
}
