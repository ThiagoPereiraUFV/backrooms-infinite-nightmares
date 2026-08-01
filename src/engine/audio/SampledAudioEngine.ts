import type { AmbienceId, FootstepSurface } from "../generation/levelProfile";
import type { AudioEngine, EntityCueId } from "./AudioEngine";
import type { AudioManifest } from "./manifest";

/** Fetches and decodes one audio asset. Injected so the class is testable with no network. */
export type AudioAssetLoader = (url: string, ctx: AudioContext) => Promise<AudioBuffer>;

export async function fetchAudioAsset(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetchAudioAsset: ${url} responded with status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

const clampVolume = (volume: number): number => Math.min(1, Math.max(0, volume));

/**
 * Plays downloaded CC0 audio where the manifest has it, and falls back to
 * the shipped procedural synthesis for anything missing (PLAN-4 §10.1). The
 * fallback is not defensive padding — it is the design (PLAN-4 D4): no
 * "are assets loaded yet" state in gameplay code, no format-capability
 * detection, no blocking preload, no partial-manifest special cases, and no
 * silent-game failure mode. A network/decode failure degrades to the
 * synthesized soundscape, never to silence.
 *
 * Both this class and `fallback` must share one `AudioContext`; only the
 * fallback's `dispose()` actually closes it (see `dispose()` below).
 */
export class SampledAudioEngine implements AudioEngine {
  private readonly musicGain: GainNode;
  private readonly sfxGain: GainNode;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private currentAmbience: AmbienceId | null = null;
  /** Bumped on every startAmbience/stopAmbience/dispose so a stale async resolution is a no-op. */
  private ambienceToken = 0;
  private readonly oneShotBuffers = new Map<string, AudioBuffer>();
  private readonly oneShotLoading = new Set<string>();
  private disposed = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly manifest: AudioManifest,
    private readonly fallback: AudioEngine,
    private readonly loader: AudioAssetLoader = fetchAudioAsset,
  ) {
    this.musicGain = ctx.createGain();
    this.musicGain.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(ctx.destination);
  }

  startAmbience(ambience: AmbienceId): void {
    if (this.disposed) return;
    this.currentAmbience = ambience;
    this.stopSampledAmbience();
    // The fallback's synthesis starts immediately — the game always has a
    // soundscape whether or not (or until) the sampled loop arrives.
    this.fallback.startAmbience(ambience);

    const url = this.manifest.ambience[ambience];
    if (!url) return; // Unmapped cue: no fetch attempted at all.

    const token = ++this.ambienceToken;
    this.loader(url, this.ctx)
      .then((buffer) => {
        // A newer startAmbience/stopAmbience/dispose call superseded this
        // request while it was in flight; the result is stale — drop it.
        if (token !== this.ambienceToken || this.currentAmbience !== ambience) return;
        this.fallback.stopAmbience();
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.musicGain);
        source.start();
        this.ambienceSource = source;
      })
      .catch(() => {
        // Network/decode failure: the fallback, already playing, is the degrade path.
      });
  }

  stopAmbience(): void {
    this.currentAmbience = null;
    this.ambienceToken++;
    this.stopSampledAmbience();
    this.fallback.stopAmbience();
  }

  private stopSampledAmbience(): void {
    if (!this.ambienceSource) return;
    try {
      this.ambienceSource.stop();
    } catch {
      // Already stopped.
    }
    this.ambienceSource.disconnect();
    this.ambienceSource = null;
  }

  private playOneShotBuffer(buffer: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start();
    source.onended = () => source.disconnect();
  }

  /** Plays from a decoded buffer if one is cached; otherwise plays the fallback and fetches for next time. */
  private playOneShot(url: string | undefined, playFallback: () => void): void {
    if (this.disposed) return;
    if (!url) {
      playFallback();
      return;
    }
    const cached = this.oneShotBuffers.get(url);
    if (cached) {
      this.playOneShotBuffer(cached);
      return;
    }
    playFallback();
    if (this.oneShotLoading.has(url)) return;
    this.oneShotLoading.add(url);
    this.loader(url, this.ctx)
      .then((buffer) => {
        this.oneShotBuffers.set(url, buffer);
      })
      .catch(() => {
        // Leave it unmapped; every future call keeps using the fallback.
      })
      .finally(() => {
        this.oneShotLoading.delete(url);
      });
  }

  playFootstep(surface: FootstepSurface, sprinting: boolean): void {
    const variants = this.manifest.footsteps[surface];
    const url = variants?.[Math.floor(Math.random() * variants.length)];
    this.playOneShot(url, () => this.fallback.playFootstep(surface, sprinting));
  }

  playUiClick(): void {
    this.playOneShot(this.manifest.ui.click, () => this.fallback.playUiClick());
  }

  // No asset bucket exists for breath (PLAN-4 §10.3's acquisition table omits
  // it) — always the synthesized version.
  playBreath(): void {
    this.fallback.playBreath();
  }

  playPickup(): void {
    this.playOneShot(this.manifest.ui.pickup, () => this.fallback.playPickup());
  }

  playEntityCue(cue: EntityCueId): void {
    this.playOneShot(this.manifest.entityCues[cue], () => this.fallback.playEntityCue(cue));
  }

  setMusicVolume(volume: number): void {
    this.musicGain.gain.value = clampVolume(volume);
    this.fallback.setMusicVolume(volume);
  }

  setSfxVolume(volume: number): void {
    this.sfxGain.gain.value = clampVolume(volume);
    this.fallback.setSfxVolume(volume);
  }

  suspend(): void {
    this.fallback.suspend();
  }

  resume(): void {
    this.fallback.resume();
  }

  /**
   * Tears down this engine's own nodes and delegates to the fallback, which
   * owns the shared `AudioContext` and is the only one of the two that
   * actually closes it — closing it twice would throw.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ambienceToken++;
    this.stopSampledAmbience();
    this.musicGain.disconnect();
    this.sfxGain.disconnect();
    this.fallback.dispose();
  }
}
