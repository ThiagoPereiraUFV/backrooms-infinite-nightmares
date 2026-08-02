import { afterEach, describe, expect, it, vi } from "vitest";
import { NullAudioEngine } from "./AudioEngine";
import { createFakeAudioContext, type FakeNode } from "./audioTestUtils";
import { ProceduralAudioEngine } from "./ProceduralAudioEngine";

const createEngine = () => {
  const context = createFakeAudioContext();
  const engine = new ProceduralAudioEngine(context as unknown as AudioContext);
  return { context, engine };
};

// Nine per-level ambience ids, all mapped onto the four synthesis recipes
// (RECIPE_BY_AMBIENCE) — one representative id per recipe is enough to cover
// the switch, and the full nine are swept separately below.
const AMBIENCES = ["lobbyHum", "parkingDrone", "hotelWind", "officeSilence"] as const;
const ALL_AMBIENCE_IDS = [
  "lobbyHum",
  "parkingDrone",
  "pipeSteam",
  "stationBuzz",
  "officeSilence",
  "hotelWind",
  "blackSilence",
  "floodedDeep",
  "caveDrip",
] as const;

describe("ProceduralAudioEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates its own AudioContext when none is provided, and exposes it", () => {
    const fakeContext = createFakeAudioContext();
    const AudioContextMock = vi.fn(function (this: unknown) {
      return fakeContext;
    });
    vi.stubGlobal("AudioContext", AudioContextMock);

    const engine = new ProceduralAudioEngine();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(engine.context).toBe(fakeContext);
  });

  it("exposes the provided context via the context getter", () => {
    const { context, engine } = createEngine();
    expect(engine.context).toBe(context);
  });

  it("builds an ambience graph for every ambience id", () => {
    for (const ambience of AMBIENCES) {
      const { context, engine } = createEngine();
      const before = context.nodes.length;
      engine.startAmbience(ambience);
      expect(context.nodes.length).toBeGreaterThan(before);
      const sources = context.nodes.filter((node) => node.started);
      expect(sources.length).toBeGreaterThan(0);
    }
  });

  it("builds a graph for all nine ambience ids (RECIPE_BY_AMBIENCE covers every id)", () => {
    for (const ambience of ALL_AMBIENCE_IDS) {
      const { context, engine } = createEngine();
      engine.startAmbience(ambience);
      expect(context.nodes.some((node) => node.started)).toBe(true);
    }
  });

  it("is idempotent for the same ambience and swaps cleanly for a new one", () => {
    const { context, engine } = createEngine();
    engine.startAmbience("parkingDrone");
    const afterFirst = context.nodes.length;
    engine.startAmbience("parkingDrone");
    expect(context.nodes.length).toBe(afterFirst);

    engine.startAmbience("hotelWind");
    const droneSources = context.nodes.slice(0, afterFirst).filter((node) => node.started);
    expect(droneSources.every((node) => node.stopped)).toBe(true);
  });

  it("stops and disconnects everything on stopAmbience", () => {
    const { context, engine } = createEngine();
    engine.startAmbience("lobbyHum");
    const ambientNodes = context.nodes.filter((node) => node.kind !== "destination");
    engine.stopAmbience();
    const stillRunning = ambientNodes.filter((node) => node.started && !node.stopped);
    expect(stillRunning).toEqual([]);
  });

  it("plays one-shot SFX that clean themselves up when they end", () => {
    const { context, engine } = createEngine();
    engine.playFootstep("carpet", false);
    engine.playFootstep("hard", true);
    engine.playUiClick();
    engine.playBreath();
    engine.playPickup();
    engine.playEntityCue("growl");

    const oneShots = context.nodes.filter((node) => node.started);
    expect(oneShots.length).toBe(6);
    for (const node of oneShots) {
      node.onended?.();
      expect(node.disconnect).toHaveBeenCalled();
    }
  });

  it("plays footsteps for wet and gravel surfaces too", () => {
    const { context, engine } = createEngine();
    engine.playFootstep("wet", false);
    engine.playFootstep("gravel", true);
    expect(context.nodes.some((node) => node.started)).toBe(true);
  });

  it("cleans up the wet-footstep splash transient when it ends", () => {
    const { context, engine } = createEngine();
    engine.playFootstep("wet", false);
    const started = context.nodes.filter((node) => node.started);
    // Main footstep source plus the splash transient's source.
    expect(started.length).toBe(2);
    for (const node of started) {
      node.onended?.();
      expect(node.disconnect).toHaveBeenCalled();
    }
  });

  it("plays every entity cue variant and cleans up on end", () => {
    for (const cue of ["growl", "shriek", "chitter", "laugh"] as const) {
      const { context, engine } = createEngine();
      const before = context.nodes.length;
      engine.playEntityCue(cue);
      expect(context.nodes.length).toBeGreaterThan(before);
      const started = context.nodes.filter((node) => node.started);
      expect(started.length).toBeGreaterThan(0);
      for (const node of started) {
        node.onended?.();
        expect(node.disconnect).toHaveBeenCalled();
      }
    }
  });

  it("clamps volumes into 0..1", () => {
    const { context, engine } = createEngine();
    engine.setMusicVolume(5);
    engine.setSfxVolume(-2);
    const gains = context.nodes.filter((node) => node.kind === "gain") as Array<
      FakeNode & { gain: { value: number } }
    >;
    const values = gains.map((gain) => gain.gain.value);
    expect(values).toContain(1);
    expect(values).toContain(0);
    expect(values.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("suspends, resumes and disposes the context", () => {
    const { context, engine } = createEngine();
    engine.suspend();
    expect(context.suspend).toHaveBeenCalled();
    engine.resume();
    expect(context.resume).toHaveBeenCalled();
    engine.dispose();
    expect(context.close).toHaveBeenCalled();
  });

  it("becomes inert after dispose", () => {
    const { context, engine } = createEngine();
    engine.dispose();
    const nodeCount = context.nodes.length;
    engine.startAmbience("parkingDrone");
    engine.playFootstep("carpet", false);
    engine.playUiClick();
    engine.playBreath();
    engine.playPickup();
    engine.playEntityCue("growl");
    engine.suspend();
    engine.resume();
    engine.dispose();
    expect(context.nodes.length).toBe(nodeCount);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});

describe("NullAudioEngine", () => {
  it("accepts every call as a no-op", () => {
    const engine = new NullAudioEngine();
    engine.startAmbience();
    engine.stopAmbience();
    engine.playFootstep();
    engine.playUiClick();
    engine.playBreath();
    engine.playPickup();
    engine.playEntityCue();
    engine.setMusicVolume();
    engine.setSfxVolume();
    engine.suspend();
    engine.resume();
    engine.dispose();
  });
});
