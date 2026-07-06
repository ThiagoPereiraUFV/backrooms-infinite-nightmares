"use client";

import dynamic from "next/dynamic";
import styles from "@/components/menu/menu.module.css";

// The 3D scene must never render on the server (WebGL, pointer lock, audio).
const GameRoot = dynamic(() => import("@/components/game/GameRoot"), {
  ssr: false,
  loading: () => (
    <main className={styles.screen}>
      <p className={styles.pressAny}>Noclipping…</p>
    </main>
  ),
});

export default function PlayPage() {
  return <GameRoot />;
}
