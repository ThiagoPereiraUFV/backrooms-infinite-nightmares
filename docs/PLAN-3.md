# Backrooms - Infinite Nightmares — Phase 3 Plan: The Main Nine

Continuation of [PLAN.md](PLAN.md) (MVP, M0–M7) and [PLAN-2.md](PLAN-2.md) (M8–M13, shipped).

This phase is a **scope reduction**, not a feature. It retires the 0–999 procedural level
generator and reduces the game to a small, hand-authored roster of canonical Backrooms levels —
"The Main Nine" — so that all future level work goes into depth on nine maps instead of breadth
across a thousand.

---

## 0. Implementation Status

**Shipped.** All four milestones (M14–M17) are implemented. Every gate is green: `yarn lint`,
`yarn typecheck`, `yarn test`, `yarn test:coverage` (engine/state/config above the 90/85%
thresholds), `yarn build`, and `yarn e2e`. The catalog is now exactly the nine authored levels
described below — `createLevelProfile`'s 0–999 RNG derivation is gone, and an out-of-roster
`level` value is a store-boundary error, not a clamp. See §9.7 for the live browser walkthrough
record.

**✅ Roster verified** against <https://backrooms.fandom.com/wiki/Category:The_Main_Nine> (fetched
live during planning): **The Main Nine = Levels 0 through 8**, nine consecutive numbers, not a
scattered set. See [§2.2](#22-roster-verification-result) for the confirmed table and the one
remaining decision (how to fill the two missing profiles) before §4 starts.

---

## 1. Problem statement & motivation

`createLevelProfile(n)` currently answers for **every integer 0–999**: seven levels are
hand-authored lore levels, the other 993 are RNG rolls over trait axes (palette family, geometry
style weights, ceiling height, fog, decay, ambience, furniture and spawn tables).

That breadth costs more than it returns:

- **Detail can't be aimed anywhere.** Every improvement to level content has to either be generic
  enough for 993 randomly-configured levels, or it only touches one of the seven authored ones.
  Adding a Level-5-specific hotel corridor motif, a Level 8 water plane, or bespoke Level 0
  wallpaper is currently a special case bolted onto a generic pipeline.
- **The 993 derived levels are noise, not content.** "The Bleached Warrens" is a name from two
  word lists and six rolled numbers. They are cheap to generate and cheap to forget — none of them
  carry lore, and they dilute the nine that do.
- **Every test, sweep and coverage pass pays for the level space.** `levelProfile.test.ts` loops
  1000 profiles; other suites sample arbitrary numbers (`123`, `777`, `42`, `137`) that mean
  nothing.
- **Validation is a clamp, not a contract.** `clampLevel` maps any input into 0..999, so "level
  501" is always a valid game. With a fixed roster, an unknown level number becomes an _error_ the
  type system and the store boundary can actually catch.

**Goal:** the game ships a fixed, enumerable set of canonical levels. Every level is authored data
with a name, lore identity and hand-tuned traits. The world inside each level stays infinite and
procedurally generated — only the _catalog of levels_ shrinks.

---

## 2. The roster

### 2.1 What the repo already has

`CANONICAL_LEVELS` in [levelProfile.ts](../src/engine/generation/levelProfile.ts) is the most
reliable statement of which levels are actually implemented with real names and hand-tuned traits
today. It contains **seven** entries:

| Level | Name               | Palette family    | Signature traits (as authored today)                       |
| ----- | ------------------ | ----------------- | ---------------------------------------------------------- |
| 0     | The Lobby          | yellowedOffice    | wallDensity 1, fluorescentHum, sparse furniture, low decay |
| 1     | Habitable Zone     | concreteBrutal    | pillarField-dominant, 4.5 m ceilings, deepDrone            |
| 2     | Pipe Dreams        | industrialDark    | halls-dominant, 2.6 m ceilings, heavy decay 0.7            |
| 3     | Electrical Station | industrialDark    | mixed maze/rooms, flicker 0.7, cabinets + crates           |
| 4     | Abandoned Office   | bleachedLiminal   | rooms-dominant, densest furniture (0.1), nearSilence       |
| 5     | The Terror Hotel   | industrialDark    | halls + rooms, beds/drawers, windHollow                    |
| 6     | Lights Out         | inline near-black | lightIntensity 0.06, fog 0.16, heaviest wanderer weight    |

Every one of these seven entries already specifies **all sixteen `LevelProfile` fields except
`level`** — i.e. for levels 0–6 the derived RNG contributes literally nothing today; the spread
`{ ...derived, ...canonical, level }` overwrites all of it. **This is the key structural finding
of this plan: deleting the derivation cannot change how any retained level looks or plays.**

### 2.2 Roster verification result

The community wiki category _The Main Nine_
(<https://backrooms.fandom.com/wiki/Category:The_Main_Nine>) was fetched live during planning. The
category's own description: _"The Main Nine are classically considered the 'core' levels of the
Backrooms... these are levels 0 through 8."_ The category listing confirms exactly nine pages:
**Level 0, 1, 2, 3, 4, 5, 6, 7, 8** — a contiguous run, not a curated scatter (no Pool Rooms,
Suburbs, etc. — those are outside the Main Nine).

Cross-checking each page's title against the repo's `CANONICAL_LEVELS`:

| Level | Wiki title               | Repo name today    | Status                                             |
| ----- | ------------------------ | ------------------ | -------------------------------------------------- |
| 0     | "The Lobby"              | The Lobby          | ✅ exact match                                     |
| 1     | "Parking Zone"           | Habitable Zone     | ⚠️ **different name** — repo's is not a wiki alias |
| 2     | "Pipe Dreams"            | Pipe Dreams        | ✅ exact match                                     |
| 3     | "The Electrical Station" | Electrical Station | ~ same identity, missing article                   |
| 4     | "The Abandoned Office"   | Abandoned Office   | ~ same identity, missing article                   |
| 5     | "Terror Hotel"           | The Terror Hotel   | ~ same identity, extra article                     |
| 6     | "Lights Out"             | Lights Out         | ✅ exact match                                     |
| 7     | "Thalassophobia"         | _not implemented_  | ❌ missing — must be authored                      |
| 8     | "Cave System"            | _not implemented_  | ❌ missing — must be authored                      |

So the gap is exactly **two** profiles (7 and 8), not an unknown number, and only **one** name is a
real mismatch (Level 1). The three "~" rows are cosmetic article differences, not identity
conflicts — no decision needed there beyond §3 below.

**Decisions confirmed by the user:**

1. **Fill the two-level gap — yes.** Author Level 7 ("Thalassophobia" — aquatic/flooded theme) and
   Level 8 ("Cave System" — cave theme) as their own commit within M14 (§11), ahead of the
   deletion commit.
2. **Level 1 naming — rename to the wiki's "Parking Zone".** Replace `"Habitable Zone"` with
   `"Parking Zone"` in the authored literal. This is the only name string that changes; the level's
   other traits (concreteBrutal palette, pillarField geometry, 4.5 m ceilings, deepDrone ambience)
   are untouched — this is a rename, not a retune.
3. Articles ("The Electrical Station" vs "Electrical Station", etc.) — left as-is; cosmetic only.

The final `LEVELS` roster for §4.1 is therefore: **0 The Lobby, 1 Parking Zone, 2 Pipe Dreams,
3 Electrical Station, 4 Abandoned Office, 5 The Terror Hotel, 6 Lights Out, 7 Thalassophobia (new),
8 Cave System (new)** — nine entries, lore numbers preserved (Design Notes D2). Record this table
at the top of `levelProfile.ts`'s doc comment so the next reader knows the roster is deliberate.

---

## 3. Scope

### In scope

1. Collapse `createLevelProfile(n)` from a 0–999 generator into a lookup over a fixed, fully
   authored roster.
2. Delete the derivation machinery that only existed to serve the 993 non-canonical levels.
3. Turn level _validation_ from a numeric clamp into roster membership, at the one boundary that
   needs it (the persisted settings store).
4. Replace the numeric level spinner in the menu with a picker over the roster.
5. Update every test, sweep constant and doc that encodes the 0–999 level space.

### Explicit non-goals

- **This plan adds no new map detail to the nine levels.** It clears the space for that work; the
  actual deepening (bespoke motifs, per-level props, set pieces) is a follow-up phase.
- **No level progression / unlock system** (see §7 — recommended _not now_, with reasoning).
- **No new level-select screen or route.** The existing settings panel gets a different control,
  not a new surface.
- **No renumbering** of levels to a 0..8 index (see Design Notes D2).
- **No save games / persisted progress** — unchanged from PLAN.md; `collectedStore` stays
  session-scoped.
- **No change to chunk generation, the border contract, collision, audio, items or entities.**
  Those consume a `LevelProfile`; they neither know nor care how many exist.
- **The world is still infinite.** "Infinite Nightmares" refers to the endless space _within_ a
  level; only the catalog shrinks. Marketing copy must be adjusted (§8), not the generator.

---

## 4. M14 — `levelProfile.ts` becomes a catalog

This is the whole engine change. One file, mostly deletion.

### 4.1 New shape

```ts
/**
 * The Main Nine — the only playable levels. Order defines menu order.
 * Every profile is authored in full: there is no derivation, so a missing
 * field is a compile error rather than a silent RNG roll.
 */
export const LEVELS: readonly LevelProfile[] = [/* 0, 1, 2, ... */];
```

- **`CANONICAL_LEVELS: Record<number, Partial<LevelProfile>>` → `LEVELS: readonly LevelProfile[]`.**
  Dropping `Partial` is free (§2.1: all entries are already complete) and buys a real guarantee:
  TypeScript now rejects a new level that forgets `itemSpawnDensity`, where today it would
  silently inherit an RNG roll. Each entry carries its own `level: <lore number>` field.
- **Array, not `Record<number, …>`**: the roster now needs to be _enumerated_ (menu picker, tests,
  any future sequential order), which an ordered array expresses directly. Lookup by number is a
  module-level `Map` built once from the array — one source of truth, no duplicated numbering.
- **`createLevelProfile(level)` → `getLevelProfile(level)`.** Nothing is created any more; the
  name should say what it does (Factory → simple repository lookup). The rename is mechanical and
  the compiler finds all six call sites. Keep the file path and the `LevelProfile` type export
  unchanged so nothing else moves.
- **`getLevelProfile` throws on an unknown level number.** It is internal code with a validated
  boundary in front of it (§5); a silent fallback to Level 0 would hide exactly the bugs this
  refactor is meant to surface. Error handling belongs at the boundary, not here.
- **Export the roster's level numbers** (e.g. `LEVEL_NUMBERS: readonly number[]`, derived from
  `LEVELS`) _or_ let `settingsStore`/`SettingsPanel` map over `LEVELS` directly. Prefer the
  latter — the picker wants `{ level, name }` anyway, and a second exported list is one more thing
  to keep in sync (DRY).

### 4.2 Deletions in the same file

Delete outright (recoverable from git history; nothing retained references them):

- `createRng`/`hashInts` import and the entire `derived` object in `createLevelProfile`.
- `NAME_ADJECTIVES`, `NAME_NOUNS` — procedural naming only ever named derived levels.
- `FAMILY_FURNITURE` and the `PaletteFamily` interface — the family→furniture bias existed to give
  derived levels plausible furniture; the nine specify `furnitureWeights` explicitly.
- `clamp01` — only the derived rolls used it.
- `PALETTE_FAMILIES`: **keep only the palettes an authored level actually references**, inlined
  next to the level that uses them (or as a small named palette list if two levels share one).
  Today that means the `dreamcorePastel` and `weirdcoreSaturated` families and several second
  palettes become dead data. Deleting them removes those aesthetics from the game — accept that
  (they exist nowhere in the retained roster today either), or adopt one for a newly-authored
  level under §2.2(a). Do not keep dead palette tables "for later" (YAGNI).

Referencing palettes as `PALETTE_FAMILIES[2].palettes[1]` is already unreadable; while the entries
are being edited anyway, give the retained palettes names (`INDUSTRIAL_DARK_RUST`,
`YELLOWED_OFFICE`, …) so each level literal says what it looks like. That is the readability win
of this file, and it costs nothing extra.

### 4.3 What must _not_ change

- The `LevelProfile` interface: no fields added, removed or renamed. Every downstream consumer
  (`generateChunk`, `chunkManager`, `placeFurniture`, `placeSpawns`, `levelMaterials`,
  `proceduralTextures`, `ChunkMesh`, `GameScene`, `ProceduralAudioEngine`) keeps compiling
  untouched. This is what keeps the change small.
- The **field values** of levels 0–6. They are the shipped look of the game; this phase is not a
  retune. Any value edit is a separate, deliberate commit.
- `chunk.ts`: nothing there is level-count-aware. `edgeGateways` hashes only
  `(worldSeed, orientation, edgeA, edgeB)` — it never sees the profile, so the border contract is
  structurally immune to this change. `generateChunk` reads `styleWeights`, `wallDensity`,
  `lightSpacing`, `furnitureDensity/Weights`, `itemSpawnDensity`, `spawnTable` — all still present.
- `MAX_LEVEL` disappears (§5), so `config/constants.ts` loses one export and gains nothing.

---

## 5. M15 — Boundary validation in `settingsStore`

`settingsStore` is the **only** place a level number enters the system from outside (user input,
and localStorage under key `bin-settings`, which is user-editable). It already has the right
shape — `setLevel` sanitizes, and `merge()` re-sanitizes on rehydrate. Keep that pattern; only the
rule changes.

- `clampLevel(level)` → a roster-membership sanitizer (`sanitizeLevel` or similar): return the
  value if it is a level number in `LEVELS`, else the first roster level. `Math.round`, the
  `Number.isFinite` guard and the 0..MAX clamp all go away with it.
- `clampLevel` is currently **exported** solely so `SettingsPanel` can parse the numeric input.
  With a picker (§6) the UI can only ever emit roster values, so the sanitizer becomes module-
  private. Fewer public surfaces, one less thing to test.
- Remove the `MAX_LEVEL` import here and delete `MAX_LEVEL` from
  [constants.ts](../src/config/constants.ts) — the roster is the source of truth for what is
  playable, and a numeric ceiling no longer describes it.
- Layering note: `state/` already imports from `engine/` (`gameStore` → `gamePhase`), so importing
  `LEVELS` here follows the established direction. `config/` must **not** import from `engine/` —
  which is the other reason `MAX_LEVEL` cannot simply become `LEVEL_NUMBERS` in constants.

With that boundary in place, `GameRoot` and `SettingsPanel` can call `getLevelProfile(level)`
without a guard — the store cannot hold a non-roster level. No defensive checks in components.

---

## 6. M16 — Menu: numeric spinner → roster picker

[SettingsPanel.tsx](../src/components/menu/SettingsPanel.tsx) is the only level-selection UI in
the app (`MainMenu` renders it; `GameRoot` renders it `compact`, which already hides the level
row mid-run).

- Replace the `− / <input type="number"> / +` group with a `<select>` listing every roster level as
  `"{level} — {name}"`, reusing the existing `styles.select` class and the `Field` wrapper that the
  Difficulty row already uses. **Consistency over novelty:** the panel already has exactly this
  control for Difficulty; a level-card grid or a custom stepper would be a new pattern for no gain
  (YAGNI — nine short strings need nine `<option>`s).
- Give it `aria-label="Level"` (distinct from `"Difficulty"`), because every test and e2e spec
  selects controls by accessible role + name in this codebase.
- **Keep the preview line** (`preview.name`, ambience, decay wording) — it is the one bit of flavor
  in the menu and now describes an authored level rather than an RNG roll. It should read from
  `getLevelProfile(settings.level)` exactly as it does today.
- CSS cleanup in [menu.module.css](../src/components/menu/menu.module.css): `.levelInput` and
  `.stepButton` (including its `@media (pointer: coarse)` 44 px rule) become unused — delete them.
  `.levelRow` is still used by the Mode row; `.levelPreview` still used. Verify with a grep before
  deleting rather than assuming.
- Touch targets: a native `<select>` already satisfies the coarse-pointer 44 px requirement from
  PLAN-2 §6.1 (the difficulty select has the same media-query treatment) — check the
  `@media (pointer: coarse)` block covers `.select` and leave it alone.

No other UI touches the level: `Hud` receives `levelNumber`/`levelName` as props from `GameRoot`,
and the enter overlay prints `Level {n} — {name}`. Both keep working unchanged, which is a direct
consequence of keeping lore numbering (Design Notes D2).

---

## 7. Level progression — open design decision (recommendation: not now)

**Question:** with only nine levels, should the player advance 0 → 1 → 2 → … in sequence?

**Current reality:** there is no progression of any kind. A level is chosen in the menu, the run
starts, and the only exits are pause → quit. There is no goal, no level exit, no completion
condition, no persisted progress (`collectedStore` is explicitly session-scoped, `playerStore`
resets on quit, `gameStore.worldSeed` is re-randomized per run), and `gamePhase`'s transition
table has no playing → loading edge.

**Recommendation: keep free selection from the menu; do not add progression in this phase.**
Sequential progression is a _feature_, not a side effect of shrinking the roster. It would require
inventing (a) a completion condition — a noclip trigger / exit volume in chunk generation, (b) a
`playing → loading` transition and a "next level" flow, (c) persisted unlock state and therefore
the save-game system PLAN.md explicitly declined, and (d) a design answer for what happens after
the last level. None of that makes the nine levels more detailed, which is the stated goal.

If the user wants it anyway, it is a clean follow-up phase and the array order of `LEVELS` is
already the sequence it would walk — which is one more reason to make the roster an ordered array
in §4.1 rather than a map.

---

## 8. Backward compatibility & docs

**Persisted state.** The only level-keyed persistence is `level: number` inside the `bin-settings`
localStorage entry (zustand `persist`). A returning player may have any value in 0..999 stored.

- The existing `merge()` sanitizer is exactly the migration seam: with §5 in place, a persisted
  `137` rehydrates to the first roster level. **No `version`/`migrate` config and no store-name
  bump** — the sanitizer already covers it, and adding migration machinery for a single scalar
  would be over-engineering (YAGNI). Add a one-line test asserting the fallback (§9).
- Nothing else persists a level: `collectedStore` keys are `cx,cz,cellX,cellZ,id`
  ([spawnFilter.ts](../src/engine/generation/spawnFilter.ts) `spawnKey`) and are not persisted;
  world seeds are per-session.
- User-visible consequence: someone who last played "Level 512" lands on Level 0 next visit, with
  all other settings intact. Acceptable; call it out in the PR description.

**Docs to update** (they describe current behavior, so they must change with it):

- [CLAUDE.md](../CLAUDE.md) — the "**Levels 0–999**" architecture bullet becomes a "fixed roster,
  new levels are entries in `LEVELS`" bullet. Keep the "new level styles are data additions, not
  code edits" spirit; it is _more_ true now.
- [README.md](../README.md) — the tagline ("1,000 levels of infinite…") and the
  "**1,000 selectable levels (0–999)**" feature bullet. Reword to nine hand-authored canonical
  levels, and keep the "infinite procedural world" bullet as-is: within a level, it still is.
- [PLAN.md](PLAN.md) / [PLAN-2.md](PLAN-2.md) — **leave as historical record** (PLAN-2 already sets
  that precedent by describing what was true at the time). This document supersedes their 0–999
  statements; say so once here rather than editing history.

---

## 9. Test plan

Framework is unchanged: Vitest (`vitest.config.mts`, jsdom) + React Testing Library for
components, Playwright for e2e. Coverage gate (`src/engine/**`, `src/state/**`, `src/config/**` at
90/85%) still applies.

### 9.1 Rewrite — `src/engine/generation/levelProfile.test.ts`

- Replace `"produces a valid profile for every level 0..999"` with the same body iterating
  `LEVELS`. Every existing field assertion is **kept** — it stops being a generator sanity check
  and becomes a _data-integrity_ check over authored content, which is more valuable. Note the
  existing `ceilingHeight` 2.5–6.5 bounds: if a newly authored level intentionally exceeds them,
  widen the bound deliberately in the same commit and say why.
- Keep `"gives canonical levels their lore identities"` verbatim (Level 0 → "The Lobby",
  Level 6 → "Lights Out", Level 4 the furniture-dense one, Level 6 the darkest / highest wanderer
  weight). It now guards against fat-fingered edits to the authored table.
- **Delete** `"varies characteristics across levels"` (the 100–199 name-diversity sweep) — the
  code it tested is gone.
- **New:** the roster is well-formed — non-empty, level numbers unique, `profile.level` matches its
  own entry, names unique and non-empty.
- **New:** `getLevelProfile(n)` returns the identical object for every roster number, and **throws**
  for a non-roster number (e.g. `999`, `-1`, `7` if 7 isn't in the roster). This is the test that
  encodes "only the roster is playable".
- `"is deterministic per level"` (currently `createLevelProfile(37)`) — retarget to a roster level;
  it is now trivially true but cheap to keep as an interface guard.

### 9.2 Rewrite — `src/state/settingsStore.test.ts`

- Replace `"clamps level into 0..999"` with: every roster level is accepted; a non-roster number,
  a negative, a fractional and `NaN` all fall back to the first roster level.
- **Delete** `"exposes clampLevel for UI input parsing"` (the export goes away).
- **New (backward compat):** seed `localStorage["bin-settings"]` with a persisted out-of-roster
  level (e.g. `137`) and assert rehydrate lands on the first roster level with other settings
  preserved. This is the migration test.

### 9.3 Rewrite — `src/components/menu/SettingsPanel.test.tsx`

- Delete the `+`/`−` stepping test and the `"clamps typed level numbers to 0..999"` test.
- **New:** the select renders exactly one option per roster level, labeled with number and name.
- **New:** choosing an option updates `settingsStore.level` and the preview line updates to that
  level's name (`userEvent.selectOptions`, matching how the Difficulty test already works).
- Update `"hides level and mode controls in compact mode"` — it currently queries the
  `spinbutton`; switch to `queryByRole("combobox", { name: "Level" })` and keep asserting the
  Difficulty combobox is still present (that assertion is what makes the test meaningful).

### 9.4 Sweep constants in existing engine tests

Replace arbitrary level numbers with roster levels; the assertions themselves don't change.

- `chunk.test.ts` — `for (const level of [0, 2, 6, 123, 777])` in the border/connectivity sweep →
  roster numbers (nine levels is cheap enough to just sweep them all). **The border contract tests
  must pass unmodified in substance** — they are the regression firewall, and `edgeGateways` never
  saw the roster to begin with.
- `chunkManager.test.ts` — `[0, 6, 42]` → roster numbers.
- `placeFurniture.test.ts` — `SAMPLED = [0, 1, 4, 5, 42, 137]` → the full roster (previously six
  entries, so runtime is comparable).

### 9.5 e2e — `e2e/game-flow.spec.ts`

- `"menu configures settings and persists them"`: `getByRole("spinbutton", { name: "Level number" })
.fill("6")` → `getByRole("combobox", { name: "Level" }).selectOption(…)`; keep the
  `"Lights Out"` preview assertion and the reload-persists assertion (that reload check is exactly
  the localStorage round-trip this phase changes).
- `"full flow: menu -> game boots 3D world"`: same substitution for the `fill("0")` step; keep the
  `Level 0 — The Lobby` overlay assertion — it verifies lore numbering survived.
- `e2e/mobile.spec.ts` does not touch level selection; no change expected (verify with a grep).

### 9.6 Coverage

`levelProfile.ts` becomes near-pure data with one small lookup, and the deleted derivation was the
branchiest part of the module. Run `yarn test:coverage` and confirm the engine thresholds still
pass; if the throw-branch in `getLevelProfile` is the only uncovered line, §9.1's throw test
covers it by construction.

### 9.7 Running verification (user-facing change — required)

The menu control changes shape, so automated tests are not sufficient. This workspace has an
integrated-browser MCP configured (`browser_navigate`, `browser_snapshot`, `browser_click`,
`browser_eval`). If those tools are available in the implementer's session, run `yarn dev` and
walk it:

1. `browser_navigate` to `http://localhost:3000`, press a key to leave the splash, land on `/menu`.
2. `browser_snapshot` the settings panel: exactly the roster levels are offered, no numeric input,
   no `+`/`−` buttons.
3. Select a mid-roster level (e.g. Level 4) → preview line shows its name; start the game and
   confirm the enter overlay and HUD badge both read `Level 4 — Abandoned Office`.
4. Reload `/menu` and confirm the selection persisted; then
   `browser_eval` a tampered value into `localStorage["bin-settings"]` (`level: 137`), reload, and
   confirm the panel falls back to the first roster level instead of crashing — the boundary test,
   live.
5. Enter → pause (Esc/P) → confirm the pause panel still hides the level control, resume, quit to
   menu.

If the browser tooling is unavailable in that session, **say so explicitly in the PR** and record
manual verification of steps 1–5 by the implementer (and a spot check by the user) as an open item
rather than skipping it.

**Verification record.** Steps 1–5 were performed live via the integrated-browser MCP: the menu
offered exactly the nine roster levels with no numeric spinner; selecting Level 4 previewed
"Abandoned Office" and both the enter overlay and HUD badge read `Level 4 — Abandoned Office`;
the selection persisted across a `/menu` reload; pause (Esc/P) hid the level control and resumed
cleanly. Step 4's tamper case was independently re-confirmed in a follow-up session: seeding
`localStorage["bin-settings"]` with `level: 137` and reloading `/menu` rehydrated the store to
`level: 0` (`sanitizeLevel` in `settingsStore.ts`) — the Level `<select>` showed `0 — The Lobby`
selected out of 9 options, with no console errors and no crash. All checks passed.

---

## 10. File-by-file change list

| File                                          | Kind                  | Change                                                                                                                                                                                                                                               |
| --------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/generation/levelProfile.ts`       | **refactor + delete** | `CANONICAL_LEVELS` → complete `LEVELS: readonly LevelProfile[]`; `createLevelProfile` → `getLevelProfile` (Map lookup, throws on unknown); delete derivation, name pools, `FAMILY_FURNITURE`, `clamp01`, unused palettes; name the retained palettes |
| `src/config/constants.ts`                     | **delete**            | Remove `MAX_LEVEL` — the roster is the source of truth                                                                                                                                                                                               |
| `src/state/settingsStore.ts`                  | refactor              | `clampLevel` → private roster-membership sanitizer, used by both `setLevel` and `merge`; drop the export and the `MAX_LEVEL` import                                                                                                                  |
| `src/components/menu/SettingsPanel.tsx`       | refactor              | Level row → `<select aria-label="Level">` over `LEVELS`, reusing `styles.select`/`Field`; preview line unchanged; `getLevelProfile` rename                                                                                                           |
| `src/components/menu/menu.module.css`         | **delete**            | `.levelInput`, `.stepButton` (+ its coarse-pointer rule) once confirmed unused                                                                                                                                                                       |
| `src/components/game/GameRoot.tsx`            | rename only           | `createLevelProfile` → `getLevelProfile`                                                                                                                                                                                                             |
| `src/engine/generation/levelProfile.test.ts`  | rewrite               | §9.1                                                                                                                                                                                                                                                 |
| `src/state/settingsStore.test.ts`             | rewrite               | §9.2                                                                                                                                                                                                                                                 |
| `src/components/menu/SettingsPanel.test.tsx`  | rewrite               | §9.3                                                                                                                                                                                                                                                 |
| `src/engine/generation/chunk.test.ts`         | edit                  | Sweep level list → roster; assertions unchanged                                                                                                                                                                                                      |
| `src/engine/generation/chunkManager.test.ts`  | edit                  | Sweep level list → roster; `createLevelProfile` rename                                                                                                                                                                                               |
| `src/engine/furniture/placeFurniture.test.ts` | edit                  | `SAMPLED` → roster; `createLevelProfile` rename                                                                                                                                                                                                      |
| `e2e/game-flow.spec.ts`                       | edit                  | Spinbutton → combobox in two tests                                                                                                                                                                                                                   |
| `CLAUDE.md`                                   | edit                  | "Levels 0–999" architecture bullet → fixed roster                                                                                                                                                                                                    |
| `README.md`                                   | edit                  | Tagline + "1,000 selectable levels" feature bullet                                                                                                                                                                                                   |
| `docs/PLAN-3.md`                              | add                   | This document                                                                                                                                                                                                                                        |

Untouched by design: `chunk.ts`, `chunkManager.ts`, `placeSpawns.ts`, `placeFurniture.ts`,
`spawnFilter.ts`, `cells.ts`, `rng.ts`, `gamePhase.ts`, `gameStore.ts`, `playerStore.ts`,
`collectedStore.ts`, all of `components/scene/`, `components/hud/`, audio, items, entities.

---

## 11. Implementation order

| Step    | Deliverable                                                                                  | Depends on |
| ------- | -------------------------------------------------------------------------------------------- | ---------- |
| **0**   | Gap-fill + Level 1 naming decisions confirmed (§2.2) — user go-ahead                         | —          |
| **M14** | `levelProfile.ts` catalog + `getLevelProfile`, incl. authored Levels 7/8; engine tests green | 0          |
| **M15** | Store boundary: roster membership, `MAX_LEVEL` deleted; store tests green                    | M14        |
| **M16** | Menu picker + CSS cleanup; component + e2e tests green; live walkthrough (§9.7)              | M15        |
| **M17** | Docs (CLAUDE.md, README)                                                                     | M16        |

Author Levels 7/8 as a **separate commit within M14**, ahead of the deletion commit, so the
pure-deletion diff (§D1) stays reviewable on its own and isn't mixed with new content.

Quality gates unchanged: `yarn lint → typecheck → test → test:coverage → build → e2e` green
throughout.

---

## 12. Risks & mitigations

| Risk                                                                       | Mitigation                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authoring Levels 7/8 from scratch produces traits that feel arbitrary      | Base them on the wiki's stated theme (7 = aquatic/flooded "Thalassophobia", 8 = cave "Cave System"); treat as a first pass the detail phase can retune       |
| The nine feel thin without the illusion of 993 more                        | That is the point — this phase is only justified if the follow-up detail work actually happens; sequence it immediately after                                |
| Deleting palette families quietly removes aesthetics (dreamcore/weirdcore) | Called out in §4.2; recoverable from git; consider adopting one for a newly-authored level                                                                   |
| Retained levels drift while the file is being rewritten                    | Field values are copied verbatim; `"gives canonical levels their lore identities"` + the data-integrity sweep are the guard; any retune is a separate commit |
| Persisted level outside the roster confuses a returning player             | Sanitized on rehydrate to the first roster level (§8) with a dedicated test; noted in the PR                                                                 |
| e2e/menu selectors silently drift                                          | They fail loudly (role/name lookups), and §9.7 walks the flow live                                                                                           |
| Coverage thresholds shift when the branchy derivation disappears           | `yarn test:coverage` in the same PR; the throw-branch is covered by §9.1                                                                                     |
| Someone later re-adds a "generic level N" path                             | `getLevelProfile` throwing + the roster test make that an explicit, reviewed decision rather than a silent one                                               |

---

## 13. Design Notes

### D1 — Why this is mostly deletion, and why that's the whole point

Every one of the seven authored levels already overrides all sixteen profile fields, so the
derivation contributes nothing to them. The reduction is therefore _provably_ behavior-preserving
for the levels being kept: no retuning, no visual diff, no regeneration of the world. That is why
this plan touches one engine file, one store, one component and their tests — and why anything
larger appearing in the diff should be treated as scope creep.

### D2 — Keep lore numbering (0, 1, 2, 5, 8, …), don't reindex to 0..8

The alternative — reindexing the roster to a dense 0..8 and treating the array index as "the level"
— was considered and rejected:

- **The number is the identity.** "Level 6" is Backrooms lore; the HUD badge, the enter overlay
  and the e2e assertions all print it. Reindexing would rename Lights Out to "Level 5" or similar,
  which is a content regression disguised as a refactor.
- Lookup by lore number costs one `Map`. Dense indexing buys nothing but an array subscript.
- It survives roster gaps. If the confirmed Main Nine is `0,1,2,3,4,5,8,9,10`, the array simply has
  gaps in its numbers — no special casing anywhere.
- Persisted settings from previous versions keep meaning something for the retained levels: a
  player who saved "Level 5" still lands on Level 5.

The array _order_ (not the numbers) is what defines menu order and any future sequence, which is
why `LEVELS` is an ordered array with a derived lookup map rather than a `Record<number, …>`.

### D3 — Factory → repository, and where errors belong

`createLevelProfile` was a genuine Factory (PLAN.md §3.2 names it as one). After this change it
creates nothing, so it becomes a plain lookup and is renamed to match. Deliberately _not_ wrapped
in a `LevelRepository` class or a provider interface: there is one implementation, one data source,
and no test needs to substitute it (KISS/YAGNI — a module-level array and a function are the
simplest thing that works, and the roster is already trivially injectable because every consumer
takes a `LevelProfile` parameter, not a level number).

Errors follow the codebase's existing split: **validate at the boundary** (`settingsStore`, which
already sanitizes user-editable localStorage in `merge()`), **trust internal code** (components
call `getLevelProfile` with a store-sanitized value and need no guard), and **throw on a broken
invariant** (`getLevelProfile` with a non-roster number means a bug, not bad input). Adding a
silent Level 0 fallback inside the engine would defeat the main correctness win of the change.

### D4 — Completeness enforced by the type system, not by an RNG safety net

`Partial<LevelProfile>` + spread meant a missing field was invisible: it silently became a random
roll. With complete `LevelProfile` literals, forgetting `spawnTable` on a new level is a compile
error. Authoring nine levels by hand is exactly the situation where you want the compiler holding
the checklist. This is a free byproduct of the deletion — worth stating explicitly so it isn't
undone by someone "simplifying" the type back to `Partial`.

### D5 — `<select>` over a level-select grid

A card grid with per-level art would be nicer eventually, but it needs art that doesn't exist and a
new component, and this phase's job is to _clear space_, not spend it. The panel already uses a
`<select>` for Difficulty; matching it keeps one pattern, inherits the coarse-pointer sizing rules
from PLAN-2 §6.1 for free, and keeps the diff reviewable. If per-level presentation becomes
desirable during the detail phase, it replaces one control in one component.

### D6 — Why no progression system here

Covered in §7: adding sequential progression means inventing a completion condition, a new phase
transition, and persisted unlocks (i.e. save games, which PLAN.md declined). None of that makes the
nine levels more detailed. Free selection is the status quo and stays.

### D7 — "Infinite Nightmares" still holds

The infinity was never the level count — it is the chunk generator and the border contract, both
untouched. Only the _catalog_ shrinks, from 1000 entries (7 real) to ~9 real ones. The README
tagline needs rewording; the architecture does not.

### Resolved (confirmed by the user)

1. **Author Levels 7 and 8 now** — yes, within M14 (§2.2).
2. **Level 1 naming** — rename to "Parking Zone" (§2.2).

### Remaining open questions (non-blocking — implementer may use judgment)

1. **Progression:** confirm free level selection stays (§7 recommendation) rather than a sequential
   0 → 1 → 2 unlock flow. (Recommendation stands: not now.)
2. **Palettes for the two new levels:** `dreamcorePastel`/`weirdcoreSaturated` are currently unused
   and slated for deletion (§4.2) — the implementer may adopt one for Level 7 or 8 if it fits, or
   author new palette values, or reuse an existing one (e.g. `industrialDark`-family for a flooded
   industrial "Thalassophobia").
3. **Persisted-level reset** (a returning player on "Level 512" lands on Level 0): accepted as-is
   per §8; no friendlier notice planned.
