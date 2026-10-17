/* Renders the game's composed score through the MuseScore General sample library into compressed, loopable audio.
 *   node tools/music/render-music.ts [chapter ...]        (default: all ten chapters)
 * Pipeline per track: compose() -> orchestrate for GM instruments -> Standard MIDI File -> spessasynth (offline) -> hall reverb
 * -> loudness-match to TRACK_LUFS -> soft limiter -> MP3 with a pre-roll so the loop point is gapless (see manifest.json).
 * Output: public/music/c<chapter>-<mood>.mp3 + public/music/manifest.json */
import fs from 'node:fs';
import path from 'node:path';
import { BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer } from 'spessasynth_core';
import { Mp3Encoder } from '@breezystack/lamejs';
import { CHAPTERS } from '../../src/content/chapters.ts';
import { compose, type Score, type ScoreMood } from '../../src/audio/score.ts';

const SR = 44100;
const PPQ = 480;
const TRACK_LUFS = -17;
const PREROLL = 4608;                 // samples of the loop's own tail placed before it, so the MP3 encoder delay never makes a gap
const OUT = path.resolve('public/music');
const SF = path.resolve('node_modules/@librescore/sf3/MuseScore_General_Lite.sf3.wasm');
const MOODS: ScoreMood[] = ['title', 'camp', 'battle', 'boss'];
const MOOD_TEMPO: Record<ScoreMood, number> = { title: 0.9, camp: 1, battle: 1.2, boss: 1.45 };
const BARS: Record<ScoreMood, number> = { title: 16, camp: 16, battle: 8, boss: 8 };

// ------------------------------------------------------------------ a tiny Standard MIDI File writer
interface Ev { tick: number; kind: 'on' | 'off' | 'prog' | 'cc'; ch: number; a: number; b: number }
function vlq(n: number): number[] { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; }
export function smf(events: Ev[], bpm: number): Uint8Array {
  const order = { prog: 0, cc: 1, off: 2, on: 3 };
  const evs = [...events].sort((x, y) => x.tick - y.tick || order[x.kind] - order[y.kind]);
  const body: number[] = [0, 0xff, 0x51, 3, ...[(60e6 / bpm) >> 16 & 255, (60e6 / bpm) >> 8 & 255, (60e6 / bpm) & 255].map((v) => Math.round(v)), 0, 0xff, 0x58, 4, 4, 2, 24, 8];
  let last = 0;
  for (const e of evs) {
    body.push(...vlq(e.tick - last)); last = e.tick;
    if (e.kind === 'on') body.push(0x90 | e.ch, e.a, e.b); else if (e.kind === 'off') body.push(0x80 | e.ch, e.a, 0);
    else if (e.kind === 'prog') body.push(0xc0 | e.ch, e.a); else body.push(0xb0 | e.ch, e.a, e.b);
  }
  body.push(0, 0xff, 0x2f, 0);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, (body.length >> 24) & 255, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255];
  return Uint8Array.from([...head, ...body]);
}

// ------------------------------------------------------------------ orchestration
const hash = (a: number, b: number): number => { let h = (a * 374761393 + b * 668265263) | 0; h = ((h ^ (h >>> 13)) * 1274126177) | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CH = { str: 0, cello: 1, harp: 2, leadA: 3, leadB: 4, choir: 5, brass: 6, timp: 7, aux: 8, drums: 9 };
const PROG: Record<ScoreMood, Partial<Record<keyof typeof CH, number>>> = {
  title: { str: 48, cello: 42, harp: 46, leadA: 73, leadB: 68, choir: 52, brass: 60, timp: 47, aux: 40 },
  camp: { str: 48, cello: 42, harp: 46, leadA: 73, leadB: 71, aux: 45 },
  battle: { str: 49, cello: 43, harp: 46, leadA: 60, leadB: 40, brass: 61, timp: 47, aux: 45 },
  boss: { str: 44, cello: 43, harp: 46, leadA: 56, leadB: 40, choir: 52, brass: 61, timp: 47, aux: 58 },
};

export function orchestrate(score: Score, mood: ScoreMood, rootMidi: number, bars: number): Ev[] {
  const ev: Ev[] = [];
  const T = (step: number): number => step * (PPQ / 4);
  const put = (ch: number, step: number, note: number, dur: number, vel: number, jitter = 0, seed = 0, legato = 0.96): void => {
    const n = Math.max(0, Math.min(127, Math.round(note)));
    const j = jitter ? Math.round((hash(step, seed) - 0.5) * 2 * jitter) : 0;
    const on = Math.max(0, T(step) + j), off = Math.max(on + 6, T(step + dur) + j - Math.round(PPQ / 32) * (1 - legato) * 8);
    const v = Math.max(20, Math.min(127, Math.round(vel * (0.94 + hash(step, seed + n) * 0.12))));
    ev.push({ tick: on, kind: 'on', ch, a: n, b: v }, { tick: off, kind: 'off', ch, a: n, b: 0 });
  };
  const fast = mood === 'battle' || mood === 'boss', total = bars * 16, sc = score.bars * 16;
  // programs and mix
  const mix: Record<keyof typeof CH, [number, number]> = { str: [92, 64], cello: [100, 52], harp: [92, 80], leadA: [105, 76], leadB: [92, 50], choir: [84, 70], brass: [96, 58], timp: [110, 64], aux: [88, 46], drums: [100, 64] };
  for (const [k, c] of Object.entries(CH) as [keyof typeof CH, number][]) {
    const p = PROG[mood][k]; if (p !== undefined && k !== 'drums') ev.push({ tick: 0, kind: 'prog', ch: c, a: p, b: 0 });
    ev.push({ tick: 0, kind: 'cc', ch: c, a: 7, b: mix[k][0] }, { tick: 0, kind: 'cc', ch: c, a: 10, b: mix[k][1] }, { tick: 0, kind: 'cc', ch: c, a: 11, b: 127 });
  }
  const n = (semis: number, oct: number): number => rootMidi + semis + 12 * oct;
  const second = (s: number): boolean => s >= sc;                // the second pass of a two-pass piece
  const twoPass = bars > score.bars;
  for (let s0 = 0; s0 < total; s0 += sc) {
    const pass = s0 / sc;
    const full = !twoPass || pass >= 1;                          // first pass of a 16-bar piece is the sparse statement
    // strings: a chord a bar, swelling in and out with expression
    for (let bar = 0; bar < score.bars; bar++) {
      const st = s0 + bar * 16, chord = score.chords[bar];
      chord.forEach((semis, i) => { put(CH.str, st, n(semis, 1), 16, (full ? 62 : 48) + i * 3, 10, i, 1); });
      put(CH.cello, st, n(chord[0], 0), 16, full ? 74 : 62, 0, 7, 1);
      if (full || fast) put(CH.cello, st, n(chord[0], -1), 16, 58, 0, 9, 1);
      for (let k = 0; k < 4; k++) ev.push({ tick: T(st) + k * 480, kind: 'cc', ch: CH.str, a: 11, b: Math.round(70 + 52 * Math.sin(((k + 1) / 4) * Math.PI)) });
    }
    // harp figure (and pizzicato doubling the bass in the fights)
    for (const a of score.arp) if (full || !fast) put(CH.harp, s0 + a.step, n(a.semis, 1), a.dur, (fast ? 70 : 78) * a.vel, 4, 1, 0.7);
    for (const b of score.bass) {
      if (fast) put(CH.aux, s0 + b.step, n(b.semis, 0) + 12, b.dur, 78 * b.vel, 0, 3, 0.55);
      else if (mood === 'camp' && full) put(CH.aux, s0 + b.step, n(b.semis, 0) + 12, 2, 54 * b.vel, 6, 4, 0.5);
    }
    // the tune: a flute alone the first time, doubled by oboe/violins the second; horns and trumpets in the fights
    for (const l of score.lead) {
      const note = n(l.semis, 1);
      put(CH.leadA, s0 + l.step, note, Math.max(1, l.dur), 84 * l.vel, 5, 11, mood === 'boss' ? 0.8 : 0.97);
      if (full) put(CH.leadB, s0 + l.step, note + (mood === 'title' ? 0 : 12), Math.max(1, l.dur), 66 * l.vel, 7, 13, 0.97);
    }
    if (full && mood === 'title') for (let bar = 0; bar < score.bars; bar += 2) put(CH.brass, s0 + bar * 16, n(score.chords[bar][0], 1), 12, 70, 0, 21, 1);
    // choir: long chords on the second pass of the title and through the boss
    if (CH.choir !== undefined && (mood === 'boss' || (mood === 'title' && full))) for (let bar = 0; bar < score.bars; bar++) score.chords[bar].forEach((semis, i) => put(CH.choir, s0 + bar * 16, n(semis, 1) + (i === 2 ? 12 : 0), 16, 52, 6, 30 + i, 1));
    // fights: brass stabs and timpani
    if (fast) for (let bar = 0; bar < score.bars; bar++) {
      const st = s0 + bar * 16, chord = score.chords[bar];
      for (const off of mood === 'boss' ? [0, 3, 6, 10, 14] : [0, 8]) chord.forEach((semis) => put(CH.brass, st + off, n(semis, 1), off === 0 ? 4 : 2, (mood === 'boss' ? 100 : 82) * (off === 0 ? 1 : 0.8), 0, 40 + off, 0.8));
      for (const off of mood === 'boss' ? [0, 3, 6, 8, 11, 14] : [0, 8, 12]) put(CH.timp, st + off, n(chord[0], -1) + (off % 8 === 0 ? 0 : 7), 2, off === 0 ? 118 : 96, 0, 50 + off, 0.5);
      for (const off of [4, 12]) put(CH.drums, st + off, 38, 1, mood === 'boss' ? 104 : 88, 0, 60, 1);
      put(CH.drums, st, 36, 1, mood === 'boss' ? 118 : 100, 0, 61, 1);
      if (bar % 4 === 0) put(CH.drums, st, 49, 4, mood === 'boss' ? 100 : 76, 0, 62, 1);
    }
    else {
      if (mood === 'title' && full) for (let bar = 0; bar < score.bars; bar += 2) put(CH.timp, s0 + bar * 16, n(score.chords[bar][0], -1), 8, 78, 0, 70, 0.6);
      if (mood === 'title' && second(s0)) put(CH.drums, s0 + (score.bars - 1) * 16 + 8, 49, 8, 72, 0, 71, 1);
    }
    void second;
  }
  return ev;
}

// ------------------------------------------------------------------ audio processing
function freeverb(L: Float32Array, R: Float32Array, wet = 0.26): void {
  const mk = (sizes: number[], spread: number): { buf: Float32Array; i: number; s: number }[] => sizes.map((n) => ({ buf: new Float32Array(n + spread), i: 0, s: 0 }));
  const combSizes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apSizes = [556, 441, 341, 225];
  const feedback = 0.9, damp = 0.35;
  const run = (src: Float32Array, spread: number): Float32Array => {
    const combs = mk(combSizes, spread), aps = mk(apSizes, spread), out = new Float32Array(src.length);
    for (let t = 0; t < src.length; t++) {
      const x = src[t] * 0.015; let acc = 0;
      for (const c of combs) { const y = c.buf[c.i]; c.s = y * (1 - damp) + c.s * damp; c.buf[c.i] = x + c.s * feedback; if (++c.i >= c.buf.length) c.i = 0; acc += y; }
      for (const a of aps) { const y = a.buf[a.i]; const o = -acc + y; a.buf[a.i] = acc + y * 0.5; if (++a.i >= a.buf.length) a.i = 0; acc = o; }
      out[t] = acc;
    }
    return out;
  };
  const wl = run(L, 0), wr = run(R, 23);
  for (let t = 0; t < L.length; t++) { L[t] = L[t] * (1 - wet * 0.5) + wl[t] * wet * 3; R[t] = R[t] * (1 - wet * 0.5) + wr[t] * wet * 3; }
}
/** ITU-R BS.1770 integrated loudness (K-weighted, 400 ms blocks, absolute and relative gates) */
function lufs(L: Float32Array, R: Float32Array): number {
  const kw = (x: Float32Array): Float32Array => {
    const s1 = (b: number[], a: number[], src: Float32Array): Float32Array => { const o = new Float32Array(src.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < src.length; i++) { const v = src[i], y = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; o[i] = y; } return o; };
    // the two stages at 44.1 kHz (shelving pre-filter, then the RLB high-pass)
    const st1 = s1([1.5308412300498355, -2.6509799951536985, 1.1690790799210682], [1, -1.6636551132560202, 0.7125954280732254], x);
    return s1([1, -2, 1], [1, -1.9891696736297957, 0.9891990357870394], st1);
  };
  const a = kw(L), b = kw(R), blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR), ms: number[] = [];
  for (let s = 0; s + blk <= a.length; s += hop) { let sum = 0; for (let i = s; i < s + blk; i++) sum += a[i] * a[i] + b[i] * b[i]; ms.push(sum / blk); }
  const loud = (m: number): number => -0.691 + 10 * Math.log10(m);
  const abs = ms.filter((m) => loud(m) > -70); if (!abs.length) return -120;
  const rel = loud(abs.reduce((x, y) => x + y, 0) / abs.length) - 10, gated = abs.filter((m) => loud(m) > rel);
  return loud(gated.reduce((x, y) => x + y, 0) / Math.max(1, gated.length));
}
function limit(L: Float32Array, R: Float32Array, ceiling = 0.89): void {
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) { const v = ch[i], a = Math.abs(v); if (a > 0.6) ch[i] = Math.sign(v) * (0.6 + (ceiling - 0.6) * Math.tanh((a - 0.6) / (ceiling - 0.6))); }
}
function mp3(L: Float32Array, R: Float32Array, kbps: number): Uint8Array {
  const enc = new Mp3Encoder(2, SR, kbps), chunks: Uint8Array[] = [];
  const to16 = (f: Float32Array, a: number, b: number): Int16Array => { const o = new Int16Array(b - a); for (let i = a; i < b; i++) o[i - a] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767))); return o; };
  for (let s = 0; s < L.length; s += 1152) { const c = enc.encodeBuffer(to16(L, s, Math.min(L.length, s + 1152)), to16(R, s, Math.min(L.length, s + 1152))); if (c.length) chunks.push(new Uint8Array(c)); }
  const end = enc.flush(); if (end.length) chunks.push(new Uint8Array(end));
  return Uint8Array.from(chunks.flatMap((c) => [...c]));
}

// ------------------------------------------------------------------ rendering
async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const bank = SoundBankLoader.fromArrayBuffer(fs.readFileSync(SF).buffer.slice(0));
  const args = process.argv.slice(2); const only = args.filter((a) => !a.startsWith("-")).map(Number).filter(Boolean); const moodOnly = args.find((a) => a.startsWith("--mood="))?.slice(7);
  const manifest: Record<string, unknown> = fs.existsSync(path.join(OUT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')) : {};
  for (const ch of CHAPTERS) {
    if (only.length && !only.includes(ch.n)) continue;
    const rootMidi = Math.round(69 + 12 * Math.log2(ch.music.root / 440));
    for (const mood of MOODS) {
      if (moodOnly && mood !== moodOnly) continue;
      const t0 = performance.now();
      const bars = BARS[mood], score = compose(ch.music.mode, mood, ch.n);
      const bpm = ch.music.tempo * MOOD_TEMPO[mood], loopSamples = Math.round((bars * 4 * 60 / bpm) * SR);
      const loopTicks = bars * 16 * (PPQ / 4);
      // three cycles back to back, so the middle one carries the previous cycle's reverb tail and is a seamless loop
      const one = orchestrate(score, mood, rootMidi, bars);
      const cycles: Ev[] = [0, 1, 2].flatMap((c) => one.filter((e) => c === 0 || e.tick > 0 && e.kind !== 'prog').map((e) => ({ ...e, tick: e.tick + c * loopTicks })));
      const mid = BasicMIDI.fromArrayBuffer(smf(cycles, bpm).buffer.slice(0) as ArrayBuffer);
      const synth = new SpessaSynthProcessor(SR, { eventsEnabled: false });
      synth.soundBankManager.addSoundBank(bank, 'main');
      await synth.processorInitialized;
      synth.setSystemParameter('autoAllocateVoices', true);
      const seq = new SpessaSynthSequencer(synth);
      seq.loadNewSongList([mid]); seq.play();
      const total = loopSamples * 3 + SR;
      const L = new Float32Array(total), R = new Float32Array(total);
      for (let f = 0; f < total;) { seq.processTick(); const n = Math.min(128, total - f); synth.process(L, R, f, n); f += n; }
      freeverb(L, R);
      // the middle cycle, with a pre-roll made of the end of the loop in front of it
      const a = loopSamples - PREROLL, z = loopSamples * 2;
      const sl = L.slice(a, z), sr = R.slice(a, z);
      // splice the wrap-around: the loop's last ~93 ms blends into the audio that really preceded the loop's first sample (the end of the
      // previous cycle), so the last sample is followed by the first one exactly as in the rendered stream, with no click
      const F = 4096;
      for (let i = 0; i < F; i++) {
        const w = i / (F - 1), g1 = Math.cos(w * Math.PI / 2), g2 = Math.sin(w * Math.PI / 2), idx = PREROLL + loopSamples - F + i;
        sl[idx] = sl[idx] * g1 + L[loopSamples - F + i] * g2; sr[idx] = sr[idx] * g1 + R[loopSamples - F + i] * g2;
      }
      const body = [sl.subarray(PREROLL), sr.subarray(PREROLL)] as const;
      const l0 = lufs(body[0], body[1]), gain = Math.pow(10, (TRACK_LUFS - l0) / 20);
      for (let i = 0; i < sl.length; i++) { sl[i] *= gain; sr[i] *= gain; }
      limit(sl, sr);
      const l1 = lufs(sl.subarray(PREROLL), sr.subarray(PREROLL));
      let peak = 0; for (let i = 0; i < sl.length; i++) peak = Math.max(peak, Math.abs(sl[i]), Math.abs(sr[i]));
      const bytes = mp3(sl, sr, 96);
      const file = `c${ch.n}-${mood}.mp3`;
      fs.writeFileSync(path.join(OUT, file), bytes);
      manifest[`${ch.n}:${mood}`] = { file, bars, bpm: +bpm.toFixed(2), sampleRate: SR, preroll: PREROLL, length: loopSamples, lufs: +l1.toFixed(2), peak: +peak.toFixed(3), bytes: bytes.length };
      console.log(`${file}  ${(loopSamples / SR).toFixed(1)}s loop  ${l1.toFixed(1)} LUFS  peak ${peak.toFixed(2)}  ${(bytes.length / 1024).toFixed(0)} KB  (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ encoderDelay: 1105, ...(manifest as object) }, null, 1));
}
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
