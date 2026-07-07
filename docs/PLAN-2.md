# Backrooms - Infinite Nightmares — Phase 2 Plan

Continuation of [PLAN.md](PLAN.md). The MVP (milestones M0–M7) shipped: infinite deterministic
generation, levels 0–999, player controller, game flow, HUD, procedural audio, CI + GitHub Pages
deploy. This phase fixes one shipped defect, adds world furniture, and then lands the Phase 2
content (items, entities) that the MVP architecture reserved seams for.

---

## 1. Scope

### In scope

1. **Pillar collision fix** — pillars currently block far more space than they visually occupy;
   collision must match the rendered mesh.
2. **Furniture system** — chairs, tables, couches, beds, drawers and similar pieces (no mirrors)
   scattered deterministically across the map, alone or grouped (side by side or piled up), with
   precise collision. Furniture is static scenery: it can never be grabbed, pushed, or picked up.
3. **Items** (per PLAN.md §8) — adrenaline pill, bandage, flashlight as registry entries, spawned
   via level spawn tables, picked up into the existing `playerStore.inventory`.
4. **Entities/enemies** (per PLAN.md §8) — first hostile entity through the existing
   `EntitySystem` seam, difficulty-scaled damage through the existing `stats.ts` pipeline;
   peaceful difficulty spawns none.
5. **Responsive UI/UX** — every screen (splash, menus, HUD, pause) adapts to any viewport;
   gameplay requires landscape, so on portrait devices (phones, iPads) the player is advised to
   rotate the screen via a blocking overlay while the game is playing.
6. **Mobile touch play** — when a mobile browser is detected the game attempts to auto-rotate to
   landscape and, during play, shows on-screen movement buttons and a sprint button; the camera
   is controlled by dragging (swiping) anywhere else on the screen.

### Explicit non-goals (unchanged from PLAN.md)

- Real multiplayer (menu keeps showing "soon").
- Physics engine — furniture is static; the grid + AABB approach stays.
- Dynamic/destructible furniture, save games, mirrors or other reflective surfaces.

---

## 2. M8 — Pillar Collision Fix

### 2.1 Root cause

Two representations of a pillar disagree:

- **Renderer** ([ChunkMesh.tsx](../src/components/scene/ChunkMesh.tsx)): pillar instances are
  scaled to `CELL_SIZE * 0.4` — a **1.6 m × 1.6 m** box centered in the cell.
- **Collision** ([chunkManager.ts](../src/engine/generation/chunkManager.ts) `isSolidAt` +
  [collision.ts](../src/engine/player/collision.ts)): any cell that is not `CELL_OPEN` is solid
  across its **entire 4 m × 4 m** footprint.

Result: an invisible ~1.2 m margin on every side of each pillar — exactly the reported
"invisible object around the pillar". A secondary defect hides behind the first: `resolveMovement`
clamps a blocked axis to the **cell** boundary, so even a shape-aware `isSolidAt` alone would
make the player stop at the cell edge instead of sliding flush against the pillar face.

### 2.2 Fix design: collide against obstacle AABBs, not cells

Generalize the collider from "cell grid is the world" to "the world hands me nearby static
AABBs". This is deliberately the same primitive furniture needs (§3.4) — designed once, used by
both.

- **New contract** in `engine/player/collision.ts`:

  ```ts
  /** Static axis-aligned obstacle in world space (XZ footprint). */
  export interface ObstacleAabb {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }

  export interface ObstacleWorld {
    /** All obstacle AABBs that could intersect the query rect (broad-phase). */
    obstaclesIn(minX: number, maxX: number, minZ: number, maxZ: number): ObstacleAabb[];
  }
  ```

- **Resolution** stays axis-separated (X then Z) for natural wall sliding, but a blocked axis is
  clamped flush to the **obstacle's** face (`obstacle.minX - radius - EPSILON`, etc.) instead of
  the cell boundary. The player footprint remains a square of half-extent `PLAYER_RADIUS`
  (square-vs-AABB overlap test — simpler and cheaper than circle-vs-corner, and indistinguishable
  at r = 0.45 m).
- **`ChunkManager` implements `ObstacleWorld`**:
  - `CELL_WALL` → full-cell AABB (unchanged behavior, existing tests keep passing).
  - `CELL_PILLAR` → centered AABB with half-extent `CELL_SIZE * PILLAR_SCALE / 2`.
  - Furniture colliders (§3.4) are appended from `ChunkData` once M9 lands.
  - Broad-phase: iterate only the cells overlapping the query rect (player moves < 1 cell per
    fixed step, so this is a ≤ 2×2 cell scan plus that cell range's furniture lists).
- **Single source of truth**: add `PILLAR_SCALE = 0.4` to
  [constants.ts](../src/config/constants.ts); both `ChunkMesh` and `ChunkManager` consume it so
  render and collision can never drift apart again (this drift *was* the bug).
- `isSolidAt` remains for spawn-safety checks but is no longer the collision primitive.

### 2.3 Tests

- Unit ([collision.test.ts]): walking into a pillar stops at the visual face (± EPSILON), not the
  cell edge; player walks freely through the open ~1.2 m band between pillar face and cell edge;
  sliding along a pillar face works on both axes; diagonal approach into a pillar corner resolves
  without tunneling; wall behavior is byte-for-byte identical to before (regression).
- Property-style: for random seeds, no resolved position ever overlaps any obstacle AABB.
- Manual verification on Level 1 (pillar-field heavy) before closing the milestone.

---

## 3. M9 — Furniture System

Static, deterministic set dressing: furniture appears alone or in groups (adjacent clusters or
piles), collides precisely, and can never be grabbed or moved. Everything below follows the
existing architecture rules: placement logic is pure TS in `engine/`, rendering is a consumer,
new content is data, not code.

### 3.1 Catalog (data, not code)

New `engine/furniture/catalog.ts` describing each piece as data; registered in a
`furnitureRegistry` (reusing [registry.ts](../src/engine/registry.ts)):

```ts
export interface FurnitureDef {
  id: string; // "chair", "table", "couch", "bed", "drawer", ...
  /** Footprint half-extents in meters (XZ) and height (Y). */
  halfX: number;
  halfZ: number;
  height: number;
  /** Can other pieces be piled on top of this one? */
  stackable: boolean;
  /** Weight when the placer picks pieces for a pile/cluster. */
  clusterAffinity: number;
}
```

Initial catalog (all box-composed, no mirrors): **chair** (0.5×0.5×0.9), **table** (1.6×0.9×0.75),
**couch** (2.0×0.9×0.8), **bed** (2.0×1.5×0.6), **drawer/dresser** (1.2×0.5×1.3),
**filing cabinet** (0.5×0.6×1.4), **bookshelf** (1.0×0.35×2.0), **crate** (0.6×0.6×0.6).
Adding a piece later = one catalog entry + one geometry builder entry (§3.5) — no engine edits.

### 3.2 Level integration

`LevelProfile` gains two data fields (defaults derived from the level RNG like every other trait):

- `furnitureDensity: number` — 0..1, expected pieces per open cell (typically 0.02–0.10).
- `furnitureWeights: Record<string, number>` — which pieces this level favors.

Canonical overrides make lore levels read correctly: Level 4 "Abandoned Office" is dense with
chairs/tables/filing cabinets, Level 5 "The Terror Hotel" favors beds/drawers, Level 0 stays
sparse (occasional lone chair — classic liminal shot), Level 6 "Lights Out" near-empty. Derived
levels get weights hashed from the level number, biased by palette family (office families favor
office furniture, etc.).

### 3.3 Deterministic placement (`engine/furniture/placeFurniture.ts`)

Runs as a pass at the end of `generateChunk`, seeded from
`hash(chunkSeed, FURNITURE_SALT)` — same seed + level ⇒ identical furniture, preserving the
determinism contract and the border contract untouched (furniture never spans chunk borders).

Placement algorithm per chunk:

1. Collect candidate open cells, **excluding** every border-contract anchor cell (gateway cells +
   their inward neighbors, via the existing `gatewayCells`) and the chunk-center anchor — the
   connectivity guarantee's carved paths run through anchors, so keeping them clear is the cheap
   invariant.
2. Roll cluster seeds from `furnitureDensity`. Each seed picks a **placement mode**:
   - **solo** — one piece, random yaw snapped to 0/90/180/270° plus a small ±10° jitter.
   - **cluster** — 2–5 pieces placed adjacently (table + chairs pushed against it, couch +
     drawer side by side) within the cell and its open neighbors.
   - **pile** — 2–4 pieces stacked: base must be `stackable`; stacked pieces get increasing Y,
     larger yaw jitter and slight XZ offset so piles read as junk heaps, not neat stacks.
3. **Fit test before commit**: a piece is placed only if its yaw-expanded AABB (a) stays inside
   open-cell area, (b) doesn't overlap already-placed furniture (except intentional pile
   stacking), and (c) leaves a walkable gap — the cell's open span minus the piece footprint must
   keep a corridor ≥ `2 * PLAYER_RADIUS + 0.3 m` to at least one open neighbor. Pieces that fail
   are dropped, not force-fitted.
4. **Connectivity safety net**: after placement, re-run the existing flood-fill over a sub-cell
   walkability grid (2×2 samples per cell, a sample is walkable if a player square centered there
   overlaps no obstacle). If any anchor became unreachable, remove the offending cluster and
   retry once, then give up (chunk simply gets less furniture). Guaranteed traversability from
   PLAN.md §4.2 stays a hard invariant.

Output extends `ChunkData`:

```ts
export interface FurniturePlacement {
  defId: string;
  /** World-space center + yaw. */
  x: number;
  y: number; // > 0 for piled pieces
  z: number;
  yaw: number;
}
// ChunkData gains: furniture: FurniturePlacement[];
```

### 3.4 Precise collision (builds on M8)

- Each placement contributes one **collider**. Yaw is mostly axis-snapped; for the jittered
  yaw the collider is the piece's **yaw-expanded world AABB** (rotate the footprint corners, take
  min/max). At ≤ 10° jitter the expansion error is centimeters — visually "precise" while keeping
  the M8 resolver untouched. (If play-testing shows corner snagging on jittered pieces, the
  escalation path is a local-frame square-vs-OBB test behind the same `ObstacleWorld` interface —
  no call-site changes.)
- Pieces shorter than a step-over threshold (`height < 0.35 m`, e.g. nothing in the initial
  catalog) would be walkable; everything listed collides at full footprint. Piled pieces above
  head height still collide via the base piece — the player never climbs.
- `ChunkManager.obstaclesIn` unions cell obstacles (walls, pillars) with a per-chunk furniture
  collider list, pre-bucketed by cell index at generation time so the broad-phase stays O(cells
  touched), not O(furniture in chunk).
- **No interaction surface at all**: furniture registers no `Item`, no `onPickup`, nothing in any
  interaction registry — statically not grabbable, matching the requirement.

### 3.5 Rendering (`components/scene/FurnitureMesh.tsx`)

Follows the established instancing budget rules (PLAN.md §3.3):

- **One merged `BufferGeometry` per furniture type**, built once at module level from unit boxes
  (chair = seat + backrest + 4 legs, bed = frame + mattress slab, drawer = body + face insets…)
  via `BufferGeometryUtils.mergeGeometries`. Eight geometries total for the whole game — never
  per chunk, never disposed.
- **One `InstancedMesh` per furniture type per chunk**, transforms straight from
  `ChunkData.furniture`. Draw calls grow by ≤ catalog size per chunk, same pattern as
  walls/pillars/lights.
- **Materials**: extend [levelMaterials.ts](../src/components/scene/levelMaterials.ts) with two
  shared per-level materials (wood-ish accent tone + fabric tone derived from the level palette,
  decay-darkened) so furniture always sits in the level's color world. Shared like every other
  material; disposed with the level set on unmount.
- Unmount frees only per-chunk instance buffers — verified by the existing play→menu→play E2E
  leak test, which must stay green.

### 3.6 Tests

- **Determinism**: same seed/level/chunk ⇒ identical `furniture` arrays (deep equality).
- **Validity**: for a sweep of seeds × levels, no placement overlaps a wall/pillar AABB; no
  placement on gateway anchor cells; pile members are stacked on `stackable` bases only.
- **Connectivity**: post-placement sub-cell flood fill still reaches all edge anchors — extends
  the existing `chunk.test.ts` connectivity suite.
- **Collision**: player cannot pass through a table; slides along a couch face; walks through a
  gap the fit test guaranteed.
- **Coverage**: `engine/furniture/` joins the 90% coverage gate.

---

## 4. M10 — Items (PLAN.md §8, now real)

The seams exist; this milestone fills them:

- **Registry entries** in `engine/items/`: `adrenaline` (temporary stamina drain immunity +
  regen burst), `bandage` (flat heal via existing `heal()`), `flashlight` (toggleable spotlight
  parented to the camera; state in `playerStore`).
- **Spawning**: `LevelProfile.spawnTable` stops being empty — weights per level, scaled by the
  difficulty table's item-scarcity column. Chunk generation rolls `ChunkData.spawns` (the field
  already exists) on open non-anchor cells; item spawns avoid furniture-occupied space (or
  deliberately sit **on** tables/drawers — flat `stackable` tops make natural item shelves).
- **Pickup**: proximity + look-at check in the fixed-timestep loop; picked items go to
  `playerStore.inventory` (already modeled); number keys / click to use. Items are the *only*
  grabbable things — furniture stays inert by construction.
- **Rendering**: small instanced meshes with a slow idle bob/spin; despawn on pickup.
- **HUD**: fill the reserved hotbar slot layout from PLAN.md §7.
- **Tests**: spawn determinism, difficulty scarcity scaling, pickup/use effects on stats
  (pure-function level), inventory HUD component tests.

---

## 5. M11 — Entities / Enemies (PLAN.md §8, now real)

- First enemy ("Wanderer"): implements the existing `Entity` interface, ticked by the
  already-running `EntitySystem.update`. Behavior: seeded roaming through open cells, aggro on
  line-of-sight within radius, chase using the same grid + `ObstacleWorld` collision the player
  uses (M8 pays off again), contact damage through the difficulty-scaled `applyDamage` pipeline.
- **Difficulty**: peaceful ⇒ spawn table contains zero entities (invariant + test); easy→hard
  scale count, aggression, damage from the existing difficulty columns.
- **Spawning**: via `LevelProfile.spawnTable` + `ChunkData.spawns`, min-distance from player
  spawn; despawn with chunk unload, respawn deterministically on revisit.
- **Audio**: proximity cue through the `AudioEngine` interface (spatialized via the existing
  PannerNode path) — gameplay code still never touches Web Audio.
- **Rendering**: simple silhouette mesh + emissive eyes reading well in fog; animation via
  transform, no skeletal rig this phase.
- **Tests**: AI state transitions (pure), damage scaling per difficulty, peaceful-spawns-nothing,
  E2E smoke on a hostile difficulty.

---

## 6. M12 — Responsive UI/UX & Orientation Gate

Menus already work at desktop sizes; this milestone makes every surface hold up on any viewport
and adds the landscape requirement for gameplay.

### 6.1 Responsive foundation

- **Fluid layout everywhere**: menus, settings, HUD and pause overlay move to `clamp()`-based
  typography and spacing, flex/grid layouts with no fixed pixel widths, and `dvh` viewport units
  (mobile URL-bar-safe) instead of `vh`. Touch targets ≥ 44 px on coarse pointers.
- **Safe areas**: HUD bars, level badge and (later) touch buttons respect
  `env(safe-area-inset-*)` so notches and home indicators never cover them.
- **Breakpoint audit**: splash, menu, settings and pause verified at phone portrait/landscape,
  tablet portrait/landscape and desktop. Menus remain fully usable in **portrait** — only
  gameplay demands landscape.
- The `filmOverlay` rule from CLAUDE.md still applies: all interactive overlays stay below
  z-index 40.

### 6.2 Orientation gate (rotate-your-device advisory)

- A `useViewportOrientation` hook (matchMedia `(orientation: portrait)`) drives a blocking
  **RotateOverlay** shown only while the game phase is `playing`/`paused` *and* the viewport is
  portrait: dimmed backdrop, animated rotate-phone glyph, "Rotate your device to play" in the
  game's flickering-fluorescent style.
- While the overlay is up the simulation is suspended through the existing pause path (guarded
  `transition()` — no new phase needed: portrait during `playing` triggers `pause`; the overlay
  simply sits above the pause menu until orientation is landscape again).
- Desktop is unaffected: the overlay only arms on coarse-pointer devices, so resizing a desktop
  window tall never blocks play.

### 6.3 Tests

- Component: RotateOverlay renders/hides on mocked orientation changes; menus render without
  overflow at 360×640, 768×1024, 1920×1080 (RTL + jsdom `matchMedia` mocks).
- E2E: Playwright mobile-emulation project (portrait viewport + `hasTouch`) — starting a game in
  portrait shows the rotate advisory; switching viewport to landscape dismisses it and the game
  resumes.

---

## 7. M13 — Mobile Touch Controls

Touch play plugs into the same fixed-timestep loop through an input abstraction — the engine
never learns what a touch is.

### 7.1 Input abstraction (prerequisite refactor)

- Introduce a normalized per-frame input contract consumed by
  [PlayerRig.tsx](../src/components/scene/PlayerRig.tsx):

  ```ts
  export interface InputFrame {
    moveX: number; // -1..1 strafe
    moveZ: number; // -1..1 forward/back
    sprint: boolean;
    lookDX: number; // accumulated look delta since last sim step (radians-scaled)
    lookDY: number;
  }
  ```

- The existing keyboard hook + pointer-lock mouse path becomes one `InputSource` implementation;
  touch becomes a second. `PlayerRig` consumes whichever source is active and stays otherwise
  unchanged — movement/collision/stats code is untouched.

### 7.2 Mobile detection & auto-rotate

- **Detection by capability, not UA string**: `(pointer: coarse)` + `(hover: none)` media
  queries with `navigator.maxTouchPoints` as tiebreaker (catches iPads reporting desktop UA).
- **Auto-rotate on entering play**: request fullscreen on the game container (already a user
  gesture — the Start tap), then `screen.orientation.lock("landscape")`. This works on
  Android Chrome/Edge; **iOS Safari does not support orientation lock**, so when the lock call
  rejects, the M12 RotateOverlay is the fallback advisory — the two milestones deliberately share
  this seam. Orientation is unlocked and fullscreen exited on quit-to-menu.

### 7.3 On-screen controls (`components/hud/TouchControls.tsx`)

Rendered only for coarse-pointer devices during `playing`, as DOM overlays (below z-40,
`touch-action: none`, `pointer-events: auto`):

- **Movement pad** (bottom-left): a virtual joystick thumb-stick — drag from its base for
  analog `moveX/moveZ` with a dead zone and radial clamp; visually rendered as a pad of direction
  buttons so it also works as tap-and-hold D-pad for players who prefer discrete buttons.
- **Sprint button** (bottom-right): hold-to-sprint, feeding the same `sprint` flag the Shift key
  sets; disabled/greyed state mirrors the stamina-lock rule.
- **Look by dragging the screen**: any touch that starts **outside** the control zones drives the
  camera — per-frame deltas from that pointer feed `lookDX/lookDY` with a touch sensitivity
  setting (added to the settings panel, persisted like the rest). No pointer lock involved on
  touch; the pointer-lock path stays desktop-only.
- **Multi-touch correctness**: pointers are tracked by `pointerId`, so move + look + sprint work
  simultaneously; a canceled pointer (`pointercancel`, edge-swipe) zeroes only its own channel.
- **Pause button** (top corner): Esc doesn't exist on mobile — a small pause icon triggers the
  same guarded `transition("paused")`.
- Browser gesture defenses: `preventDefault` on touch start within the play surface,
  `overscroll-behavior: none` on the game route to stop pull-to-refresh and back-swipe
  navigation from hijacking look drags.

### 7.4 Tests

- Unit: joystick math (dead zone, normalization, radial clamp) as pure functions in `engine/` or
  a plain TS module; look-delta accumulation and reset per sim step.
- Component: TouchControls renders only on coarse-pointer (mocked media queries); sprint button
  press/release toggles the input flag; pause button fires the phase transition.
- E2E (Playwright touch emulation, landscape): controls are visible in play; a joystick drag
  moves the player (position snapshot changes); a screen drag changes the camera; pause button
  opens the pause menu. Desktop project asserts touch controls are absent.

---

## 8. Quality gates (unchanged discipline)

- Every milestone lands PR-sized with tests; CI (`lint → typecheck → test → build → e2e → audit`)
  stays green throughout; coverage thresholds keep applying to all new `engine/` modules.
- Determinism, border-contract and connectivity tests are the regression firewall — M9 extends
  them rather than weakening them.
- The play→menu→play E2E leak test gates M9 (new geometries/materials) and M11 (entity meshes).
- Performance budget check after M9: furniture must not push draw calls or frame time past the
  MVP baseline on Level 4 (densest furniture level) — measured before/after with the same seed.
- M12/M13 add a Playwright mobile-emulation project to CI (touch + portrait/landscape viewports);
  both desktop and mobile projects must pass.

---

## 9. Implementation order

| Milestone | Deliverable                                    | Depends on |
| --------- | ---------------------------------------------- | ---------- |
| **M8**    | Obstacle-AABB collider; pillar collision matches visuals | —          |
| **M9**    | Furniture: catalog, deterministic placement, precise collision, instanced rendering | M8         |
| **M10**   | Items: registry entries, spawn tables, pickup, hotbar HUD | M9 (spawn placement aware of furniture) |
| **M11**   | First enemy through `EntitySystem`, difficulty-scaled damage | M8 (shared collision), M10 (spawn plumbing) |
| **M12**   | Responsive UI everywhere; portrait rotate-device gate during play | —          |
| **M13**   | Touch controls: input abstraction, auto-rotate, move pad, sprint, drag-look, pause button | M12 (orientation gate, responsive HUD) |

M8 goes first because it is a shipped defect *and* because its `ObstacleWorld` abstraction is the
foundation furniture and enemy collision both stand on. M12 is independent of the world-content
track (M9–M11) and can land in parallel; M13 builds on M12's orientation gate and responsive HUD.

---

## 10. Risks & mitigations

| Risk                                                         | Mitigation                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Collider refactor regresses wall feel                        | Wall AABBs remain full cells — existing collision tests must pass unmodified before pillar tests are added |
| Furniture blocks guaranteed paths                            | Anchor-cell exclusion + walkable-gap fit test + sub-cell flood-fill safety net; drop pieces, never force-fit |
| Yaw-jittered pieces snag the player on inflated AABB corners | Jitter capped at ±10°; escalation path to local-frame OBB test is isolated behind `ObstacleWorld` |
| Draw-call growth from 8 furniture types × chunks             | One instanced mesh per type per chunk, merged geometries, skip empty types; measured perf gate on Level 4 |
| Determinism drift (furniture differing between visits)       | Placement seeded from chunk seed + salt; deep-equality determinism tests across regenerate cycles |
| Enemy pathing cost per frame                                 | Grid-based steering reusing chunk cells (no navmesh); entity count capped per difficulty          |
| Orientation lock unsupported (iOS Safari rejects `orientation.lock`) | Lock attempted where available; rejection falls back to the M12 rotate-device overlay — advisory always works |
| Browser gestures hijack look-drag (pull-to-refresh, back-swipe) | `touch-action: none` on the play surface, `overscroll-behavior: none`, `preventDefault` on tracked pointers |
| Touch e2e flakiness across emulated devices                  | Pointer events tested at the unit/component layer; Playwright covers one canonical mobile profile only |
| Input refactor regresses desktop feel                        | Keyboard+mouse path becomes an `InputSource` with behavior-identical output; existing movement tests and desktop e2e must pass unmodified |
