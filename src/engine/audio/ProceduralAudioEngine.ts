import type { AmbienceId } from "../generation/levelProfile";
import type { AudioEngine, FootstepSurface } from "./AudioEngine";

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

    switch (ambience) {
      case "fluorescentHum": {
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
      case "deepDrone": {
        this.oscillator("sine", 55, 0.05).connect(this.musicBus);
        const detuned = this.oscillator("sine", 55.7, 0.045);
        detuned.connect(this.musicBus);
        this.lfo(detuned.gain, 0.07, 0.02);
        this.oscillator("triangle", 38, 0.04).connect(this.musicBus);
        this.noiseSource(0.03, "lowpass", 120).gain.connect(this.musicBus);
        break;
      }
      case "windHollow": {
        const wind = this.noiseSource(0.09, "bandpass", 420);
        wind.gain.connect(this.musicBus);
        // Slow sweep of the bandpass center: hollow corridors of moving air.
        this.lfo(wind.filter.frequency, 0.05, 180);
        this.oscillator("sine", 92, 0.012).connect(this.musicBus);
        break;
      }
      case "nearSilence": {
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
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.playbackRate.value = 0.9 + Math.random() * 0.3 + (sprinting ? 0.15 : 0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = surface === "carpet" ? 380 : 900;

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
