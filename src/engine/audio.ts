/**
 * Tiny synthesizer: every sound in QR Market is generated with WebAudio, no audio files.
 */
export type Sfx =
  | 'chime'
  | 'blip'
  | 'select'
  | 'back'
  | 'coin'
  | 'rip'
  | 'clack'
  | 'pop'
  | 'fizz'
  | 'whoosh'
  | 'tada'
  | 'error'
  | 'register'
  | 'crunch'
  | 'pour'
  | 'step'
  | 'unlock'
  | 'scratch'
  | 'zap'
  | 'splash'
  | 'crack'
  | 'ding';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastPlay = new Map<string, number>();
  muted = false;
  musicOn = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNextTime = 0;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicOn) this.startMusic();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, bus?: GainNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private bell(freq: number, dur: number, vol: number, when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    carrier.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    modGain.gain.setValueAtTime(freq * 1.2, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(modGain).connect(carrier.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.connect(g).connect(this.sfxBus!);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1?: number, when = 0, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const biq = ctx.createBiquadFilter();
    biq.type = filter;
    biq.Q.value = q;
    biq.frequency.setValueAtTime(f0, t);
    if (f1) biq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biq).connect(g).connect(this.sfxBus!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name: Sfx, opts: { rate?: number; minGap?: number } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = opts.minGap ?? 0.02;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < gap) return;
    this.lastPlay.set(name, now);
    const r = opts.rate ?? 1;
    switch (name) {
      case 'chime':
        this.bell(NOTE(76), 1.2, 0.25, 0);
        this.bell(NOTE(72), 1.4, 0.25, 0.32);
        this.bell(NOTE(74), 1.2, 0.2, 0.64);
        this.bell(NOTE(79), 1.8, 0.22, 0.96);
        break;
      case 'ding':
        this.bell(NOTE(84) * r, 0.9, 0.18);
        break;
      case 'blip':
        this.tone(880 * r, 0.05, 'square', 0.05, 0, 1320 * r);
        break;
      case 'select':
        this.tone(660, 0.07, 'square', 0.07);
        this.tone(990, 0.1, 'square', 0.07, 0.06);
        break;
      case 'back':
        this.tone(660, 0.07, 'square', 0.06);
        this.tone(440, 0.1, 'square', 0.06, 0.06);
        break;
      case 'coin':
        this.tone(NOTE(83), 0.08, 'square', 0.08);
        this.tone(NOTE(88), 0.35, 'square', 0.08, 0.07);
        break;
      case 'unlock':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.16, 'square', 0.06, i * 0.06));
        this.bell(NOTE(96), 1, 0.12, 0.32);
        break;
      case 'rip':
        this.noise(0.28, 0.5, 'bandpass', 3500, 900, 0, 0.8);
        this.noise(0.12, 0.3, 'highpass', 5000, undefined, 0.05);
        break;
      case 'clack':
        this.tone((1800 + Math.random() * 1400) * r, 0.03, 'triangle', 0.05);
        this.noise(0.02, 0.06, 'highpass', 4000);
        break;
      case 'pop':
        this.tone(700 * r, 0.1, 'sine', 0.25, 0, 110);
        break;
      case 'fizz':
        this.noise(1.4, 0.18, 'highpass', 6000, 3000, 0, 0.5);
        break;
      case 'whoosh':
        this.noise(0.45, 0.25, 'bandpass', 400, 2400, 0, 1.4);
        break;
      case 'tada':
        [60, 64, 67, 72].forEach((n, i) => this.tone(NOTE(n + 12), 0.14, 'square', 0.06, i * 0.08));
        this.tone(NOTE(84), 0.6, 'triangle', 0.1, 0.34);
        this.tone(NOTE(79), 0.6, 'triangle', 0.08, 0.34);
        break;
      case 'error':
        this.tone(160, 0.18, 'square', 0.08);
        this.tone(120, 0.25, 'square', 0.08, 0.12);
        break;
      case 'register':
        this.noise(0.05, 0.3, 'highpass', 2500);
        this.bell(NOTE(93), 0.6, 0.15, 0.06);
        this.bell(NOTE(98), 0.9, 0.12, 0.16);
        break;
      case 'crunch':
        for (let i = 0; i < 4; i++) this.noise(0.05, 0.25, 'bandpass', 1500 + Math.random() * 2500, undefined, i * 0.04, 1.2);
        break;
      case 'pour':
        for (let i = 0; i < 10; i++) this.tone(1500 + Math.random() * 2500, 0.02, 'triangle', 0.035, i * 0.05 + Math.random() * 0.03);
        break;
      case 'step':
        this.noise(0.06, 0.12, 'lowpass', 400);
        break;
      case 'scratch':
        this.noise(0.08, 0.12, 'bandpass', 2400 + Math.random() * 1500, undefined, 0, 2);
        break;
      case 'zap':
        this.tone(1200, 0.25, 'sawtooth', 0.06, 0, 80);
        this.noise(0.2, 0.15, 'highpass', 3000);
        break;
      case 'splash':
        this.noise(0.5, 0.3, 'lowpass', 2500, 300, 0, 0.7);
        break;
      case 'crack':
        this.noise(0.09, 0.4, 'bandpass', 1800, 700, 0, 1.5);
        this.tone(300, 0.08, 'square', 0.05, 0.02, 120);
        break;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Background music: a relaxed 8-bar convenience-store loop (bass, chords, melody).
  private startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicNextTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  private stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicBus) return;
    const stepDur = 60 / 104 / 2; // eighth notes at 104 bpm
    // chords: Fmaj7, Em7, Dm7, Cmaj7 (two bars each)
    const chords = [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ];
    const melody = [
      76, -1, 74, 72, -1, 69, 72, -1, 74, -1, 72, 71, -1, 67, -1, -1,
      74, -1, 72, 69, -1, 65, 69, -1, 72, -1, 71, 67, -1, 64, -1, -1,
      72, -1, 74, 76, -1, 79, 76, -1, 74, -1, 72, 74, -1, 72, 69, -1,
      71, -1, 72, 74, -1, 71, 67, -1, 64, -1, 67, 71, -1, 72, -1, -1,
    ];
    while (this.musicNextTime < this.ctx.currentTime + 0.3) {
      const s = this.musicStep % 64;
      const when = this.musicNextTime - this.ctx.currentTime;
      const chord = chords[Math.floor(s / 16)];
      if (s % 4 === 0) this.tone(NOTE(chord[0] - 12), stepDur * 1.8, 'triangle', 0.25, when, undefined, this.musicBus);
      if (s % 4 === 2) this.tone(NOTE(chord[0] - 5), stepDur * 1.2, 'triangle', 0.18, when, undefined, this.musicBus);
      if (s % 8 === 2 || s % 8 === 5) {
        for (const n of chord.slice(1)) this.tone(NOTE(n), stepDur * 0.9, 'square', 0.03, when, undefined, this.musicBus);
      }
      const m = melody[s];
      if (m > 0) this.tone(NOTE(m), stepDur * 1.6, 'square', 0.05, when, undefined, this.musicBus);
      this.musicNextTime += stepDur;
      this.musicStep++;
    }
  }
}

export const audio = new Audio();
