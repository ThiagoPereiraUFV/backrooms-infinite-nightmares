# Audio credits

Every file under `public/audio/` is **CC0 / public domain**, sourced from
[OpenGameArt.org](https://opengameart.org/), filtered to their CC0 license
facet. CC-BY / CC-BY-SA / NonCommercial assets were rejected outright (see
PLAN-4 §10.4 — this app has no credits UI, so attribution-required licenses
would be a silent violation). All files were re-encoded to mono 32 kHz Ogg
Vorbis (`ffmpeg -ac 1 -ar 32000 -c:a libvorbis -q:a 1`); ambience loops were
trimmed to 20–45 s. No source `.wav`/`.flac`/`.zip` files are committed.

Retrieved: **2026-08-01**.

## Ambience (`public/audio/ambience/`)

| File               | Source                                                                                                                                     | Author                                | License | Original filename         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------- | ------------------------- |
| `lobbyHum.ogg`     | [Droning Sound Effects](https://opengameart.org/content/droning-sound-effects)                                                             | bretbernhoft                          | CC0     | `drone53.wav`             |
| `stationBuzz.ogg`  | [Droning Sound Effects](https://opengameart.org/content/droning-sound-effects)                                                             | bretbernhoft                          | CC0     | `drone54.wav`             |
| `parkingDrone.ogg` | [Droning Sound Effects](https://opengameart.org/content/droning-sound-effects)                                                             | bretbernhoft                          | CC0     | `drone55.wav`             |
| `pipeSteam.ogg`    | [Droning Sound Effects](https://opengameart.org/content/droning-sound-effects)                                                             | bretbernhoft                          | CC0     | `drone56.wav`             |
| `floodedDeep.ogg`  | [Droning Sound Effects](https://opengameart.org/content/droning-sound-effects) (different segment of the same recording as `lobbyHum.ogg`) | bretbernhoft                          | CC0     | `drone53.wav`             |
| `hotelWind.ogg`    | [Short wind sound](https://opengameart.org/content/short-wind-sound)                                                                       | remaxim                               | CC0     | `short wind sound.wav`    |
| `caveDrip.ogg`     | [Dripping water loop](https://opengameart.org/content/dripping-water-loop)                                                                 | Independent.nu (submitted by qubodup) | CC0     | `atmosbasement.mp3_.flac` |

`officeSilence` and `blackSilence` have no committed asset — both levels are
meant to read as near-silent, and the shipped `ProceduralAudioEngine`
"silence" recipe already covers that; the manifest entry is deliberately
absent (PLAN-4 §10.1's partial-manifest design), not missing.

## Footsteps (`public/audio/sfx/footsteps/`)

| File           | Source                                                                                                                                              | Author        | License | Original filename |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------- | ----------------- |
| `hard-1.ogg`   | [Footsteps](https://opengameart.org/content/footsteps-0)                                                                                            | GboxMikeFozzy | CC0     | `01-footstep.ogg` |
| `wet-1.ogg`    | [Water Splash and sand footsteps](https://opengameart.org/content/water-splash-and-sand-footsteps)                                                  | Peludo        | CC0     | `splash1.wav`     |
| `gravel-1.ogg` | [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud) (zip) | TinyWorlds    | CC0     | `gravel.ogg`      |

`carpet` has no committed asset yet — falls back to the procedural footstep
synthesis, which already has a carpet-specific low-pass timbre.

## Entity cues (`public/audio/sfx/entities/`)

| File          | Source                                                                                         | Author     | License | Original filename         |
| ------------- | ---------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------------- |
| `growl.ogg`   | [growl](https://opengameart.org/content/growl)                                                 | Anonymous  | CC0     | `growl.flac`              |
| `shriek.ogg`  | [Insect or alien scream (short)](https://opengameart.org/content/insect-or-alien-scream-short) | qubodup    | CC0     | `insectoralienshort.flac` |
| `chitter.ogg` | [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) (zip)               | rubberduck | CC0     | `bug_01.ogg`              |
| `laugh.ogg`   | [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) (zip)               | rubberduck | CC0     | `weird_01.ogg`            |

## UI (`public/audio/sfx/ui/`)

| File        | Source                                                                                                                            | Author  | License | Original filename    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- | -------------------- |
| `click.ogg` | [Button Click Sound Effect (CC0/Public Domain)](https://opengameart.org/content/button-click-sound-effect-cc0public-domain) (zip) | qubodup | CC0     | `qubodup-click1.wav` |

`pickup` has no committed asset yet — falls back to the procedural pickup chime.
