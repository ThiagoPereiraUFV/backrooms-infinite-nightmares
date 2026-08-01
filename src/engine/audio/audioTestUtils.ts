import { vi } from "vitest";

/**
 * Minimal Web Audio fake, shared by every audio engine test (ProceduralAudioEngine,
 * SampledAudioEngine): enough surface for both engines' node graphs. Every
 * created node is recorded so tests can assert lifecycle behavior. Follows
 * the `hooks/matchMediaTestUtils.ts` precedent of factoring a fake browser
 * API out of the tests that need it. Excluded from the coverage gate (see
 * `vitest.config.mts`) — it is test infrastructure, not engine logic.
 */
export interface FakeNode {
  kind: string;
  connected: unknown[];
  disconnect: ReturnType<typeof vi.fn>;
  connect(target: unknown): void;
  started?: boolean;
  stopped?: boolean;
  onended?: (() => void) | null;
}

export const createFakeAudioContext = () => {
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
    decodeAudioData: vi.fn(
      async (): Promise<{
        length: number;
        sampleRate: number;
        getChannelData: () => Float32Array;
      }> => ({
        length: 0,
        sampleRate: 8000,
        getChannelData: () => new Float32Array(0),
      }),
    ),
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
