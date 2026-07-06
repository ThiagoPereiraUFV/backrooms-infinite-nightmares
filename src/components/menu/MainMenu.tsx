"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";
import { Button } from "@/components/ui/Button";
import { SettingsPanel } from "./SettingsPanel";
import styles from "./menu.module.css";

export function MainMenu() {
  const router = useRouter();

  // Deep links land here with the store still in "splash"; normalize it.
  useEffect(() => {
    useGameStore.getState().quitToMenu();
  }, []);

  const start = () => {
    if (useGameStore.getState().startGame()) {
      router.push("/play");
    }
  };

  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Backrooms</h1>
      <p className={styles.subtitle}>Infinite Nightmares</p>
      <SettingsPanel />
      <div className={styles.actions}>
        <Button variant="primary" onClick={start} data-testid="start-game">
          Enter the Backrooms
        </Button>
      </div>
    </main>
  );
}
