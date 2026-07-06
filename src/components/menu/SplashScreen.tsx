"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";
import styles from "./menu.module.css";

/**
 * First screen. Any key or click moves to the menu — that interaction also
 * satisfies the browser user-gesture requirement for audio later on.
 */
export function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const proceed = () => {
      useGameStore.getState().quitToMenu();
      router.push("/menu");
    };
    window.addEventListener("keydown", proceed);
    window.addEventListener("pointerdown", proceed);
    return () => {
      window.removeEventListener("keydown", proceed);
      window.removeEventListener("pointerdown", proceed);
    };
  }, [router]);

  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Backrooms</h1>
      <p className={styles.subtitle}>Infinite Nightmares</p>
      <p className={styles.pressAny}>Press any key</p>
    </main>
  );
}
