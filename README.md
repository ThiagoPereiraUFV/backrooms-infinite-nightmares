# Backrooms - Infinite Nightmares

A 3D first-person Backrooms exploration game. You noclipped out of reality — now there is an
infinite, procedurally generated liminal space between you and nothing at all, spread across nine
hand-authored canonical levels.

Built with Next.js 16, React 19, three.js (@react-three/fiber) and zustand. Fully static —
deployed to GitHub Pages on every push to `main`.

## Features

- **Infinite procedural world** — chunk-based generation with a deterministic border contract:
  neighboring chunks agree on their shared edges without ever seeing each other, so the world is
  seamless and truly endless. Same seed + level ⇒ identical world.
- **Nine hand-authored canonical levels ("The Main Nine", 0–8)** — The Lobby, Parking Zone, Pipe
  Dreams, Electrical Station, Abandoned Office, The Terror Hotel, Lights Out, Thalassophobia and
  Cave System, verified against the [Backrooms wiki](https://backrooms.fandom.com/wiki/Category:The_Main_Nine)
  (see the source-of-truth comment at the top of `levelProfile.ts`), each with its own surface
  style, structural features (door frames, wall breaches, ceiling openings, pipe/duct runs),
  lighting behavior, props, inhabitants and soundscape.
- **Backrooms aesthetics** — nine distinct procedural surface painters (wallpaper, raw concrete,
  riveted steel, cinder block, drywall, hotel damask, void black, wet tile, bare rock), per-level
  lighting modes (fluorescent panels, caged industrial, emergency-only, or none at all), fog, film
  grain and vignette.
- **First-person controls** — arrows/WASD to move, mouse to look (pointer lock), Shift to sprint,
  Esc to pause; on touch devices, an on-screen joystick, sprint button and drag-look.
- **Health and stamina** — sprinting drains stamina; exhaustion locks sprint until you recover.
  Difficulty-scaled damage from hostile entities on non-peaceful settings.
- **Furniture and props** — deterministically placed, precisely collidable set dressing (chairs,
  tables, beds, lockers, barrels, pipe stacks, transformers, vending machines, rubble, stalagmites
  and more), instanced per chunk.
- **Items** — bandages, adrenaline pills and a toggleable flashlight, spawned per level and
  collected into a hotbar.
- **Entities** — a handful of lore-appropriate hostiles/passives (Hound, Deathmoth, Skin-Stealer,
  Smiler, and more) behind three shared behavior strategies (chase, stalk-and-freeze, drift),
  thinned to nothing on peaceful difficulty.
- **Sound** — a sampled `AudioEngine` plays downloaded CC0 ambience loops, footsteps and entity
  cues where available, and falls back seamlessly to live Web Audio synthesis for everything else
  — the game always has a full soundscape, on every level, even offline. See
  [`public/audio/CREDITS.md`](public/audio/CREDITS.md) for the license/attribution of every
  committed asset (CC0 / public domain only).
- **Game flow** — splash screen, main menu (level select with preview, difficulty, music/SFX
  volume, single player now / multiplayer soon), loading screen, pause menu.
- **Difficulties** — peaceful, easy, medium, hard (stamina economy, item scarcity and enemy
  aggression/damage all scale with it).

### Not yet built

- Multiplayer: shown in the menu as "soon"; deterministic seeded generation is sync-friendly.
- Level progression, save games: out of scope by design — every level is freely selectable, every
  session starts fresh.

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
│   ├── generation/  # seeded RNG, level profiles, chunks, border contract, structural features, LRU manager
│   ├── furniture/   # deterministic ground-prop catalog + placement
│   ├── lighting/     # pure per-mode flicker model
│   ├── player/      # movement, grid collision, health/stamina rules
│   ├── audio/       # AudioEngine interface, sampled backend + procedural fallback
│   ├── items/       # item contract + registry
│   └── entities/    # entity contract, shared behavior strategies, lore-entity catalog
├── state/        # zustand stores: settings (persisted), game phase machine, HUD snapshots
├── hooks/        # keyboard/touch input, orientation gate
└── config/       # tunables: constants, difficulty table, asset base-path helper
```

Key decisions:

- The **engine layer is pure TS** and unit-tested in isolation (determinism, border contract,
  connectivity guarantees, stamina curves, phase machine legality).
- **The renderer is a consumer** of engine data: instanced meshes per chunk, one shared material
  set per level (flyweight), chunk data cached in a bounded LRU, everything disposed on unmount.
- **The simulation is fixed-timestep** (120 Hz) and framerate-independent; the DOM HUD subscribes
  to ~10 Hz snapshots so React never taxes the render loop.
- **Audio assets always go through `assetUrl()`** (`src/config/assets.ts`) — Next.js does not
  rewrite URLs inside `fetch()`, so a literal `"/audio/..."` path 404s under the GitHub Pages base
  path even though it works on localhost.
- **Audio licensing is CC0/public-domain only.** There is no credits screen in this app, so a
  CC-BY asset would be a silent license violation; every committed file's source, author, license
  and retrieval date is recorded in `public/audio/CREDITS.md`.

See [PLAN.md](docs/PLAN.md), [PLAN-2.md](docs/PLAN-2.md), [PLAN-3.md](docs/PLAN-3.md) and
[PLAN-4.md](docs/PLAN-4.md) for the full implementation history.
