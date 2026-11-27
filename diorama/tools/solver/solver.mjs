// ソルバー: ギミックの状態 + 主人公のいる連結成分 を1つの状態として幅優先探索する。
// 使い方: node tools/solver/solver.mjs [village tsumiki forest tower] [--quiet]
//   → 結果を表示し、tools/solver/plans/<area>.json に「最少の操作手順」を書く。合格しなければ終了コード 1
//
// 確かめること(checkArea)
//   1. ピンセットあり: 入口から全部の宝箱・棚・人・出口・階段・ぬし・ゴール・巣に届く
//   2. どの到達状態からでも入口(または開いている出口)に戻れる(詰まない)
//   3. needs:['tweezers'] の印の物は、ピンセットなしでは届かず、ありでは届く
//   4. エリアごとの約束(expect): 例 時計塔は「大きい歯車を外せないと 6階に行けない」
//
// 速くする工夫
//   - 歩くのは0手。1手 = ギミックを1回動かす(ハンドル・ランプ台・文字盤・つまむ・置く)。だから状態の数は「ギミックの状態 × 連結成分」
//   - 連結成分は「階ごと」に数える。階の歩ける形を決める変数(その階の台・輪・ランプ・その階にある物)だけで鍵を作り、
//     ラベル付けを状態どうしで使い回す。階どうしは階段で union-find してつなぐ
//   - ギミックの状態は混合基数の整数に詰める(状態の鍵 = 整数 × マス数 + 成分の代表マス)
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../../src/core/grid.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TARGET_TYPES = new Set(['chest', 'shelf', 'npc', 'boss', 'goal', 'clockface', 'exit', 'stairs', 'sign', 'statue']);

export function loadArea(id) {
  const a = JSON.parse(readFileSync(join(ROOT, 'data', 'areas', id + '.json'), 'utf8'));
  a._flags = {};
  return a;
}

// ---------------------------------------------------------------- 状態の詰め方
function makeCodec(area) {
  const vars = []; // { kind, id, radix, values? , levels:Set }
  for (const d of area.discs || []) vars.push({ kind: 'disc', id: d.id, radix: 4, levels: new Set([d.l]) });
  for (const r of area.rings || []) vars.push({ kind: 'ring', id: r.id, radix: 4, levels: new Set([r.l]) });
  const hasLamp = (area.casters || []).length > 0 || area.objects.some((o) => o.type === 'lampStation');
  if (hasLamp) vars.push({ kind: 'lamp', id: 'lamp', radix: 3, levels: new Set(area.levels.map((L, l) => l).filter((l) => area.levels[l].t.includes('c'))) });
  const sockets = area.objects.filter((o) => o.type === 'socket');
  for (const s of sockets) if (s.kind === 'gear' && s.link) vars.push({ kind: 'gp', id: s.id, radix: 2, levels: new Set() });
  for (const it of area.objects.filter((o) => o.type === 'item')) {
    const fitting = sockets.filter((s) => G.fits(area, it.item, s));
    const values = ['home', 'held', ...fitting.map((s) => s.id)];
    const levels = new Set([it.l, ...fitting.map((s) => s.l)]);
    if (fitting.some((s) => s.kind === 'cutout')) for (const L of area.levels.keys()) if (area.levels[L].t.includes('c')) levels.add(L);
    vars.push({ kind: 'item', id: it.item, radix: values.length, values, levels });
  }
  let total = 1;
  for (const v of vars) { v.mul = total; total *= v.radix; }
  if (total > 2 ** 40) throw new Error('状態が多すぎて整数に詰められない: ' + total);
  const encode = (gs) => {
    let c = 0;
    for (const v of vars) {
      let x;
      if (v.kind === 'disc') x = gs.disc[v.id];
      else if (v.kind === 'ring') x = gs.ring[v.id];
      else if (v.kind === 'lamp') x = gs.lamp;
      else if (v.kind === 'gp') x = gs.gp[v.id] || 0;
      else x = v.values.indexOf(gs.items[v.id]);
      if (x < 0) throw new Error('詰められない値 ' + v.id + '=' + gs.items[v.id]);
      c += x * v.mul;
    }
    return c;
  };
  const decode = (c) => {
    const gs = { disc: {}, ring: {}, lamp: area.lampStart ?? 0, gp: {}, items: {}, held: null };
    for (const s of sockets) if (s.kind === 'gear') gs.gp[s.id] = 0;
    for (const v of vars) {
      const x = Math.floor(c / v.mul) % v.radix;
      if (v.kind === 'disc') gs.disc[v.id] = x;
      else if (v.kind === 'ring') gs.ring[v.id] = x;
      else if (v.kind === 'lamp') gs.lamp = x;
      else if (v.kind === 'gp') gs.gp[v.id] = x;
      else { gs.items[v.id] = v.values[x]; if (v.values[x] === 'held') gs.held = v.id; }
    }
    return gs;
  };
  // 階 l の歩ける形を決める変数だけの鍵
  const levelVars = area.levels.map((L, l) => vars.filter((v) => v.levels.has(l)));
  const levelKey = (c, l) => {
    let k = 0, m = 1;
    for (const v of levelVars[l]) { k += (Math.floor(c / v.mul) % v.radix) * m; m *= v.radix; }
    return k;
  };
  return { vars, total, encode, decode, levelKey };
}

// ---------------------------------------------------------------- 連結成分
function makeWalker(area, codec) {
  const nL = area.levels.length;
  const off = [];
  let K = 0;
  for (const L of area.levels) { off.push(K); K += L.w * L.d; }
  const levelCache = area.levels.map(() => new Map());
  const stairs = area.objects.filter((o) => o.type === 'stairs' && o.to);
  // 状態によって変わりうるマス(台・輪・物の元の場所・くぼみ・谷・振り子)だけ、毎回 cell() を呼ぶ。ほかは1回だけ
  const gsBase = G.newGimmickState(area);
  const dyn = area.levels.map((L, l) => {
    const m = new Uint8Array(L.w * L.d);
    for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) {
      if (G.moverAt(area, l, x, z) || L.t[z * L.w + x] === 'c') m[z * L.w + x] = 1;
    }
    for (const o of area.objects) if (o.l === l && ['item', 'socket'].includes(o.type)) m[o.z * L.w + o.x] = 1;
    for (const o of area.objects) if (o.l === l && o.type === 'pendulum') for (const [x, z] of o.cells || [[o.x, o.z]]) m[z * L.w + x] = 1;
    return m;
  });
  const staticCells = area.levels.map((L, l) => {
    const cs = new Array(L.w * L.d);
    for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) if (!dyn[l][z * L.w + x]) cs[z * L.w + x] = G.cell(area, gsBase, l, x, z);
    return cs;
  });
  function labelLevel(gs, l) {
    const L = area.levels[l];
    const N = L.w * L.d;
    const cs = staticCells[l].slice();
    const dm = dyn[l];
    for (let i = 0; i < N; i++) if (dm[i]) cs[i] = G.cell(area, gs, l, i % L.w, (i - (i % L.w)) / L.w);
    const comp = new Int32Array(N).fill(-1);
    const mins = [];
    const q = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (comp[i] >= 0 || !G.walkable(cs[i])) continue;
      const id = mins.length;
      let qh = 0, qt = 0, mn = i;
      q[qt++] = i; comp[i] = id;
      while (qh < qt) {
        const j = q[qh++];
        if (j < mn) mn = j;
        const x = j % L.w, z = (j - x) / L.w;
        for (const [dx, dz] of G.DIRS) {
          const xx = x + dx, zz = z + dz;
          if (xx < 0 || zz < 0 || xx >= L.w || zz >= L.d) continue;
          const k = zz * L.w + xx;
          if (comp[k] >= 0 || !G.canStep(cs[j], cs[k])) continue;
          comp[k] = id; q[qt++] = k;
        }
      }
      mins.push(mn);
    }
    return { comp, mins };
  }
  const fullCache = new Map();
  function walkInfo(code, gs) {
    const labs = [];
    const keys = [];
    for (let l = 0; l < nL; l++) {
      const k = codec.levelKey(code, l);
      keys.push(k);
      let lab = levelCache[l].get(k);
      if (!lab) { lab = labelLevel(gs || codec.decode(code), l); levelCache[l].set(k, lab); }
      labs.push(lab);
    }
    const fk = keys.join(',');
    let info = fullCache.get(fk);
    if (info) return info;
    // 階段で union-find
    const base = [];
    let n = 0;
    for (let l = 0; l < nL; l++) { base.push(n); n += labs[l].mins.length; }
    const par = new Int32Array(n);
    for (let i = 0; i < n; i++) par[i] = i;
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (const s of stairs) {
      const L1 = area.levels[s.l], L2 = area.levels[s.to.l];
      const c1 = labs[s.l].comp[s.z * L1.w + s.x], c2 = labs[s.to.l].comp[s.to.z * L2.w + s.to.x];
      if (c1 < 0 || c2 < 0) continue;
      const a = find(base[s.l] + c1), b = find(base[s.to.l] + c2);
      if (a !== b) par[a] = b;
    }
    const repOfRoot = new Map();
    for (let l = 0; l < nL; l++) labs[l].mins.forEach((mn, c) => {
      const r = find(base[l] + c), v = off[l] + mn;
      if (!repOfRoot.has(r) || repOfRoot.get(r) > v) repOfRoot.set(r, v);
    });
    const rep = labs.map((lab, l) => Int32Array.from(lab.mins, (_, c) => repOfRoot.get(find(base[l] + c))));
    info = { labs, rep };
    fullCache.set(fk, info);
    return info;
  }
  const repOf = (info, l, x, z) => {
    const L = area.levels[l];
    if (!L || x < 0 || z < 0 || x >= L.w || z >= L.d) return -1;
    const c = info.labs[l].comp[z * L.w + x];
    return c < 0 ? -1 : info.rep[l][c];
  };
  const cellOf = (g) => { let l = 0; while (l + 1 < nL && off[l + 1] <= g) l++; const L = area.levels[l]; const i = g - off[l]; return [l, i % L.w, Math.floor(i / L.w)]; };
  return { K, off, walkInfo, repOf, cellOf, levelCache, fullCache };
}

// ---------------------------------------------------------------- 幅優先探索
export function solveArea(area, opts = {}) {
  const abilities = opts.abilities || {};
  const flags = opts.flags || {};
  const forbidTake = new Set(opts.forbidTake || []);
  const forbidUse = new Set(opts.forbidUse || []);
  const maxStates = opts.maxStates || 6e6;
  const codec = makeCodec(area);
  const W = makeWalker(area, codec);
  const ent = area.entries[area.entry];
  const start = [ent.l, ent.x, ent.z];
  const gimmicks = area.objects.filter((o) => G.GIMMICK_TYPES.has(o.type));
  const exits = area.objects.filter((o) => o.type === 'exit');
  const targets = area.objects.filter((o) => TARGET_TYPES.has(o.type) && !(o.type === 'shelf' && !o.item && !o.book && !o.text));
  for (const r of area.rares || []) targets.push({ ...r, type: 'rare' });

  const ids = new Map();
  const codes = [], reps = [], parent = [], viaObj = [], viaCell = [], depth = [];
  const eStart = [], eTo = [];
  const hit = new Map(); // target id -> state index
  const push = (code, rep, from, oi, cellG) => {
    const key = code * W.K + rep;
    let id = ids.get(key);
    if (id !== undefined) return id;
    id = codes.length;
    ids.set(key, id);
    codes.push(code); reps.push(rep); parent.push(from); viaObj.push(oi); viaCell.push(cellG);
    depth.push(from < 0 ? 0 : depth[from] + 1);
    return id;
  };
  const gs0 = G.newGimmickState(area);
  const code0 = codec.encode(gs0);
  const info0 = W.walkInfo(code0, gs0);
  const rep0 = W.repOf(info0, ...start);
  if (rep0 < 0) throw new Error(area.id + ': 入口のマスに立てない');
  push(code0, rep0, -1, -1, -1);
  const gOf = (l, x, z) => W.off[l] + z * area.levels[l].w + x;
  const resetCode = (gs) => codec.encode(G.resetLooseItems(gs));
  let truncated = false;
  const good0 = [];
  for (let si = 0; si < codes.length; si++) {
    if (codes.length > maxStates) { truncated = true; break; }
    const code = codes[si], rep = reps[si];
    const gs = codec.decode(code);
    const info = W.walkInfo(code, gs);
    const inC = (l, x, z) => W.repOf(info, l, x, z) === rep;
    eStart.push(eTo.length);
    // 目当ての物
    for (const t of targets) {
      if (hit.has(t.id)) continue;
      if (t.type === 'exit' && !G.exitOpen(area, gs, t, flags)) continue;
      let cells;
      if (t.type === 'rare') cells = [[t.l, t.x, t.z], ...G.DIRS.map(([dx, dz]) => [t.l, t.x + dx, t.z + dz])];
      else { if (!G.isPresent(area, gs, t)) continue; cells = G.interactCells(area, gs, t); }
      if (cells.some((c) => inC(...c))) hit.set(t.id, si);
    }
    // 入口に戻れる・出られる
    if (inC(...start) || exits.some((o) => G.exitOpen(area, gs, o, flags) && G.interactCells(area, gs, o).some((c) => inC(...c)))) good0.push(si);
    // ギミックを動かす
    for (let oi = 0; oi < gimmicks.length; oi++) {
      const o = gimmicks[oi];
      if (forbidUse.has(o.id)) continue;
      if (o.type !== 'socket' && !G.isPresent(area, gs, o)) continue;
      if (o.type === 'socket' && forbidTake.has(o.id) && !gs.held && G.socketContent(gs, o.id)) continue;
      const cells = G.interactCells(area, gs, o).filter((c) => inC(...c));
      if (!cells.length) continue;
      const many = G.moverAt(area, o.l, ...G.objPos(area, gs, o)) || o.onDisc;
      const seenTo = new Set();
      for (const c of many ? cells : cells.slice(0, 1)) {
        const r = G.applyInteract(area, gs, o, c, abilities);
        if (!r.ok) break;
        const nc = codec.encode(r.gs);
        const ninfo = W.walkInfo(nc, r.gs);
        const nrep = W.repOf(ninfo, ...r.player);
        if (nrep < 0) continue;
        const to = push(nc, nrep, si, oi, gOf(...c));
        if (!seenTo.has(to)) { seenTo.add(to); eTo.push(to); }
      }
    }
    // 出口から出て、入りなおす(置いていない物は元に戻る)
    for (const o of exits) {
      if (!G.exitOpen(area, gs, o, flags)) continue;
      const c = G.interactCells(area, gs, o)[0];
      if (!inC(...c)) continue;
      const nc = resetCode(gs);
      const to = push(nc, W.repOf(W.walkInfo(nc), ...start), si, -2 - area.objects.indexOf(o), gOf(...c));
      eTo.push(to);
      break;
    }
  }
  eStart.push(eTo.length);
  const n = codes.length;
  // 詰み: 入口に戻れる状態へ、どうやっても行けない状態(逆向きの幅優先)
  const indeg = new Int32Array(n + 1);
  const done = Math.min(n, eStart.length - 1);
  for (let a = 0; a < done; a++) for (let e = eStart[a]; e < eStart[a + 1]; e++) indeg[eTo[e] + 1]++;
  for (let i = 0; i < n; i++) indeg[i + 1] += indeg[i];
  const rev = new Int32Array(eTo.length);
  const fill = indeg.slice();
  for (let a = 0; a < done; a++) for (let e = eStart[a]; e < eStart[a + 1]; e++) rev[fill[eTo[e]]++] = a;
  const good = new Uint8Array(n);
  const st = [];
  for (const g of good0) { good[g] = 1; st.push(g); }
  while (st.length) { const k = st.pop(); for (let e = indeg[k]; e < indeg[k + 1]; e++) { const a = rev[e]; if (!good[a]) { good[a] = 1; st.push(a); } } }
  const stuck = [];
  for (let i = 0; i < done; i++) if (!good[i]) stuck.push(i);

  // 手順を組み立てる: 「どのマスまで歩く」「どの物を調べる」の並び
  const plan = (si, finalTarget) => {
    const chain = [];
    for (let s = si; parent[s] >= 0; s = parent[s]) chain.push(s);
    chain.reverse();
    const steps = [];
    let ops = 0;
    for (const s of chain) {
      const at = W.cellOf(viaCell[s]);
      steps.push({ walk: at });
      if (viaObj[s] <= -2) steps.push({ exit: area.objects[-2 - viaObj[s]].id });
      else { steps.push({ use: gimmicks[viaObj[s]].id }); ops++; }
    }
    if (finalTarget) {
      const gs = codec.decode(codes[si]);
      const info = W.walkInfo(codes[si], gs);
      const cells = finalTarget.type === 'rare' ? [[finalTarget.l, finalTarget.x, finalTarget.z], ...G.DIRS.map(([dx, dz]) => [finalTarget.l, finalTarget.x + dx, finalTarget.z + dz])] : G.interactCells(area, gs, finalTarget);
      const c = cells.find((cc) => W.repOf(info, ...cc) === reps[si]);
      steps.push({ walk: c }, { [finalTarget.type === 'rare' ? 'reach' : 'use']: finalTarget.id });
    }
    return { ops, steps };
  };
  const result = {
    area: area.id, abilities, states: n, truncated, gsSpace: codec.total,
    levelLabelings: W.levelCache.reduce((s, m) => s + m.size, 0), walkShapes: W.fullCache.size,
    reached: {}, unreached: [], stuck: stuck.length,
    stuckExample: stuck.length ? { gs: codec.decode(codes[stuck[0]]), at: W.cellOf(reps[stuck[0]]) } : null,
  };
  for (const t of targets) {
    if (hit.has(t.id)) result.reached[t.id] = { type: t.type, ops: depth[hit.get(t.id)], needs: t.needs, cond: t.cond };
    else result.unreached.push({ id: t.id, type: t.type, l: t.l, x: t.x, z: t.z, needs: t.needs });
  }
  result.plan = (id) => { const t = targets.find((q) => q.id === id); return hit.has(id) ? plan(hit.get(id), t) : null; };
  result.planTo = (pred) => { for (let i = 0; i < n; i++) if (pred(codec.decode(codes[i]), W.cellOf(reps[i]))) return plan(i); return null; };
  return result;
}

// 手順を、grid.js の規則だけで頭から通しで遊んでみる(歩けるか・調べられるか)。通れば null、だめなら理由
export function replayPlan(area, plan, abilities = { tweezers: true }) {
  let gs = G.newGimmickState(area);
  const ent = area.entries[area.entry];
  let p = [ent.l, ent.x, ent.z];
  const byId = Object.fromEntries(area.objects.map((o) => [o.id, o]));
  for (const [i, st] of plan.steps.entries()) {
    if (st.walk) {
      const [l, x, z] = st.walk;
      const path = G.findPath(area, gs, p, (a, b, c) => a === l && b === x && c === z, 200000);
      if (!path) return `手順${i}: ${st.walk} まで歩けない`;
      p = st.walk.slice();
    } else if (st.exit) {
      gs = G.resetLooseItems(gs);
      p = [ent.l, ent.x, ent.z];
    } else if (st.use) {
      const o = byId[st.use];
      if (!o) return `手順${i}: ${st.use} がない`;
      if (!G.interactCells(area, gs, o).some((c) => c[0] === p[0] && c[1] === p[1] && c[2] === p[2])) return `手順${i}: ${st.use} のとなりにいない`;
      if (G.GIMMICK_TYPES.has(o.type)) {
        const r = G.applyInteract(area, gs, o, p, abilities);
        if (!r.ok) return `手順${i}: ${st.use} を動かせない (${r.msg})`;
        gs = r.gs; p = r.player;
      }
    } else if (st.reach) {
      const t = (area.rares || []).find((q) => q.id === st.reach);
      if (Math.abs(t.x - p[1]) + Math.abs(t.z - p[2]) > 1 || t.l !== p[0]) return `手順${i}: ${st.reach} に届かない`;
    }
  }
  return null;
}

// ---------------------------------------------------------------- エリアごとの約束と合否
export const EXPECT = {
  village: { flags: { wokeUp: true, gotStarter: true } },
  tsumiki: { goal: 'ts_goal', goalOps: 6, mustUse: [{ use: ['D_h21_21'], target: 'ts_chest_ledge', why: '台Dを回さないと積み木に届かない' }] },
  forest: { goal: 'fo_boss', goalOps: 8 },
  tower: { goal: 'tw_boss', noTweezersUnreached: ['tw_up2'], mustRemove: { socket: 'tw_axle4', target: 'tw_up4' },
    mustUse: [{ use: ['tw_block5'], target: 'tw_chest_treasure', why: '5階の段は5階のアーチの積み木でしか登れない' }, { use: ['tw_axle4'], target: 'tw_chest_treasure', why: '5階の宝は4階の歯車で5階をそろえたあと' }] },
};

export function checkArea(id, { log = () => {} } = {}) {
  const ex = EXPECT[id] || {};
  const errors = [];
  const area1 = loadArea(id);
  const t0 = Date.now();
  const yes = solveArea(area1, { abilities: { tweezers: true }, flags: ex.flags });
  const t1 = Date.now();
  const no = solveArea(loadArea(id), { abilities: {}, flags: ex.flags });
  log(`${id}: ピンセットあり 状態 ${yes.states}(${t1 - t0}ms) / なし 状態 ${no.states}`);
  if (yes.truncated) errors.push('探索が上限で打ち切られた');
  for (const u of yes.unreached) errors.push(`届かない: ${u.type} ${u.id} L${u.l}(${u.x},${u.z})`);
  if (yes.stuck) errors.push(`詰む状態 ${yes.stuck}(例 ${JSON.stringify(yes.stuckExample)})`);
  if (no.stuck) errors.push(`ピンセットなしで詰む状態 ${no.stuck}`);
  const needT = Object.entries(yes.reached).filter(([, r]) => r.needs && r.needs.includes('tweezers')).map(([k]) => k);
  for (const k of needT) if (no.reached[k]) errors.push(`ピンセットの印なのに、なしで届く: ${k}`);
  const needsMarked = new Set([...needT, ...yes.unreached.filter((u) => u.needs).map((u) => u.id)]);
  for (const k of Object.keys(yes.reached)) if (!no.reached[k] && !needsMarked.has(k) && !(ex.noTweezersUnreached || []).includes(k) && !(id === 'tower')) errors.push(`印がないのに、ピンセットなしでは届かない: ${k}`);
  for (const k of ex.noTweezersUnreached || []) if (no.reached[k]) errors.push(`ピンセットなしで届いてはいけない: ${k}`);
  if (ex.goal && yes.reached[ex.goal] && ex.goalOps != null && yes.reached[ex.goal].ops !== ex.goalOps) errors.push(`${ex.goal} までの最少操作が ${yes.reached[ex.goal].ops}(設計図は ${ex.goalOps})`);
  let mustRemove = null;
  if (ex.mustRemove) {
    const r = solveArea(loadArea(id), { abilities: { tweezers: true }, forbidTake: [ex.mustRemove.socket] });
    mustRemove = !r.reached[ex.mustRemove.target];
    if (!mustRemove) errors.push(`${ex.mustRemove.socket} を外さなくても ${ex.mustRemove.target} に届く(付けかえが必須でない)`);
  }
  const mustUse = [];
  for (const m of ex.mustUse || []) {
    const r = solveArea(loadArea(id), { abilities: { tweezers: true }, forbidUse: m.use });
    const ok = !r.reached[m.target];
    mustUse.push({ ...m, ok });
    if (!ok) errors.push(`${m.use} を使わなくても ${m.target} に届く(${m.why})`);
  }
  return { id, ok: errors.length === 0, errors, yes, no, mustRemove, mustUse };
}

export function writePlans(res) {
  const out = { area: res.id, note: '最少の操作手順。walk = そのマスまで歩く [階,x,z]、use = その物を調べる、exit = 出口から出て入りなおす。ops = ギミックの操作の回数', states: res.yes.states, targets: {} };
  for (const id of Object.keys(res.yes.reached)) {
    const r = res.yes.reached[id];
    if (!['chest', 'shelf', 'boss', 'goal', 'clockface', 'rare', 'exit', 'stairs'].includes(r.type)) continue;
    if (r.type === 'shelf' && r.ops === 0 && !r.cond) continue;
    out.targets[id] = res.yes.plan(id);
  }
  mkdirSync(join(ROOT, 'tools', 'solver', 'plans'), { recursive: true });
  writeFileSync(join(ROOT, 'tools', 'solver', 'plans', res.id + '.json'), JSON.stringify(out, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ids = process.argv.slice(2).filter((s) => !s.startsWith('--'));
  let bad = 0;
  for (const id of ids.length ? ids : ['village', 'tsumiki', 'forest', 'tower']) {
    const res = checkArea(id, { log: console.log });
    writePlans(res);
    const r = res.yes.reached;
    const main = Object.entries(r).filter(([, v]) => ['chest', 'boss', 'goal', 'rare'].includes(v.type) || (v.type === 'shelf' && v.ops > 0));
    console.log(`  届く ${Object.keys(r).length} / ${Object.keys(r).length + res.yes.unreached.length}  詰み ${res.yes.stuck}  ${res.mustRemove != null ? '付けかえ必須 ' + res.mustRemove : ''}`);
    if (!process.argv.includes('--quiet')) for (const [k, v] of main) console.log(`    ${k.padEnd(20)} ${String(v.ops).padStart(2)}手${v.needs ? ' [ピンセット]' : ''}${v.cond ? ' (' + v.cond + ')' : ''}${res.no.reached[k] ? '' : ' なしでは×'}`);
    if (!res.ok) { bad++; for (const e of res.errors) console.log('  NG', e); } else console.log('  OK');
  }
  process.exit(bad ? 1 : 0);
}
