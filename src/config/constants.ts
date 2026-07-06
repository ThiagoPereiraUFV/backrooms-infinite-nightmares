/** Size of one grid cell in meters. */
export const CELL_SIZE = 4;

/** Cells per chunk side. */
export const CHUNK_SIZE = 16;

/** World-space size of one chunk in meters. */
export const CHUNK_WORLD_SIZE = CELL_SIZE * CHUNK_SIZE;

/** Chunk ring radius rendered around the player (2 => 5x5 chunks). */
export const VIEW_DISTANCE_CHUNKS = 2;

/** Generated-chunk LRU cache size (data only, not meshes). */
export const CHUNK_CACHE_SIZE = 256;

export const PLAYER_RADIUS = 0.45;
export const PLAYER_EYE_HEIGHT = 1.65;

/** Base walking speed in m/s. */
export const WALK_SPEED = 3.4;
export const SPRINT_MULTIPLIER = 1.8;

/** How fast velocity approaches the target (1/s). */
export const ACCELERATION = 12;

/** Fixed simulation timestep in seconds. */
export const FIXED_TIMESTEP = 1 / 120;

/** Clamp for frame deltas (tab switches, hitches). */
export const MAX_FRAME_DELTA = 0.1;

/** Highest selectable level. */
export const MAX_LEVEL = 999;

/** HUD store snapshot frequency (Hz) so DOM updates never track the render loop. */
export const HUD_UPDATE_HZ = 10;
