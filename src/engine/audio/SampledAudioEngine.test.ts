import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "./AudioEngine";
import { createFakeAudioContext } from "./audioTestUtils";
import type { AudioManifest } from "./manifest";
import { fetchAudioAsset, SampledAudioEngine, type AudioAssetLoader } from "./SampledAudioEngine";

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

    // The cached-buffer playback path cleans itself up when it ends.
    const cachedSource = context.nodes.find(
      (node) => node.kind === "bufferSource" && node.started,
    )!;
    cachedSource.onended?.();
    expect(cachedSource.disconnect).toHaveBeenCalled();
  });

  it("keeps using the fallback when a one-shot's background fetch rejects", async () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockRejectedValue(new Error("network down"));
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.playUiClick();
    await flush();

    engine.playUiClick();
    // Never cached: every call still delegates to the fallback.
    expect(fallback.playUiClick).toHaveBeenCalledTimes(2);
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

  it("does nothing when startAmbience is called after dispose", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.dispose();
    engine.startAmbience("lobbyHum");
    expect(fallback.startAmbience).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
  });

  it("does not attempt a fetch for an unmapped ambience id", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      MANIFEST,
      fallback,
      loader,
    );

    engine.startAmbience("officeSilence"); // not in MANIFEST.ambience
    expect(fallback.startAmbience).toHaveBeenCalledWith("officeSilence");
    expect(loader).not.toHaveBeenCalled();
  });

  it("drops a stale ambience resolution superseded by a later startAmbience", async () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const twoAmbienceManifest: AudioManifest = {
      ambience: {
        lobbyHum: "/audio/ambience/lobbyHum.ogg",
        stationBuzz: "/audio/ambience/stationBuzz.ogg",
      },
      footsteps: {},
      entityCues: {},
      ui: {},
    };
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      twoAmbienceManifest,
      fallback,
      loader,
    );

    engine.startAmbience("lobbyHum");
    engine.startAmbience("stationBuzz"); // supersedes the in-flight lobbyHum load
    await flush();

    // Only the second (current) ambience's loop should have been wired up.
    const bufferSources = context.nodes.filter((node) => node.kind === "bufferSource");
    expect(bufferSources.filter((node) => node.started).length).toBe(1);
    expect(fallback.stopAmbience).toHaveBeenCalledTimes(1);
  });

  it("drops a stale ambience resolution superseded by stopAmbience", async () => {
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
    engine.stopAmbience();
    await flush();

    const bufferSources = context.nodes.filter((node) => node.kind === "bufferSource");
    expect(bufferSources.some((node) => node.started)).toBe(false);
  });

  it("stops and disconnects a live sampled ambience source on stopAmbience", async () => {
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
    await flush();
    const looping = context.nodes.find((node) => node.kind === "bufferSource" && node.started)!;

    engine.stopAmbience();
    expect(looping.stopped).toBe(true);
    expect(looping.disconnect).toHaveBeenCalled();
    expect(fallback.stopAmbience).toHaveBeenCalled();
  });

  it("does nothing when a one-shot is requested after dispose", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const engine = new SampledAudioEngine(context as unknown as AudioContext, MANIFEST, fallback);

    engine.dispose();
    engine.playUiClick();
    expect(fallback.playUiClick).not.toHaveBeenCalled();
  });

  it("only fetches a one-shot asset once for overlapping in-flight requests", async () => {
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
    engine.playUiClick(); // still loading; must not trigger a second fetch
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fallback.playUiClick).toHaveBeenCalledTimes(2);
    await flush();
  });

  it("plays a footstep variant from the manifest and falls back for an unmapped surface", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const footstepManifest: AudioManifest = {
      ambience: {},
      footsteps: { hard: ["/audio/sfx/footsteps/hard-1.ogg", "/audio/sfx/footsteps/hard-2.ogg"] },
      entityCues: {},
      ui: {},
    };
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      footstepManifest,
      fallback,
      loader,
    );

    engine.playFootstep("hard", true);
    expect(loader).toHaveBeenCalledWith(
      expect.stringMatching(/^\/audio\/sfx\/footsteps\/hard-/),
      context,
    );
    expect(fallback.playFootstep).toHaveBeenCalledWith("hard", true);

    engine.playFootstep("carpet", false); // no bucket at all in this manifest
    expect(fallback.playFootstep).toHaveBeenCalledWith("carpet", false);
  });

  it("plays a mapped pickup one-shot", () => {
    const context = createFakeAudioContext();
    const fallback = createSpyFallback();
    const loader: AudioAssetLoader = vi.fn().mockResolvedValue(FAKE_BUFFER);
    const pickupManifest: AudioManifest = {
      ambience: {},
      footsteps: {},
      entityCues: {},
      ui: { pickup: "/audio/sfx/ui/pickup.ogg" },
    };
    const engine = new SampledAudioEngine(
      context as unknown as AudioContext,
      pickupManifest,
      fallback,
      loader,
    );

    engine.playPickup();
    expect(loader).toHaveBeenCalledWith("/audio/sfx/ui/pickup.ogg", context);
    expect(fallback.playPickup).toHaveBeenCalled();
  });
});

describe("fetchAudioAsset", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("decodes the response body via the context on a successful fetch", async () => {
    const context = createFakeAudioContext();
    const arrayBuffer = new ArrayBuffer(8);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(arrayBuffer),
    }) as unknown as typeof fetch;

    const buffer = await fetchAudioAsset("/audio/x.ogg", context as unknown as AudioContext);

    expect(globalThis.fetch).toHaveBeenCalledWith("/audio/x.ogg");
    expect(context.decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(buffer).toBeDefined();
  });

  it("throws when the response is not ok", async () => {
    const context = createFakeAudioContext();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }) as unknown as typeof fetch;

    await expect(
      fetchAudioAsset("/audio/missing.ogg", context as unknown as AudioContext),
    ).rejects.toThrow(/404/);
  });
});
