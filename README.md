# Backrooms - Infinite Nightmares

A 3D first-person Backrooms exploration game. You noclipped out of reality — now there are 1,000
levels of infinite, procedurally generated liminal space between you and nothing at all.

Built with Next.js 16, React 19, three.js (@react-three/fiber) and zustand. Fully static —
deployed to GitHub Pages on every push to `main`.

## Features (MVP)

- **Infinite procedural world** — chunk-based generation with a deterministic border contract:
  neighboring chunks agree on their shared edges without ever seeing each other, so the world is
  seamless and truly endless. Same seed + level ⇒ identical world.
- **1,000 selectable levels (0–999)** — canonical lore levels (The Lobby, Lights Out, …) are
  hand-tuned; every other level derives its palette, geometry style, lighting, fog, decay and
  ambience from its number.
- **Backrooms aesthetics** — monotonous geometry, retro/dated procedural textures (wallpaper,
  carpet, ceiling tile), buzzing/flickering fluorescents, fog, film grain and vignette, dreamcore
  and brutalist palettes.
- **First-person controls** — arrows/WASD to move, mouse to look (pointer lock), Shift to sprint,
  Esc to pause.
- **Health and stamina** — sprinting drains stamina; exhaustion locks sprint until you recover.
  The full damage/heal pipeline is implemented and difficulty-scaled, ready for Phase 2.
- **Procedural soundtrack** — the entire soundscape (drones, fluorescent hum, hollow wind, room
  tone, footsteps, breathing, UI) is synthesized live with the Web Audio API behind an
  `AudioEngine` interface, so file-based audio (mp3/ogg) can be swapped in without touching call
  sites.
- **Game flow** — splash screen, main menu (level select with preview, difficulty, music/SFX
  volume, single player now / multiplayer soon), loading screen, pause menu.
- **Difficulties** — peaceful, easy, medium, hard (stamina economy now; damage/aggression columns
  already wired for Phase 2).

### Phase 2 (planned, architecture in place)

- Entities/enemies: `EntitySystem` already ticks inside the fixed-timestep loop; enemies are
  registry entries, not refactors.
- Items (adrenaline pills, bandage, flashlight): `Item` contract + registry + spawn tables on
  level profiles + inventory slot on the player store are all present and empty.
- Multiplayer: shown in the menu as "soon"; deterministic seeded generation is sync-friendly.

## Development

Requires Node.js 20.18+ (Node 22 recommended) and corepack (Yarn 4 via `packageManager`).

```sh
corepack enable
yarn install
yarn dev          # dev server at http://localhost:3000
```

### Quality gates

```sh
yarn lint          # ESLint
yarn format:check  # Prettier
yarn typecheck     # tsc --noEmit
yarn test          # Vitest unit + component tests
yarn test:coverage # with coverage thresholds (engine/state/config: 90%+)
yarn build         # static export to out/
yarn e2e           # Playwright against the exported build (yarn build first)
yarn audit         # dependency audit (fails on high/critical)
```

CI (`.github/workflows/ci.yaml`) runs lint → test → build → e2e → audit on every push/PR, plus
CodeQL and weekly Dependabot updates. On push to `main`, the static export is deployed to GitHub
Pages (one-time repo setup: **Settings → Pages → Source → GitHub Actions**).

## Architecture

```
src/
├── app/          # Next.js App Router shell (splash / menu / play routes)
├── components/   # React: ui atoms, menus, HUD, R3F scene components
├── engine/       # Pure TypeScript game logic — no React imports
│   ├── generation/  # seeded RNG, level profiles, chunks, border contract, LRU manager
│   ├── player/      # movement, grid collision, health/stamina rules
│   ├── audio/       # AudioEngine interface + procedural Web Audio backend
│   ├── items/       # Phase 2: item contract + registry (empty in MVP)
│   └── entities/    # Phase 2: entity contract + system (no-op in MVP)
├── state/        # zustand stores: settings (persisted), game phase machine, HUD snapshots
├── hooks/        # keyboard input
└── config/       # tunables: constants, difficulty table
```

Key decisions:

- The **engine layer is pure TS** and unit-tested in isolation (determinism, border contract,
  connectivity guarantees, stamina curves, phase machine legality).
- **The renderer is a consumer** of engine data: instanced meshes per chunk, one shared material
  set per level (flyweight), chunk data cached in a bounded LRU, everything disposed on unmount.
- **The simulation is fixed-timestep** (120 Hz) and framerate-independent; the DOM HUD subscribes
  to ~10 Hz snapshots so React never taxes the render loop.

See [PLAN.md](docs/PLAN.md) for the full implementation plan.
