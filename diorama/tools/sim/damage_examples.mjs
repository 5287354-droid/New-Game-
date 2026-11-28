// ダメージの例(乱数1・急所なし)。docs/DESIGN.md §4-4 と ISSUES の例を、いまの data と定数で出す。
//   node tools/sim/damage_examples.mjs
import { fileURLToPath } from 'node:url';
import { createMonster } from '../../src/core/stats.js';
import { createBattle, calcDamage, bossEnemies } from '../../src/core/battle.js';
import { dbNow } from './progress_sim.mjs';

export const EXAMPLES = [
  ['nejiko', 5, 'tackle', 'koroishi', 4], ['koroishi', 4, 'tackle', 'nejiko', 5], ['koroishi', 4, 'roll', 'nejiko', 5],
  ['matchbo', 7, 'spark', 'perari', 6], ['rousokun', 10, 'spark', 'perari', 10],
  ['hibachineko', 14, 'flame', 'kageboushi', 'boss'], ['kageboushi', 'boss', 'shadowstep', 'nejiko', 14], ['kageboushi', 'boss', 'drain', 'nejiko', 14],
  ['burikishi', 20, 'knightcharge', 'tokeimori', 'boss'], ['tokeimori', 'boss', 'chime', 'burikishi', 20], ['tokeimori', 'boss', 'gearsaw', 'felton', 20],
];
export function examples(db) {
  return EXAMPLES.map(([a, la, sk, d, ld]) => {
    const mkA = la === 'boss' ? bossEnemies(db, a, 1)[0] : createMonster(db, { sp: a, lv: la, shiny: false });
    const mkD = ld === 'boss' ? bossEnemies(db, d, 1)[0] : createMonster(db, { sp: d, lv: ld, shiny: false });
    const b = createBattle(db, { allies: [mkA], enemies: [mkD], seed: 1 });
    const A = b.units.a0, D = b.units.e0;
    const { dmg } = calcDamage(b, A, D, db.sk(sk), { roll: 1, crit: false });
    return { att: `${db.sp(a).name} Lv${mkA.lv}`, skill: db.sk(sk).name, def: `${db.sp(d).name} Lv${mkD.lv}${mkD.isBoss ? '(ぬし)' : ''}`, dmg, hp: D.maxHp, hits: Math.ceil(D.maxHp / dmg) };
  });
}
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) for (const r of examples(dbNow)) console.log(`${r.att} ${r.skill} → ${r.def}: ${r.dmg} / ${r.hp}(${r.hits}発)`);
