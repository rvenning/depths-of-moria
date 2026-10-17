import { ENEMY_LIST } from '../src/content/enemies.ts';
import { getSkill } from '../src/content/skills.ts';
for (const e of ENEMY_LIST) {
  const ok = e.skills.some((r) => { const s = getSkill(r.skill); return (r.cd ?? s.cd) === 0 && !!s.hits; });
  if (!ok) console.log('no basic:', e.id, e.skills.map((s) => s.skill).join(','));
}
