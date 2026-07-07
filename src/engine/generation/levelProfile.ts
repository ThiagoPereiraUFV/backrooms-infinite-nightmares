import { createRng, hashInts } from "./rng";

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

/** Phase 2: spawn table entry — item/entity id with spawn weight per chunk. */
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
  /** Phase 2: what can spawn in this level's chunks. Empty in MVP. */
  spawnTable: SpawnTableEntry[];
}

interface PaletteFamily {
  name: string;
  palettes: LevelPalette[];
}

// Aesthetic pillars mapped to palette families: retro/dated (yellowed office),
// brutalism (concrete), dreamcore (washed pastels), weirdcore (off-key saturation),
// decay (dark industrial), liminal (bleached monotone).
const PALETTE_FAMILIES: PaletteFamily[] = [
  {
    name: "yellowedOffice",
    palettes: [
      {
        wall: "#b8a758",
        floor: "#8a7f4e",
        ceiling: "#c9c3a0",
        accent: "#9c8c3f",
        fog: "#a99c55",
        light: "#fff6c9",
      },
      {
        wall: "#c2b268",
        floor: "#96884f",
        ceiling: "#d1cba8",
        accent: "#a89a4a",
        fog: "#b3a660",
        light: "#fff9d6",
      },
    ],
  },
  {
    name: "concreteBrutal",
    palettes: [
      {
        wall: "#8d8d88",
        floor: "#6f6f6a",
        ceiling: "#7c7c78",
        accent: "#5d5d58",
        fog: "#77776f",
        light: "#e8e8dc",
      },
      {
        wall: "#9a948c",
        floor: "#726d64",
        ceiling: "#84807a",
        accent: "#4d4a44",
        fog: "#6e6a60",
        light: "#f2ede0",
      },
    ],
  },
  {
    name: "industrialDark",
    palettes: [
      {
        wall: "#4a4d44",
        floor: "#33352f",
        ceiling: "#3d3f38",
        accent: "#5f6353",
        fog: "#2c2e28",
        light: "#cfd6b8",
      },
      {
        wall: "#474038",
        floor: "#2f2b26",
        ceiling: "#3a352e",
        accent: "#635a4c",
        fog: "#262220",
        light: "#e0cfa8",
      },
    ],
  },
  {
    name: "dreamcorePastel",
    palettes: [
      {
        wall: "#b9c8d6",
        floor: "#9aa8b5",
        ceiling: "#cdd8e2",
        accent: "#d6b9c8",
        fog: "#aebccb",
        light: "#f0f6ff",
      },
      {
        wall: "#cfc3d9",
        floor: "#a89cb3",
        ceiling: "#ded4e6",
        accent: "#b3d9c3",
        fog: "#bfb3cc",
        light: "#faf2ff",
      },
    ],
  },
  {
    name: "weirdcoreSaturated",
    palettes: [
      {
        wall: "#7a9e6b",
        floor: "#5d7a51",
        ceiling: "#94b585",
        accent: "#b56b94",
        fog: "#6d8f5f",
        light: "#eaffde",
      },
      {
        wall: "#9e6b7a",
        floor: "#7a515d",
        ceiling: "#b58594",
        accent: "#6b949e",
        fog: "#8f5f6d",
        light: "#ffdeea",
      },
    ],
  },
  {
    name: "bleachedLiminal",
    palettes: [
      {
        wall: "#d6d2c4",
        floor: "#b5b1a4",
        ceiling: "#e2ded1",
        accent: "#c4bfae",
        fog: "#ccc8ba",
        light: "#fffdf2",
      },
    ],
  },
];

// Furniture leanings per palette family — office families read as offices,
// industrial families as storage, dreamcore as displaced bedrooms.
const FAMILY_FURNITURE: Record<string, Record<string, number>> = {
  yellowedOffice: {
    chair: 3,
    table: 2,
    cabinet: 2,
    bookshelf: 1,
    drawer: 1,
    couch: 0.5,
    crate: 0.5,
  },
  concreteBrutal: { crate: 3, cabinet: 1, chair: 1, table: 0.5 },
  industrialDark: { crate: 3, cabinet: 2, chair: 0.5, bookshelf: 0.5 },
  dreamcorePastel: { couch: 2, bed: 2, chair: 1, table: 1, drawer: 1 },
  weirdcoreSaturated: { chair: 2, couch: 1, table: 1, bookshelf: 1, crate: 1, bed: 0.5 },
  bleachedLiminal: { chair: 1, table: 0.5, couch: 0.5 },
};

const NAME_ADJECTIVES = [
  "Endless",
  "Hollow",
  "Silent",
  "Buzzing",
  "Forgotten",
  "Sunken",
  "Bleached",
  "Crooked",
  "Vacant",
  "Humming",
  "Stale",
  "Flooded",
  "Fractured",
  "Sleepless",
  "Wandering",
  "Faded",
];

const NAME_NOUNS = [
  "Offices",
  "Halls",
  "Corridors",
  "Complex",
  "Wing",
  "Sublevel",
  "Annex",
  "Storerooms",
  "Concourse",
  "Passages",
  "Chambers",
  "Terminals",
  "Galleries",
  "Warrens",
  "Foyers",
  "Basements",
];

/** Hand-tuned canonical levels where Backrooms lore expects specific looks. */
const CANONICAL_LEVELS: Record<number, Partial<LevelProfile>> = {
  0: {
    name: "The Lobby",
    palette: PALETTE_FAMILIES[0].palettes[0],
    styleWeights: { pillarField: 3, maze: 4, rooms: 2, halls: 1 },
    wallDensity: 0.32,
    ceilingHeight: 3,
    fogDensity: 0.055,
    lightIntensity: 0.85,
    flickerAmount: 0.25,
    decay: 0.25,
    lightSpacing: 3,
    ambience: "fluorescentHum",
    furnitureDensity: 0.02,
    furnitureWeights: { chair: 2, table: 0.5, crate: 0.3 },
  },
  1: {
    name: "Habitable Zone",
    palette: PALETTE_FAMILIES[1].palettes[0],
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
  },
  2: {
    name: "Pipe Dreams",
    palette: PALETTE_FAMILIES[2].palettes[0],
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
  },
  3: {
    name: "Electrical Station",
    palette: PALETTE_FAMILIES[2].palettes[1],
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
  },
  4: {
    name: "Abandoned Office",
    palette: PALETTE_FAMILIES[5].palettes[0],
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
  },
  5: {
    name: "The Terror Hotel",
    palette: PALETTE_FAMILIES[2].palettes[1],
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
  },
  6: {
    name: "Lights Out",
    palette: {
      wall: "#1c1c20",
      floor: "#121214",
      ceiling: "#17171a",
      accent: "#26262c",
      fog: "#0a0a0c",
      light: "#3a3a44",
    },
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
  },
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Derives the full characteristic set for a level from its number alone.
 * Canonical levels override the derived traits; every level in 0..999 is valid.
 */
export function createLevelProfile(level: number): LevelProfile {
  const rng = createRng(hashInts(0x1ee7, level));

  const family = rng.pick(PALETTE_FAMILIES);
  const palette = rng.pick(family.palettes);

  const derived: LevelProfile = {
    level,
    name: `The ${rng.pick(NAME_ADJECTIVES)} ${rng.pick(NAME_NOUNS)}`,
    palette,
    styleWeights: {
      pillarField: rng.range(0, 4),
      maze: rng.range(0, 4),
      rooms: rng.range(0, 4),
      halls: rng.range(0, 4),
    },
    wallDensity: clamp01(rng.range(0.15, 0.6)),
    ceilingHeight: rng.range(2.5, 6.5),
    fogDensity: rng.range(0.035, 0.12),
    lightIntensity: clamp01(rng.range(0.15, 0.9)),
    flickerAmount: clamp01(rng.range(0, 0.8)),
    decay: clamp01(rng.range(0, 1)),
    lightSpacing: rng.int(3, 7),
    ambience: rng.pick<AmbienceId>(["fluorescentHum", "deepDrone", "windHollow", "nearSilence"]),
    // Furniture rolls come last so adding them never reshuffled older traits.
    furnitureDensity: rng.range(0.015, 0.08),
    furnitureWeights: FAMILY_FURNITURE[family.name],
    spawnTable: [],
  };

  const canonical = CANONICAL_LEVELS[level];
  return canonical ? { ...derived, ...canonical, level, spawnTable: [] } : derived;
}
