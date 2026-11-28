// 調整前と調整後をモンテカルロで比べて、docs/balance/ に SVG のグラフと report.json を書く(balancer 用)。
//   node tools/sim/balance_report.mjs [--runs 200] [--boss 10] [--base 507e212]
// 調整前 = git の基準コミット(--base)の data/*.json と、そのときの定数(BEFORE)。調整後 = いまの data/*.json と定数。
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDB } from '../../src/core/db.js';
import { TUNE, BOSS } from '../../src/core/battle.js';
import { GROW, xpForLevel } from '../../src/core/stats.js';
import { runMany, dbNow } from './progress_sim.mjs';
import { scoutTable } from './scout_sim.mjs';
import { simulate, PRESETS } from './battle_sim.mjs';
import { matrix, WILD } from './matchup.mjs';
import { examples } from './damage_examples.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'balance');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => { if (x.startsWith('--')) acc.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const RUNS = +args.runs || 200, BOSSN = +args.boss || 10, BASE = args.base || '507e212';

// 調整前の定数(Phase2 の実装班のまま)
export const BEFORE = {
  TUNE: { powDiv: 16, adv: 1.5, disadv: 0.67, stab: 1.2, back: 0.7, all: 0.75, critRate: 1 / 16, critMul: 1.5, healDiv: 40, shadowAtk: 1.2, shadowHit: 0.25 },
  GROW: { lvRate: 0.1, xpA: 2.5, xpP: 2.2, xpDiv: 3, goldDiv: 5 },
  BOSS: { kageboushi: { lv: 14, minion: 'origarasu', minionLv: 11, minions: 2 }, tokeimori: { lv: 20, minion: 'zenmainu', minionLv: 16, minions: 2, reinforce: 2 } },
};
const AFTER = { TUNE: { ...TUNE }, GROW: { ...GROW }, BOSS: JSON.parse(JSON.stringify(BOSS)) };
const setConsts = (c) => { Object.assign(TUNE, c.TUNE); Object.assign(GROW, c.GROW); for (const k of Object.keys(c.BOSS)) Object.assign(BOSS[k], c.BOSS[k]); };

const gitJSON = (f) => JSON.parse(execSync(`git show ${BASE}:diorama/data/${f}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
const dbBefore = makeDB({ monsters: gitJSON('monsters.json'), skills: gitJSON('skills.json'), breed: gitJSON('breed.json'), items: gitJSON('items.json') });

function measure(db, consts, route) {
  setConsts(consts);
  const t0 = Date.now();
  const nob = runMany(db, { runs: RUNS, seed: 11, route, breedMode: false, bossN: BOSSN }).sum;
  const bre = runMany(db, { runs: RUNS, seed: 11, route, breedMode: true, bossN: BOSSN }).sum;
  const scout = scoutTable(db, { hp: 0.25, runs: 20, route });
  const presets = PRESETS.map((p) => ({ name: p.name, r: simulate({ ...p, n: 400, seed: 3, db }) }));
  const mx = matrix(db, WILD, 10, 60);
  const dmg = examples(db);
  const xp = Array.from({ length: 30 }, (_, i) => xpForLevel(i + 1));
  console.error(`  ${route}: ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  return { dmg, nob, bre, scout, presets, mx: mx.map((r) => r.map((c) => Math.round(c.win * 100))), xp };
}

console.error('調整前を測る…');
const before = measure(dbBefore, BEFORE, 'design');
console.error('調整後を測る…');
const after = measure(dbNow, AFTER, 'proposal');
setConsts(AFTER);
// 大きな配列はグラフに使うだけなので、json には要約だけ
const slim = (m) => ({ ...m, nob: { ...m.nob, allTurns: undefined }, bre: { ...m.bre, allTurns: undefined } });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ runs: RUNS, bossN: BOSSN, base: BASE, before: slim(before), after: slim(after) }, null, 1));

// ---------- SVG ----------
const C = { before: '#257de0', after: '#f47230', band: '#ebebeb', text: '#191919', sub: '#666666', grid: '#e2e2e2', surface: '#ffffff' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = "font-family='Hiragino Sans, Noto Sans JP, sans-serif'";
function frame(w, h, title, sub, body) {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' ${FONT}>
<rect width='${w}' height='${h}' fill='${C.surface}'/>
<text x='16' y='26' font-size='16' font-weight='700' fill='${C.text}'>${esc(title)}</text>
<text x='16' y='46' font-size='12' fill='${C.sub}'>${esc(sub)}</text>
${body}
</svg>
`;
}
function legend(x, y, items) {
  return items.map(([label, color, kind], i) => {
    const xx = x + i * 150;
    const mark = kind === 'band' ? `<rect x='${xx}' y='${y - 9}' width='14' height='10' fill='${color}'/>` : `<rect x='${xx}' y='${y - 9}' width='14' height='10' rx='2' fill='${color}'/>`;
    return `${mark}<text x='${xx + 20}' y='${y}' font-size='12' fill='${C.text}'>${esc(label)}</text>`;
  }).join('');
}
function axes(L, T, W, H, ymin, ymax, ystep, yfmt = (v) => v) {
  let s = '';
  for (let v = ymin; v <= ymax + 1e-9; v += ystep) {
    const y = T + H - (v - ymin) / (ymax - ymin) * H;
    s += `<line x1='${L}' x2='${L + W}' y1='${y}' y2='${y}' stroke='${C.grid}' stroke-width='1'/><text x='${L - 6}' y='${y + 4}' font-size='11' fill='${C.sub}' text-anchor='end'>${yfmt(v)}</text>`;
  }
  return s;
}
// 折れ線(series: [{label,color,pts:[[x,y]]}])、bands: [{x0,x1,y0,y1,label}]
function lineChart({ title, sub, series, bands = [], xmax, ymin = 0, ymax, ystep, xlabel, ylabel, xticks = [], w = 720, h = 400 }) {
  const L = 56, T = 90, W = w - L - 24, H = h - T - 56;
  const X = (x) => L + x / xmax * W, Y = (y) => T + H - (y - ymin) / (ymax - ymin) * H;
  let b = axes(L, T, W, H, ymin, ymax, ystep);
  for (const bd of bands) b += `<rect x='${X(bd.x0)}' y='${Y(bd.y1)}' width='${X(bd.x1) - X(bd.x0)}' height='${Y(bd.y0) - Y(bd.y1)}' fill='${C.band}'><title>${esc(bd.label)}</title></rect><text x='${X(bd.x0) + 4}' y='${Y(bd.y1) - 4}' font-size='11' fill='${C.sub}'>${esc(bd.label)}</text>`;
  for (const t of xticks) b += `<line x1='${X(t.x)}' x2='${X(t.x)}' y1='${T}' y2='${T + H}' stroke='${C.grid}' stroke-dasharray='3 3'/><text x='${X(t.x)}' y='${T + H + 16}' font-size='11' fill='${C.sub}' text-anchor='${X(t.x) > L + W - 30 ? 'end' : 'middle'}'>${esc(t.label)}</text>`;
  for (const s of series) {
    b += `<polyline fill='none' stroke='${s.color}' stroke-width='2' stroke-linejoin='round' points='${s.pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(Math.min(ymax, y)).toFixed(1)}`).join(' ')}'/>`;
    b += s.pts.map(([x, y]) => `<circle cx='${X(x).toFixed(1)}' cy='${Y(Math.min(ymax, y)).toFixed(1)}' r='6' fill='transparent'><title>${esc(s.label)} ${x}: ${typeof y === 'number' ? y.toFixed(1) : y}</title></circle>`).join('');
    const [lx, ly] = s.pts[s.pts.length - 1];
    b += `<text x='${X(lx) - 4}' y='${Y(Math.min(ymax, ly)) - 8}' font-size='12' fill='${C.text}' text-anchor='end'>${esc(s.label)} ${ly.toFixed(1)}</text>`;
  }
  b += `<text x='${L + W / 2}' y='${h - 12}' font-size='12' fill='${C.sub}' text-anchor='middle'>${esc(xlabel)}</text>`;
  b += `<text x='14' y='${T + H / 2}' font-size='12' fill='${C.sub}' transform='rotate(-90 14 ${T + H / 2})' text-anchor='middle'>${esc(ylabel)}</text>`;
  b += legend(L, 70, [...series.map((s) => [s.label, s.color]), ...(bands.length ? [['目標', C.band, 'band']] : [])]);
  return frame(w, h, title, sub, b);
}
// 横並びの棒(groups: [{label, values:[before, after]}])
function barChart({ title, sub, groups, ymax, ystep, yfmt = (v) => v, band = null, w = 720, h = 380, valueFmt = (v) => v }) {
  const L = 56, T = 70, W = w - L - 24, H = h - T - 74;
  const Y = (y) => T + H - Math.min(y, ymax) / ymax * H;
  let b = axes(L, T, W, H, 0, ymax, ystep, yfmt);
  if (band) b += `<rect x='${L}' y='${Y(band[1])}' width='${W}' height='${Y(band[0]) - Y(band[1])}' fill='${C.band}' opacity='0.8'><title>目標 ${band[0]}〜${band[1]}</title></rect>`;
  const gw = W / groups.length, bw = Math.min(26, (gw - 14) / 2);
  groups.forEach((g, i) => {
    const cx = L + gw * i + gw / 2;
    g.values.forEach((v, j) => {
      const x = cx - bw - 1 + j * (bw + 2), y = Y(v), hh = T + H - y;
      const col = j === 0 ? C.before : C.after;
      b += `<path d='M${x},${T + H} V${y + Math.min(4, hh)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${T + H} Z' fill='${col}'><title>${esc(g.label)} ${j === 0 ? '調整前' : '調整後'}: ${valueFmt(v)}</title></path>`;
      if (j === 1 || groups.length <= 8) b += `<text x='${x + bw / 2}' y='${y - 4}' font-size='10' fill='${C.text}' text-anchor='middle'>${valueFmt(v)}</text>`;
    });
    b += `<text x='${cx}' y='${T + H + 14}' font-size='11' fill='${C.text}' text-anchor='middle'>${esc(g.label)}</text>`;
    if (g.sub) b += `<text x='${cx}' y='${T + H + 28}' font-size='10' fill='${C.sub}' text-anchor='middle'>${esc(g.sub)}</text>`;
  });
  b += legend(L, h - 14, [['調整前', C.before], ['調整後', C.after], ...(band ? [['目標', C.band, 'band']] : [])]);
  return frame(w, h, title, sub, b);
}
const pct = (v) => `${Math.round(v * 100)}%`;

// 1. 成長曲線(戦った回数 → いちばん Lv の高い仲間)
{
  const tick = (s) => { const n = { tsumiki: 10, forest: 10 }; return [{ x: n.tsumiki, label: 'つみき野→森' }, { x: n.tsumiki + n.forest, label: 'カゲボウシ' }, { x: s.length, label: 'トケイモリ' }]; };
  const svg = lineChart({
    title: '成長曲線: 寄り道なしで戦った回数と、台に出る3体の平均 Lv', sub: `配合なし・${RUNS} 回の通しの平均。調整前は DESIGN §9 の出現 Lv、調整後は BALANCE.md §5 の案`,
    series: [{ label: '調整前', color: C.before, pts: before.nob.trace3.map((y, i) => [i + 1, y]) }, { label: '調整後', color: C.after, pts: after.nob.trace3.map((y, i) => [i + 1, y]) }],
    bands: [{ x0: 8, x1: 10, y0: 9, y1: 10, label: 'Lv9〜10' }, { x0: 18, x1: 20, y0: 12, y1: 14, label: 'Lv12〜14' }, { x0: 30, x1: 32, y0: 18, y1: 20, label: 'Lv18〜20' }],
    xmax: 32, ymax: 30, ystep: 5, xlabel: '野生戦の回数(つみき野10・森10・塔12)', ylabel: 'Lv', xticks: tick(after.nob.trace),
  });
  writeFileSync(join(OUT, 'growth.svg'), svg);
}
// 2. 野生戦のターン数の分布
{
  const hist = (arr) => { const h = Array(9).fill(0); for (const t of arr) h[Math.min(8, t - 1)]++; return h.map((x) => x / arr.length); };
  const hb = hist(before.nob.allTurns), ha = hist(after.nob.allTurns);
  const svg = barChart({
    title: '野生戦が何ターンで終わるか', sub: `配合なし・寄り道なしの野生戦 ${before.nob.allTurns.length} 戦ずつ。平均 ${before.nob.turns.avg.toFixed(1)} → ${after.nob.turns.avg.toFixed(1)} ターン(目標 3〜5)`,
    groups: hb.map((v, i) => ({ label: i === 8 ? '9+' : String(i + 1), values: [v, ha[i]] })), ymax: 0.4, ystep: 0.1, yfmt: pct, valueFmt: pct,
  });
  writeFileSync(join(OUT, 'turns.svg'), svg);
}
// 3. ぬし・ボスの勝率
{
  const g = [
    { label: 'カゲボウシ', sub: '配合なし', values: [before.nob.boss.kageboushi.win, after.nob.boss.kageboushi.win] },
    { label: 'カゲボウシ', sub: '配合あり', values: [before.bre.boss.kageboushi.win, after.bre.boss.kageboushi.win] },
    { label: 'トケイモリ', sub: '配合なし', values: [before.nob.boss.tokeimori.win, after.nob.boss.tokeimori.win] },
    { label: 'トケイモリ', sub: '配合あり', values: [before.bre.boss.tokeimori.win, after.bre.boss.tokeimori.win] },
  ];
  writeFileSync(join(OUT, 'boss.svg'), barChart({ title: 'ぬし・ボスの勝率(その時点の寄り道なしパーティ)', sub: `${RUNS} 回の通し × ${BOSSN} 戦。目標: 配合なし 55〜70%(帯)、配合あり 80% 以上`, groups: g, ymax: 1, ystep: 0.25, yfmt: pct, valueFmt: pct, band: [0.55, 0.7] }));
  const t = [
    { label: 'カゲボウシ', sub: '配合なし', values: [before.nob.boss.kageboushi.turns, after.nob.boss.kageboushi.turns] },
    { label: 'カゲボウシ', sub: '配合あり', values: [before.bre.boss.kageboushi.turns, after.bre.boss.kageboushi.turns] },
    { label: 'トケイモリ', sub: '配合なし', values: [before.nob.boss.tokeimori.turns, after.nob.boss.tokeimori.turns] },
    { label: 'トケイモリ', sub: '配合あり', values: [before.bre.boss.tokeimori.turns, after.bre.boss.tokeimori.turns] },
  ];
  writeFileSync(join(OUT, 'boss_turns.svg'), barChart({ title: 'ぬし・ボス戦の長さ(平均ターン、負けもふくむ)', sub: '目標 8〜12 ターン(帯)', groups: t, ymax: 16, ystep: 4, band: [8, 12], valueFmt: (v) => v.toFixed(1) }));
}
// 4. スカウト
{
  const g = after.scout.map((r, i) => ({ label: r.sp.slice(0, 5), values: [before.scout[i].tries, r.tries] }));
  writeFileSync(join(OUT, 'scout.svg'), barChart({ title: 'スカウト: HP 1/4 にしてから成功するまでの回数(ねばり込みの期待値)', sub: 'ニスなし。その場所にいるときの寄り道なしパーティ。目標: 1回目の成功率 20〜33%(=3〜5回に1回)、期待回数 2.5〜4 回(帯)', groups: g, ymax: 5, ystep: 1, band: [2.5, 4], valueFmt: (v) => v.toFixed(1), w: 900 }));
}
// 5. お金
{
  const A = ['tsumiki', 'forest', 'tower'], N = { tsumiki: 'つみき野', forest: 'ランプの森', tower: '時計塔' };
  const g = A.map((a) => ({ label: N[a], sub: '稼ぎ ÷ 全回復の道具代', values: [before.nob.area[a].gold / before.nob.area[a].cost, after.nob.area[a].gold / after.nob.area[a].cost] }));
  writeFileSync(join(OUT, 'economy.svg'), barChart({ title: 'お金のつり合い: 稼いだお金 ÷ 毎戦を道具で全回復したときの値段', sub: '配合なし。1 を下まわるぶんは、宿屋(ただ)と回復わざでまかなう。目標 0.35〜0.9(帯)', groups: g, ymax: 1.2, ystep: 0.2, yfmt: (v) => v.toFixed(1), band: [0.35, 0.9], valueFmt: (v) => v.toFixed(2) }));
}
// 6. 経験値の表
{
  const svg = lineChart({
    title: '経験値の表 T(L): Lv L に上がるのに要る合計', sub: `調整前 2.5×(L−1)^2.2 / 調整後 ${GROW.xpA}×(L−1)^${GROW.xpP}(1戦の経験値は Σ xp×Lv÷${GROW.xpDiv})`,
    series: [{ label: '調整前', color: C.before, pts: before.xp.map((y, i) => [i + 1, y]) }, { label: '調整後', color: C.after, pts: after.xp.map((y, i) => [i + 1, y]) }],
    xmax: 30, ymax: 25000, ystep: 5000, xlabel: 'Lv', ylabel: '経験値の合計',
  });
  writeFileSync(join(OUT, 'xp_table.svg'), svg);
}
// 7. 種族ごとの1対1の強さ(Lv10 どうし、相手18種の平均勝率)
{
  const avgRow = (m) => m.map((r) => r.reduce((a, x) => a + x, 0) / r.length / 100);
  const ab = avgRow(before.mx), aa = avgRow(after.mx);
  const g = WILD.map((sp, i) => ({ label: sp.slice(0, 5), values: [ab[i], aa[i]] }));
  writeFileSync(join(OUT, 'species.svg'), barChart({ title: '種族の1対1の強さ(Lv10 どうし・18種との平均勝率)', sub: '左から つみき野6・森4・塔4・ハリボテ・配合のみ3。同じ場所の中でそろっているかを見る', groups: g, ymax: 1, ystep: 0.25, yfmt: pct, valueFmt: (v) => Math.round(v * 100), w: 1000 }));
}

// ---------- 表(BALANCE.md に貼る) ----------
const f1 = (x) => x.toFixed(1), p0 = (x) => `${Math.round(x * 100)}%`;
const row = (k, fb, fa) => `| ${k} | ${fb} | ${fa} |`;
const md = [];
md.push('| 項目 | 調整前 | 調整後 |', '|---|---|---|');
for (const [mode, nm] of [['nob', '配合なし'], ['bre', '配合あり']]) {
  const B = before[mode], A = after[mode];
  md.push(row(`${nm}: Lv(つみき野の後 / カゲボウシ前 / トケイモリ前)※台の3体の平均`, `${f1(B.lv.tsumiki.avg)} / ${f1(B.lv.kageboushi.avg)} / ${f1(B.lv.tokeimori.avg)}`, `${f1(A.lv.tsumiki.avg)} / ${f1(A.lv.kageboushi.avg)} / ${f1(A.lv.tokeimori.avg)}`));
  md.push(row(`${nm}: いちばん強い1体の Lv(同)`, `${f1(B.trace[9])} / ${f1(B.trace[19])} / ${f1(B.trace[31])}`, `${f1(A.trace[9])} / ${f1(A.trace[19])} / ${f1(A.trace[31])}`));
  md.push(row(`${nm}: 野生戦の平均ターン(10%〜90%)`, `${f1(B.turns.avg)}(${B.turns.p10}〜${B.turns.p90})`, `${f1(A.turns.avg)}(${A.turns.p10}〜${A.turns.p90})`));
  md.push(row(`${nm}: 野生戦の負け(つみき野 / 森 / 塔)`, ['tsumiki', 'forest', 'tower'].map((a) => p0(B.area[a].loseRate)).join(' / '), ['tsumiki', 'forest', 'tower'].map((a) => p0(A.area[a].loseRate)).join(' / ')));
  md.push(row(`${nm}: カゲボウシ 勝率・ターン`, `${p0(B.boss.kageboushi.win)}・${f1(B.boss.kageboushi.turns)}`, `${p0(A.boss.kageboushi.win)}・${f1(A.boss.kageboushi.turns)}`));
  md.push(row(`${nm}: トケイモリ 勝率・ターン`, `${p0(B.boss.tokeimori.win)}・${f1(B.boss.tokeimori.turns)}`, `${p0(A.boss.tokeimori.win)}・${f1(A.boss.tokeimori.turns)}`));
  md.push(row(`${nm}: 稼ぎ(つみき野 / 森 / 塔)`, ['tsumiki', 'forest', 'tower'].map((a) => Math.round(B.area[a].gold)).join(' / '), ['tsumiki', 'forest', 'tower'].map((a) => Math.round(A.area[a].gold)).join(' / ')));
  md.push(row(`${nm}: 全回復の道具代(同)`, ['tsumiki', 'forest', 'tower'].map((a) => Math.round(B.area[a].cost)).join(' / '), ['tsumiki', 'forest', 'tower'].map((a) => Math.round(A.area[a].cost)).join(' / ')));
}
md.push('', '| battle_sim の節目 | 調整前 勝率・ターン | 調整後 勝率・ターン |', '|---|---|---|');
for (let i = 0; i < after.presets.length; i++) {
  const B = before.presets[i]?.r, A = after.presets[i].r;
  md.push(`| ${after.presets[i].name} | ${B ? `${p0(B.winRate)}・${f1(B.avgTurns)}` : '—'} | ${p0(A.winRate)}・${f1(A.avgTurns)} |`);
}
md.push('', '| 場所 | 種族 | Lv | scout 前→後 | 1回目の成功率 前→後 | 期待回数 前→後 | ニスあり(後) |', '|---|---|---|---|---|---|---|');
after.scout.forEach((r, i) => { const b = before.scout[i]; md.push(`| ${r.area} | ${r.sp} | ${r.lv} | ${b.scout}→${r.scout} | ${p0(b.p)}→${p0(r.p)} | ${f1(b.tries)}→${f1(r.tries)} | ${f1(r.triesVarnish)} |`); });
md.push('', '| 攻撃 | わざ | 受ける側 | 調整前 ダメージ/HP | 調整後 ダメージ/HP |', '|---|---|---|---|---|');
after.dmg.forEach((r, i) => { const b = before.dmg[i]; md.push(`| ${r.att} | ${r.skill} | ${r.def} | ${b.dmg} / ${b.hp}(${b.hits}発) | ${r.dmg} / ${r.hp}(${r.hits}発) |`); });
writeFileSync(join(OUT, 'tables.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
