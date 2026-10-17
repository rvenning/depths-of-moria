/**
 * Audio: a sampled orchestral score per chapter and mood (rendered offline from the same composer through the MuseScore General
 * soundfont; see tools/music and docs/RIGHTS.md), with the runtime synth as the fallback, plus synthesised SFX and an ambience bed.
 * Independent sliders: master, music, sfx, ambience.
 */
import { CHAPTER_BY_N } from '../content/chapters.ts';
import type { Settings } from '../core/state.ts';
import { compose, type Score, type ScoreNote } from './score.ts';

type Mood = 'camp' | 'battle' | 'boss' | 'title';

interface TrackInfo { file: string; sampleRate: number; preroll: number; length: number }
interface MusicManifest { encoderDelay: number; [key: string]: TrackInfo | number }

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; ambBus!: GainNode; reverb!: ConvolverNode; reverbSend!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private vol = { master: 0.8, music: 0.5, sfx: 0.7, ambience: 0.5 };
  private muted = false;
  private chapter = 1;
  private mood: Mood = 'title';
  private timer: ReturnType<typeof setInterval> | null = null;
  private drone: { o: OscillatorNode[]; g: GainNode; f: BiquadFilterNode } | null = null;
  private amb: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } | null = null;
  private dripTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSfx: Record<string, number> = {};
  private sampledOn = true;
  private manifest: Promise<MusicManifest | null> | null = null;
  private tracks = new Map<string, Promise<{ buf: AudioBuffer; info: TrackInfo; delay: number } | null>>();
  private sampled: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private playToken = 0;

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
  /** use the sampled orchestral tracks (default) or only the synth */
  setSampled(on: boolean): void {
    if (on === this.sampledOn) return;
    this.sampledOn = on;
    if (this.ctx && this.active) { const c = this.chapter, m = this.mood; this.mood = '' as Mood; this.playMusic(c, m); }
  }
  setMuted(m: boolean): void { this.muted = m; this.apply(); }
  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.75, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.vol.ambience * 0.5, t, 0.05);
  }

  // ------------------------------------------------------------------ music
  playMusic(chapter: number, mood: Mood): void {
    const c = this.ensure(); if (!c) return;
    const changed = chapter !== this.chapter || mood !== this.mood || !this.active;
    this.chapter = chapter; this.mood = mood;
    if (!changed) return;
    this.active = true;
    const token = ++this.playToken;
    this.startAmbience();
    this.halt(false);
    if (!this.sampledOn) { this.startSynth(); return; }
    void this.loadTrack(chapter, mood).then((t) => {
      if (token !== this.playToken) return;                      // the screen moved on while it loaded
      if (t && this.startSampled(t)) return;
      this.startSynth();
    });
  }
  stopMusic(): void {
    this.active = false; this.playToken++;
    this.halt(true);
    const c = this.ctx;
    if (c && this.amb) { this.amb.g.gain.setTargetAtTime(0, c.currentTime, 0.3); const a = this.amb; setTimeout(() => { try { a.src.stop(); } catch { /* */ } }, 1500); this.amb = null; }
    if (this.dripTimer) { clearTimeout(this.dripTimer); this.dripTimer = null; }
  }
  private active = false;

  /** fade out whatever music is playing (the sampled track and the synth) */
  private halt(_final: boolean): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const c = this.ctx; if (!c) return;
    if (this.drone) { this.drone.g.gain.setTargetAtTime(0, c.currentTime, 0.3); const d = this.drone; setTimeout(() => d.o.forEach((o) => { try { o.stop(); } catch { /* */ } }), 1500); this.drone = null; }
    if (this.sampled) { const s = this.sampled; s.g.gain.setTargetAtTime(0, c.currentTime, 0.25); setTimeout(() => { try { s.src.stop(); } catch { /* */ } }, 1500); this.sampled = null; }
  }
  private startSynth(): void {
    const c = this.ctx; if (!c) return;
    this.startDrone();
    this.scoreKey = '';
    this.nextStep = c.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 100);
  }

  private loadTrack(chapter: number, mood: Mood): Promise<{ buf: AudioBuffer; info: TrackInfo; delay: number } | null> {
    const key = `${chapter}:${mood}`;
    let p = this.tracks.get(key);
    if (!p) {
      const base = (import.meta.env?.BASE_URL ?? '/') + 'music/';
      this.manifest ??= fetch(base + 'manifest.json').then((r) => (r.ok ? (r.json() as Promise<MusicManifest>) : null)).catch(() => null);
      p = this.manifest.then(async (m) => {
        const info = m?.[key] as TrackInfo | undefined; if (!m || !info || !this.ctx) return null;
        const res = await fetch(base + info.file); if (!res.ok) return null;
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        return { buf, info, delay: m.encoderDelay };
      }).catch(() => null);
      this.tracks.set(key, p);
    }
    return p;
  }
  /** loop the body of the track gaplessly (the file carries a pre-roll and the encoder's delay, which the loop points skip) */
  private startSampled(t: { buf: AudioBuffer; info: TrackInfo; delay: number }): boolean {
    const c = this.ctx; if (!c) return false;
    const rate = t.buf.sampleRate, start = (t.info.preroll + t.delay) / rate, end = start + t.info.length / rate;
    if (!(end <= t.buf.duration + 0.05)) return false;           // the decoder gave something unexpected: use the synth
    const src = c.createBufferSource(); src.buffer = t.buf; src.loop = true; src.loopStart = start; src.loopEnd = Math.min(end, t.buf.duration);
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, c.currentTime, 0.2);
    src.connect(g); g.connect(this.musicBus); src.start(0, start);
    this.sampled = { src, g };
    return true;
  }

  private startDrone(): void {
    const c = this.ctx as AudioContext;
    const ch = CHAPTER_BY_N(this.chapter).music;
    if (this.drone) { this.drone.g.gain.setTargetAtTime(0, c.currentTime, 0.4); const d = this.drone; setTimeout(() => d.o.forEach((o) => { try { o.stop(); } catch { /* */ } }), 2500); }
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(this.mood === 'title' ? 0.3 : 0.2, c.currentTime, 0.8);
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

  private score: Score | null = null;
  private scoreKey = '';
  private step = 0;
  private nextStep = 0;
  private byStep: { lead: Map<number, ScoreNote>; arp: Map<number, ScoreNote>; bass: Map<number, ScoreNote> } | null = null;

  private loadScore(): void {
    const key = `${this.chapter}:${this.mood}`;
    if (key === this.scoreKey && this.score) return;
    const m = CHAPTER_BY_N(this.chapter).music;
    this.score = compose(m.mode, this.mood, this.chapter);
    const idx = (a: ScoreNote[]): Map<number, ScoreNote> => new Map(a.map((n) => [n.step, n]));
    this.byStep = { lead: idx(this.score.lead), arp: idx(this.score.arp), bass: idx(this.score.bass) };
    this.scoreKey = key; this.step = 0;
  }

  /** a sixteenth-note sequencer: reads the composed score and plays each part on its own instrument */
  private schedule(): void {
    const c = this.ctx; if (!c) return;
    this.loadScore();
    const sc = this.score as Score, by = this.byStep as NonNullable<typeof this.byStep>;
    const ch = CHAPTER_BY_N(this.chapter).music;
    const tempo = ch.tempo * (this.mood === 'boss' ? 1.45 : this.mood === 'battle' ? 1.2 : this.mood === 'title' ? 0.9 : 1);
    const sd = 60 / tempo / 4;                         // seconds per sixteenth
    const fq = (semis: number, oct: number): number => ch.root * Math.pow(2, (semis + 12 * oct) / 12);
    const fight = this.mood === 'battle' || this.mood === 'boss';
    const total = sc.bars * 16;
    if (this.nextStep < c.currentTime - 1) this.nextStep = c.currentTime + 0.05;
    while (this.nextStep < c.currentTime + 0.4) {
      const t = this.nextStep, s = this.step % total, inBar = s % 16, bar = Math.floor(s / 16);
      const chord = sc.chords[bar];
      // strings under everything, one chord a bar (a choir "ah" joins for a boss)
      if (inBar === 0) {
        for (const semis of chord) this.pad(fq(semis, 1), t, sd * 16, this.mood === 'camp' ? 0.032 : 0.04);
        if (this.mood === 'boss') for (const semis of chord) this.choir(fq(semis, 1), t, sd * 16, 0.03);
        if (this.mood === 'boss' || (this.mood === 'title' && bar % 4 === 0)) this.brass(chord.map((x) => fq(x, 1)), t, sd * 3, this.mood === 'boss' ? 0.07 : 0.05);
      }
      const bn = by.bass.get(s); if (bn) this.bassNote(fq(bn.semis, 1), t, bn.dur * sd, 0.2 * bn.vel * (fight ? 1.05 : 0.9));
      const an = by.arp.get(s); if (an) this.harp(fq(an.semis, 1), t, an.dur * sd, (fight ? 0.07 : this.mood === 'camp' ? 0.1 : 0.085) * an.vel);
      const ln = by.lead.get(s); if (ln) this.lead(fq(ln.semis, 1), t, ln.dur * sd, (fight ? 0.1 : 0.115) * ln.vel);
      // percussion
      if (this.mood === 'title' && inBar === 0 && bar % 2 === 0) this.drum(t, 0.3, 60);
      if (fight) {
        const boss = this.mood === 'boss';
        if (inBar === 0 || inBar === 8 || (boss && (inBar === 3 || inBar === 6 || inBar === 11 || inBar === 14))) this.drum(t, boss ? 0.55 : 0.45, 62);
        if (inBar === 4 || inBar === 12) this.snare(t, boss ? 0.2 : 0.14);
        if (inBar % 2 === 0) this.hat(t, boss ? 0.045 : 0.035);
        if (boss && inBar === 0 && bar % 2 === 1) this.hit(t);
      }
      this.nextStep += sd; this.step++;
    }
  }

  /** route a voice to the music bus, placed left/right so the parts sit apart like an ensemble */
  private to(g: AudioNode, pan: number): void {
    const c = this.ctx as AudioContext;
    if (typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.musicBus); } else g.connect(this.musicBus);
  }

  // ---- instruments (all through the music bus)
  private env(g: GainNode, t: number, a: number, peak: number, hold: number, rel: number): void {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  /** warm string pad: two detuned saws and a triangle through a gentle low-pass, slow swell */
  private pad(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(600, t + dur); f.Q.value = 0.4;
    const g = c.createGain(); this.env(g, t, Math.min(0.7, dur * 0.35), vol, Math.max(0.05, dur - 1.5), 0.9);
    for (const [type, det] of [['sawtooth', -8], ['sawtooth', 8], ['triangle', 0]] as [OscillatorType, number][]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 1.1);
    }
    f.connect(g); this.to(g, Math.sin(freq * 0.37) * 0.7);
  }
  /** a sung "ah" for boss fights: a saw through two vowel-ish band-passes */
  private choir(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const g = c.createGain(); this.env(g, t, 0.5, vol, Math.max(0.05, dur - 1.2), 0.8);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq / 2;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.2; const lg = c.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune);
    for (const [fr, q] of [[700, 6], [1150, 8]] as [number, number][]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; o.connect(b); b.connect(g); }
    o.start(t); lfo.start(t); o.stop(t + dur + 1); lfo.stop(t + dur + 1); this.to(g, Math.sin(freq * 0.61) * 0.55);
  }
  private brass(freqs: number[], t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.09); f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = c.createGain(); this.env(g, t, 0.025, vol, dur * 0.4, dur * 0.8);
    for (const fr of freqs) for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur * 1.4 + 0.1); }
    f.connect(g); this.to(g, Math.sin(freqs[0] * 0.2) * 0.4);
  }
  private bassNote(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const g = c.createGain(); this.env(g, t, 0.015, vol, Math.max(0.02, dur * 0.5), Math.max(0.12, dur * 0.7));
    for (const [type, mul, v] of [['sine', 1, 1], ['triangle', 2, 0.25]] as [OscillatorType, number, number][]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq * mul; const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur * 1.3 + 0.2);
    }
    g.connect(this.musicBus);
  }
  /** a harp-like pluck: bright attack, long ringing tail */
  private harp(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.9);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.9, dur + 0.7));
    for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]] as [OscillatorType, number, number][]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq * mul; const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 1.2);
    }
    f.connect(g); this.to(g, -0.35 + ((Math.log2(freq / 220) * 0.5) % 1) * 0.7);
  }
  /** a flute-like lead: breathy attack, gentle vibrato that blooms after a moment */
  private lead(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const g = c.createGain(); this.env(g, t, 0.05, vol, Math.max(0.02, dur - 0.18), 0.22);
    const vib = c.createOscillator(); vib.frequency.value = 5.1; const vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + Math.min(0.45, dur)); vib.connect(vg);
    for (const [type, mul, v] of [['sine', 1, 1], ['triangle', 2, 0.18], ['sine', 3, 0.06]] as [OscillatorType, number, number][]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq * mul; const og = c.createGain(); og.gain.value = v; vg.connect(o.detune); o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.4);
    }
    vib.start(t); vib.stop(t + dur + 0.4);
    const n = c.createBufferSource(); n.buffer = this.noise(); const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 2.5; nf.Q.value = 2;
    const ng = c.createGain(); ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(nf); nf.connect(ng); this.to(ng, 0.2); n.start(t, Math.random()); n.stop(t + 0.1);
    this.to(g, 0.2);
  }
  private snare(t: number, vol: number): void {
    const c = this.ctx as AudioContext;
    const s = c.createBufferSource(); s.buffer = this.noise(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t, Math.random()); s.stop(t + 0.18);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.09);
    const og = c.createGain(); og.gain.setValueAtTime(vol * 0.6, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(this.musicBus); o.start(t); o.stop(t + 0.12);
  }
  /** an orchestral hit for boss bars: a drum thud with a bright burst on top */
  private hit(t: number): void {
    this.drum(t, 0.7, 52);
    const c = this.ctx as AudioContext;
    const s = c.createBufferSource(); s.buffer = this.noise(); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t, Math.random()); s.stop(t + 0.45);
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
  /** the soft blip of text being typed in a cutscene */
  tick: () => { if (!A.ctx) return; A.tone(880 + Math.random() * 140, 0.02, 'square', 0.022); },
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
