import { assetUrl } from "@/config/assets";
import type { AmbienceId, FootstepSurface } from "../generation/levelProfile";
import type { EntityCueId } from "./AudioEngine";

/**
 * Asset id -> path data, no I/O (paths only; `SampledAudioEngine` does the
 * fetching). Deliberately **partial**: any cue with no entry here delegates
 * to the procedural fallback, so the game always has a full soundscape even
 * where an asset hasn't landed (PLAN-4 §10.1). Every path is produced by
 * `assetUrl()` so it resolves under the GitHub Pages base path.
 *
 * All committed files are CC0/public-domain, sourced from OpenGameArt.org —
 * see `public/audio/CREDITS.md` for source/author/license per file. Two
 * ambience ids (`officeSilence`, `blackSilence`) and two buckets (`carpet`
 * footsteps, `pickup` UI) are deliberately left unmapped for now; they read
 * fine on the procedural fallback and CREDITS.md explains why.
 */
export interface AudioManifest {
  ambience: Partial<Record<AmbienceId, string>>;
  /** Multiple variants per surface are picked at random; any subset may be present. */
  footsteps: Partial<Record<FootstepSurface, readonly string[]>>;
  entityCues: Partial<Record<EntityCueId, string>>;
  ui: Partial<Record<"click" | "pickup", string>>;
}

export const MANIFEST: AudioManifest = {
  ambience: {
    lobbyHum: assetUrl("/audio/ambience/lobbyHum.ogg"),
    stationBuzz: assetUrl("/audio/ambience/stationBuzz.ogg"),
    parkingDrone: assetUrl("/audio/ambience/parkingDrone.ogg"),
    pipeSteam: assetUrl("/audio/ambience/pipeSteam.ogg"),
    floodedDeep: assetUrl("/audio/ambience/floodedDeep.ogg"),
    hotelWind: assetUrl("/audio/ambience/hotelWind.ogg"),
    caveDrip: assetUrl("/audio/ambience/caveDrip.ogg"),
  },
  footsteps: {
    hard: [assetUrl("/audio/sfx/footsteps/hard-1.ogg")],
    wet: [assetUrl("/audio/sfx/footsteps/wet-1.ogg")],
    gravel: [assetUrl("/audio/sfx/footsteps/gravel-1.ogg")],
  },
  entityCues: {
    growl: assetUrl("/audio/sfx/entities/growl.ogg"),
    shriek: assetUrl("/audio/sfx/entities/shriek.ogg"),
    chitter: assetUrl("/audio/sfx/entities/chitter.ogg"),
    laugh: assetUrl("/audio/sfx/entities/laugh.ogg"),
  },
  ui: {
    click: assetUrl("/audio/sfx/ui/click.ogg"),
  },
};
