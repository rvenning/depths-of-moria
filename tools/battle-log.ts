import { newGame, unlockHero } from '../src/core/game.ts';
import { planFloor } from '../src/core/floors.ts';
import { buildSetup } from '../src/core/party.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { HERO_IDS } from '../src/content/schema.ts';

const floor = Number(process.argv[2] ?? 50);
const level = Number(process.argv[3] ?? 12);
const s = newGame(7);
for (const h of ['gimli', 'frodo', 'legolas', 'sam']) unlockHero(s, h as never);
for (const h of HERO_IDS) s.heroes[h].level = level;
s.party = ['gimli', 'aragorn', null, 'legolas', 'sam'];
const plan = planFloor(floor, s.seed, 4);
console.log(plan.title, plan.tag, plan.waves.map((w) => w.map((e) => e.id).join(',')));
const setup = buildSetup(s, plan, {});
const b = new Battle(setup, 99);
const names = new Map<number, string>();
for (const u of b.units) names.set(u.uid, `${u.name}#${u.uid}`);
let n = 0;
while (!b.over && n++ < 3000) {
  for (const ev of b.step()) {
    const nm = (id: number) => names.get(id) ?? id;
    switch (ev.t) {
      case 'round': console.log(`--- round ${ev.n}`); break;
      case 'skill': console.log(`${nm(ev.actor)} uses ${ev.name} ${ev.rule ? `[${ev.rule}]` : ''} -> ${ev.targets.map(nm).join(',')}`); break;
      case 'hit': console.log(`   ${nm(ev.target)} -${ev.amount}${ev.absorbed ? ` (+${ev.absorbed} abs)` : ''}${ev.crit ? ' CRIT' : ''} ${ev.kind} hp=${ev.hp}`); break;
      case 'heal': console.log(`   ${nm(ev.target)} +${ev.amount} hp=${ev.hp}`); break;
      case 'miss': console.log(`   ${nm(ev.target)} dodged`); break;
      case 'status': console.log(`   ${nm(ev.target)} ${ev.on ? '+' : '-'}${ev.id}`); break;
      case 'death': console.log(`   X ${nm(ev.target)} falls`); break;
      case 'turn': if (ev.skip) console.log(`${nm(ev.actor)} skips (${ev.skip})`); break;
      default: break;
    }
  }
}
const r = b.summary();
console.log(r.result, 'rounds', r.rounds, 'actions', r.actions, r.heroes.map((h) => `${h.id}:${Math.round(h.hpFrac * 100)}%`).join(' '));
