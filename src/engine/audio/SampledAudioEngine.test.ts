import { describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "./AudioEngine";
import { createFakeAudioContext } from "./audioTestUtils";
import type { AudioManifest } from "./manifest";
import { SampledAudioEngine, type AudioAssetLoader } from "./SampledAudioEngine";

const FAKE_BUFFER = { length: 100, sampleRate: 8000, getChannelData: () => new Float32Array(100) };

const createSpyFallback = (): AudioEngine => ({
  startAmbience: vi.fn(),
  stopAmbience: vi.fn(),
  playFootstep: vi.fn(),
  playUiClick: vi.fn(),
  playBreath: vi.fn(),
  playPickup: vi.fn(),
  playEntityCue: vi.fn(),
  setMusicVolume: vi.fn(),
  setSfxVolume: vi.fn(),
  suspend: vi.fn(),
  resume: vi.fn(),
  dispose: vi.fn(),
});

const MANIFEST: AudioManifest = {
  ambience: { lobbyHum: "/audio/ambience/lobbyHum.ogg" },
  footsteps: { carpet: ["/audio/sfx/footsteps/carpet-1.ogg"] },
  entityCues: { growl: "/audio/sfx/entities/growl.ogg" },
  ui: { click: "/audio/sfx/ui/click.ogg" },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SampledAudioEngine", () => {
  it("plays from the decoded buffer once a resolved loader's asset lands", async () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.startAmbience("lobbyHum");
    expect(fallback.startAmbience).toHaveBeenCalledWith("lobbyHum");
    await flush();

    // The sampled loop takes over: fallback ambience is stopped, and a
    // looping buffer source was created and started from the decoded asset.
    expect(fallback.stopAmbience).toHaveBeenCalled();
    const bufferSources = context.nodes.filter((node) => node.kind === "bufferSource");
    const looping = bufferSources.find(
      (node) => (node as unknown as { buffer: unknown }).buffer === FAKE_BUFFER,
    );
    expect(looping?.started).toBe(true);
  });

  it("delegates to the fallback when the loader rejects", async () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockRejectedValue(new Error("network down"));
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.startAmbience("lobbyHum");
    await flush();

    // Never swapped away from the fallback: no stopAmbience call, and the
    // fallback's synthesis is what's left playing.
    expect(fallback.startAmbience).toHaveBeenCalledWith("lobbyHum");
    expect(fallback.stopAmbience).not.toHaveBeenCalled();
  });

  it("delegates an unmapped cue without attempting a fetch", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.playEntityCue("laugh"); // not in MANIFEST.entityCues
    expect(loader).not.toHaveBeenCalled();
    expect(fallback.playEntityCue).toHaveBeenCalledWith("laugh");

    engine.playBreath(); // never has an asset bucket at all
    expect(loader).not.toHaveBeenCalled();
    expect(fallback.playBreath).toHaveBeenCalled();
  });

  it("plays a mapped one-shot from the fallback once, then from the decoded buffer after it loads", async () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.playUiClick();
    expect(fallback.playUiClick).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(MANIFEST.ui.click, context);
    await flush();

    engine.playUiClick();
    // Second call plays from the now-cached buffer, not the fallback again.
    expect(fallback.playUiClick).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("dispose() closes the shared context exactly once, via the fallback", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const engine = new SampledAudioEngine(context as unknown as AudioContext, MANIFEST, fallback);

    engine.dispose();
    expect(fallback.dispose).toHaveBeenCalledTimes(1);
    expect(context.close).not.toHaveBeenCalled(); // SampledAudioEngine never closes it itself

    engine.dispose(); // idempotent
    expect(fallback.dispose).toHaveBeenCalledTimes(1);
  });

  it("routes setMusicVolume/setSfxVolume to the fallback too", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const engine = new SampledAudioEngine(context as unknown as AudioContext, MANIFEST, fallback);

    engine.setMusicVolume(0.5);
    engine.setSfxVolume(0.25);
    expect(fallback.setMusicVolume).toHaveBeenCalledWith(0.5);
    expect(fallback.setSfxVolume).toHaveBeenCalledWith(0.25);
  });

  it("suspend/resume delegate to the fallback (shared context)", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const engine = new SampledAudioEngine(context as unknown as AudioContext, MANIFEST, fallback);

    engine.suspend();
    engine.resume();
    expect(fallback.suspend).toHaveBeenCalled();
    expect(fallback.resume).toHaveBeenCalled();
  });
});
