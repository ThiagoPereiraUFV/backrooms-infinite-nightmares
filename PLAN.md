# Backrooms - Infinite Nightmares — Implementation Plan

A 3D first-person Backrooms exploration game built on Next.js, with infinite procedurally generated levels (0–999), full Backrooms aesthetics, and an architecture ready for future phases (enemies, items).

---

## 1. Vision & Scope

### MVP (this phase)
- 3D first-person exploration: **arrow keys** (+ WASD as bonus) to move, **mouse** to look (Pointer Lock).
- **Infinite, random map generation** — chunk-based, deterministic per seed + level.
- **1000 selectable levels (0–999)**, each with distinct characteristics derived from its number.
- **Splash screen → Main menu** with settings: level select, music on/off + volume, SFX on/off + volume, single/multiplayer (multiplayer greyed out — "soon"), difficulty (peaceful / easy / medium / hard).
- **Pause menu** (resume, settings, quit to menu).
- **Sprint/run** mechanic bound to Shift.
- **HUD**: health bar + stamina bar.
- **Procedural soundtrack + SFX** with Backrooms aesthetics (Web Audio synthesis now; swappable for mp3/ogg later behind an audio abstraction).
- **No enemies** — pure exploration.

### Explicit non-goals for MVP (but architected for)
- Enemies / AI (Phase 2).
- Collectible items: adrenaline pills, bandage, flashlight, etc. (Phase 2).
- Real multiplayer (menu shows the option as disabled/"soon").

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19.2 + TypeScript 6 (strict)** | Latest stable stack; static-first game shell |
| 3D engine | **three.js (0.185+) via @react-three/fiber 9** | Declarative, componentized 3D that fits React best practices |
| 3D helpers | **@react-three/drei 10** | PointerLockControls, instancing helpers, performance utilities |
| State | **zustand 5** | Minimal, decoupled stores; selector-based subscriptions avoid re-render storms |
| Audio | **Web Audio API behind an `AudioEngine` interface** | Procedural soundtrack now; mp3/ogg later without touching call sites |
| Styling | **CSS Modules (or Tailwind v4)** | Scoped, zero-runtime styling for menus/HUD |
| Unit tests | **Vitest 4 + React Testing Library** | Fast, ESM-native |
| E2E tests | **Playwright 1.6x** | Menu flows, canvas boot smoke test |
| Lint/format | **ESLint 10 (flat config) + Prettier** | Enterprise hygiene |
| Package manager | **Yarn (Berry)** | Deterministic installs (`--immutable` in CI), built-in `yarn npm audit` |
| CI | **GitHub Actions (`ci.yaml`)** | Lint → typecheck → test → build → audit |

Rendering note: the game scene is fully client-side (`"use client"` + dynamic import, `ssr: false`). Next.js serves the shell, menus, and routing; the canvas mounts only on the game route to keep SSR/hydration clean and avoid WebGL-on-server issues.

Deployment note: the app builds as a **static export** (`output: 'export'` in `next.config.ts`) and deploys to **GitHub Pages** on every push to `main`. This is a natural fit — no server features are needed. Requires `basePath`/`assetPrefix` set to the repo name (e.g. `/backrooms-infinite-nightmares`) when served from `<user>.github.io/<repo>`, `images.unoptimized: true`, and trailing-slash-safe routing.

---

## 3. Architecture

### 3.1 Directory layout

```
src/
├── app/                          # Next.js App Router (thin shell only)
│   ├── layout.tsx
│   ├── page.tsx                  # Splash → redirects/transitions to menu
│   ├── menu/page.tsx             # Main menu + settings
│   └── play/page.tsx             # Game route (dynamic, ssr: false)
├── components/
│   ├── ui/                       # Dumb, reusable UI atoms (Button, Slider, Toggle, Bar)
│   ├── menu/                     # SplashScreen, MainMenu, SettingsPanel, LevelSelector, PauseMenu
│   ├── hud/                      # HUD, HealthBar, StaminaBar, LevelBadge, Crosshair
│   └── scene/                    # R3F components: Level, ChunkRenderer, Lighting, PlayerRig, Effects
├── engine/                       # Pure TS game logic — NO React imports (testable in isolation)
│   ├── generation/               # Procedural generation
│   │   ├── rng.ts                # Seeded PRNG (mulberry32/xxhash) — deterministic worlds
│   │   ├── chunk.ts              # Chunk model + maze/room algorithm
│   │   ├── chunkManager.ts       # Load/unload ring around player, LRU cache
│   │   └── levelProfile.ts       # level number (0–999) → LevelProfile
│   ├── player/
│   │   ├── movement.ts           # Kinematics: accel, friction, sprint
│   │   ├── collision.ts          # Grid-based AABB collision vs walls
│   │   └── stats.ts              # Health/stamina update rules (pure functions)
│   ├── audio/
│   │   ├── AudioEngine.ts        # Interface: playMusic/playSfx/setVolumes/dispose
│   │   ├── ProceduralAudioEngine.ts  # Web Audio implementation (drone, hum, footsteps)
│   │   └── tracks/               # Per-ambience procedural "track" definitions
│   ├── items/                    # Phase-2 ready: Item interface + registry (empty registry now)
│   └── entities/                 # Phase-2 ready: Entity interface + system stubs
├── state/                        # zustand stores (small, single-responsibility)
│   ├── settingsStore.ts          # level, difficulty, audio prefs, mode — persisted to localStorage
│   ├── gameStore.ts              # phase: splash|menu|playing|paused, session data
│   └── playerStore.ts            # health, stamina, position snapshot for HUD
├── hooks/                        # useKeyboard, usePointerLock, usePauseKey, useGameLoop glue
├── config/                       # constants.ts (speeds, chunk size, stamina rates), difficulty.ts
└── types/                        # Shared types: LevelProfile, ChunkData, Difficulty, GameSettings
```

### 3.2 Design principles applied

- **SOLID**
  - *SRP*: generation, movement, collision, audio, stats are separate pure modules; React components only render.
  - *OCP*: `LevelProfile` + trait tables mean new level styles are data additions, not code edits; new audio backends implement `AudioEngine`.
  - *LSP/ISP*: narrow interfaces (`AudioEngine`, `Item`, `Entity`, `ChunkGenerator`) — consumers depend on the minimal contract.
  - *DIP*: scene components receive engine services via a lightweight context/provider, never instantiate concretions.
- **DRY**: single source of truth in `config/` for all tunables; difficulty table drives stamina/health rules everywhere.
- **KISS**: grid-based chunks + AABB collision (no physics engine needed for MVP); add complexity only when a phase demands it.
- **Patterns (best fit, not pattern soup)**
  - *Strategy* — level generation traits & audio ambience per level profile.
  - *Factory* — `createLevelProfile(levelNumber)`, `createChunk(seed, x, z, profile)`.
  - *Object Pool / Flyweight* — reused wall/floor/ceiling geometry + materials; `InstancedMesh` for walls and pillars.
  - *Observer* — zustand subscriptions; game loop publishes, HUD subscribes selectively.
  - *State* — explicit game phase machine (`splash → menu → loading → playing ⇄ paused → menu`).
  - *Registry* — item/entity registries so Phase 2 plugs in without core changes.

### 3.3 Memory & performance budget

- **Chunk lifecycle**: render ring of N chunks around player; chunks outside ring+1 are disposed (`geometry.dispose()`, materials shared so never per-chunk). LRU cache of generated `ChunkData` (cheap, plain arrays) so revisits are instant without keeping meshes alive.
- **Instancing**: one `InstancedMesh` per material type per chunk (walls, pillars, ceiling tiles, lights) — draw calls stay flat as the world grows.
- **Shared resources**: geometries/materials/textures created once in a module-level cache; procedural textures (wallpaper, carpet, ceiling tile) generated on `<canvas>` once per level profile.
- **Game loop**: `useFrame` with delta-time; fixed-timestep accumulator for movement/stats so behavior is framerate-independent.
- **No leaks**: every `useEffect` returns cleanup (event listeners, pointer lock, AudioContext close, RAF); Playwright smoke test navigates play → menu → play to catch leaked contexts; strict-mode double-mount safe.
- **HUD isolation**: HUD lives outside the Canvas and subscribes to throttled store snapshots (≈10 Hz) — 3D framerate never blocked by DOM updates.

---

## 4. Procedural Infinite Generation

### 4.1 Determinism
- World seed = `hash(sessionSeed, levelNumber)`; chunk seed = `hash(worldSeed, chunkX, chunkZ)`.
- Same seed + level ⇒ identical world. Enables testing, sharing seeds, and later multiplayer sync.

### 4.2 Chunk algorithm
- Grid chunks (e.g. 16×16 cells, cell = 4m). Each cell: wall / open / pillar.
- Per-chunk generation mixes weighted patterns from the level profile: open plains with pillar grids, corridor mazes (recursive-division), room clusters, long hallways.
- **Border contract**: openings on chunk edges are computed from a hash of the shared edge coordinates — neighboring chunks agree without communicating (no seams, no cross-chunk dependency). This is what makes generation truly infinite and parallelizable.
- Guaranteed connectivity: each chunk keeps at least one open path between each pair of open edges (flood-fill fix-up pass).

### 4.3 Level profiles (0–999)
`createLevelProfile(n)` deterministically derives characteristics from the level number:

- **Canonical levels hand-tuned** where lore expects it: Level 0 (classic yellow wallpaper, damp carpet, hum), Level 1 (concrete warehouse/parking), Level 2 (dark maintenance corridors + pipes), Level 3 (electrical station brutalism), Level 4 (abandoned office), Level 5 (hotel), Level 6 (lights out)… defined in a data table.
- **All other levels** blend trait axes seeded by `n`: palette (sickly yellows, mono grays, dreamcore pastels, weirdcore saturation), geometry style (mono grid, maze, cathedral-scale brutalism, cramped crawl), light mood (buzzing fluorescent, sparse flicker, near-dark, unnatural glow), decay (pristine liminal → water damage, stains, exposed rebar), ceiling height, fog density/color, ambience track.
- Aesthetic pillars mapped to concrete render features:
  - *Monotonous geometry* → repeated cell patterns, instanced pillars, identical doorframes.
  - *Retro/dated finishes* → procedural wallpaper/carpet/ceiling-tile textures, beige/brown palettes.
  - *Lighting & atmosphere* → fluorescent panel lights with hum + random flicker, fog, subtle film grain/vignette post-processing.
  - *Liminal/dreamcore/weirdcore* → over-scaled empty rooms, doors to nowhere, off-palette accent levels, slightly wrong proportions.
  - *Brutalism & decay* → raw concrete materials, monolithic pillars, stain/crack decals on higher-decay levels.

---

## 5. Gameplay Systems

### 5.1 Player controller
- Pointer Lock mouse-look (yaw on rig, pitch on camera, clamped).
- Arrow keys **and** WASD; Shift = sprint; Esc = pause (releases pointer lock).
- Capsule-vs-grid AABB collision with wall sliding; fixed timestep.

### 5.2 Health & stamina
- Stamina drains while sprinting, regenerates when walking/idle (delay before regen); at 0 stamina, sprint locks until a threshold refills.
- Health: full and static in MVP peaceful mode; the pipeline (`applyDamage`, `heal`, regen rules) is implemented and difficulty-scaled so Phase 2 enemies/items plug straight in.
- Difficulty table (peaceful/easy/medium/hard) scales: stamina drain/regen, future damage taken, future item scarcity. Peaceful = no damage sources ever.

### 5.3 Game flow state machine
`splash → menu → loading (level gen + audio warmup) → playing ⇄ paused → menu`
- Implemented as an explicit typed state machine in `gameStore` — illegal transitions impossible, trivially unit-testable.

---

## 6. Audio (Backrooms soundtrack + SFX)

- `AudioEngine` interface decouples all gameplay code from the backend. MVP ships `ProceduralAudioEngine` (Web Audio API); a future `FileAudioEngine` (mp3/ogg via howler or native) is a drop-in swap — call sites never change.
- **Procedural soundtrack**, per level ambience: layered low drones (detuned oscillators), 60 Hz fluorescent hum (filtered saw + amplitude wobble), distant air-handler rumble (filtered noise), sparse eerie tonal events with long reverb (ConvolverNode with generated impulse response), level-profile-driven mix (Level 6 ≈ near silence + breathing room tone).
- **SFX**: footsteps (filtered noise bursts, carpet vs concrete variant, rate tied to walk/sprint), stamina-exhausted breathing, UI clicks, pause whoosh, light-flicker buzz spatialized via PannerNode.
- Music/SFX have independent enable + volume from settings; AudioContext created only after user gesture (menu click) per browser policy; fully disposed on quit-to-menu.

---

## 7. UI/UX

1. **Splash screen** — title "Backrooms - Infinite Nightmares", flickering fluorescent title treatment, "press any key" (also satisfies the audio-gesture requirement).
2. **Main menu** — Start, Settings, Credits. Settings: level selector (0–999, numeric input + prev/next, shows level name/traits preview), difficulty, music toggle+volume, SFX toggle+volume, mode (Single Player / Multiplayer *(soon — disabled)*). Persisted via zustand `persist`.
3. **Loading screen** — brief, seeds generation + warms audio; lore-flavored tips.
4. **In-game HUD** — health bar, stamina bar (fades when full), level badge, center dot crosshair. Reserved slot layout for Phase 2 hotbar/inventory.
5. **Pause menu** — Esc: Resume / Settings (audio + difficulty subset) / Quit to menu. Game loop and audio fully suspended while paused.

---

## 8. Phase 2 Readiness (built now, used later)

- `engine/items/`: `Item` interface (`id, name, icon, onPickup, onUse`), `ItemRegistry`, and a `WorldObject` spawn hook in chunk generation (spawn tables come from `LevelProfile`, empty in MVP). Adrenaline pill (stamina burst), bandage (heal), flashlight (spotlight toggle) become registry entries only.
- `engine/entities/`: `Entity` interface + per-frame `EntitySystem` update slot already called by the game loop (no-op now). Enemies become implementations, not refactors.
- `playerStore` already models health damage/heal and an `inventory: ItemStack[]` field (empty array in MVP).
- Difficulty table already has columns for enemy aggression/damage (unused in MVP).

---

## 9. Quality: Tests, Security, CI

### 9.1 Tests
- **Unit (Vitest)** — the pure `engine/` layer is the priority:
  - RNG determinism (same seed ⇒ same sequence; distribution sanity).
  - Chunk generation: determinism, border contract (adjacent chunks agree on edges), connectivity guarantee.
  - Level profiles: 0–999 all produce valid profiles; canonical levels match expectations.
  - Movement/collision: wall blocking, sliding, sprint speed, fixed-timestep consistency.
  - Stats: stamina drain/regen curves per difficulty, health clamp rules.
  - State machine: legal/illegal transitions.
- **Component (RTL)** — menu renders/settings interactions, HUD reflects store values, pause menu behavior.
- **E2E (Playwright)** — splash → menu → configure → start → canvas mounts → pause/resume → quit; WebGL smoke via headless GPU flags.
- Coverage gate on `engine/` and `state/` (e.g. 90%); UI measured but not gated.

### 9.2 Security / vulnerability checks
- `yarn npm audit` (fail CI on high/critical) + **Dependabot** config for weekly dependency PRs.
- CodeQL workflow (free for public repos) for static analysis.
- Strict TypeScript, no `eval`/`dangerouslySetInnerHTML`. GitHub Pages can't set custom HTTP headers, so CSP ships as a `<meta http-equiv="Content-Security-Policy">` tag (tuned for WebGL/workers/audio worklets) in the root layout.
- Settings persistence validates/sanitizes anything read back from localStorage (zod or hand-rolled guards).

### 9.3 CI/CD — `.github/workflows/ci.yaml`
Jobs (yarn cache enabled via `actions/setup-node`, `yarn install --immutable`):
1. **lint** — ESLint + Prettier check + `tsc --noEmit`.
2. **test** — Vitest with coverage, upload report artifact.
3. **build** — `next build` (static export → `out/`), upload `out/` as the Pages artifact (depends on lint+test).
4. **e2e** — Playwright against the exported build (Chromium; artifact traces on failure).
5. **audit** — `yarn npm audit --severity high`.
6. **deploy** — **GitHub Pages**, runs **only on push to `main`** after build+e2e pass: `actions/configure-pages` → `actions/upload-pages-artifact` (the `out/` export, with `.nojekyll`) → `actions/deploy-pages`. Uses the `github-pages` environment with `pages: write` + `id-token: write` permissions; PRs never deploy.

Triggers: push to `main`, all PRs. Concurrency group cancels superseded runs (deploy uses its own group so an in-flight production deploy is never cancelled mid-publish).

---

## 10. Implementation Order (milestones)

1. **M0 — Scaffold**: `create-next-app --use-yarn` (TS, App Router, ESLint), static export config (`output: 'export'`, `basePath`), Prettier, Vitest, Playwright, CI `ci.yaml` green on the empty app **and deployed to GitHub Pages**. *(CI + live deploy exist from day one.)*
2. **M1 — Engine core (pure TS)**: RNG, level profiles, chunk generation + border contract + connectivity, unit tests.
3. **M2 — Render the world**: R3F canvas on `/play`, chunk manager + instanced rendering, procedural textures, fluorescent lighting + fog, Level 0 visuals.
4. **M3 — Player**: pointer lock look, arrows/WASD movement, collision, sprint, fixed timestep.
5. **M4 — Game flow + UI**: state machine, splash, main menu + settings (persisted), loading, pause, HUD (health/stamina), quit-to-menu with full disposal.
6. **M5 — Audio**: `AudioEngine` + procedural ambience per profile, footsteps + UI SFX, volume/toggle wiring.
7. **M6 — Levels 0–999 breadth**: trait tables, canonical level overrides, post-processing polish (grain/vignette/flicker), performance pass (draw calls, dispose audit).
8. **M7 — Hardening**: E2E suite, coverage gate, memory-leak pass (play→menu→play loops), security headers, Dependabot + CodeQL, README.

Each milestone lands as a small PR-sized unit with tests; CI must stay green throughout.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Chunk seams / disagreeing borders | Edge-hash border contract + dedicated unit tests on adjacency |
| GC hitches from chunk churn | Pooled instanced meshes, plain-array chunk data, LRU reuse |
| WebGL context leaks navigating between routes | Single Canvas mounted only on `/play`, disposal audit + E2E loop test |
| Audio blocked by autoplay policy | AudioContext created on splash key-press / menu click |
| 1000 levels feeling samey | Trait-axis combinatorics + hand-tuned canonical levels + per-level palette/fog/audio |
| Pointer lock quirks across browsers | drei `PointerLockControls` + explicit Esc/regain handling, E2E coverage |
| Broken assets/routes under GitHub Pages subpath | `basePath`/`assetPrefix` from day one, E2E runs against the exported build served under the subpath |
