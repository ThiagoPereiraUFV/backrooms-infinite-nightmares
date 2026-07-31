/** Size of one grid cell in meters. */
export const CELL_SIZE = 4;

/** Cells per chunk side. */
export const CHUNK_SIZE = 16;

/** World-space size of one chunk in meters. */
export const CHUNK_WORLD_SIZE = CELL_SIZE * CHUNK_SIZE;

/**
 * Pillar footprint as a fraction of its cell. Render and collision both
 * derive from this — they must never disagree (that drift was the invisible
 * -wall bug around pillars).
 */
export const PILLAR_SCALE = 0.4;

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

/** HUD store snapshot frequency (Hz) so DOM updates never track the render loop. */
export const HUD_UPDATE_HZ = 10;

/** Distance at which a walked-over item spawn is collected. */
export const ITEM_PICKUP_RADIUS = 1.0;

/** Entities never spawn this close to the player's session spawn point. */
export const ENEMY_MIN_SPAWN_DISTANCE = 12;

/** Safety cap on concurrently simulated entities, regardless of difficulty. */
export const MAX_ACTIVE_ENTITIES = 8;

/** Distance at which a newly-approached entity triggers a one-shot growl cue. */
export const ENEMY_GROWL_RADIUS = 8;

/** Chunk ring (radius, in chunks) scanned for item/entity spawn reconciliation. */
export const SPAWN_SCAN_RADIUS_CHUNKS = 1;
