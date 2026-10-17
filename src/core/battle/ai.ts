import type { SkillDef, Rule } from '../../content/schema.ts';
import type { Battle } from './engine.ts';
import type { BSkill, BUnit } from './types.ts';

export interface Decision { skill: SkillDef; rule: string; target?: BUnit }

function ready(b: Battle, u: BUnit, s: BSkill): boolean {
  if (s.cdLeft > 0) return false;
  const sealed = b.has(u, 'sealed');
  if (sealed) return false;
  if (b.setup.challenge.includes('silence') && s.def.tags.includes('ultimate')) return false;
  return b.skillValid(u, s.def);
}

const isHeal = (d: SkillDef) => d.tags.includes('heal') && !d.hits;
const isDamaging = (d: SkillDef) => !!d.hits && d.hits.length > 0;

/** Is every recipient of this buff already carrying it (so casting again is wasted)? */
function buffRedundant(b: Battle, u: BUnit, d: SkillDef): boolean {
  const st = d.effects?.find((e) => e.k === 'status') as { id: never } | undefined;
  const sh = d.effects?.find((e) => e.k === 'shield');
  if (!st && !sh) return false;
  const recips = d.target === 'self' ? [u] : b.allies(u);
  if (st && recips.every((r) => r.statuses.some((s) => s.id === (st.id as string) && s.turns > 1))) return true;
  if (!st && sh && recips.every((r) => b.has(r, 'ward'))) return true;
  return false;
}

export function chooseHeroAction(b: Battle, u: BUnit): Decision {
  const rules: Rule[] = u.rules.length ? u.rules : [{ id: 'use-ready', enabled: true }, { id: 'basic', enabled: true }];
  const skills = u.skills.filter((s) => ready(b, u, s));
  const allies = b.allies(u);
  const noHeal = b.setup.challenge.includes('noHealing');
  const enemies = b.foes(u).filter((e) => !b.has(e, 'submerged'));
  const lowestAlly = allies.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];

  for (const r of rules) {
    if (!r.enabled) continue;
    switch (r.id) {
      case 'heal-below': {
        if (noHeal) break;
        const thr = (r.param ?? 50) / 100;
        const need = allies.some((a) => a.hp / a.maxHp < thr);
        if (!need) break;
        const s = skills.find((x) => isHeal(x.def) && !x.def.tags.includes('rescue') && !x.def.effects?.some((e) => e.k === 'selfDamagePct'));
        if (s) return { skill: s.def, rule: `Heal below ${r.param ?? 50}%` };
        break;
      }
      case 'rescue': {
        if (noHeal) break;
        const thr = (r.param ?? 30) / 100;
        const hurt = allies.filter((a) => a.hp / a.maxHp < thr && !(a === u && false));
        if (!hurt.length) break;
        const s = skills.find((x) => x.def.tags.includes('rescue') && (!x.def.effects?.some((e) => e.k === 'selfDamagePct') || (u.hp / u.maxHp > 0.4 && hurt.some((h) => h !== u))));
        if (s) return { skill: s.def, rule: `Rescue below ${r.param ?? 30}%` };
        break;
      }
      case 'cleanse': {
        if (!allies.some((a) => b.hasHarmful(a))) break;
        const s = skills.find((x) => x.def.tags.includes('cleanse') && !x.def.tags.includes('rescue'));
        if (s) return { skill: s.def, rule: 'Cleanse' };
        break;
      }
      case 'guard-low': {
        const thr = (r.param ?? 45) / 100;
        if (u.hp / u.maxHp >= thr) break;
        const s = skills.find((x) => x.def.tags.includes('guard') && (x.def.target === 'self' || x.def.target === 'allAllies') && !buffRedundant(b, u, x.def));
        if (s) return { skill: s.def, rule: `Guard below ${r.param ?? 45}%` };
        break;
      }
      case 'buff-opener': {
        const s = skills.find((x) => (x.def.tags.includes('buff') || x.def.tags.includes('guard')) && !isHeal(x.def) && !x.def.tags.includes('rescue') && !isDamaging(x.def) && !buffRedundant(b, u, x.def) && !(x.def.tags.includes('ultimate')));
        if (s && enemies.length) return { skill: s.def, rule: 'Open with buffs' };
        break;
      }
      case 'aoe-3': {
        if (enemies.length < 3) break;
        const s = skills.find((x) => x.def.tags.includes('aoe') && isDamaging(x.def) && (x.def.target === 'allEnemies' || x.def.target === 'randomEnemies' || x.def.target === 'frontEnemies'));
        if (s) return { skill: s.def, rule: 'Area on 3+ enemies' };
        break;
      }
      case 'ultimate': {
        const s = skills.find((x) => x.def.tags.includes('ultimate') && isDamaging(x.def));
        if (s) return { skill: s.def, rule: 'Ultimate ready' };
        break;
      }
      case 'focus-marked': break; // handled during targeting
      case 'use-ready': {
        const anyMarked = enemies.some((e) => b.has(e, 'mark'));
        const s = skills.find((x) => isDamaging(x.def) && !(x.def.tags.includes('mark') && anyMarked) && !(x.def.tags.includes('ultimate')))
          ?? skills.find((x) => isDamaging(x.def) && !(x.def.tags.includes('mark') && anyMarked));
        if (s) return { skill: s.def, rule: 'Use ready skill' };
        break;
      }
      case 'basic': return { skill: u.basic, rule: 'Basic attack' };
      default: break;
    }
  }
  void lowestAlly;
  return { skill: u.basic, rule: 'Basic attack' };
}
