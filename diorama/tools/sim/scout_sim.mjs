// スカウトの成功率(balancer 用)。寄り道なしの進行で、その場所にいるときのパーティで、相手の HP を 1/4 にけずってからスカウトする。
//   node tools/sim/scout_sim.mjs [--hp 0.25] [--json]
// 期待回数 = ねばり(失敗ごとに +0.1、最大 +0.3)込みで、成功するまでに投げる回数の平均。
import { fileURLToPath } from 'node:url';
import { createMonster } from '../../src/core/stats.js';
import { createBattle, scoutChance } from '../../src/core/battle.js';
import { dbNow, playthrough, ROUTES } from './progress_sim.mjs';

export const SPOTS = [
  ['tsumiki', ['nejiko', 'koroishi', 'perari', 'watabou', 'matchbo'], 'tsumiki', 5],
  ['forest', ['inky', 'felton', 'jarihebi', 'origarasu', 'hotarubin'], 'forest', 10.5],
  ['tower', ['zenmainu', 'rousokun', 'kamishibai', 'tsumiking'], 'tower', 15],
];

function chanceWith(db, party, sp, lv, hp, opt = {}) {
  const e = createMonster(db, { sp, lv, shiny: false });
  const b = createBattle(db, { allies: party, enemies: [e], seed: 1 });
  const u = b.units.e0; u.hp = Math.max(1, Math.floor(u.maxHp * hp));
  const out = [];
  for (let f = 0; f < 4; f++) { b.scoutFails = f; out.push(scoutChance(b, u, opt)); }
  return out; // ねばり 0..3
}
export function expectedTries(ps) { // ps[0..3]: f 回失敗したあとの成功率
  let alive = 1, e = 0;
  for (let n = 1; n <= 60; n++) { const p = ps[Math.min(n - 1, 3)]; e += alive * p * n; alive *= 1 - p; }
  return e + alive * 60;
}

export function scoutTable(db, { hp = 0.25, runs = 30, route = 'proposal' } = {}) {
  // その場所の途中のパーティ(進行シミュレーターの、その場所の真ん中あたり)
  const parties = { tsumiki: [], forest: [], tower: [] };
  for (let i = 0; i < runs; i++) {
    const st = playthrough(db, { seed: 4242 + i * 7, bossN: 1, route });
    parties.tsumiki.push([createMonster(db, { sp: ['nejiko', 'perari', 'inky'][i % 3], lv: 6, shiny: false }), createMonster(db, { sp: 'koroishi', lv: 4, shiny: false })]);
    parties.forest.push(st.partyAt.kageboushi.slice(0, 3).map((m) => createMonster(db, { ...m, lv: Math.max(1, m.lv - 2), shiny: false })));
    parties.tower.push(st.partyAt.tokeimori.slice(0, 3).map((m) => createMonster(db, { ...m, lv: Math.max(1, m.lv - 3), shiny: false })));
  }
  const rows = [];
  for (const [area, list] of SPOTS) {
    const zones = ROUTES[route][area];
    for (const sp of list) {
      const z = zones.find((zz) => zz.sp.some(([k]) => k === sp));
      const lv = Math.round((z.lv[0] + z.lv[1]) / 2);
      let p0 = 0, e = 0, ev = 0;
      for (const party of parties[area]) {
        const ps = chanceWith(db, party, sp, lv, hp);
        p0 += ps[0]; e += expectedTries(ps);
        ev += expectedTries(chanceWith(db, party, sp, lv, hp, { varnish: true }));
      }
      const n = parties[area].length;
      rows.push({ area, sp, lv, scout: db.sp(sp).scout, p: p0 / n, tries: e / n, triesVarnish: ev / n });
    }
  }
  return rows;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => { if (x.startsWith('--')) acc.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
  const rows = scoutTable(dbNow, { hp: +args.hp || 0.25 });
  if (args.json) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(`${r.area.padEnd(8)} ${r.sp.padEnd(11)} Lv${r.lv} scout ${r.scout}  1回目 ${(r.p * 100).toFixed(0)}%  期待 ${r.tries.toFixed(1)} 回  ニスあり ${r.triesVarnish.toFixed(1)} 回`);
}
