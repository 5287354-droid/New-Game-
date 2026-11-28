// 戦闘のかんたんなシミュレーター(balancer 用)。2チームを何度も自動で戦わせて、勝率・平均ターン・残りHPを出す。
//
//   node tools/sim/battle_sim.mjs --a nejiko:5,perari:5 --b koroishi:4,watabou:4 --n 1000 [--seed 1] [--json]
//   node tools/sim/battle_sim.mjs --preset kageboushi --a hibachineko:14,hotarubin:14,nuihebi:14
//   node tools/sim/battle_sim.mjs --preset tokeimori  --a burikishi:20,nuihebi:20,kamishibai:20
//   node tools/sim/battle_sim.mjs --preset all          … 体験版の節目(DESIGN §3-2 の目安の Lv)をまとめて
//
// チームの書き方: 種族:Lv[:b伸びボーナス][:おさがり 種族.場所★] をカンマで。例 nejiko:12:b0.1:hotarubin.back3
// A が味方(先頭3体が台、4〜6体目は控え)、B が敵(3体まで)。両方とも battle.js の autoAction で動く。
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDBNode } from '../../src/core/db.js';
import { createMonster } from '../../src/core/stats.js';
import { createBattle, runAuto, bossEnemies } from '../../src/core/battle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const db = await loadDBNode(join(ROOT, 'data'));

function parseTeam(str) {
  return str.split(',').filter(Boolean).map((tok) => {
    const [sp, lv, ...rest] = tok.trim().split(':');
    const o = { sp, lv: +lv || 1, shiny: false, parts: {} };
    for (const r of rest) {
      if (r.startsWith('b')) o.bonus = +r.slice(1);
      else { const m = r.match(/^(\w+)\.(head|back|tail)(\d)?$/); if (m) o.parts[m[2]] = { from: m[1], slot: m[2], star: +(m[3] || 1), history: [m[1]] }; }
    }
    return o;
  });
}
const mkTeam = (spec, rng, d = db) => spec.map((o) => createMonster(d, { ...o, rng }));

export function simulate({ a, b, n = 500, seed = 1, preset = null, maxTurns = 80, db: d = db }) {
  const A = typeof a === 'string' ? parseTeam(a) : a;
  const Bs = typeof b === 'string' ? parseTeam(b) : b;
  const out = { n, win: 0, lose: 0, timeout: 0, turns: 0, turnsWin: 0, hpLeft: 0, faintedA: 0 };
  for (let i = 0; i < n; i++) {
    const s = seed * 100003 + i;
    const allies = mkTeam(A, s, d);
    const enemies = preset ? bossEnemies(d, preset, s) : mkTeam(Bs, s + 7, d);
    const bt = createBattle(d, { allies, enemies, seed: s });
    const r = runAuto(bt, maxTurns);
    out[r.outcome === 'win' ? 'win' : r.outcome === 'lose' ? 'lose' : 'timeout']++;
    out.turns += r.turns;
    if (r.outcome === 'win') {
      out.turnsWin += r.turns;
      const al = bt.roster.ally.map((k) => bt.units[k]);
      out.hpLeft += al.reduce((x, u) => x + u.hp, 0) / al.reduce((x, u) => x + u.maxHp, 0);
      out.faintedA += al.filter((u) => !u.alive).length;
    }
  }
  return {
    n, winRate: out.win / n, loseRate: out.lose / n, timeoutRate: out.timeout / n,
    avgTurns: out.turns / n, avgTurnsWin: out.win ? out.turnsWin / out.win : null,
    avgHpLeftOnWin: out.win ? out.hpLeft / out.win : null, avgFaintedOnWin: out.win ? out.faintedA / out.win : null,
  };
}

// 体験版の節目(DESIGN §3-2・§9 の目安)
export const PRESETS = [
  { name: 'つみき野の入口(Lv3 の最初の1体 vs 野生3体)', a: 'nejiko:3', b: 'nejiko:2,koroishi:3,perari:2' },
  { name: 'つみき野の終わり(Lv9×3 vs 北東の群れ)', a: 'nejiko:9,koroishi:9,watabou:9', b: 'nejiko:8,perari:8,matchbo:8' },
  { name: '森の中(Lv12×3 vs 中の群れ)', a: 'nuihebi:12,koroishi:12,perari:12', b: 'jarihebi:10,inky:10,felton:10' },
  { name: 'ぬし カゲボウシ(Lv14×3)', a: 'hibachineko:14,hotarubin:14,nuihebi:14', preset: 'kageboushi' },
  { name: 'ぬし カゲボウシ(配合なし Lv14×3)', a: 'nejiko:14,koroishi:14,perari:14', preset: 'kageboushi' },
  { name: '塔の5階(Lv18×3 vs ツミキングたち)', a: 'nuihebi:18,hibachineko:18,hotarubin:18', b: 'tsumiking:16,kamishibai:16,rousokun:16' },
  { name: 'ボス トケイモリ(Lv20×3)', a: 'burikishi:20,nuihebi:20,kamishibai:20', preset: 'tokeimori' },
  { name: 'ボス トケイモリ(配合なし Lv20×3)', a: 'zenmainu:20,tsumiking:20,hotarubin:20', preset: 'tokeimori' },
  // balancer が足した「寄り道なしの平均的なパーティ」(progress_sim の真ん中あたり。docs/BALANCE.md §4)
  { name: 'ぬし カゲボウシ(平均・配合なし: 最初の1体+つみき野2+森1)', a: 'perari:14,koroishi:13,watabou:13,inky:12', preset: 'kageboushi' },
  { name: 'ぬし カゲボウシ(平均・配合あり: ヌイヘビ b0.1 入り)', a: 'nuihebi:12:b0.1,nejiko:14,koroishi:13,felton:12', preset: 'kageboushi' },
  { name: 'ボス トケイモリ(平均・配合なし)', a: 'nejiko:20,koroishi:19,felton:19,rousokun:18,watabou:18', preset: 'tokeimori' },
  { name: 'ボス トケイモリ(平均・配合あり)', a: 'nuihebi:20:b0.1,hibachineko:17:b0.1,nejiko:20,koroishi:19,felton:18', preset: 'tokeimori' },
];

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => { if (x.startsWith('--')) acc.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
  const n = +args.n || 500, seed = +args.seed || 1;
  const fmt = (r) => `勝ち ${(r.winRate * 100).toFixed(1)}% / 負け ${(r.loseRate * 100).toFixed(1)}% / 決着なし ${(r.timeoutRate * 100).toFixed(1)}% / 平均 ${r.avgTurns.toFixed(1)} ターン` +
    (r.avgHpLeftOnWin != null ? ` / 勝ったときの残りHP ${(r.avgHpLeftOnWin * 100).toFixed(0)}% ・たおれた仲間 ${r.avgFaintedOnWin.toFixed(2)}` : '');
  if (args.preset === 'all') {
    const rows = PRESETS.map((p) => ({ ...p, r: simulate({ ...p, n, seed }) }));
    if (args.json) console.log(JSON.stringify(rows, null, 1));
    else for (const p of rows) console.log(`${p.name}\n  ${fmt(p.r)}`);
  } else {
    if (!args.a || (!args.b && !args.preset)) { console.log('使い方: --a 種族:Lv,… --b 種族:Lv,… [--n 500] [--seed 1] [--preset kageboushi|tokeimori|all] [--json]'); process.exit(1); }
    const r = simulate({ a: args.a, b: args.b || '', preset: args.preset || null, n, seed });
    console.log(args.json ? JSON.stringify(r, null, 1) : fmt(r));
  }
}
