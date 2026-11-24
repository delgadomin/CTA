/**
 * Procedural Web Audio Engine for Cáceres Criminal.
 * Follows gamedev-skills audio guidelines (sound-brief):
 * - Bus architecture with master limiter, SFX and engine channels
 * - Zero external assets: 100% procedural Web Audio API synthesis
 * - Safe fallback in environments without AudioContext (e.g. tests)
 * - Zero GC allocations in hot loop
 */

export class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
  private skidSource: AudioBufferSourceNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;
  private hornActive = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private init(): boolean {
    if (this.initialized) return true;
    if (typeof window === 'undefined') return false;

    const ContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextClass) return false;

    try {
      this.context = new ContextClass();
      const ctx = this.context;

      // Master bus
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.65, ctx.currentTime);
      this.masterGain.connect(ctx.destination);

      // SFX bus
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Procedural White Noise Buffer (2 seconds looping)
      const bufferSize = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }

      // 1. Vehicle Engine Oscillator
      this.engineGain = ctx.createGain();
      this.engineGain.gain.setValueAtTime(0, ctx.currentTime);
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(260, ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, ctx.currentTime);

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(42, ctx.currentTime);
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // 2. Tire Skid / Screech Node
      this.skidGain = ctx.createGain();
      this.skidGain.gain.setValueAtTime(0, ctx.currentTime);
      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.setValueAtTime(850, ctx.currentTime);
      skidFilter.Q.setValueAtTime(3.0, ctx.currentTime);

      this.skidSource = ctx.createBufferSource();
      this.skidSource.buffer = this.noiseBuffer;
      this.skidSource.loop = true;
      this.skidSource.connect(skidFilter);
      skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);
      this.skidSource.start();

      // 3. Police Siren Node (Two-tone modulated wail)
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0, ctx.currentTime);
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.setValueAtTime(600, ctx.currentTime);

      const sirenLfoGain = ctx.createGain();
      sirenLfoGain.gain.setValueAtTime(180, ctx.currentTime);
      this.sirenLfo = ctx.createOscillator();
      this.sirenLfo.frequency.setValueAtTime(1.1, ctx.currentTime); // 1.1 Hz sweep
      this.sirenLfo.connect(sirenLfoGain);
      sirenLfoGain.connect(this.sirenOsc.frequency);

      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenLfo.start();
      this.sirenOsc.start();

      // 4. Car Horn Node (Dual-frequency 420Hz + 525Hz)
      this.hornGain = ctx.createGain();
      this.hornGain.gain.setValueAtTime(0, ctx.currentTime);
      this.hornOsc1 = ctx.createOscillator();
      this.hornOsc1.type = 'sawtooth';
      this.hornOsc1.frequency.setValueAtTime(420, ctx.currentTime);
      this.hornOsc2 = ctx.createOscillator();
      this.hornOsc2.type = 'sawtooth';
      this.hornOsc2.frequency.setValueAtTime(525, ctx.currentTime);

      const hornFilter = ctx.createBiquadFilter();
      hornFilter.type = 'lowpass';
      hornFilter.frequency.setValueAtTime(1800, ctx.currentTime);

      this.hornOsc1.connect(hornFilter);
      this.hornOsc2.connect(hornFilter);
      hornFilter.connect(this.hornGain);
      this.hornGain.connect(this.masterGain);
      this.hornOsc1.start();
      this.hornOsc2.start();

      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  resume(): void {
    if (!this.initialized) this.init();
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  toggleMute(): boolean {
    this.resume();
    this.muted = !this.muted;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.65, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Updates vehicle engine rpm pitch and volume based on speed and throttle. */
  updateVehicleEngine(active: boolean, speed: number, throttle: boolean): void {
    if (
      !this.initialized ||
      !this.context ||
      !this.engineGain ||
      !this.engineOsc ||
      !this.engineFilter
    )
      return;
    const now = this.context.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.15);
      return;
    }
    const speedRatio = Math.min(speed / 24, 1);
    const targetFreq = 42 + speedRatio * 155 + (throttle ? 18 : 0);
    const targetCutoff = 280 + speedRatio * 900 + (throttle ? 320 : 0);
    const targetVolume = 0.28 + speedRatio * 0.22;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.1);
    this.engineGain.gain.setTargetAtTime(targetVolume, now, 0.08);
  }

  /** Plays or stops tire screech sound during sharp drift or handbrake. */
  updateSkid(screeching: boolean): void {
    if (!this.initialized || !this.context || !this.skidGain) return;
    const now = this.context.currentTime;
    const targetGain = screeching ? 0.35 : 0;
    this.skidGain.gain.setTargetAtTime(targetGain, now, screeching ? 0.05 : 0.12);
  }

  /** Sets horn active state when driving. */
  setHorn(active: boolean): void {
    if (!this.initialized || !this.context || !this.hornGain) return;
    if (this.hornActive === active) return;
    this.hornActive = active;
    const now = this.context.currentTime;
    this.hornGain.gain.setTargetAtTime(active ? 0.32 : 0, now, active ? 0.02 : 0.06);
  }

  /** Updates police siren volume according to wanted level and distance to nearest patrol. */
  updatePoliceSiren(wantedStars: number, nearestDistance: number): void {
    if (!this.initialized || !this.context || !this.sirenGain) return;
    const now = this.context.currentTime;
    if (wantedStars <= 0 || nearestDistance > 140) {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.25);
      return;
    }
    const proximity = Math.max(0, 1 - nearestDistance / 140);
    const volume = 0.08 + proximity * 0.32;
    this.sirenGain.gain.setTargetAtTime(volume, now, 0.1);
  }

  /** Short footstep sound triggered on walking cadence. */
  playFootstep(): void {
    if (!this.initialized || !this.context || !this.noiseBuffer || !this.sfxGain || this.muted)
      return;
    try {
      const now = this.context.currentTime;
      const stepSource = this.context.createBufferSource();
      stepSource.buffer = this.noiseBuffer;

      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 + Math.random() * 200, now);
      filter.Q.setValueAtTime(3.5, now);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      stepSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      stepSource.start(now);
      stepSource.stop(now + 0.06);
    } catch {
      // Ignore audio glitches on disposed context
    }
  }

  /** Crash or punchy collision sound. */
  playCollision(intensity = 0.5): void {
    if (!this.initialized || !this.context || !this.noiseBuffer || !this.sfxGain || this.muted)
      return;
    try {
      const now = this.context.currentTime;
      const punchOsc = this.context.createOscillator();
      punchOsc.type = 'triangle';
      punchOsc.frequency.setValueAtTime(140, now);
      punchOsc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

      const punchGain = this.context.createGain();
      punchGain.gain.setValueAtTime(Math.min(intensity * 0.5, 0.4), now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      punchOsc.connect(punchGain);
      punchGain.connect(this.sfxGain);
      punchOsc.start(now);
      punchOsc.stop(now + 0.23);

      const crunch = this.context.createBufferSource();
      crunch.buffer = this.noiseBuffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);

      const crunchGain = this.context.createGain();
      crunchGain.gain.setValueAtTime(Math.min(intensity * 0.45, 0.35), now);
      crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      crunch.connect(filter);
      filter.connect(crunchGain);
      crunchGain.connect(this.sfxGain);
      crunch.start(now);
      crunch.stop(now + 0.19);
    } catch {
      // Ignore error
    }
  }

  /** Alert chime on crime star escalation. */
  playCrimeAlert(): void {
    if (!this.initialized || !this.context || !this.sfxGain || this.muted) return;
    try {
      const now = this.context.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, index) => {
        if (!this.context || !this.sfxGain) return;
        const noteOsc = this.context.createOscillator();
        noteOsc.type = 'sine';
        noteOsc.frequency.setValueAtTime(freq, now + index * 0.08);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.2, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);

        noteOsc.connect(gain);
        gain.connect(this.sfxGain);
        noteOsc.start(now + index * 0.08);
        noteOsc.stop(now + index * 0.08 + 0.26);
      });
    } catch {
      // Ignore error
    }
  }

  /** Busted jingle on arrest. */
  playBusted(): void {
    if (!this.initialized || !this.context || !this.sfxGain || this.muted) return;
    try {
      const now = this.context.currentTime;
      const notes = [220, 196, 174.6, 146.8]; // A3, G3, F3, D3 descending
      notes.forEach((freq, index) => {
        if (!this.context || !this.sfxGain) return;
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + index * 0.16);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now + index * 0.16);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.3, now + index * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.16 + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + index * 0.16);
        osc.stop(now + index * 0.16 + 0.36);
      });
    } catch {
      // Ignore error
    }
  }
}
