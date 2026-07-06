import { describe, expect, it, vi } from "vitest";
import { NullAudioEngine } from "./AudioEngine";
import { ProceduralAudioEngine } from "./ProceduralAudioEngine";

/**
 * Minimal Web Audio fake: enough surface for the engine's node graph. Every
 * created node is recorded so tests can assert lifecycle behavior.
 */
interface FakeNode {
  kind: string;
  connected: unknown[];
  disconnect: ReturnType<typeof vi.fn>;
  connect(target: unknown): void;
  started?: boolean;
  stopped?: boolean;
  onended?: (() => void) | null;
}

const createFakeContext = () => {
  const nodes: FakeNode[] = [];

  const param = (value = 0) => ({
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });

  const baseNode = (kind: string): FakeNode => {
    const node: FakeNode = {
      kind,
      connected: [],
      disconnect: vi.fn(),
      connect(target: unknown) {
        node.connected.push(target);
      },
    };
    nodes.push(node);
    return node;
  };

  const sourceNode = (kind: string) => {
    const node = baseNode(kind) as FakeNode & {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    };
    node.started = false;
    node.stopped = false;
    node.onended = null;
    node.start = vi.fn(() => {
      node.started = true;
    });
    node.stop = vi.fn(() => {
      node.stopped = true;
      node.onended?.();
    });
    return node;
  };

  const context = {
    nodes,
    state: "running" as AudioContextState,
    currentTime: 0,
    sampleRate: 8000,
    destination: baseNode("destination"),
    createGain: () => Object.assign(baseNode("gain"), { gain: param(1) }),
    createDelay: () => Object.assign(baseNode("delay"), { delayTime: param(0) }),
    createBiquadFilter: () =>
      Object.assign(baseNode("filter"), { type: "lowpass", frequency: param(0), Q: param(1) }),
    createOscillator: () =>
      Object.assign(sourceNode("oscillator"), { type: "sine", frequency: param(0) }),
    createBufferSource: () =>
      Object.assign(sourceNode("bufferSource"), {
        buffer: null,
        loop: false,
        playbackRate: param(1),
      }),
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    }),
    suspend: vi.fn(function (this: { state: AudioContextState }) {
      context.state = "suspended";
      return Promise.resolve();
    }),
    resume: vi.fn(() => {
      context.state = "running";
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      context.state = "closed";
      return Promise.resolve();
    }),
  };
  return context;
};

const createEngine = () => {
  const context = createFakeContext();
  const engine = new ProceduralAudioEngine(context as unknown as AudioContext);
  return { context, engine };
};

const AMBIENCES = ["fluorescentHum", "deepDrone", "windHollow", "nearSilence"] as const;

describe("ProceduralAudioEngine", () => {
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

  it("is idempotent for the same ambience and swaps cleanly for a new one", () => {
    const { context, engine } = createEngine();
    engine.startAmbience("deepDrone");
    const afterFirst = context.nodes.length;
    engine.startAmbience("deepDrone");
    expect(context.nodes.length).toBe(afterFirst);

    engine.startAmbience("windHollow");
    const droneSources = context.nodes.slice(0, afterFirst).filter((node) => node.started);
    expect(droneSources.every((node) => node.stopped)).toBe(true);
  });

  it("stops and disconnects everything on stopAmbience", () => {
    const { context, engine } = createEngine();
    engine.startAmbience("fluorescentHum");
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

    const oneShots = context.nodes.filter((node) => node.started);
    expect(oneShots.length).toBe(4);
    for (const node of oneShots) {
      node.onended?.();
      expect(node.disconnect).toHaveBeenCalled();
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
    engine.startAmbience("deepDrone");
    engine.playFootstep("carpet", false);
    engine.playUiClick();
    engine.playBreath();
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
    engine.setMusicVolume();
    engine.setSfxVolume();
    engine.suspend();
    engine.resume();
    engine.dispose();
  });
});
