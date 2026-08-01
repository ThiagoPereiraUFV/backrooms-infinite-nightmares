import type { AmbienceId, FootstepSurface } from "../generation/levelProfile";
import type { AudioEngine, EntityCueId } from "./AudioEngine";

/**
 * The nine per-level `AmbienceId`s (PLAN-4 §4.2) share exactly four
 * synthesis recipes — widening the data model to nine ids gave each level
 * its own audio-asset key without writing five new oscillator graphs
 * (PLAN-4 D7). `SampledAudioEngine` still keys downloaded loops by the full
 * nine ids; this is purely the procedural fallback's mapping.
 */
const RECIPE_BY_AMBIENCE: Record<AmbienceId, "hum" | "drone" | "wind" | "silence"> = {
  lobbyHum: "hum",
  stationBuzz: "hum",
  parkingDrone: "drone",
  pipeSteam: "drone",
  floodedDeep: "drone",
  hotelWind: "wind",
  officeSilence: "silence",
  blackSilence: "silence",
  caveDrip: "silence",
};

/** Footstep filter per surface — carpet/hard existed before; wet/gravel are new (PLAN-4 §5). */
const FOOTSTEP_TIMBRE: Record<
  FootstepSurface,
  { filterType: BiquadFilterType; frequency: number }
> = {
  carpet: { filterType: "lowpass", frequency: 380 },
  hard: { filterType: "lowpass", frequency: 900 },
  wet: { filterType: "lowpass", frequency: 650 },
  gravel: { filterType: "bandpass", frequency: 1300 },
};

/**
 * Backrooms soundtrack, synthesized live with the Web Audio API: detuned
 * drones, fluorescent hum, hollow wind and near-silent room tone, plus
 * footsteps/breath/UI effects. No assets to load; everything is generated.
 *
 * Construct only after a user gesture (browser autoplay policy).
 */
export class ProceduralAudioEngine implements AudioEngine {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly musicBus: GainNode;
  private readonly sfxBus: GainNode;
  /** Sources that must be stop()ped when the ambience changes. */
  private ambienceSources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  /** Every node in the current ambience graph, for disconnect(). */
  private ambienceNodes: AudioNode[] = [];
  private currentAmbience: AmbienceId | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private disposed = false;

  /** Exposed so `SampledAudioEngine` can share the same `AudioContext` (GameRoot composes them). */
  get context(): AudioContext {
    return this.ctx;
  }

  constructor(context?: AudioContext) {
    this.ctx = context ?? new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    // Echoey liminal space: ambience runs through a feedback delay.
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.35;
    const damp = this.ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1200;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    feedback.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.noiseBuffer) {
      const seconds = 2;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        // Brown-ish noise: integrate white noise, keep it bounded.
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
        data[i] = last * 12;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private oscillator(type: OscillatorType, frequency: number, gainValue: number): GainNode {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    osc.connect(gain);
    osc.start();
    this.ambienceSources.push(osc);
    this.ambienceNodes.push(osc, gain);
    return gain;
  }

  private noiseSource(
    gainValue: number,
    filterType: BiquadFilterType,
    frequency: number,
  ): { gain: GainNode; filter: BiquadFilterNode } {
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    source.start();
    this.ambienceSources.push(source);
    this.ambienceNodes.push(source, filter, gain);
    return { gain, filter };
  }

  private lfo(target: AudioParam, frequency: number, depth: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.value = depth;
    osc.connect(gain);
    gain.connect(target);
    osc.start();
    this.ambienceSources.push(osc);
    this.ambienceNodes.push(osc, gain);
  }

  startAmbience(ambience: AmbienceId): void {
    if (this.disposed || this.currentAmbience === ambience) return;
    this.stopAmbience();
    this.currentAmbience = ambience;

    switch (RECIPE_BY_AMBIENCE[ambience]) {
      case "hum": {
        // The classic Level 0 soundscape: mains hum plus air-handler rumble.
        const hum = this.oscillator("sawtooth", 120, 0.02);
        const humFilter = this.ctx.createBiquadFilter();
        humFilter.type = "bandpass";
        humFilter.frequency.value = 240;
        humFilter.Q.value = 6;
        hum.connect(humFilter);
        humFilter.connect(this.musicBus);
        this.ambienceNodes.push(humFilter);
        this.lfo(hum.gain, 0.4, 0.008);
        this.noiseSource(0.05, "lowpass", 160).gain.connect(this.musicBus);
        this.oscillator("sine", 60, 0.015).connect(this.musicBus);
        break;
      }
      case "drone": {
        this.oscillator("sine", 55, 0.05).connect(this.musicBus);
        const detuned = this.oscillator("sine", 55.7, 0.045);
        detuned.connect(this.musicBus);
        this.lfo(detuned.gain, 0.07, 0.02);
        this.oscillator("triangle", 38, 0.04).connect(this.musicBus);
        this.noiseSource(0.03, "lowpass", 120).gain.connect(this.musicBus);
        break;
      }
      case "wind": {
        const wind = this.noiseSource(0.09, "bandpass", 420);
        wind.gain.connect(this.musicBus);
        // Slow sweep of the bandpass center: hollow corridors of moving air.
        this.lfo(wind.filter.frequency, 0.05, 180);
        this.oscillator("sine", 92, 0.012).connect(this.musicBus);
        break;
      }
      case "silence": {
        // Room tone at the edge of hearing; the scariest track is almost none.
        this.noiseSource(0.015, "lowpass", 100).gain.connect(this.musicBus);
        const tone = this.oscillator("sine", 210, 0.004);
        tone.connect(this.musicBus);
        this.lfo(tone.gain, 0.02, 0.003);
        break;
      }
    }
  }

  stopAmbience(): void {
    for (const source of this.ambienceSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    for (const node of this.ambienceNodes) {
      node.disconnect();
    }
    this.ambienceSources = [];
    this.ambienceNodes = [];
    this.currentAmbience = null;
  }

  playFootstep(surface: FootstepSurface, sprinting: boolean): void {
    if (this.disposed) return;
    const timbre = FOOTSTEP_TIMBRE[surface];
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 0.9 + Math.random() * 0.3 + (sprinting ? 0.15 : 0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = timbre.filterType;
    filter.frequency.value = timbre.frequency;

    const envelope = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const peak = (sprinting ? 0.5 : 0.35) * (0.85 + Math.random() * 0.3);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(peak, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    source.start(now, Math.random(), 0.16);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };

    // Wet floors get a brief bright "splash" transient layered on top.
    if (surface === "wet") {
      const splash = this.ctx.createBufferSource();
      splash.buffer = this.getNoiseBuffer();
      const splashFilter = this.ctx.createBiquadFilter();
      splashFilter.type = "bandpass";
      splashFilter.frequency.value = 2200;
      splashFilter.Q.value = 0.6;
      const splashEnvelope = this.ctx.createGain();
      splashEnvelope.gain.setValueAtTime(0, now);
      splashEnvelope.gain.linearRampToValueAtTime(peak * 0.4, now + 0.006);
      splashEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      splash.connect(splashFilter);
      splashFilter.connect(splashEnvelope);
      splashEnvelope.connect(this.sfxBus);
      splash.start(now, Math.random(), 0.08);
      splash.onended = () => {
        splash.disconnect();
        splashFilter.disconnect();
        splashEnvelope.disconnect();
      };
    }
  }

  playUiClick(): void {
    if (this.disposed) return;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 660;
    const envelope = this.ctx.createGain();
    const now = this.ctx.currentTime;
    envelope.gain.setValueAtTime(0.12, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(envelope);
    envelope.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.07);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
  }

  playBreath(): void {
    if (this.disposed) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    const envelope = this.ctx.createGain();
    const now = this.ctx.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.12, now + 0.25);
    envelope.gain.linearRampToValueAtTime(0.01, now + 0.8);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    source.start(now, Math.random(), 0.9);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  playPickup(): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(envelope);
    envelope.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
  }

  playEntityCue(cue: EntityCueId): void {
    if (this.disposed) return;
    switch (cue) {
      case "growl":
        this.playGrowlCue();
        break;
      case "shriek":
        this.playShriekCue();
        break;
      case "chitter":
        this.playChitterCue();
        break;
      case "laugh":
        this.playLaughCue();
        break;
    }
  }

  private playGrowlCue(): void {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 0.35;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.9);
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.22, now + 0.15);
    envelope.gain.linearRampToValueAtTime(0.001, now + 1.1);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    source.start(now, Math.random(), 1.1);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  /** A rising, thin noise burst — a startled shriek. */
  private playShriekCue(): void {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 1.6;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.35);
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.18, now + 0.05);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    source.start(now, Math.random(), 0.5);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  /** A noise burst with fast amplitude modulation — insect-like chittering. */
  private playChitterCue(): void {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 2.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1400;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.linearRampToValueAtTime(0.16, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    // A fast tremolo on top of the envelope reads as rapid clicking rather
    // than a single smooth burst.
    const tremolo = this.ctx.createOscillator();
    tremolo.frequency.value = 22;
    const tremoloGain = this.ctx.createGain();
    tremoloGain.gain.value = 0.1;
    tremolo.connect(tremoloGain);
    tremoloGain.connect(envelope.gain);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    source.start(now, Math.random(), 0.45);
    tremolo.start(now);
    tremolo.stop(now + 0.45);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      tremolo.disconnect();
      tremoloGain.disconnect();
    };
  }

  /** A wavering, off-pitch tone — an unsettling laugh. */
  private playLaughCue(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 260;
    const wobble = this.ctx.createOscillator();
    wobble.frequency.value = 7;
    const wobbleGain = this.ctx.createGain();
    wobbleGain.gain.value = 60;
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.1, now + 0.05);
    envelope.gain.linearRampToValueAtTime(0.001, now + 0.6);
    osc.connect(envelope);
    envelope.connect(this.sfxBus);
    osc.start(now);
    wobble.start(now);
    osc.stop(now + 0.65);
    wobble.stop(now + 0.65);
    osc.onended = () => {
      osc.disconnect();
      wobble.disconnect();
      wobbleGain.disconnect();
      envelope.disconnect();
    };
  }

  setMusicVolume(volume: number): void {
    this.musicBus.gain.value = Math.min(1, Math.max(0, volume));
  }

  setSfxVolume(volume: number): void {
    this.sfxBus.gain.value = Math.min(1, Math.max(0, volume));
  }

  suspend(): void {
    if (!this.disposed && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (!this.disposed && this.ctx.state === "suspended") void this.ctx.resume();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopAmbience();
    this.disposed = true;
    void this.ctx.close();
  }
}
