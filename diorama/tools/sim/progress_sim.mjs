// 寄り道なしの進行シミュレーター(balancer 用)。
// 最初の1体 → つみき野 → (配合)→ ランプの森 → カゲボウシ → (配合)→ 時計塔 → トケイモリ を、
// 野生戦を1戦ずつ battle.js の自動戦闘で戦わせて、Lv・ターン数・負け・お金・回復の道具代・ぬし戦の勝率を出す。
//
//   node tools/sim/progress_sim.mjs [--runs 300] [--boss 20] [--seed 1] [--route design|proposal] [--json]
//
// 「寄り道なしの平均的なプレイヤー」の決めごと(docs/BALANCE.md §2):
//   - 最初の1体は ネジコ / ペラリ / インキー から等しく選ぶ(Lv START_LV)
//   - スカウトは つみき野で2体、森で1体、塔で1体(その場の魔物の Lv で仲間になる)
//   - 毎戦、いちばん強い3体を台に出す(強さ = 種族の合計 × Lv の倍率 × (1+伸びボーナス))。4体目からは控え(経験値半分)
//   - 戦闘のはじめは満タン(宿屋・道具で回復した前提)。へった HP・MP・たおれた数を、道具の値段に直して「回復の道具代」とする
//   - 配合あり: 村にもどったとき(森の前。Lv10 が2体いなければ森の途中)に1回、カゲボウシのあとにもう1回。
//     Lv10 以上の2体(ネジコ×マッチボウがいればそれ。なければいちばん強い1体を残して弱い2体)を組む。親が減るぶん、つみき野と森で1体ずつ多くスカウトする
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDBNode } from '../../src/core/db.js';
import { createMonster, calcStats, gainXp, healFull, learnSkill, GROW } from '../../src/core/stats.js';
import { createBattle, runAuto, bossEnemies, TUNE, BOSS } from '../../src/core/battle.js';
import { breed } from '../../src/core/breed.js';
import { makeRng } from '../../src/core/rng.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const dbNow = await loadDBNode(join(ROOT, 'data'));

export const START_LV = 5;
// 野生の群れの数(1体 / 2体 / 3体 の割合)。DESIGN に書かれていないので balancer が決める(BALANCE.md §3-5)
export const GROUP = { first: [1, 0, 0], early: [0.8, 0.2, 0], mid: [0.5, 0.4, 0.1], normal: [0.4, 0.4, 0.2], late: [0.3, 0.45, 0.25] };

// 寄り道なしで通る場所と、そこで戦う回数(DESIGN §1・§9)。lv は出現レベル
export const ROUTES = {
  // DESIGN §9 の表のまま(調整前)
  design: {
    tsumiki: [
      { sp: [['nejiko', 3], ['koroishi', 3], ['perari', 2]], lv: [2, 4], n: 2, g: 'first' },
      { sp: [['koroishi', 3], ['watabou', 3], ['perari', 2]], lv: [3, 6], n: 2, g: 'early', scout: true },
      { sp: [['nejiko', 3], ['watabou', 2], ['matchbo', 1]], lv: [4, 7], n: 2, g: 'early', scoutB: true },
      { sp: [['koroishi', 1], ['nejiko', 1]], lv: [5, 7], n: 1, g: 'early', scout: true },
      { sp: [['watabou', 2], ['koroishi', 2], ['matchbo', 2], ['nejiko', 2], ['perari', 2]], lv: [6, 9], n: 3, g: 'mid' },
    ],
    forest: [
      { sp: [['inky', 3], ['felton', 2], ['watabou', 1]], lv: [7, 10], n: 3, g: 'normal', scout: true },
      { sp: [['jarihebi', 3], ['inky', 2], ['felton', 2]], lv: [8, 11], n: 3, g: 'normal' },
      { sp: [['origarasu', 2], ['hotarubin', 2]], lv: [9, 12], n: 2, g: 'normal', scoutB: true },
      { sp: [['jarihebi', 2], ['felton', 2], ['inky', 1]], lv: [9, 12], n: 2, g: 'normal' },
    ],
    tower: [
      { sp: [['zenmainu', 2], ['rousokun', 2]], lv: [11, 13], n: 2, g: 'normal' },
      { sp: [['zenmainu', 2], ['rousokun', 2], ['kamishibai', 1]], lv: [12, 14], n: 2, g: 'normal', scout: true },
      { sp: [['kamishibai', 2], ['tsumiking', 1]], lv: [13, 15], n: 3, g: 'normal' },
      { sp: [['tsumiking', 2], ['zenmainu', 2]], lv: [14, 16], n: 2, g: 'normal' },
      { sp: [['tsumiking', 2], ['kamishibai', 2], ['rousokun', 1]], lv: [15, 17], n: 3, g: 'late' },
    ],
  },
};
// balancer の案(BALANCE.md §5 の表。areas は直さず、ジオラマ大工への申し送り)
ROUTES.proposal = JSON.parse(JSON.stringify(ROUTES.design));
{
  const t = ROUTES.proposal;
  const lv = { tsumiki: [[2, 3], [3, 4], [4, 6], [5, 7], [6, 8]], forest: [[8, 10], [9, 11], [10, 12], [10, 13]], tower: [[13, 14], [14, 15], [15, 16], [15, 17], [16, 18]] };
  for (const a of Object.keys(lv)) t[a].forEach((z, i) => { z.lv = lv[a][i]; });
}

const pickW = (rng, list) => { const s = list.reduce((a, [, w]) => a + w, 0); let r = rng.next() * s; for (const [k, w] of list) { if ((r -= w) < 0) return k; } return list[0][0]; };
const pickG = (rng, p) => { const r = rng.next(); return r < p[0] ? 1 : r < p[0] + p[1] ? 2 : 3; };

export function power(db, m) { return Object.values(db.sp(m.sp).base).reduce((a, x) => a + x, 0) * (1 + GROW.lvRate * (m.lv - 1)) * (1 + (m.bonus || 0)); }
function order(db, party) { party.sort((a, b) => power(db, b) - power(db, a)); }

// 覚えるわざが4つをこえたら、いちばん弱い攻撃わざ(なければ最初のわざ)と入れかえる
function autoLearn(db, mon, evs) {
  for (const e of evs) if (e.type === 'learnFull') {
    const pw = (k) => { const s = db.sk(k); return s.pow ? s.pow : 1000; }; // 補助は残す
    const weakest = [...mon.skills].sort((a, b) => pw(a) - pw(b))[0];
    if (db.sk(e.skill).pow && pw(weakest) < db.sk(e.skill).pow) learnSkill(mon, e.skill, weakest);
  }
}

// へった HP を、いちばん安い組み合わせの道具で直す値段(森からは大きなばんそうこうも買える)。MP は宿屋でもどす前提で数えない
export function healCost(db, lost, big) {
  if (lost <= 0) return 0;
  const p = db.it('patch'), bp = db.it('bigpatch');
  if (!big) return Math.ceil(lost / p.hp) * p.price;
  const nb = Math.floor(lost / bp.hp), rest = lost - nb * bp.hp;
  return nb * bp.price + Math.min(Math.ceil(rest / p.hp) * p.price, rest > 0 ? bp.price : 0);
}
// 1戦。戦闘のはじめは満タン。結果を st に積む
function fight(db, party, enemies, rng, st, tag) {
  for (const m of party) healFull(db, m);
  order(db, party);
  const b = createBattle(db, { allies: party, enemies, rng });
  const r = runAuto(b, 80);
  st.battles++; st.turns.push(r.turns);
  (st.byArea[tag] ||= { battles: 0, turns: 0, lose: 0, gold: 0, cost: 0 });
  const A = st.byArea[tag]; A.battles++; A.turns += r.turns;
  let cost = 0;
  for (const k of b.roster.ally) {
    const u = b.units[k];
    if (!u.alive) cost += db.it('oil').price; // ぜんまいオイル
    else cost += healCost(db, u.maxHp - u.hp, tag !== 'tsumiki');
  }
  A.cost += cost; st.cost += cost;
  if (r.outcome === 'win') {
    for (const x of r.xp) { const mon = b.units[x.unit].mon; if (x.amount > 0) autoLearn(db, mon, gainXp(db, mon, x.amount)); }
    st.gold += r.gold; A.gold += r.gold;
  } else { st.lose++; A.lose++; st.gold = Math.floor(st.gold / 2); }
  return r;
}

function wildGroup(db, zone, rng) {
  const n = pickG(rng, GROUP[zone.g]);
  return Array.from({ length: n }, () => createMonster(db, { sp: pickW(rng, zone.sp), lv: rng.int(zone.lv[0], zone.lv[1]), rng, shiny: false }));
}

function doBreed(db, party, rng, st, prefer) {
  const ok = party.filter((m) => m.lv >= 10 && !db.sp(m.sp).noBreed);
  if (ok.length < 2) { st.breedLate = (st.breedLate || 0) + 1; return false; }
  let a = prefer && ok.find((m) => m.sp === prefer[0]), b = prefer && ok.find((m) => m.sp === prefer[1] && m !== a);
  if (!a || !b) { const top = [...party].sort((x, y) => power(db, y) - power(db, x))[0]; const s = ok.filter((m) => m !== top || ok.length < 3).sort((x, y) => power(db, x) - power(db, y)); a = s[0]; b = s[1]; } // いちばん強い1体は残し、弱い2体を組む
  const atk = [...new Set([...a.skills, ...b.skills])].filter((k) => db.sk(k).pow).sort((x, y) => db.sk(y).pow - db.sk(x).pow).slice(0, 2);
  const { child } = breed(db, a, b, { parts: [{ from: 'a', slot: 'back' }], skills: atk, rng });
  party.splice(party.indexOf(a), 1); party.splice(party.indexOf(b), 1);
  party.push(child);
  st.bred.push(child.sp);
  return true;
}

export const snap = (db, party) => party.map((m) => ({ sp: m.sp, lv: m.lv, bonus: m.bonus || 0, skills: [...m.skills], parts: JSON.parse(JSON.stringify(m.parts)), born: m.born, gen: m.gen }));
const clone = (db, s) => s.map((o) => createMonster(db, { ...o, shiny: false }));

export function bossTrials(db, partySnap, which, n, seed) {
  let win = 0, turns = 0, hpLeft = 0;
  for (let i = 0; i < n; i++) {
    const party = clone(db, partySnap);
    order(db, party);
    const b = createBattle(db, { allies: party, enemies: bossEnemies(db, which, seed + i), seed: seed * 7919 + i });
    const r = runAuto(b, 80);
    turns += r.turns;
    if (r.outcome === 'win') { win++; const al = b.roster.ally.map((k) => b.units[k]); hpLeft += al.reduce((x, u) => x + u.hp, 0) / al.reduce((x, u) => x + u.maxHp, 0); }
  }
  return { win: win / n, turns: turns / n, hpLeft: win ? hpLeft / win : 0 };
}

/** 1回の通しプレイ。breedMode: false=配合なし / true=配合あり */
export function playthrough(db, { route = 'design', seed = 1, breedMode = false, starter = null, bossN = 10 } = {}) {
  const rng = makeRng(seed);
  const R = ROUTES[route];
  const st = { battles: 0, turns: [], lose: 0, gold: 0, cost: 0, byArea: {}, byZone: {}, bred: [], lvTrace: [], lvTrace3: [], lvAt: {} };
  const sp0 = starter || ['nejiko', 'perari', 'inky'][rng.int(0, 2)];
  const party = [createMonster(db, { sp: sp0, lv: START_LV, rng, shiny: false, born: 'starter' })];
  const avgLv = () => { const f = [...party].sort((a, b) => power(db, b) - power(db, a)).slice(0, 3); return f.reduce((a, m) => a + m.lv, 0) / f.length; };
  const runArea = (area) => {
    R[area].forEach((z, zi) => {
      for (let i = 0; i < z.n; i++) {
        const en = wildGroup(db, z, rng);
        const r = fight(db, party, en, rng, st, area);
        const Z = (st.byZone[area + zi] ||= { n: 0, lose: 0, size: 0, lv: 0 });
        Z.n++; Z.lose += r.outcome === 'win' ? 0 : 1; Z.size += party.length; Z.lv += avgLv();
        st.lvTrace.push(Math.max(...party.map((m) => m.lv))); st.lvTrace3.push(avgLv());
        if ((z.scout || (breedMode && z.scoutB)) && i === 0) { // この場所で1体スカウト(そこの魔物の Lv)
          const sp = pickW(rng, z.sp.filter(([k]) => !party.some((m) => m.sp === k)).length ? z.sp.filter(([k]) => !party.some((m) => m.sp === k)) : z.sp);
          party.push(createMonster(db, { sp, lv: rng.int(z.lv[0], z.lv[1]), rng, shiny: false }));
        }
      }
      if (breedMode && pendingBreed && area !== 'tsumiki') { if (doBreed(db, party, rng, st, pendingBreed.prefer)) pendingBreed = null; }
    });
  };
  let pendingBreed = null;
  runArea('tsumiki');
  st.lvAt.tsumiki = avgLv();
  // 配合あり: 村にもどったとき。Lv10 が2体いなければ、森で2体そろったところで村にもどって組む
  if (breedMode && !doBreed(db, party, rng, st, ['nejiko', 'matchbo'])) pendingBreed = { prefer: ['nejiko', 'matchbo'] };
  runArea('forest');
  st.lvAt.kageboushi = avgLv();
  st.goldAt = { kageboushi: st.gold };
  st.partyAt = { kageboushi: snap(db, party) };
  st.boss = { kageboushi: bossTrials(db, st.partyAt.kageboushi, 'kageboushi', bossN, seed) };
  // ぬしの経験値・お金(勝った前提)
  {
    const k = bossEnemies(db, 'kageboushi', seed);
    const xp = Math.floor(k.reduce((a, e) => a + db.sp(e.sp).xp * e.lv / GROW.xpDiv, 0));
    order(db, party); party.forEach((m, i) => autoLearn(db, m, gainXp(db, m, i < 3 ? xp : Math.floor(xp / 2))));
    st.gold += Math.floor(k.reduce((a, e) => a + db.sp(e.sp).gold * e.lv / GROW.goldDiv, 0));
  }
  if (breedMode) doBreed(db, party, rng, st, null);
  pendingBreed = null;
  runArea('tower');
  st.lvAt.tokeimori = avgLv();
  st.goldAt.tokeimori = st.gold;
  st.partyAt.tokeimori = snap(db, party);
  st.boss.tokeimori = bossTrials(db, st.partyAt.tokeimori, 'tokeimori', bossN, seed + 1);
  return st;
}

export function summarize(list) {
  const avg = (f) => list.reduce((a, s) => a + f(s), 0) / list.length;
  const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const areas = ['tsumiki', 'forest', 'tower'];
  const allTurns = list.flatMap((s) => s.turns);
  return {
    runs: list.length,
    lv: Object.fromEntries(['tsumiki', 'kageboushi', 'tokeimori'].map((k) => [k, { avg: avg((s) => s.lvAt[k]), p10: pct(list.map((s) => s.lvAt[k]), 0.1), p90: pct(list.map((s) => s.lvAt[k]), 0.9) }])),
    turns: { avg: allTurns.reduce((a, b) => a + b, 0) / allTurns.length, p10: pct(allTurns, 0.1), p90: pct(allTurns, 0.9) },
    area: Object.fromEntries(areas.map((a) => [a, {
      turns: avg((s) => s.byArea[a].turns / s.byArea[a].battles),
      loseRate: avg((s) => s.byArea[a].lose / s.byArea[a].battles),
      gold: avg((s) => s.byArea[a].gold), cost: avg((s) => s.byArea[a].cost),
    }])),
    boss: Object.fromEntries(['kageboushi', 'tokeimori'].map((k) => [k, { win: avg((s) => s.boss[k].win), turns: avg((s) => s.boss[k].turns), hpLeft: avg((s) => s.boss[k].hpLeft) }])),
    gold: avg((s) => s.gold), cost: avg((s) => s.cost), goldAtKage: avg((s) => s.goldAt.kageboushi), goldAtToke: avg((s) => s.goldAt.tokeimori),
    battles: list[0].battles,
    trace: list[0].lvTrace.map((_, i) => avg((s) => s.lvTrace[i])), trace3: list[0].lvTrace3.map((_, i) => avg((s) => s.lvTrace3[i])),
    allTurns,
    breedLate: avg((s) => (s.breedLate ? 1 : 0)),
    zone: Object.fromEntries(Object.keys(list[0].byZone).map((k) => [k, { lose: avg((s) => s.byZone[k].lose / s.byZone[k].n), size: avg((s) => s.byZone[k].size / s.byZone[k].n), lv: avg((s) => s.byZone[k].lv / s.byZone[k].n) }])),
  };
}

export function runMany(db, { runs = 200, seed = 1, route = 'design', breedMode = false, bossN = 10 } = {}) {
  const list = [];
  for (let i = 0; i < runs; i++) list.push(playthrough(db, { route, seed: seed * 1000003 + i * 17, breedMode, bossN }));
  return { list, sum: summarize(list) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => { if (x.startsWith('--')) acc.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
  const runs = +args.runs || 200, bossN = +args.boss || 10, seed = +args.seed || 1, route = args.route || 'proposal';
  const out = {};
  for (const bm of [false, true]) out[bm ? 'breed' : 'nobreed'] = runMany(dbNow, { runs, seed, route, breedMode: bm, bossN }).sum;
  if (args.json) console.log(JSON.stringify(out, null, 1));
  else for (const [k, s] of Object.entries(out)) {
    console.log(`== ${k === 'breed' ? '配合あり' : '配合なし'}(${s.runs} 回の通し・野生 ${s.battles} 戦)`);
    console.log(`  Lv: つみき野の後 ${s.lv.tsumiki.avg.toFixed(1)} / カゲボウシ前 ${s.lv.kageboushi.avg.toFixed(1)} (${s.lv.kageboushi.p10.toFixed(1)}〜${s.lv.kageboushi.p90.toFixed(1)}) / トケイモリ前 ${s.lv.tokeimori.avg.toFixed(1)} (${s.lv.tokeimori.p10.toFixed(1)}〜${s.lv.tokeimori.p90.toFixed(1)})`);
    console.log(`  野生戦: 平均 ${s.turns.avg.toFixed(1)} ターン (10%=${s.turns.p10} 90%=${s.turns.p90})  ` + ['tsumiki', 'forest', 'tower'].map((a) => `${a} ${s.area[a].turns.toFixed(1)}T 負け${(s.area[a].loseRate * 100).toFixed(1)}% 金${s.area[a].gold.toFixed(0)} 道具代${s.area[a].cost.toFixed(0)}`).join(' / '));
    console.log(`  カゲボウシ 勝率 ${(s.boss.kageboushi.win * 100).toFixed(0)}% ${s.boss.kageboushi.turns.toFixed(1)}T 残HP${(s.boss.kageboushi.hpLeft * 100).toFixed(0)}% / トケイモリ 勝率 ${(s.boss.tokeimori.win * 100).toFixed(0)}% ${s.boss.tokeimori.turns.toFixed(1)}T 残HP${(s.boss.tokeimori.hpLeft * 100).toFixed(0)}%`);
    console.log(`  お金: カゲボウシ前 ${s.goldAtKage.toFixed(0)} / トケイモリ前 ${s.goldAtToke.toFixed(0)} / 最後 ${s.gold.toFixed(0)}  回復の道具代の合計 ${s.cost.toFixed(0)}`);
  }
}
