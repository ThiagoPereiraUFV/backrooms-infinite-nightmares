"use client";

import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
}

export function Button({ variant = "default", className, ...rest }: ButtonProps) {
  const base = variant === "primary" ? styles.buttonPrimary : styles.button;
  return <button className={className ? `${base} ${className}` : base} {...rest} />;
}
