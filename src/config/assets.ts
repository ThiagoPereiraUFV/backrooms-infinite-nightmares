/**
 * Next.js does not rewrite URLs inside `fetch()`, so a hardcoded `/audio/...`
 * path 404s under the GitHub Pages base path
 * (`/backrooms-infinite-nightmares/`). Every asset URL must be routed through
 * this helper instead of being written as a literal string.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const assetUrl = (path: string): string => `${BASE_PATH}${path}`;
