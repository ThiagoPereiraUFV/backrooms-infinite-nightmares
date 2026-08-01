"use client";

import { useEffect } from "react";
import { assetUrl } from "@/config/assets";

/**
 * Registers the offline-cache service worker. Skipped in dev — the dev
 * server's constantly-changing bundles fight a persistent cache — so
 * offline support only ever activates against the static export.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(assetUrl("/sw.js")).catch(() => {
      // Progressive enhancement only; the game must still work unregistered.
    });
  }, []);

  return null;
}
