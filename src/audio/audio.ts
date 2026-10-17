/**
 * Procedural audio: a generative score per chapter, synthesised SFX and an ambience bed.
 * Everything is original and made at runtime with WebAudio — no samples, no copyrighted music.
 * Independent sliders: master, music, sfx, ambience.
 */
import { CHAPTER_BY_N } from '../content/chapters.ts';
import type { Settings } from '../core/state.ts';

type Mood = 'camp' | 'battle' | 'boss' | 'title';

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; ambBus!: GainNode; reverb!: ConvolverNode; reverbSend!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private vol = { master: 0.8, music: 0.5, sfx: 0.7, ambience: 0.5 };
  private muted = false;
  private chapter = 1;
  private mood: Mood = 'title';
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private drone: { o: OscillatorNode[]; g: GainNode; f: BiquadFilterNode } | null = null;
  private amb: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } | null = null;
  private dripTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSfx: Record<string, number> = {};

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain(); this.ambBus = ctx.createGain();
    this.reverb = ctx.createConvolver(); this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverb.buffer = this.impulse(2.6, 3);
    const rg = ctx.createGain(); rg.gain.value = 0.8;
    this.reverbSend.connect(this.reverb); this.reverb.connect(rg); rg.connect(this.master);
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) { b.connect(this.master); b.connect(this.reverbSend); }
    this.apply();
    return ctx;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx as AudioContext;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf; return buf;
  }

  resume(): void {
    const c = this.ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  configure(s: Pick<Settings, 'master' | 'music' | 'sfx' | 'ambience'>): void {
    this.vol = { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience };
    this.apply();
  }
  setMuted(m: boolean): void { this.muted = m; this.apply(); }
  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.vol.ambience * 0.5, t, 0.05);
  }

  // ------------------------------------------------------------------ music
  playMusic(chapter: number, mood: Mood): void {
    const c = this.ensure(); if (!c) return;
    const changed = chapter !== this.chapter || mood !== this.mood || !this.timer;
    this.chapter = chapter; this.mood = mood;
    if (!changed) return;
    this.startDrone();
    this.startAmbience();
    if (!this.timer) {
      this.nextBeat = c.currentTime + 0.1; this.beat = 0;
      this.timer = setInterval(() => this.schedule(), 100);
    }
  }
  stopMusic(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const c = this.ctx;
    if (c && this.drone) { this.drone.g.gain.setTargetAtTime(0, c.currentTime, 0.3); const d = this.drone; setTimeout(() => d.o.forEach((o) => { try { o.stop(); } catch { /* */ } }), 1500); this.drone = null; }
    if (c && this.amb) { this.amb.g.gain.setTargetAtTime(0, c.currentTime, 0.3); const a = this.amb; setTimeout(() => { try { a.src.stop(); } catch { /* */ } }, 1500); this.amb = null; }
    if (this.dripTimer) { clearTimeout(this.dripTimer); this.dripTimer = null; }
  }

  private startDrone(): void {
    const c = this.ctx as AudioContext;
    const ch = CHAPTER_BY_N(this.chapter).music;
    if (this.drone) { this.drone.g.gain.setTargetAtTime(0, c.currentTime, 0.4); const d = this.drone; setTimeout(() => d.o.forEach((o) => { try { o.stop(); } catch { /* */ } }), 2500); }
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(this.mood === 'title' ? 0.5 : 0.35, c.currentTime, 0.8);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.mood === 'boss' ? 900 : this.mood === 'battle' ? 650 : 420; f.Q.value = 2;
    const base = ch.root / 2;
    const oscs: OscillatorNode[] = [];
    [[1, -6], [1, 6], [1.5, 0], [2, 3]].forEach(([mul, det], i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : (ch.tone as OscillatorType); o.frequency.value = base * mul; o.detune.value = det;
      const og = c.createGain(); og.gain.value = i === 2 ? 0.25 : i === 3 ? 0.12 : 0.3;
      o.connect(og); og.connect(f); o.start(); oscs.push(o);
    });
    // slow filter movement
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); oscs.push(lfo);
    f.connect(g); g.connect(this.musicBus);
    this.drone = { o: oscs, g, f };
  }

  private startAmbience(): void {
    const c = this.ctx as AudioContext;
    if (this.amb) { this.amb.g.gain.setTargetAtTime(0, c.currentTime, 0.4); const a = this.amb; setTimeout(() => { try { a.src.stop(); } catch { /* */ } }, 2500); }
    const theme = CHAPTER_BY_N(this.chapter).theme;
    const src = c.createBufferSource(); src.buffer = this.noise(); src.loop = true;
    const f = c.createBiquadFilter(); f.type = theme === 'forge' || theme === 'flame' || theme === 'bridge' ? 'lowpass' : 'bandpass';
    f.frequency.value = theme === 'flooded' ? 500 : theme === 'forge' || theme === 'flame' ? 200 : theme === 'chasm' ? 260 : 360; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(theme === 'flame' || theme === 'bridge' ? 0.5 : 0.3, c.currentTime, 1.2);
    src.connect(f); f.connect(g); g.connect(this.ambBus); src.start();
    this.amb = { src, g, f };
    if (this.dripTimer) clearTimeout(this.dripTimer);
    const drip = () => {
      if (!this.ctx || !this.amb) return;
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'sine';
      const og = this.ctx.createGain();
      const fr = theme === 'flooded' ? 900 + Math.random() * 500 : 1200 + Math.random() * 600;
      o.frequency.setValueAtTime(fr, now); o.frequency.exponentialRampToValueAtTime(fr * 0.5, now + 0.12);
      og.gain.setValueAtTime(0.0001, now); og.gain.exponentialRampToValueAtTime(0.1, now + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      o.connect(og); og.connect(this.ambBus); o.start(now); o.stop(now + 0.3);
      this.dripTimer = setTimeout(drip, (theme === 'flooded' ? 800 : 2500) + Math.random() * 4000);
    };
    this.dripTimer = setTimeout(drip, 1500);
  }

  private schedule(): void {
    const c = this.ctx; if (!c) return;
    const ch = CHAPTER_BY_N(this.chapter).music;
    const tempo = ch.tempo * (this.mood === 'boss' ? 1.5 : this.mood === 'battle' ? 1.25 : 1);
    const spb = 60 / tempo;
    while (this.nextBeat < c.currentTime + 0.4) {
      const t = this.nextBeat;
      const b = this.beat;
      // melody: sparse pentatonic-ish steps on the chapter's mode
      const prob = this.mood === 'title' ? 0.4 : this.mood === 'camp' ? 0.32 : 0.5;
      if (b % 2 === 0 && Math.random() < prob) {
        const deg = ch.mode[Math.floor(Math.random() * ch.mode.length)];
        const oct = Math.random() < 0.3 ? 2 : 1;
        this.pluck(ch.root * Math.pow(2, deg / 12) * oct, t, spb * 2.4, this.mood === 'camp' || this.mood === 'title' ? 0.16 : 0.12, ch.tone === 'sawtooth' ? 'triangle' : 'sine');
      }
      // slow bass movement every 8 beats
      if (b % 8 === 0) { const deg = ch.mode[Math.floor((b / 8) % ch.mode.length)]; this.pluck(ch.root / 2 * Math.pow(2, deg / 12), t, spb * 6, 0.18, 'triangle'); }
      // war drums in fights
      if (this.mood !== 'camp' && this.mood !== 'title') {
        if (b % 4 === 0) this.drum(t, 0.5, 70);
        if (this.mood === 'boss' && (b % 4 === 2 || b % 8 === 7)) this.drum(t, 0.35, 90);
        if (b % 2 === 1 && this.mood === 'battle') this.hat(t, 0.05);
      }
      this.nextBeat += spb / 2; this.beat++;
    }
  }

  private pluck(freq: number, t: number, dur: number, vol: number, type: OscillatorType): void {
    const c = this.ctx as AudioContext;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  private drum(t: number, vol: number, freq: number): void {
    const c = this.ctx as AudioContext;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.8, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.55);
  }
  private hat(t: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const s = c.createBufferSource(); s.buffer = this.noise();
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
  }

  // ------------------------------------------------------------------ sfx primitives
  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.lastSfx[key] ?? 0) < ms) return false;
    this.lastSfx[key] = now; return true;
  }
  tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0): void {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.03);
  }
  burst(dur: number, filter: BiquadFilterType, freq: number, vol = 0.25, q = 1, delay = 0, sweepTo?: number): void {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise();
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }
}

const A = new AudioEngine();
export const audio = A;

export const sfx = {
  resume: () => A.resume(),
  configure: (s: Settings) => A.configure(s),
  click: () => { if (!A.ctx) return; A.tone(520, 0.05, 'triangle', 0.08); },
  confirm: () => { A.tone(440, 0.08, 'triangle', 0.12); A.tone(660, 0.12, 'triangle', 0.12, undefined, 0.07); },
  error: () => { A.tone(180, 0.18, 'sawtooth', 0.12, 120); },
  coin: () => { A.tone(1200, 0.06, 'square', 0.06); A.tone(1800, 0.12, 'square', 0.06, undefined, 0.05); },
  levelUp: () => { [523, 659, 784, 1047].forEach((f, i) => A.tone(f, 0.25, 'triangle', 0.16, undefined, i * 0.08)); },
  loot: (rar = 0) => { A.tone(700 + rar * 120, 0.1, 'triangle', 0.1); A.tone(1050 + rar * 160, 0.18, 'triangle', 0.1, undefined, 0.06); },
  hit: (magic = false) => { if (!A['throttle']('hit', 40)) return; if (magic) { A.burst(0.18, 'bandpass', 2400, 0.12, 4); A.tone(300, 0.14, 'sine', 0.12, 120); } else { A.burst(0.12, 'lowpass', 1400, 0.3); A.tone(120, 0.1, 'sine', 0.22, 60); } },
  crit: () => { A.burst(0.2, 'lowpass', 2000, 0.35); A.tone(90, 0.2, 'sine', 0.3, 40); A.tone(1500, 0.25, 'triangle', 0.1, 900, 0.02); },
  dot: () => { if (!A['throttle']('dot', 80)) return; A.tone(200, 0.12, 'sawtooth', 0.05, 120); },
  miss: () => { A.burst(0.16, 'bandpass', 900, 0.1, 1, 0, 2400); },
  heal: () => { if (!A['throttle']('heal', 60)) return; [660, 880, 1320].forEach((f, i) => A.tone(f, 0.22, 'sine', 0.08, undefined, i * 0.05)); },
  shield: () => { A.tone(900, 0.3, 'triangle', 0.08, 1400); A.burst(0.25, 'highpass', 4000, 0.05); },
  death: () => { A.burst(0.35, 'lowpass', 600, 0.25, 1, 0, 120); A.tone(160, 0.4, 'sawtooth', 0.12, 50); },
  phase: () => { A.tone(80, 1.2, 'sawtooth', 0.22, 55); A.tone(160, 1.1, 'square', 0.08, 110); A.burst(0.8, 'lowpass', 400, 0.2); },
  combo: () => { [440, 554, 659, 880].forEach((f, i) => A.tone(f, 0.28, 'triangle', 0.12, undefined, i * 0.06)); },
  hazard: () => { A.burst(0.6, 'lowpass', 300, 0.4, 1, 0, 80); A.tone(60, 0.6, 'sine', 0.3, 40); },
  battleStart: () => { A.tone(70, 0.3, 'sine', 0.3, 50); A.tone(70, 0.3, 'sine', 0.3, 50); setTimeout(() => A.tone(70, 0.4, 'sine', 0.35, 45), 220); },
  victory: () => { [392, 523, 659, 784, 1047].forEach((f, i) => A.tone(f, 0.45, 'triangle', 0.16, undefined, i * 0.11)); },
  defeat: () => { [392, 311, 262, 196].forEach((f, i) => A.tone(f, 0.55, 'sawtooth', 0.09, undefined, i * 0.18)); },
  skill: (fx: string) => {
    if (!A['throttle']('skill', 50)) return;
    switch (fx) {
      case 'arrow': case 'volley': case 'pierce': A.burst(0.14, 'bandpass', 3000, 0.1, 2, 0, 1200); break;
      case 'fire': A.burst(0.35, 'lowpass', 1500, 0.2, 1, 0, 400); break;
      case 'light': A.tone(900, 0.35, 'sine', 0.1, 1500); break;
      case 'heal': break;
      case 'horn': A.tone(220, 0.5, 'sawtooth', 0.13); A.tone(330, 0.5, 'sawtooth', 0.08); break;
      case 'drum': A.tone(80, 0.25, 'sine', 0.3, 50); break;
      case 'shadow': case 'curse': A.tone(140, 0.4, 'sawtooth', 0.08, 70); break;
      case 'poison': A.burst(0.25, 'bandpass', 700, 0.12, 3); break;
      case 'water': case 'wave': A.burst(0.4, 'bandpass', 500, 0.14, 1, 0, 1200); break;
      case 'smash': case 'slam': A.tone(60, 0.3, 'sine', 0.3, 35); A.burst(0.2, 'lowpass', 500, 0.3); break;
      default: A.burst(0.1, 'bandpass', 1800, 0.12, 2, 0, 700); break;
    }
  },
};
