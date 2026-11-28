// balancer の調整案(docs/BALANCE.md)。data/*.json の数字の差分と、core の定数。
//   node tools/sim/tuning.mjs --write   … data/*.json に書きこむ(core の定数は手で battle.js / stats.js に入れる)
//   シミュレーターからは applyTuning(db) / applyConsts() で、メモリの上だけで試せる
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNE, BOSS } from '../../src/core/battle.js';
import { GROW } from '../../src/core/stats.js';

export const CONSTS = {
  TUNE: { powDiv: 28 },
  GROW: { xpA: 1, xpP: 3, xpDiv: 1, goldDiv: 2 },
  BOSS: { kageboushi: { lv: 13, minionLv: 9 }, tokeimori: { lv: 19, minionLv: 12, reinforce: 1 } },
};
// 種族: base は上書きする値だけ、learn は [Lv, わざ] の表をまるごと
export const SPECIES = {
  // つみき野
  nejiko: { xp: 18, gold: 10 },
  perari: { base: { hp: 32, mp: 18, atk: 14, def: 11, spd: 15, int: 12 }, xp: 18, gold: 9, learn: [[1, 'tackle'], [1, 'papercut'], [6, 'papershield'], [10, 'heal'], [12, 'fold'], [23, 'confetti']] },
  inky: { xp: 13, gold: 9 },
  koroishi: { base: { hp: 43, atk: 14, def: 16, spd: 8, int: 7 }, xp: 17, gold: 9, learn: [[1, 'tackle'], [6, 'roll'], [8, 'stoneskin'], [14, 'pebble'], [18, 'cover'], [22, 'quake']] },
  watabou: { base: { hp: 31, mp: 14, atk: 13, def: 10, spd: 18, int: 12 }, xp: 17, gold: 9 },
  matchbo: { xp: 21, gold: 11, base: { hp: 32, def: 11, int: 11 } },
  // ランプの森
  origarasu: { base: { hp: 31, mp: 15, atk: 15, def: 12, spd: 17, int: 13 }, xp: 13, gold: 10, learn: [[1, 'papercut'], [1, 'shadowstep'], [14, 'fold'], [15, 'glue'], [22, 'confetti']] },
  jarihebi: { base: { atk: 16, int: 12 }, xp: 13, gold: 10 },
  felton: { xp: 12, gold: 9 },
  hotarubin: { xp: 13, gold: 10 },
  // 時計塔
  zenmainu: { xp: 15, gold: 7, base: { atk: 17, int: 11 } },
  rousokun: { xp: 15, gold: 7 },
  tsumiking: { xp: 16, gold: 8 },
  kamishibai: { xp: 16, gold: 8, learn: [[1, 'papercut'], [1, 'lullaby'], [14, 'heal'], [18, 'confetti'], [24, 'healall']] },
  tokeimori: { hpMul: 3, base: { atk: 14, def: 17, spd: 13, int: 10 }, learn: [[1, 'gearsaw'], [1, 'windup'], [1, 'clang'], [1, 'rustrain']] },
  kageboushi: { xp: 60, gold: 50, hpMul: 2.2, base: { atk: 13, spd: 15, int: 12 } },
};
// スカウトの値(HP 1/4 で 3〜5 回に1回)
export const SCOUT = { nejiko: 0.2, perari: 0.2, inky: 0.19, koroishi: 0.22, watabou: 0.2, matchbo: 0.17, origarasu: 0.17, jarihebi: 0.18, felton: 0.19, hotarubin: 0.17, zenmainu: 0.17, rousokun: 0.17, tsumiking: 0.16, kamishibai: 0.16, haribote: 0.1 };
for (const [k, v] of Object.entries(SCOUT)) (SPECIES[k] ||= {}).scout = v;
export const SKILLS = {
  heal: { pow: 30 },
  healall: { pow: 20 },
};
export const ITEMS = {};

export function applyConsts(c = CONSTS) {
  Object.assign(TUNE, c.TUNE); Object.assign(GROW, c.GROW);
  for (const [k, v] of Object.entries(c.BOSS)) Object.assign(BOSS[k], v);
}
function patchRaw(raw) {
  for (const s of raw.monsters.species) {
    const p = SPECIES[s.id]; if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (k === 'base') Object.assign(s.base, v);
      else s[k] = v;
    }
    if (s.bst != null) s.bst = Object.values(s.base).reduce((a, x) => a + x, 0);
  }
  for (const s of raw.skills.skills) if (SKILLS[s.id]) Object.assign(s, SKILLS[s.id]);
  for (const s of raw.items.items) if (ITEMS[s.id]) Object.assign(s, ITEMS[s.id]);
}
// db(makeDB の結果)をメモリの上で書きかえる(species などは raw と同じオブジェクト)
export function applyTuning(db) { patchRaw(db.raw); return db; }

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && process.argv.includes('--write')) {
  const D = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
  const J = (f) => JSON.parse(readFileSync(join(D, f), 'utf8'));
  const raw = { monsters: J('monsters.json'), skills: J('skills.json'), items: J('items.json') };
  patchRaw(raw);
  writeFileSync(join(D, 'monsters.json'), JSON.stringify(raw.monsters, null, 1) + '\n');
  // skills.json / items.json は1行1件の手書きの形をくずさないように、その行の値だけ書きかえる
  for (const [f, P] of [['skills.json', SKILLS], ['items.json', ITEMS]]) {
    const lines = readFileSync(join(D, f), 'utf8').split('\n');
    for (const [id, ch] of Object.entries(P)) {
      const i = lines.findIndex((l) => l.includes(`"id": "${id}"`));
      if (i < 0) throw new Error('見つからない: ' + id);
      for (const [k, v] of Object.entries(ch)) {
        const re = new RegExp(`"${k}": (?:"[^"]*"|[-0-9.]+|true|false)`);
        const val = JSON.stringify(v);
        if (re.test(lines[i])) lines[i] = lines[i].replace(re, `"${k}": ${val}`);
        else lines[i] = lines[i].replace(/, "desc"/, `, "${k}": ${val}, "desc"`);
      }
      JSON.parse(lines[i].trim().replace(/,$/, '')); // 1行がまだ正しい JSON か
    }
    writeFileSync(join(D, f), lines.join('\n'));
  }
  console.log('data/*.json に書きこみました。core の定数:', JSON.stringify(CONSTS));
}
