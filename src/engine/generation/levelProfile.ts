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
 */

/** How a level's chunks are predominantly laid out. */
export type GeometryStyle = "pillarField" | "maze" | "rooms" | "halls";

/** Procedural ambience track selector (see engine/audio). */
export type AmbienceId = "fluorescentHum" | "deepDrone" | "windHollow" | "nearSilence";

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
    flickerAmount: 0.25,
    decay: 0.25,
    lightSpacing: 3,
    ambience: "fluorescentHum",
    furnitureDensity: 0.02,
    furnitureWeights: { chair: 2, table: 0.5, crate: 0.3 },
    itemSpawnDensity: 0.012,
    spawnTable: [
      { id: "bandage", weight: 1.5 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.3 },
      { id: "wanderer", weight: 0.3 },
    ],
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
    ambience: "deepDrone",
    furnitureDensity: 0.015,
    furnitureWeights: { crate: 3, cabinet: 0.5 },
    itemSpawnDensity: 0.01,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.2 },
      { id: "wanderer", weight: 0.4 },
    ],
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
    ambience: "deepDrone",
    furnitureDensity: 0.02,
    furnitureWeights: { crate: 3, cabinet: 1 },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.5 },
      { id: "adrenaline", weight: 0.8 },
      { id: "flashlight", weight: 0.5 },
      { id: "wanderer", weight: 0.8 },
    ],
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
    ambience: "fluorescentHum",
    furnitureDensity: 0.03,
    furnitureWeights: { cabinet: 3, crate: 2, chair: 0.5, table: 0.5 },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.2 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.6 },
      { id: "wanderer", weight: 0.9 },
    ],
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
    flickerAmount: 0.15,
    decay: 0.35,
    lightSpacing: 3,
    ambience: "nearSilence",
    furnitureDensity: 0.1,
    furnitureWeights: { chair: 4, table: 3, cabinet: 2, bookshelf: 1.5, drawer: 1, couch: 0.5 },
    itemSpawnDensity: 0.016,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 0.8 },
      { id: "flashlight", weight: 0.3 },
      { id: "wanderer", weight: 0.5 },
    ],
  },
  {
    level: 5,
    name: "The Terror Hotel",
    palette: INDUSTRIAL_DARK_RUST,
    styleWeights: { pillarField: 0, maze: 2, rooms: 4, halls: 6 },
    wallDensity: 0.6,
    ceilingHeight: 3.1,
    fogDensity: 0.075,
    lightIntensity: 0.4,
    flickerAmount: 0.5,
    decay: 0.55,
    lightSpacing: 4,
    ambience: "windHollow",
    furnitureDensity: 0.07,
    furnitureWeights: { bed: 3, drawer: 2, chair: 1, table: 1, couch: 1, bookshelf: 0.5 },
    itemSpawnDensity: 0.014,
    spawnTable: [
      { id: "bandage", weight: 1.3 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.4 },
      { id: "wanderer", weight: 1 },
    ],
  },
  {
    level: 6,
    name: "Lights Out",
    palette: LIGHTS_OUT_BLACK,
    styleWeights: { pillarField: 1, maze: 4, rooms: 2, halls: 3 },
    wallDensity: 0.5,
    ceilingHeight: 2.8,
    fogDensity: 0.16,
    lightIntensity: 0.06,
    flickerAmount: 0.9,
    decay: 0.5,
    lightSpacing: 8,
    ambience: "nearSilence",
    furnitureDensity: 0.01,
    furnitureWeights: { chair: 1, crate: 1 },
    itemSpawnDensity: 0.02,
    spawnTable: [
      { id: "bandage", weight: 1 },
      { id: "adrenaline", weight: 1.2 },
      { id: "flashlight", weight: 1.2 },
      { id: "wanderer", weight: 1.8 },
    ],
  },
  {
    // Aquatic/flooded theme per the wiki: endless net of flooded industrial
    // corridors, water rising and falling, a deep waterborne hum.
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
    ambience: "deepDrone",
    furnitureDensity: 0.02,
    furnitureWeights: { crate: 2, cabinet: 1 },
    itemSpawnDensity: 0.012,
    spawnTable: [
      { id: "bandage", weight: 1.2 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.5 },
      { id: "wanderer", weight: 0.7 },
    ],
  },
  {
    // Cave theme per the wiki: natural rock, tight and winding, sparse light
    // sources, echoing near-silence rather than machine hum.
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
    ambience: "nearSilence",
    furnitureDensity: 0.005,
    furnitureWeights: { crate: 1, cabinet: 0.3 },
    itemSpawnDensity: 0.015,
    spawnTable: [
      { id: "bandage", weight: 1.3 },
      { id: "adrenaline", weight: 1 },
      { id: "flashlight", weight: 0.6 },
      { id: "wanderer", weight: 0.6 },
    ],
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
