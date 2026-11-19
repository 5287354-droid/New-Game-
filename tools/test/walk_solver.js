/* みちくさ踏破の実際の移動の物理ソルバー(ページの中で動く。run.js が page.evaluate に渡す)
 * owTryMove / owArrive と同じ規則で、状態(いる場所 + 岩の位置 + うまった穴)を探索して、踏めるマスを集める。
 *  - 氷(i)と流れ(1234): 入ったら、ぶつかるか外に出るまで止まれない(owSlideStep)。すべる最中は岩を押せない
 *  - 押す岩(rocks): 押すと1マス動く。すべる氷塊(rockSlide)は氷の上をすべり、穴(O)に落ちたら道になる
 *  - 流氷・霧・潮・夜昼: 「どの時間でも・どの位置でも」通れるものとして、歩ける側に数える(ここは時刻しだい)
 *  - 輪・間欠泉(jumps)・トロッコ(c)・同じ地図内のワープ: 運ばれる行き先から、また探索する
 * 返り値: { total, touched(区画の番号の配列), valid(区画の番号の配列), lack, extra, states } */
module.exports = function (id) {
  const m = MAPS[id], R = m.rows.length, C = Math.max(...m.rows.map(r => r.length)); footIn();
  const chAt = (x, y) => (m.rows[y] || '')[x];
  const saveRk = OWC.rk, saveOw = state.ow, saveT = state.time, DN = Date.now, orig = owFloatPos;
  state.ow = { map: id, x: m.spawn.x, y: m.spawn.y, dir: 'down' }; OWC.rk = { map: id, rocks: [], filled: {} };
  let sel = -1; window.owFloatPos = f => { if (sel < 0) return orig(f); const t = owFloatTiles(f); return t[Math.min(sel, t.length - 1)]; };
  const mx = Math.max(1, ...(m.floats || []).map(f => owFloatTiles(f).length));
  if (m.fogStone) Date.now = () => m.fogStone.per * 1000 + m.fogStone.on + 1;
  /* 動かない地形の通れなさ(岩は空にして、穴は未うめ): どの時間・位置でも通れるなら通れる */
  const S = new Uint8Array(R * C).fill(1);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    let v = false;
    for (let t = 0; t < 4 && !v; t++) { state.time = t; for (sel = m.floats ? 0 : -1; sel < (m.floats ? mx : 0); sel++) if (!owSolid(m, x, y)) { v = true; break; } }
    sel = -1; S[y * C + x] = v ? 0 : 1;
  }
  Date.now = DN; window.owFloatPos = orig; OWC.rk = saveRk; state.ow = saveOw; state.time = saveT;
  const hasIce = m.rows.some(r => /[i1234]/.test(r));
  const slideRock = !!m.rockSlide, warps = m.warps || {};
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, DIRS = ['up', 'down', 'left', 'right'];
  const touched = new Uint8Array(R * C);
  const fi0 = footInfo(id); let left = fi0.total; const gotB = new Uint8Array(fi0.nb);
  const mark = (x, y) => { const k = y * C + x; if (touched[k]) return; touched[k] = 1; const b = (y >> 2) * fi0.bw + (x >> 2); if (fi0.valid[b] && !gotB[b]) { gotB[b] = 1; left--; } };
  const inb = (x, y) => x >= 0 && y >= 0 && x < C && y < R;
  /* 状態: rocks = ['x,y',...] (並べ替えて持つ), filled = Set ではなく 'x,y' の文字列の配列 */
  const keyOf = (rocks, filled) => rocks.join(';') + '|' + filled.join(';');
  const startRocks = (m.rocks || []).map(r => r[0] + ',' + r[1]).sort();
  const startFilled = [];
  if (!m.rockSlide) { /* 町ごとに保存される穴のうめ立ては、最初は空 */ }
  /* 探索の順番: 穴をうめた数が多い状態から先に(同じなら先に見つけた順) */
  const buckets = new Map(); let pending = 0; const seenOuter = new Set();
  const pushOuter = (rocks, filled, x, y) => { const k = keyOf(rocks, filled) + '@' + x + ',' + y; if (seenOuter.has(k)) return; seenOuter.add(k); const b = -filled.length; if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push({ rocks, filled, x, y, h: 0 }); pending++; };
  const nextState = () => { let best = null; for (const b of buckets.keys()) if (buckets.get(b).length && (best === null || b < best)) best = b; const a = buckets.get(best), st = a[a.__h || 0]; a.__h = (a.__h || 0) + 1; if (a.__h >= a.length) { a.length = 0; a.__h = 0; } pending--; return st; };
  const starts = [];
  const addStart = (x, y) => { if (inb(x, y)) starts.push([x, y]); };
  if (m.spawn) addStart(m.spawn.x, m.spawn.y); if (m.station) addStart(m.station.x, m.station.y);
  (FOOT_IN[id] || []).forEach(([x, y]) => addStart(x, y));
  [m.fallTo, m.tideSafe].forEach(p => { if (p) addStart(p.x, p.y); });
  starts.forEach(([x, y]) => pushOuter(startRocks, startFilled, x, y));
  let states = 0; const covered = new Map();   /* 歩くだけの地図: 同じ岩配置で、すでに探索した場所は飛ばす */
  const trolleyOf = (x, y) => { const rs = new Set([y * C + x]), q = [[x, y]], out = []; while (q.length) { const [cx, cy] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, c2 = chAt(nx, ny); if ((c2 === '+' || c2 === 'c') && !rs.has(ny * C + nx)) { rs.add(ny * C + nx); q.push([nx, ny]); if (c2 === 'c') out.push([nx, ny]); } } } return out; };
  while (pending > 0) {
    if (left <= 0 && !m.fullSearch) break;   /* 全区画に着いたら、もう探さなくてよい */
    const st = nextState(); const rockSet = new Set(st.rocks), filledSet = new Set(st.filled), ck = keyOf(st.rocks, st.filled);
    if (!hasIce && covered.has(ck) && covered.get(ck).has(st.y * C + st.x)) continue;
    if (++states > 400000) throw new Error(id + ': 状態が多すぎる');
    const solid = (x, y) => {
      if (!inb(x, y)) return true;
      if (rockSet.has(x + ',' + y)) return true;
      if (chAt(x, y) === 'O' && m.rocks && filledSet.has(x + ',' + y)) return false;
      return !!S[y * C + x];
    };
    /* このときの岩の並びのまま、歩ける場所を全部広げる */
    const rest = new Set(), q = []; const cover = new Set();
    const addRest = (x, y) => { if (!inb(x, y)) return; const k = y * C + x; mark(x, y); if (!rest.has(k)) { rest.add(k); q.push(x, y); } };
    addRest(st.x, st.y);
    const pushes = [];   /* 岩を押した結果: [新しい岩, 新しい穴うめ, いる場所] */
    while (q.length) {
      const y = q.pop(), x = q.pop(); cover.add(y * C + x);
      const here0 = chAt(x, y);
      if (m.jumps && m.jumps[x + ',' + y]) addRest(...m.jumps[x + ',' + y]);
      (m.rings || []).forEach(r => { if (r[0] === x && r[1] === y) addRest(r[2], r[3]); if (r[2] === x && r[3] === y) addRest(r[0], r[1]); });
      if (here0 === 'c' && m.rows.some(r => r.includes('+'))) trolleyOf(x, y).forEach(([a, b]) => addRest(a, b));
      for (const d of DIRS) {
        const [dx, dy] = D[d]; let cx = x, cy = y; let dir = d, nx = cx + dx, ny = cy + dy;
        const rk = rockSet.has(nx + ',' + ny);
        if (rk) {   /* 岩を押す(止まったまま) */
          const bx = nx + dx, by = ny + dy, bch = chAt(bx, by), bk = bx + ',' + by;
          if (bch === 'O' && m.rocks && !filledSet.has(bk)) { const nr = st.rocks.filter(r => r !== nx + ',' + ny), nf = st.filled.concat([bk]).sort(); pushes.push([nr, nf, x, y]); }
          else if (!solid(bx, by) && !warps[bk]) {
            let fx = bx, fy = by, fell = null;
            if (slideRock) while (chAt(fx, fy) === 'i') { const qx = fx + dx, qy = fy + dy, qk = qx + ',' + qy; if (chAt(qx, qy) === 'O' && !filledSet.has(qk)) { fell = qk; break; } if (solid(qx, qy) || warps[qk]) break; fx = qx; fy = qy; }
            if (fell) pushes.push([st.rocks.filter(r => r !== nx + ',' + ny), st.filled.concat([fell]).sort(), x, y]);
            else pushes.push([st.rocks.filter(r => r !== nx + ',' + ny).concat([fx + ',' + fy]).sort(), st.filled, x, y]);
          }
          continue;
        }
        if (solid(nx, ny)) continue;
        /* 歩き出す。止まるまで、1マスずつ owArrive と同じ判定 */
        let guard = 0;
        for (;;) {
          if (++guard > 400) break;
          cx = nx; cy = ny; mark(cx, cy); const here = chAt(cx, cy), wk = cx + ',' + cy, w = warps[wk];
          if (w && (!w.need || true)) { if (w.to === id) addRest(w.x, w.y); break; }
          const ring = (m.rings || []).find(r => (r[0] === cx && r[1] === cy) || (r[2] === cx && r[3] === cy));
          if (ring) { if (ring[0] === cx && ring[1] === cy) addRest(ring[2], ring[3]); else addRest(ring[0], ring[1]); break; }
          let slide = null;
          if (here === 'i') slide = dir; else if (OW_CUR[here]) { slide = OW_CUR[here]; dir = slide; }
          if (!slide) { addRest(cx, cy); break; }
          const [sx, sy] = D[slide], ax = cx + sx, ay = cy + sy;
          if (rockSet.has(ax + ',' + ay) || solid(ax, ay)) { addRest(cx, cy); break; }   /* すべっている最中は岩を押せない */
          nx = ax; ny = ay;
        }
      }
    }
    if (!hasIce) { const c = covered.get(ck) || new Set(); cover.forEach(k => c.add(k)); covered.set(ck, c); }
    for (const [nr, nf, px, py] of pushes) pushOuter(nr, nf, px, py);
  }
  const fi = footInfo(id), hit = new Set();
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (touched[y * C + x]) hit.add((y >> 2) * fi.bw + (x >> 2));
  const lack = [], valid = []; let extra = 0;
  for (let i = 0; i < fi.nb; i++) { if (fi.valid[i]) { valid.push(i); if (!hit.has(i)) lack.push(i); } else if (hit.has(i)) extra++; }
  const tiles = []; for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (touched[y * C + x]) tiles.push([x, y]);
  return { total: fi.total, lack, extra, states, tiles };
};
