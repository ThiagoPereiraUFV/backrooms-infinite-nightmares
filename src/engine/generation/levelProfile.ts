/**
 * The Main Nine — the only playable levels, verified against the Backrooms
 * wiki (backrooms.fandom.com/wiki/Category:The_Main_Nine). Order defines menu
 * order. Every profile is authored in full: there is no derivation, so a
 * missing field is a compile error rather than a silent RNG roll.
 *
 * | Level | Name               |
 * | ----- | ------------------ |
 * | 0     | The Lobby          |
 * | 1     | Parking Zone       |
 * | 2     | Pipe Dreams        |
 * | 3     | Electrical Station |
 * | 4     | Abandoned Office   |
 * | 5     | The Terror Hotel   |
 * | 6     | Lights Out         |
 * | 7     | Thalassophobia     |
 * | 8     | Cave System        |
 *
 * ## PLAN-4 R1 source-of-truth (wiki domain + per-level pages, retrieved 2026-07-31)
 *
 * Wiki domain (D0, PLAN-4 §2): `backrooms.fandom.com` — the roster above, unchanged.
 * Every value below that differs from the pre-PLAN-4 shipped numbers was corrected
 * against the live page for that level number, fetched on the date above:
 *
 * - Level 0 <https://backrooms.fandom.com/wiki/Level_0> — mono-yellow wallpaper,
 *   "worn, moist carpeting", constant fluorescent hum/buzz; Threat Index states
 *   "Devoid of Entities" (confirmed) — `spawnTable` carries no entity entry.
 * - Level 1 <https://backrooms.fandom.com/wiki/Level_1> — concrete parking garage,
 *   concrete pillars, hanging fluorescent lights, blackouts; "Minimal Entity Count"
 *   (Facelings, Clumps, Hounds, Dullers, Deathmoths recorded).
 * - Level 2 <https://backrooms.fandom.com/wiki/Level_2> — utility tunnels, rusting
 *   pipes, humid; page states explicitly **"There are no doors that can be
 *   found"** — `featureRates.doorway` is 0, not the provisional 0.06. Entities:
 *   Clumps, Hounds, Smilers, Skin-Stealers ("Low Entity Count").
 * - Level 3 <https://backrooms.fandom.com/wiki/Level_3> — maintenance halls with
 *   transformers, conductor circuits, industrial fans; page states its
 *   architecture "remains largely consistent, with wires, **fluorescent
 *   lights**, and various machines" — i.e. the lights *work*, so `lighting` is
 *   `fluorescentPanels`, correcting the plan's provisional `emergencyOnly`.
 *   Entities: Deathmoths (docile) reported at corridor ends.
 * - Level 4 <https://backrooms.fandom.com/wiki/Level_4> — barren office/cubicles,
 *   vending machines, furniture-shaped indents in the carpet (mostly empty);
 *   "many of the fluorescent lights ... do not function". Threat Index states
 *   **"Devoid of Entities"** (confirmed) — corrects the plan's provisional
 *   Faceling/stalker assignment; `spawnTable` carries no entity entry, matching
 *   Level 0.
 * - Level 5 <https://backrooms.fandom.com/wiki/Level_5> — infinite hotel, doors
 *   leading to nowhere is the level's defining physical trait (`doorway` stays
 *   high). Entities are explicitly unconfirmed rumors (Hounds, Skin-Stealers,
 *   Wretches, Deathmoths, Predatory Windows) described as "incredibly skittish,
 *   constantly hiding, and seemingly passive unless provoked" — matches the
 *   `createStalker` behavior (freezes when observed) better than a chaser.
 * - Level 6 <https://backrooms.fandom.com/wiki/Level_6> — **the wiki's Level 6
 *   is an outdoor tundra/wilderness** (rock formations, pitfalls, valleys), not
 *   an interior maze, and states portable light sources including flashlights
 *   are extinguished on entry. Both are irreconcilable with this engine's
 *   interior grid generator and fixed-inventory flashlight (an outdoor/skybox
 *   mode is out of scope per PLAN-4 §3 non-goals, matching the Level 7
 *   "Suburbs" case) — the shipped interior "pitch-black maze" interpretation is
 *   kept deliberately, and the flashlight is kept functional for navigability.
 *   The page's own Threat Index marks entity presence "Indeterminable" while
 *   its body text claims the level is uninhabited (self-contradictory) — kept
 *   the shipped heaviest-wanderer-weight design rather than break the existing
 *   "Lights Out is the scariest level lore-wise" test invariant over an
 *   ambiguous source, per PLAN-4 §2.1's "wiki is silent or self-contradictory"
 *   fallback rule.
 * - Level 7 <https://backrooms.fandom.com/wiki/Level_7> — confirmed aquatic: a
 *   rusted metal bunker afloat on an endless foggy ocean, knee-deep water,
 *   decrepit furniture (bunkbeds, folding chairs, bookshelves); a single named
 *   entity ("The Thing on Level 7") — matches a slow chaser at low weight
 *   ("Singular Entity Presence").
 * - Level 8 <https://backrooms.fandom.com/wiki/Level_8> — subterranean rock
 *   system, stagnant water pools (drowning hazard — recorded, not built per
 *   PLAN-4 §3 non-goals), wooden bridges/dens from past habitation. No fixture
 *   type is mentioned, so `lighting` stays `none`. Entities: Mortisdoptera
 *   (moth-like swarm predator, "Some Hostile Presence").
 *
 * Hazards recorded by the wiki (Level 1 rebar/tetanus, Level 2 pathogens/
 * earthquakes, Level 3 heat/live current, Level 7 hypothermia, Level 8
 * drowning) are all non-goals this phase (PLAN-4 §3) — never rendered as
 * damage, only implied by set dressing/audio.
 */

/** How a level's chunks are predominantly laid out. */
export type GeometryStyle = "pillarField" | "maze" | "rooms" | "halls";

/**
 * Procedural ambience track selector (see engine/audio). Nine ids — one per
 * level — so each can key its own downloaded audio asset (PLAN-4 §10); the
 * synthesis fallback still maps all nine onto four shared recipes.
 */
export type AmbienceId =
  | "lobbyHum"
  | "parkingDrone"
  | "pipeSteam"
  | "stationBuzz"
  | "officeSilence"
  | "hotelWind"
  | "blackSilence"
  | "floodedDeep"
  | "caveDrip";

/** Which procedural painter set dresses this level's wall/floor/ceiling. */
export type SurfaceStyle =
  | "dampWallpaper" // L0 — mono-yellow paper, moist carpet, drop tiles
  | "rawConcrete" // L1 — poured slab, form-tie marks, no ceiling tiles
  | "rivetedSteel" // L2 — painted steel plate, plate floor, pipe-crowded ceiling
  | "rustedUtility" // L3 — block wall, sealed concrete, cable tray ceiling
  | "officeDrywall" // L4 — bleached drywall, low-pile carpet, drop tiles
  | "hotelPaper" // L5 — patterned paper + wainscot, figured carpet
  | "voidBlack" // L6 — near-black everything, no legible detail
  | "wetTile" // L7 — glazed tile with grout, standing-water sheen
  | "bareRock"; // L8 — mottled stone, no tiles, no skirting

/** What kind of fixture this level's ceiling lights are, and how they behave. */
export type LightingMode =
  | "fluorescentPanels" // recessed troffers: stutter flicker, audible buzz
  | "cagedIndustrial" // sparse caged bulbs / strip lights: slow brownout sag
  | "emergencyOnly" // few amber/red fixtures: steady slow pulse
  | "none"; // no fixtures generated at all — player lamp/flashlight only

/** Surface the player's feet land on — drives footstep timbre. */
export type FootstepSurface = "carpet" | "hard" | "wet" | "gravel";

/**
 * How often each cosmetic structural feature appears, as a 0..1 chance per
 * eligible cell. All three are consumed by one pass (placeFeatures), so they
 * live together.
 */
export interface LevelFeatureRates {
  /** Door frame on a detected threshold cell (open cell pinched by walls). */
  doorway: number;
  /** Broken-drywall / crumbled hole on a wall cell that faces open space. */
  wallBreach: number;
  /** Missing ceiling tile / opening above an open cell. */
  ceilingOpening: number;
  /** Pipe or duct run along the ceiling of an open cell. */
  ceilingRun: number;
}

export interface LevelPalette {
  wall: string;
  floor: string;
  ceiling: string;
  accent: string;
  fog: string;
  light: string;
}

/** Spawn table entry — item/entity registry id with a relative spawn weight. */
export interface SpawnTableEntry {
  id: string;
  weight: number;
}

export interface LevelProfile {
  level: number;
  name: string;
  palette: LevelPalette;
  styleWeights: Record<GeometryStyle, number>;
  /** 0..1 — how much of the interior is wall mass. */
  wallDensity: number;
  /** Ceiling height in meters. */
  ceilingHeight: number;
  /** Exponential fog density. */
  fogDensity: number;
  /** 0..1 — overall light level. */
  lightIntensity: number;
  /** 0..1 — how strongly the lights flicker. */
  flickerAmount: number;
  /** 0..1 — pristine liminal -> stains, damage, decay. */
  decay: number;
  /** Cells between ceiling light fixtures. */
  lightSpacing: number;
  ambience: AmbienceId;
  /** 0..1 — expected furniture groups per open interior cell. */
  furnitureDensity: number;
  /** Furniture piece weights for this level (keys = furniture def ids). */
  furnitureWeights: Record<string, number>;
  /** 0..1 — expected item/entity spawn points per open interior cell. */
  itemSpawnDensity: number;
  /** What can spawn in this level's chunks (item ids and entity ids alike). */
  spawnTable: SpawnTableEntry[];
  /** Which procedural painter set dresses this level's surfaces. */
  surfaceStyle: SurfaceStyle;
  /** Ceiling fixture kind and flicker behavior. */
  lighting: LightingMode;
  /** Drives footstep audio timbre. */
  footstepSurface: FootstepSurface;
  /** Structural-feature (doorway/breach/opening/pipe run) appearance rates. */
  featureRates: LevelFeatureRates;
}

// Named palettes, one per aesthetic actually used by a roster entry below —
// referencing `PALETTE_FAMILIES[2].palettes[1]` was unreadable, so each
// retained/new level's look now has a name that says what it is.

const YELLOWED_OFFICE: LevelPalette = {
  wall: "#b8a758",
  floor: "#8a7f4e",
  ceiling: "#c9c3a0",
  accent: "#9c8c3f",
  fog: "#a99c55",
  light: "#fff6c9",
};

const CONCRETE_BRUTAL: LevelPalette = {
  wall: "#8d8d88",
  floor: "#6f6f6a",
  ceiling: "#7c7c78",
  accent: "#5d5d58",
  fog: "#77776f",
  light: "#e8e8dc",
};

const INDUSTRIAL_DARK_MOSS: LevelPalette = {
  wall: "#4a4d44",
  floor: "#33352f",
  ceiling: "#3d3f38",
  accent: "#5f6353",
  fog: "#2c2e28",
  light: "#cfd6b8",
};

const INDUSTRIAL_DARK_RUST: LevelPalette = {
  wall: "#474038",
  floor: "#2f2b26",
  ceiling: "#3a352e",
  accent: "#635a4c",
  fog: "#262220",
  light: "#e0cfa8",
};

const BLEACHED_LIMINAL: LevelPalette = {
  wall: "#d6d2c4",
  floor: "#b5b1a4",
  ceiling: "#e2ded1",
  accent: "#c4bfae",
  fog: "#ccc8ba",
  light: "#fffdf2",
};

// Hotel maroon — Level 5 "The Terror Hotel": deep burgundy/brass 1920s hotel
// interior, its own palette rather than sharing Level 3's industrial rust.
const HOTEL_MAROON: LevelPalette = {
  wall: "#5a2a2f",
  floor: "#3b2024",
  ceiling: "#4a2a2e",
  accent: "#8a5a3f",
  fog: "#2a1518",
  light: "#ffdca8",
};

const LIGHTS_OUT_BLACK: LevelPalette = {
  wall: "#1c1c20",
  floor: "#121214",
  ceiling: "#17171a",
  accent: "#26262c",
  fog: "#0a0a0c",
  light: "#3a3a44",
};

// Flooded industrial teal — Level 7 "Thalassophobia": waterlogged concrete
// under a dim, water-reflected glow.
const FLOODED_DEPTHS: LevelPalette = {
  wall: "#2e4a4a",
  floor: "#1c3333",
  ceiling: "#33504d",
  accent: "#3f6b63",
  fog: "#1a2e2c",
  light: "#a8d8cc",
};

// Damp rock — Level 8 "Cave System": natural stone, warm faint glow instead
// of fluorescents.
const CAVE_STONE: LevelPalette = {
  wall: "#5c5347",
  floor: "#3f382e",
  ceiling: "#4a4238",
  accent: "#6b5f4e",
  fog: "#2b2620",
  light: "#c9b896",
};

/**
 * The Main Nine, in full. Every field is authored — there is no fallback
 * derivation, so TypeScript rejects a level literal that forgets a field.
 */
export const LEVELS: readonly LevelProfile[] = [
  {
    level: 0,
    name: "The Lobby",
    palette: YELLOWED_OFFICE,
    styleWeights: { pillarField: 3, maze: 4, rooms: 2, halls: 1 },
    wallDensity: 1,
    ceilingHeight: 3,
    fogDensity: 0.055,
    lightIntensity: 0.85,
    flickerAmount: 0.35,
    decay: 0.25,
    lightSpacing: 3,
    ambience: "lobbyHum",
    furnitureDensity: 0.02,
    furnitureWeights: { chair: 2, table: 0.5, crate: 0.3, vendingMachine: 0.05 },
    itemSpawnDensity: 0.012,
    spawnTable: [
      { id: "bandage", weight: 1.5 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.3 },
    ],
    surfaceStyle: "dampWallpaper",
    lighting: "fluorescentPanels",
    footstepSurface: "carpet",
    featureRates: { doorway: 0.05, wallBreach: 0.04, ceilingOpening: 0.08, ceilingRun: 0 },
  },
  {
    level: 1,
    name: "Parking Zone",
    palette: CONCRETE_BRUTAL,
    styleWeights: { pillarField: 5, maze: 1, rooms: 1, halls: 2 },
    wallDensity: 0.18,
    ceilingHeight: 4.5,
    fogDensity: 0.045,
    lightIntensity: 0.6,
    flickerAmount: 0.45,
    decay: 0.4,
    lightSpacing: 4,
    ambience: "parkingDrone",
    furnitureDensity: 0.015,
    furnitureWeights: { crate: 3, cabinet: 0.5, barrel: 2, pipeStack: 1 },
    itemSpawnDensity: 0.01,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.2 },
      { id: "hound", weight: 1 },
    ],
    surfaceStyle: "rawConcrete",
    lighting: "cagedIndustrial",
    footstepSurface: "hard",
    featureRates: { doorway: 0.05, wallBreach: 0.1, ceilingOpening: 0.03, ceilingRun: 0.12 },
  },
  {
    level: 2,
    name: "Pipe Dreams",
    palette: INDUSTRIAL_DARK_MOSS,
    styleWeights: { pillarField: 0, maze: 3, rooms: 1, halls: 6 },
    wallDensity: 0.55,
    ceilingHeight: 2.6,
    fogDensity: 0.09,
    lightIntensity: 0.35,
    flickerAmount: 0.6,
    decay: 0.7,
    lightSpacing: 5,
    ambience: "pipeSteam",
    furnitureDensity: 0.02,
    furnitureWeights: { crate: 1, cabinet: 1, pipeStack: 3, barrel: 2, valveWheel: 1 },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.5 },
      { id: "adrenaline", weight: 0.8 },
      { id: "flashlight", weight: 0.5 },
      { id: "hound", weight: 0.8 },
    ],
    surfaceStyle: "rivetedSteel",
    lighting: "cagedIndustrial",
    footstepSurface: "hard",
    // The wiki states plainly "there are no doors that can be found" here.
    featureRates: { doorway: 0, wallBreach: 0.08, ceilingOpening: 0.02, ceilingRun: 0.55 },
  },
  {
    level: 3,
    name: "Electrical Station",
    palette: INDUSTRIAL_DARK_RUST,
    styleWeights: { pillarField: 2, maze: 3, rooms: 3, halls: 2 },
    wallDensity: 0.45,
    ceilingHeight: 3.4,
    fogDensity: 0.07,
    lightIntensity: 0.45,
    flickerAmount: 0.7,
    decay: 0.65,
    lightSpacing: 4,
    ambience: "stationBuzz",
    furnitureDensity: 0.03,
    furnitureWeights: {
      cabinet: 2,
      crate: 1,
      chair: 0.3,
      table: 0.3,
      transformer: 2,
      electricalPanel: 2,
    },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.2 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.6 },
      { id: "deathmoth", weight: 0.5 },
    ],
    surfaceStyle: "rustedUtility",
    // The page's prose: "fluorescent lights" are part of the level's
    // consistent architecture — they work, correcting the plan's provisional
    // emergencyOnly guess.
    lighting: "fluorescentPanels",
    footstepSurface: "hard",
    featureRates: { doorway: 0.1, wallBreach: 0.06, ceilingOpening: 0.04, ceilingRun: 0.35 },
  },
  {
    level: 4,
    name: "Abandoned Office",
    palette: BLEACHED_LIMINAL,
    styleWeights: { pillarField: 1, maze: 2, rooms: 6, halls: 2 },
    wallDensity: 0.4,
    ceilingHeight: 2.9,
    fogDensity: 0.05,
    lightIntensity: 0.75,
    // Many of the level's fluorescent lights "do not function" per the wiki —
    // a higher flicker/dropout rate than the plan's original "lights work
    // perfectly" assumption.
    flickerAmount: 0.35,
    decay: 0.35,
    lightSpacing: 3,
    ambience: "officeSilence",
    furnitureDensity: 0.1,
    furnitureWeights: {
      chair: 4,
      table: 3,
      cabinet: 2,
      bookshelf: 1.5,
      drawer: 1,
      couch: 0.5,
      vendingMachine: 0.4,
      waterCooler: 0.3,
    },
    itemSpawnDensity: 0.016,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 0.8 },
      { id: "flashlight", weight: 0.3 },
    ],
    surfaceStyle: "officeDrywall",
    lighting: "fluorescentPanels",
    footstepSurface: "carpet",
    featureRates: { doorway: 0.4, wallBreach: 0.03, ceilingOpening: 0.15, ceilingRun: 0 },
  },
  {
    level: 5,
    name: "The Terror Hotel",
    palette: HOTEL_MAROON,
    styleWeights: { pillarField: 0, maze: 2, rooms: 4, halls: 6 },
    wallDensity: 0.6,
    ceilingHeight: 3.1,
    fogDensity: 0.075,
    lightIntensity: 0.4,
    flickerAmount: 0.5,
    decay: 0.55,
    lightSpacing: 4,
    ambience: "hotelWind",
    furnitureDensity: 0.07,
    furnitureWeights: {
      bed: 3,
      drawer: 2,
      chair: 1,
      table: 1,
      couch: 1,
      bookshelf: 0.5,
      luggageCart: 0.8,
    },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.3 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.4 },
      { id: "skinStealer", weight: 0.6 },
    ],
    surfaceStyle: "hotelPaper",
    lighting: "fluorescentPanels",
    footstepSurface: "carpet",
    // The payoff feature of M19: a hotel is physically a corridor lined with
    // doors, and the wiki calls out "doors leading to nowhere" as a defining
    // trait.
    featureRates: { doorway: 0.65, wallBreach: 0.02, ceilingOpening: 0.03, ceilingRun: 0 },
  },
  {
    level: 6,
    name: "Lights Out",
    palette: LIGHTS_OUT_BLACK,
    styleWeights: { pillarField: 1, maze: 4, rooms: 2, halls: 3 },
    wallDensity: 0.5,
    ceilingHeight: 2.8,
    fogDensity: 0.16,
    lightIntensity: 0.03,
    // Nothing to flicker: no fixtures are generated at all.
    flickerAmount: 0,
    decay: 0.5,
    lightSpacing: 8,
    ambience: "blackSilence",
    furnitureDensity: 0.01,
    furnitureWeights: { chair: 1, crate: 1, rubblePile: 0.5 },
    itemSpawnDensity: 0.02,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 1.2 },
      { id: "flashlight", weight: 1.2 },
      { id: "wanderer", weight: 1.5 },
      { id: "smiler", weight: 1 },
      { id: "hound", weight: 1 },
    ],
    surfaceStyle: "voidBlack",
    // Fixture generation skipped entirely — chunk.lights is empty, which is
    // what finally makes this level actually dark rather than glowing
    // MeshBasicMaterial panels at full brightness regardless of scene light.
    lighting: "none",
    footstepSurface: "hard",
    // Detail you cannot see is wasted draw calls.
    featureRates: { doorway: 0.02, wallBreach: 0.03, ceilingOpening: 0, ceilingRun: 0 },
  },
  {
    // Aquatic/flooded theme, confirmed live against the wiki: a rusted metal
    // bunker afloat on an endless foggy ocean, knee-deep water inside.
    level: 7,
    name: "Thalassophobia",
    palette: FLOODED_DEPTHS,
    styleWeights: { pillarField: 2, maze: 2, rooms: 1, halls: 5 },
    wallDensity: 0.35,
    ceilingHeight: 4,
    fogDensity: 0.1,
    lightIntensity: 0.3,
    flickerAmount: 0.3,
    decay: 0.6,
    lightSpacing: 5,
    ambience: "floodedDeep",
    furnitureDensity: 0.02,
    furnitureWeights: { crate: 2, cabinet: 1, pipeStack: 1 },
    itemSpawnDensity: 0.012,
    spawnTable: [
      { id: "bandage", weight: 1.2 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.5 },
      // "Singular Entity Presence" per the wiki — a low weight, not a swarm.
      { id: "aquaticThing", weight: 0.5 },
    ],
    surfaceStyle: "wetTile",
    lighting: "emergencyOnly",
    footstepSurface: "wet",
    featureRates: { doorway: 0.1, wallBreach: 0.05, ceilingOpening: 0.02, ceilingRun: 0.25 },
  },
  {
    // Cave theme, confirmed live against the wiki: a subterranean rock system
    // with stagnant water pools and signs of past wanderer habitation
    // (wooden bridges, small dens).
    level: 8,
    name: "Cave System",
    palette: CAVE_STONE,
    styleWeights: { pillarField: 1, maze: 6, rooms: 1, halls: 2 },
    wallDensity: 0.65,
    ceilingHeight: 3.2,
    fogDensity: 0.08,
    lightIntensity: 0.25,
    flickerAmount: 0.1,
    decay: 0.3,
    lightSpacing: 6,
    ambience: "caveDrip",
    furnitureDensity: 0.005,
    furnitureWeights: { crate: 1, rubblePile: 2, stalagmite: 1.5 },
    itemSpawnDensity: 0.015,
    spawnTable: [
      { id: "bandage", weight: 1.3 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.6 },
      { id: "hound", weight: 0.5 },
      { id: "caveDweller", weight: 0.4 },
    ],
    surfaceStyle: "bareRock",
    // No fixture type is mentioned by the wiki; kept unlit like Level 6.
    lighting: "none",
    footstepSurface: "gravel",
    // A cave with door frames would read as instantly wrong.
    featureRates: { doorway: 0, wallBreach: 0.18, ceilingOpening: 0.06, ceilingRun: 0 },
  },
];

const LEVELS_BY_NUMBER: ReadonlyMap<number, LevelProfile> = new Map(
  LEVELS.map((profile) => [profile.level, profile]),
);

/**
 * Looks up an authored level by its lore number. Throws on a number outside
 * the roster — a bug (unvalidated caller), not bad input; validation belongs
 * at the boundary (`settingsStore`), not here.
 */
export function getLevelProfile(level: number): LevelProfile {
  const profile = LEVELS_BY_NUMBER.get(level);
  if (!profile) {
    throw new Error(`getLevelProfile: ${level} is not one of the Main Nine`);
  }
  return profile;
}
