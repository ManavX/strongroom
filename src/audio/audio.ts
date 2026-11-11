/**
 * Sound design. Every sound is synthesised with the Web Audio API at runtime,
 * so there are no audio files to load and nothing to license.
 * The context is created on the first user gesture (browser autoplay rules).
 */

type Report = 'rifle' | 'heavy' | 'pistol' | 'magnum' | 'smg' | 'shotgun' | 'blade';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private noise!: AudioBuffer;
  private volume = 0.7;
  private muted = false;
  private humGain: GainNode | null = null;
  private lastTick = 0;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    // synthetic room: decaying filtered noise as the impulse response
    const len = Math.floor(ctx.sampleRate * 2.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.5 - t * 0.38);
        d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.5;
    this.wet.connect(conv).connect(this.master);
    // shared white noise
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    this.startHum();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  private applyGain() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }

  /* ---------------- building blocks ---------------- */

  private out(gain: number, reverb = 0): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.dry);
    if (reverb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.wet);
    }
    return g;
  }

  /** A tone with an exponential decay envelope and optional pitch glide. */
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, at = 0, reverb = 0, attack = 0.002) {
    const ctx = this.ctx;
    const dest = this.out(1, reverb);
    if (!ctx || !dest) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Filtered noise burst with an optional filter sweep. */
  private hiss(type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, gain: number, at = 0, reverb = 0, attack = 0.002) {
    const ctx = this.ctx;
    const dest = this.out(1, reverb);
    if (!ctx || !dest) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private startHum() {
    const ctx = this.ctx;
    if (!ctx || this.humGain) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 2.5);
    g.connect(this.master);
    this.humGain = g;
    for (const [f, a] of [
      [54, 0.5],
      [81.2, 0.18],
      [108.5, 0.1],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start();
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    src.connect(lp).connect(ng).connect(g);
    src.start();
  }

  /* ---------------- interface sounds ---------------- */

  hover() {
    this.tone('sine', 2100, 1700, 0.035, 0.018);
  }

  click() {
    this.tone('sine', 190, 95, 0.07, 0.22);
    this.hiss('highpass', 3200, 3200, 0.7, 0.018, 0.07);
  }

  select() {
    this.tone('triangle', 720, 1080, 0.07, 0.07);
  }

  error() {
    this.tone('square', 120, 96, 0.14, 0.07);
    this.tone('square', 90, 72, 0.16, 0.06, 0.07);
  }

  /** Credits arriving. */
  coin(big = false) {
    const notes = big ? [1318.5, 1568, 1975.5, 2637] : [1568, 2093];
    notes.forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.07, i * 0.055, 0.25));
    this.hiss('bandpass', 6500, 6500, 2, 0.05, 0.03);
  }

  /** Reel passing one card under the marker. `bright` lifts the pitch for rarer cards. */
  tick(bright = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    // never stack ticks closer than 12 ms: at full reel speed that only adds noise
    if (ctx.currentTime - this.lastTick < 0.012) return;
    this.lastTick = ctx.currentTime;
    const f = 820 + bright * 190;
    this.tone('triangle', f * 1.5, f, 0.045, 0.1);
    this.hiss('bandpass', 2600 + bright * 500, 2600, 3, 0.02, 0.09);
  }

  /* ---------------- case sounds ---------------- */

  whoosh(k = 1) {
    this.hiss('bandpass', 260, 2200, 0.9, 0.2, 0.1 * k, 0, 0.3, 0.06);
    this.hiss('bandpass', 2200, 420, 0.9, 0.24, 0.07 * k, 0.16, 0.3, 0.02);
  }

  latch() {
    this.hiss('highpass', 2400, 2400, 0.7, 0.03, 0.3, 0, 0.25);
    this.tone('square', 1320, 1180, 0.07, 0.035, 0, 0.3);
    this.tone('sine', 2860, 2700, 0.11, 0.04, 0, 0.35);
    this.tone('sine', 150, 70, 0.08, 0.3);
  }

  lid(k = 1) {
    this.hiss('bandpass', 320, 980, 2.2, 0.36, 0.11 * k, 0, 0.35, 0.05);
    this.tone('sine', 96, 52, 0.22, 0.26 * k, 0.02, 0.2);
    this.tone('sawtooth', 210, 330, 0.3, 0.012 * k, 0, 0.4, 0.08);
  }

  /** Pressure building before a relic reveal. */
  charge() {
    const dur = 1.35;
    this.hiss('highpass', 300, 6000, 0.8, dur, 0.16, 0, 0.4, dur * 0.9);
    this.tone('sawtooth', 55, 220, dur, 0.09, 0, 0.3, dur * 0.85);
    this.tone('sine', 110, 440, dur, 0.1, 0, 0.3, dur * 0.85);
    this.tone('sine', 164.8, 659.3, dur, 0.06, 0, 0.3, dur * 0.85);
  }

  /** The drop. Tier 0 is a modest chime; tier 4 is the full fanfare. */
  reveal(tier: number) {
    // impact
    this.tone('sine', 78 + tier * 6, 30, 0.5 + tier * 0.12, 0.5 + tier * 0.07, 0, 0.3);
    this.hiss('lowpass', 2400 + tier * 900, 300, 0.7, 0.3 + tier * 0.08, 0.2 + tier * 0.03, 0, 0.5);
    this.hiss('highpass', 5000, 9000, 0.7, 0.5 + tier * 0.25, 0.03 + tier * 0.012, 0, 0.7, 0.01);
    // harmony: each tier adds notes and sustain
    const root = [261.63, 293.66, 329.63, 349.23, 293.66][tier];
    const chords = [
      [1, 1.5],
      [1, 1.5, 2],
      [1, 1.25, 1.5, 2],
      [1, 1.25, 1.5, 1.875, 2.5],
      [0.5, 1, 1.25, 1.5, 2, 2.5, 3],
    ][tier];
    const sustain = 0.5 + tier * 0.45;
    chords.forEach((r, i) => {
      this.tone('triangle', root * r, root * r, sustain, 0.075, 0.02 + i * 0.012, 0.6, 0.01);
      this.tone('sine', root * r * 2, root * r * 2, sustain * 0.8, 0.03, 0.03 + i * 0.012, 0.7, 0.01);
    });
    if (tier >= 2) {
      // rising sparkle
      const arp = [2, 2.5, 3, 4, 5, 6, 8].slice(0, 3 + tier);
      arp.forEach((r, i) => this.tone('sine', root * r, root * r, 0.5 + tier * 0.1, 0.045, 0.12 + i * (0.075 - tier * 0.006), 0.8));
    }
    if (tier >= 4) {
      // bell cluster and a second swell for relics
      [3, 4, 5, 6, 7.5, 8, 10].forEach((r, i) => this.tone('sine', root * r, root * r * 1.002, 1.8, 0.035, 0.5 + i * 0.07, 0.9));
      this.tone('sawtooth', root * 0.5, root * 0.5, 1.6, 0.03, 0.05, 0.6, 0.3);
      this.hiss('bandpass', 1800, 7000, 1.2, 1.4, 0.05, 0.1, 0.8, 0.5);
    }
  }

  contract() {
    this.tone('sine', 120, 38, 0.5, 0.5, 0, 0.3);
    this.hiss('lowpass', 1800, 200, 0.7, 0.4, 0.22, 0, 0.4);
    this.hiss('highpass', 3000, 7000, 0.7, 0.7, 0.05, 0.1, 0.6, 0.1);
  }

  /* ---------------- test fire ---------------- */

  fire(kind: Report) {
    if (kind === 'blade') {
      this.hiss('bandpass', 700, 3400, 1.4, 0.26, 0.16, 0, 0.3, 0.09);
      this.hiss('bandpass', 3400, 900, 1.4, 0.3, 0.12, 0.26, 0.3, 0.03);
      this.tone('sine', 3350, 3300, 0.7, 0.025, 0.42, 0.7);
      this.tone('sine', 5120, 5080, 0.5, 0.012, 0.42, 0.7);
      return;
    }
    const p = {
      rifle: { body: 0.2, cut: 3400, low: 130, lowDur: 0.2, gain: 0.55, tail: 0.5 },
      heavy: { body: 0.42, cut: 2200, low: 95, lowDur: 0.42, gain: 0.7, tail: 0.9 },
      pistol: { body: 0.13, cut: 4200, low: 170, lowDur: 0.12, gain: 0.45, tail: 0.35 },
      magnum: { body: 0.24, cut: 2900, low: 120, lowDur: 0.26, gain: 0.62, tail: 0.6 },
      smg: { body: 0.1, cut: 5200, low: 190, lowDur: 0.09, gain: 0.4, tail: 0.28 },
      shotgun: { body: 0.34, cut: 1900, low: 85, lowDur: 0.36, gain: 0.72, tail: 0.8 },
    }[kind];
    this.hiss('highpass', 4200, 4200, 0.7, 0.012, p.gain * 0.9); // crack
    this.hiss('lowpass', p.cut, 240, 0.8, p.body, p.gain, 0, 0.45); // body
    this.tone('sine', p.low, 34, p.lowDur, p.gain * 0.95, 0, 0.2); // thump
    this.hiss('bandpass', 900, 300, 0.6, p.tail, p.gain * 0.14, 0.03, 0.9); // tail
    // action cycling
    if (kind === 'shotgun') {
      this.hiss('bandpass', 1500, 900, 2.5, 0.07, 0.16, 0.36);
      this.tone('square', 760, 610, 0.05, 0.035, 0.37);
      this.hiss('bandpass', 1100, 1900, 2.5, 0.07, 0.16, 0.52);
      this.tone('square', 900, 1050, 0.05, 0.035, 0.53);
    } else if (kind === 'heavy') {
      this.hiss('bandpass', 2000, 1200, 3, 0.05, 0.12, 0.45);
      this.tone('square', 980, 760, 0.04, 0.03, 0.46);
      this.hiss('bandpass', 1300, 2300, 3, 0.05, 0.12, 0.66);
    } else {
      this.tone('square', 1500, 1100, 0.03, 0.022, 0.06);
    }
  }
}

export const audio = new AudioEngine();
