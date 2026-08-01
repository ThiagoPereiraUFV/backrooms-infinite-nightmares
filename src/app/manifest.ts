import type { MetadataRoute } from "next";
import { assetUrl } from "@/config/assets";

// Required for metadata routes under `output: "export"` — there's no request
// to vary the response by, so this is a static file like any other route.
export const dynamic = "force-static";

/**
 * Next does not rewrite basePath into a manifest route's own field values
 * (unlike the href it generates for the <link rel="manifest"> tag itself),
 * so every URL here goes through assetUrl() — same rule as audio assets.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetUrl("/"),
    name: "Backrooms - Infinite Nightmares",
    short_name: "Backrooms",
    description:
      "You noclipped out of reality. Explore infinite procedurally generated backrooms levels — if you don't hear the fluorescent hum, run.",
    start_url: assetUrl("/"),
    scope: assetUrl("/"),
    display: "standalone",
    orientation: "landscape",
    background_color: "#0c0b07",
    theme_color: "#0c0b07",
    icons: [
      {
        src: assetUrl("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: assetUrl("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: assetUrl("/icons/icon-maskable-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: assetUrl("/icons/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
