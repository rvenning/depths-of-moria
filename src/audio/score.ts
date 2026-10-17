/**
 * A tiny composer: for a chapter's mode and a mood it writes an 8-bar piece as plain data (chords, a melody with
 * real phrasing, a harp figure and a bass line). No WebAudio here, so it is deterministic and unit-tested; audio.ts plays it.
 * Everything stays inside the chapter's scale, and phrases end on chord tones so it cannot wander off key.
 */
export type ScoreMood = 'camp' | 'battle' | 'boss' | 'title';

/** one note: `step` is a sixteenth within the piece, `semis` is semitones above the chapter root */
export interface ScoreNote { step: number; semis: number; dur: number; vel: number }
export interface Score {
  bars: number;
  /** per bar: the chord's semitones above the root (three notes, low to high) */
  chords: number[][];
  lead: ScoreNote[];
  arp: ScoreNote[];
  bass: ScoreNote[];
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** progressions as scale degrees (0 = tonic) */
const PROG: Record<ScoreMood, number[][]> = {
  title: [[0, 5, 2, 4, 0, 5, 3, 4], [0, 3, 5, 4, 0, 5, 1, 4]],
  camp: [[0, 3, 5, 4, 0, 3, 4, 0], [0, 5, 3, 4, 0, 2, 4, 0]],
  battle: [[0, 5, 3, 4, 0, 5, 4, 4], [0, 3, 4, 5, 0, 3, 4, 4]],
  boss: [[0, 1, 0, 4, 0, 5, 1, 4], [0, 4, 1, 0, 0, 5, 4, 4]],
};

/** rhythm cells for one bar of melody: [start step, length in steps] */
const SLOW: [number, number][][] = [
  [[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 4], [12, 4]], [[0, 8], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 8]], [[0, 4], [4, 4], [8, 6], [14, 2]],
];
const FAST: [number, number][][] = [
  [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]], [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 3], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]],
];

export function compose(mode: number[], mood: ScoreMood, seed: number): Score {
  const r = rng(seed * 7919 + mood.length * 131);
  const n = mode.length;
  const prog = PROG[mood][Math.floor(r() * PROG[mood].length)];
  // semitones of scale position p (counting octaves upward)
  const at = (p: number): number => { const o = Math.floor(p / n), d = ((p % n) + n) % n; return mode[d] + 12 * o; };
  const chordPos = (d: number): number[] => [d, d + 2, d + 4];
  const chords = prog.map((d) => chordPos(d).map(at));
  const fast = mood === 'battle' || mood === 'boss';
  const cells = fast ? FAST : SLOW;

  // ---- melody: two four-bar phrases, the second answering the first and closing on the tonic
  const lead: ScoreNote[] = [];
  const contour = [0, 2, 3, 1];                       // where each bar of a phrase is headed (in scale steps above the start)
  const phrase = (bar0: number, close: boolean, motif?: [number, number][][]): [number, number][][] => {
    const made: [number, number][][] = [];
    let pos = 7 + (prog[bar0] % n);                   // start around the middle of the scale, on the chord's root
    for (let b = 0; b < 4; b++) {
      const bar = bar0 + b, tones = chordPos(prog[bar]);
      const cell = motif ? motif[b].map(([s, d]) => [s, d] as [number, number]) : cells[Math.floor(r() * cells.length)];
      const bn: [number, number][] = [];
      cell.forEach(([s, d], i) => {
        const target = 7 + (prog[bar0] % n) + contour[b];
        if (i === 0) {
          // land on the nearest chord tone
          const cands: number[] = []; for (let k = -4; k <= 4; k++) for (const t of tones) { const p = pos + k; if (((p - t) % n + n) % n === 0) cands.push(p); }
          pos = cands.sort((a, c) => Math.abs(a - target) - Math.abs(c - target) || Math.abs(a - pos) - Math.abs(c - pos))[0] ?? pos;
        } else {
          const toward = Math.sign(target - pos), step = (r() < 0.62 ? 1 : 2) * (r() < 0.7 && toward !== 0 ? toward : (r() < 0.5 ? 1 : -1));
          pos = Math.max(3, Math.min(13, pos + step));
        }
        // the very last note of a closing phrase sits on the tonic
        const last = close && b === 3 && i === cell.length - 1;
        if (last) pos = 7;
        lead.push({ step: bar * 16 + s, semis: at(pos), dur: last ? 16 - s : d, vel: s === 0 ? 1 : 0.8 });
        bn.push([s, d]);
      });
      made.push(bn);
    }
    return made;
  };
  const a = phrase(0, false);
  // the answer repeats the first phrase's rhythm (so the theme is recognisable) and then closes
  phrase(4, true, a);

  // ---- harp figure: the chord rolled up and back, an eighth at a time (a lighter two-note rock for the fights)
  const arp: ScoreNote[] = [];
  const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
  chords.forEach((ch, bar) => {
    const tones = [ch[0], ch[1], ch[2], ch[0] + 12];
    if (fast) { for (let s = 0; s < 16; s += 2) arp.push({ step: bar * 16 + s, semis: tones[(s / 2) % 3] + (s % 8 === 6 ? 12 : 0), dur: 2, vel: s % 4 === 0 ? 0.8 : 0.5 }); }
    else pattern.forEach((p, i) => arp.push({ step: bar * 16 + i * 2, semis: tones[p], dur: 3, vel: 0.9 - i * 0.05 }));
  });

  // ---- bass: whole-bar roots for the slow pieces, a driving root-and-fifth for the fights
  const bass: ScoreNote[] = [];
  chords.forEach((ch, bar) => {
    const root = ch[0] - 12;
    if (fast) for (let s = 0; s < 16; s += 2) bass.push({ step: bar * 16 + s, semis: s % 8 === 6 ? ch[2] - 12 : root, dur: 2, vel: s % 8 === 0 ? 1 : 0.7 });
    else { bass.push({ step: bar * 16, semis: root, dur: 12, vel: 1 }); bass.push({ step: bar * 16 + 12, semis: ch[2] - 12, dur: 4, vel: 0.7 }); }
  });
  return { bars: 8, chords, lead, arp, bass };
}
