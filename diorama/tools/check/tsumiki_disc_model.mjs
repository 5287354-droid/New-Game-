// つみき野の回転台パズル(docs/maps/tsumiki.md)を抽象化して確かめる。陸 = 点、台 = 腕の向き。
// 使い方: node tools/check/tsumiki_disc_model.mjs
// 本番のソルバー(tools/solver/)はマス目で確かめる。これは設計の段階での下見。
const DIR = ['N', 'E', 'S', 'W'];
const rotD = (d, k) => DIR[(DIR.indexOf(d) + k) % 4];

// handles: 陸の名前 = その陸にハンドル / 'ride' = 台の中心(乗ったまま回す)
const design = {
  start: 'R0',
  discs: {
    A: { arms: ['S'], start: 0, handles: ['ride'], bridges: { N: 'R3', E: 'R2', S: 'R0', W: 'R1' } },
    B: { arms: ['N', 'S'], start: 1, handles: ['R1'], bridges: { N: 'R7', E: 'R4', S: 'R1', W: 'R10' } },
    C: { arms: ['N', 'E'], start: 1, handles: ['R2', 'R5'], bridges: { N: 'R8', E: 'R11', S: 'R2', W: 'R5' } },
    D: { arms: ['W', 'N', 'E'], start: 2, handles: ['R4'], bridges: { N: 'R6', E: 'R5', S: 'R3', W: 'R4' } },
    E: { arms: ['N', 'S'], start: 1, handles: ['R8'], bridges: { N: 'R9', E: 'R8', S: 'R6', W: 'R7' } },
  },
};
const ids = Object.keys(design.discs);
const D = design.discs;
const arms = (id, k) => D[id].arms.map((a) => rotD(a, k));

function reach(o, p) {
  const seen = new Set([p]);
  const q = [p];
  while (q.length) {
    const c = q.shift();
    const nbs = [];
    if (c.startsWith('L:')) {
      const land = c.slice(2);
      for (const id of ids) for (const [dir, l] of Object.entries(D[id].bridges)) if (l === land && arms(id, o[ids.indexOf(id)]).includes(dir)) nbs.push('D:' + id);
    } else {
      const id = c.slice(2);
      for (const a of arms(id, o[ids.indexOf(id)])) { const l = D[id].bridges[a]; if (l) nbs.push('L:' + l); }
    }
    for (const n of nbs) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  return seen;
}
const key = (o, r) => o.join('') + '|' + [...r].sort()[0];
const st = new Map();
const q = [];
const edges = [];
const push = (o, p, from, act) => {
  const r = reach(o, p);
  const k = key(o, r);
  if (from) edges.push([from, k]);
  if (st.has(k)) return;
  st.set(k, { o, r, from, act });
  q.push(k);
};
push(ids.map((id) => D[id].start), 'L:' + design.start, null, null);
while (q.length) {
  const k = q.shift();
  const s = st.get(k);
  for (const id of ids) for (const h of D[id].handles) {
    const where = h === 'ride' ? 'D:' + id : 'L:' + h;
    if (!s.r.has(where)) continue;
    const o = s.o.slice();
    o[ids.indexOf(id)] = (o[ids.indexOf(id)] + 1) % 4;
    push(o, where, k, `${id}@${h}`);
  }
}
// 各陸への最少操作
const lands = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11'];
for (const g of lands) {
  let best = null;
  for (const [k, s] of st) if (s.r.has('L:' + g)) {
    const acts = [];
    let c = k;
    while (st.get(c).from) { acts.push(st.get(c).act); c = st.get(c).from; }
    if (!best || acts.length < best.length) best = acts.reverse();
  }
  console.log(g, best ? `${best.length} ${best.join(' ')}` : '届かない');
}
// 詰み: 入口 R0 に戻れる状態へ、どうやっても行けない状態
const good = new Set([...st].filter(([, s]) => s.r.has('L:R0')).map(([k]) => k));
let ch = true;
while (ch) { ch = false; for (const [a, b] of edges) if (!good.has(a) && good.has(b)) { good.add(a); ch = true; } }
console.log('到達できる状態', st.size, '詰む状態', st.size - good.size);
process.exit(st.size - good.size ? 1 : 0);
