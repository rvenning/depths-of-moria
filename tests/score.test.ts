import { describe, expect, it } from 'vitest';
import { compose, type ScoreMood } from '../src/audio/score.ts';
import { CHAPTERS } from '../src/content/chapters.ts';

const MOODS: ScoreMood[] = ['title', 'camp', 'battle', 'boss'];

describe('the composer', () => {
  for (const ch of CHAPTERS) for (const mood of MOODS) {
    it(`chapter ${ch.n} ${mood}: every note is in the chapter's scale and lands on the grid`, () => {
      const s = compose(ch.music.mode, mood, ch.n);
      const pcs = new Set(ch.music.mode.map((m) => ((m % 12) + 12) % 12));
      expect(s.bars).toBe(8);
      expect(s.chords).toHaveLength(8);
      for (const note of [...s.lead, ...s.arp, ...s.bass]) {
        expect(pcs.has(((note.semis % 12) + 12) % 12)).toBe(true);
        expect(Number.isInteger(note.step)).toBe(true);
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step).toBeLessThan(8 * 16);
        expect(note.dur).toBeGreaterThan(0);
        expect(note.vel).toBeGreaterThan(0);
      }
      // a singable range: within two octaves and a bit of the root
      for (const note of s.lead) { expect(note.semis).toBeGreaterThanOrEqual(0); expect(note.semis).toBeLessThanOrEqual(30); }
    });
  }

  it('is deterministic, and different chapters get different tunes', () => {
    const a = compose(CHAPTERS[0].music.mode, 'title', 1), b = compose(CHAPTERS[0].music.mode, 'title', 1), c = compose(CHAPTERS[4].music.mode, 'title', 5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.lead)).not.toBe(JSON.stringify(c.lead));
  });

  it('closes each piece on the tonic (a held root in the last bar)', () => {
    for (const ch of CHAPTERS) {
      const s = compose(ch.music.mode, 'camp', ch.n);
      const last = s.lead.filter((n) => n.step >= 7 * 16).pop();
      expect(last).toBeDefined();
      expect(last && ((last.semis % 12) + 12) % 12).toBe(0);
    }
  });

  it('gives the melody a second phrase that repeats the first one’s rhythm', () => {
    const s = compose(CHAPTERS[2].music.mode, 'camp', 3);
    const rhythm = (lo: number, hi: number): string => s.lead.filter((n) => n.step >= lo && n.step < hi).map((n) => `${n.step - lo}:${n.dur}`).join(',');
    // bars 0-2 of each phrase share rhythm (the last note of the closing phrase is held)
    expect(rhythm(64, 64 + 48)).toBe(rhythm(0, 48));
  });
});
