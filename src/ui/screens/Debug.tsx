import { useState } from 'react';
import { HERO_IDS } from '../../content/schema.ts';
import { Battle } from '../../core/battle/engine.ts';
import { planFloor } from '../../core/floors.ts';
import { unlockHero, grantXp, ageLevelCap } from '../../core/game.ts';
import { buildSetup, formation } from '../../core/party.ts';
import { store, useGame } from '../store.ts';
import { HEROES } from '../../content/heroes.ts';

/** Developer panel (backtick). Not part of the player experience. */
export function DebugPanel() {
  const s = useGame();
  const [floor, setFloor] = useState(s.best + 1);
  const [out, setOut] = useState('');
  const sim = () => {
    const plan = planFloor(floor, s.seed, Math.max(3, formation(s).length));
    let w = 0, rounds = 0; const N = 200;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) { const b = new Battle(buildSetup(s, plan), 1000 + i, { record: false }); const r = b.run(); if (r.result === 'victory') w++; rounds += r.rounds; }
    setOut(`${plan.title}\nwin ${(w / N * 100).toFixed(0)}% over ${N} seeded runs · avg ${(rounds / N).toFixed(1)} rounds · ${(performance.now() - t0).toFixed(0)}ms`);
  };
  const btn = (label: string, fn: () => void) => <button className="btn small" onClick={() => { store.mutate(fn, 'now'); }}>{label}</button>;
  return (
    <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 200, width: 360, maxHeight: '70vh', overflow: 'auto' }} className="panel">
      <div className="ph"><h4>Developer panel</h4><button className="btn small" onClick={() => { store.debug = false; store.touch(); }}>×</button></div>
      <div className="row wrap" style={{ gap: 4 }}>
        {btn('+10k gold', () => { s.gold += 10000; })}
        {btn('+500 essence', () => { s.essence += 500; })}
        {btn('+50 renown', () => { s.renown += 50; })}
        {btn('+200 ore/cloth', () => { s.ore += 200; s.cloth += 200; })}
        {btn('+10 shards', () => { s.shards += 10; })}
        {btn('Unlock all heroes', () => { for (const h of HERO_IDS) unlockHero(s, h); })}
        {btn('Heroes → cap', () => { for (const h of HERO_IDS) if (s.heroes[h].unlocked) grantXp(s, h, 1e9); void ageLevelCap; })}
        {btn('Clear Age boss', () => { s.best = Math.max(s.best, s.age * 100); })}
        {btn('Best → 990', () => { s.best = 990; s.age = 10; })}
        {btn('+100 affinity', () => { for (const k of Object.keys(s.bonds)) s.bonds[k] += 100; for (const a of HERO_IDS) for (const b of HERO_IDS) if (a < b) s.bonds[`${a}+${b}`] = (s.bonds[`${a}+${b}`] ?? 0) + 100; })}
      </div>
      <hr className="hr" />
      <div className="row"><input type="text" style={{ width: 90 }} value={floor} onChange={(e) => setFloor(Number(e.target.value) || 1)} aria-label="Floor" /><button className="btn small" onClick={sim}>Sim win-rate ×200</button></div>
      <pre className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{out}</pre>
      <div className="tiny dim">Seed {s.seed} · age {s.age} · best {s.best} · heroes {HERO_IDS.filter((h) => s.heroes[h].unlocked).map((h) => HEROES[h].name).join(', ')}</div>
    </div>
  );
}
