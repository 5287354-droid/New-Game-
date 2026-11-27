// 企画参謀の下見用プローブ(本番のソルバーは tools/solver/ に diorama-builder が作る)
// 使い方: node tools/check/area_probe.mjs <area> [tweezers]
// ギミックの状態 × 主人公のいる連結成分 で幅優先探索し、宝箱・ぬし・ゴール・出口・レアに届くか、入口に戻れるかを見る
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../../src/core/grid.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const id = process.argv[2];
const ab = { tweezers: process.argv.includes('tweezers') };
const area = JSON.parse(readFileSync(join(ROOT, 'data', 'areas', id + '.json')));
area._flags = {};
const ent = area.entries[area.entry];
const start = [ent.l, ent.x, ent.z];
const ck = (p) => p.join(':');
function comp(gs, p) {
  const seen = new Set([ck(p)]); const q = [p]; const cells = [];
  while (q.length) { const c = q.shift(); cells.push(c); for (const nb of G.neighbors(area, gs, ...c)) { const k = ck(nb); if (!seen.has(k)) { seen.add(k); q.push(nb); } } }
  return { seen, cells };
}
const targets = area.objects.filter((o) => ['chest', 'boss', 'goal', 'exit', 'stairs'].includes(o.type));
for (const r of area.rares || []) targets.push({ ...r, type: 'rare' });
const hit = new Map();
const gs0 = G.newGimmickState(area);
const states = new Map(); // key -> {gs,p}
const q = [];
const exitsO = area.objects.filter((o) => o.type === 'exit');
const canExit = (s) => exitsO.some((o) => G.interactCells(area, s.gs, o).some((cc) => s.c.seen.has(ck(cc))));
const keyOf = (gs, p) => { const c = comp(gs, p); let rep = null; for (const x of c.seen) if (rep === null || x < rep) rep = x; return G.gsKey(gs) + '|' + rep; };
const push = (gs, p, from) => {
  const c = comp(gs, p); let rep = null; for (const x of c.seen) if (rep === null || x < rep) rep = x;
  const k = G.gsKey(gs) + '|' + rep;
  if (states.has(k)) return k;
  states.set(k, { gs, p, c, from, depth: from ? states.get(from).depth + 1 : 0 }); q.push(k);
  return k;
};
const edges = [];
push(gs0, start, null);
let n = 0;
while (q.length && n < 200000) {
  n++;
  const k = q.shift(); const { gs, p, c } = states.get(k);
  for (const t of targets) {
    if (hit.has(t.id)) continue;
    let cells;
    if (t.type === 'rare') cells = [[t.l, t.x, t.z], ...G.DIRS.map(([dx, dz]) => [t.l, t.x + dx, t.z + dz])];
    else cells = G.interactCells(area, gs, t);
    if (!G.isPresent(area, gs, t)) continue;
    if (cells.some((cc) => c.seen.has(ck(cc)))) hit.set(t.id, states.get(k).depth);
  }
  for (const o of area.objects) {
    if (!G.GIMMICK_TYPES.has(o.type) || !G.isPresent(area, gs, o) && o.type !== 'socket') continue;
    const cells = G.interactCells(area, gs, o);
    const at = cells.find((cc) => c.seen.has(ck(cc)));
    if (!at) continue;
    const r = G.applyInteract(area, gs, o, at, ab);
    if (r.ok) { const nk = push(r.gs, r.player, k); edges.push([k, nk]); }
  }
  if (canExit(states.get(k))) { const g2 = G.resetLooseItems(gs); const nk = push(g2, start, k); edges.push([k, nk]); }
}
// 詰み: 出口に出られる状態へ、どうやっても戻れない状態の数(逆向きの幅優先)
const rev = new Map(); for (const [a, b] of edges) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
const good = new Set(); const qq = [];
for (const [k, s] of states) if (canExit(s)) { good.add(k); qq.push(k); }
while (qq.length) { const k = qq.pop(); for (const a of rev.get(k) || []) if (!good.has(a)) { good.add(a); qq.push(a); } }
const stuck = states.size - good.size;
// 届いた場所の地図(レベルごと)
if (process.argv.includes('map')) for (let l = 0; l < area.levels.length; l++) {
  const L = area.levels[l]; const seenAll = new Set(); for (const s of states.values()) for (const x of s.c.seen) seenAll.add(x);
  console.log('L' + l); for (let z = 0; z < L.d; z++) { let row = String(z).padStart(2) + ' '; for (let x = 0; x < L.w; x++) row += seenAll.has(l + ':' + x + ':' + z) ? '+' : (L.t[z * L.w + x] === 'w' ? '~' : ' '); console.log(row); }
}
console.log(`${id} tweezers=${ab.tweezers} states=${states.size} steps=${n}`);
const miss = targets.filter((t) => !hit.has(t.id));
console.log('届く:', targets.length - miss.length, '/', targets.length);
for (const t of miss) console.log('  届かない:', t.type, t.id, `L${t.l} (${t.x},${t.z})`, t.note || t.label || '');
console.log('詰む状態(出口へ戻れない):', stuck);
for (const t of targets) if (hit.has(t.id) && ['chest','boss','goal','rare'].includes(t.type)) console.log('  ', t.id, '最少の操作回数', hit.get(t.id));
