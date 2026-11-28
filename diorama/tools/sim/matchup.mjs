// 1対1の相性表(balancer 用)。同じ Lv の2体を何度も戦わせて、行の種族の勝率を出す。
//   node tools/sim/matchup.mjs [--lv 10] [--n 200] [--json]
import { fileURLToPath } from 'node:url';
import { createMonster } from '../../src/core/stats.js';
import { createBattle, runAuto } from '../../src/core/battle.js';
import { dbNow } from './progress_sim.mjs';

export const WILD = ['nejiko', 'perari', 'inky', 'koroishi', 'watabou', 'matchbo', 'origarasu', 'jarihebi', 'felton', 'hotarubin', 'zenmainu', 'rousokun', 'tsumiking', 'kamishibai', 'haribote', 'hibachineko', 'nuihebi', 'burikishi'];

export function duel(db, a, la, e, le, n = 200, seed = 1) {
  let w = 0, t = 0;
  for (let i = 0; i < n; i++) {
    const s = seed * 7777 + i;
    const b = createBattle(db, { allies: [createMonster(db, { sp: a, lv: la, shiny: false })], enemies: [createMonster(db, { sp: e, lv: le, shiny: false })], seed: s });
    const r = runAuto(b, 60);
    if (r.outcome === 'win') w++; else if (r.outcome === 'timeout') w += 0.5;
    t += r.turns;
  }
  return { win: w / n, turns: t / n };
}

export function matrix(db, list = WILD, lv = 10, n = 200) {
  return list.map((a) => list.map((e) => duel(db, a, lv, e, lv, n)));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => { if (x.startsWith('--')) acc.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
  const lv = +args.lv || 10, n = +args.n || 200;
  const m = matrix(dbNow, WILD, lv, n);
  if (args.json) console.log(JSON.stringify(m));
  else {
    console.log('勝率% (行 vs 列) Lv' + lv);
    console.log('           ' + WILD.map((s) => s.slice(0, 5).padStart(6)).join(''));
    m.forEach((row, i) => console.log(WILD[i].padEnd(11) + row.map((c) => String(Math.round(c.win * 100)).padStart(6)).join('') + '   平均 ' + Math.round(row.reduce((a, c) => a + c.win, 0) / row.length * 100) + '%  ' + (row.reduce((a, c) => a + c.turns, 0) / row.length).toFixed(1) + 'T'));
  }
}
