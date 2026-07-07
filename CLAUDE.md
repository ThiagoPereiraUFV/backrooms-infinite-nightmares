# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

"Backrooms - Infinite Nightmares" — a 3D first-person Backrooms exploration game.
Next.js 16 (App Router, static export) + React 19 + three.js via @react-three/fiber + zustand.
Deployed to GitHub Pages on push to `main`. Full design rationale lives in [PLAN.md](docs/PLAN.md).

## Commands

Package manager is **Yarn 4 via corepack** (`packageManager` field). If `yarn --version`
reports 1.x, run `corepack enable` first (on this machine the shims live in `~/.local/bin`).

```sh
yarn dev           # dev server at http://localhost:3000
yarn lint          # ESLint (flat config, includes React Compiler rules)
yarn format:check  # Prettier (yarn format to write)
yarn typecheck     # tsc --noEmit
yarn test          # Vitest (unit + component, jsdom)
yarn test:coverage # enforces thresholds on engine/state/config (90/85%+)
yarn build         # static export to out/
yarn e2e           # Playwright against out/ — run yarn build FIRST
yarn audit         # yarn npm audit --severity high
```

Run a single test file: `yarn vitest run src/engine/generation/chunk.test.ts`

To verify the GitHub Pages variant exactly as CI does, set
`NEXT_PUBLIC_BASE_PATH=/backrooms-infinite-nightmares` for both `yarn build` and `yarn e2e`.

## Architecture (the rules that matter)

- **`src/engine/` is pure TypeScript — no React, no DOM, no three.js imports.** All game logic
  (generation, movement, collision, stats, audio, phase machine) lives here and is unit-tested in
  isolation. If you're adding game logic, it goes here, not in a component.
- **Determinism is a contract.** World = f(seed, level). Chunk borders use the _border contract_:
  gateway openings are hashed from the shared edge's absolute coordinates so neighboring chunks
  agree without communicating ([chunk.ts](src/engine/generation/chunk.ts) `edgeGateways`). Tests
  in `chunk.test.ts` enforce adjacency agreement and connectivity — don't break them.
- **Levels 0–999** come from `createLevelProfile(n)` ([levelProfile.ts](src/engine/generation/levelProfile.ts)):
  canonical lore levels are a data table (`CANONICAL_LEVELS`), everything else is derived. New
  level styles are data additions, not code edits.
- **Rendering is a consumer of engine data.** One shared material set per level
  ([levelMaterials.ts](src/components/scene/levelMaterials.ts)), shared unit geometries, instanced
  meshes per chunk. Anything created must be disposed on unmount — the e2e suite has a
  play→menu→play leak test.
- **Simulation is fixed-timestep (120 Hz)** inside `useFrame` in
  [PlayerRig.tsx](src/components/scene/PlayerRig.tsx); mutable sim state lives in a ref, never in
  React state. The DOM HUD reads ~10 Hz snapshots from `playerStore` — never publish to stores per
  frame.
- **Game flow is a guarded state machine** (`splash → menu → loading → playing ⇄ paused`,
  [gamePhase.ts](src/engine/gamePhase.ts)). Illegal transitions return false; don't bypass
  `transition()` by calling `setState` directly.
- **Audio goes through the `AudioEngine` interface** ([AudioEngine.ts](src/engine/audio/AudioEngine.ts)).
  Gameplay code never touches Web Audio directly; the AudioContext may only be created after a
  user gesture.
- **Phase 2 (enemies/items) plugs into existing seams**: `itemRegistry`/`entityRegistry`,
  `LevelProfile.spawnTable`, `ChunkData.spawns`, `EntitySystem.update` (already ticking),
  `playerStore.inventory`, and the difficulty-scaled damage pipeline in `stats.ts`. Extend via
  registry entries, not core rewrites.

## Gotchas

- **Local Node is 20.18** (no `require(esm)`): jsdom is pinned to `^26`, and the Vitest config is
  `vitest.config.mts` (must stay `.mts`). CI runs Node 22 — don't unpin jsdom unless local Node
  is ≥ 20.19.
- **Playwright e2e serves `out/`** via `scripts/serve-out.mjs`; tests must navigate with
  _relative_ paths (`page.goto("menu/")`, not `"/menu/"`) or the Pages base path is dropped.
- Headless Chromium needs the SwiftShader flags already set in `playwright.config.ts` for WebGL;
  synthesized Escape doesn't release pointer lock — tests use `document.exitPointerLock()`.
- The `filmOverlay` grain/vignette div in the root layout sits above everything at z-index 40
  with `pointer-events: none`; keep interactive overlays below that.
- `public/.nojekyll` must exist or GitHub Pages drops the `_next/` directory.
