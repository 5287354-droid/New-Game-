// マス目とギミックの規則。ブラウザ(ゲーム本体)と node(ソルバー・テスト)の両方で使う。three.js に依存しない。
// 関数の一覧と JSON の形は docs/INTERFACES.md の「マップ JSON」「grid.js の関数」。
//
// エリアのデータ(data/areas/*.json)
//   levels[l] = { w, d, y, h:[高さ], t:"地面の種類の文字列" }   マス番号 = z * w + x
//   objects  = [{ id, type, l, x, z, ... }]
//   discs    = 回転台 [{ id, l, cx, cz, r, start, arms }]          (つみき野)
//   rings    = 回る外周の床 [{ id, l, cx, cz, r1, r2, start }]     (時計塔)
//   casters  = 影を落とす物 [{ id, l, x, z, angle, len, wide }] / [{ id, l, kind:'arch', angle, rects:[[x0,z0,x1,z1]] }] (ランプの森)
//   lampStart = はじめのランプの向き(0 東 / 1 真上 / 2 西)
//
// ギミックの状態 gs = { disc:{id:向き}, ring:{id:向き}, lamp:0..2, gp:{歯車の軸id:0|1}, items:{物id:'home'|'held'|くぼみid}, held:null|物id }

export const WALK = new Set(['g', 'p', 'f', 'k', 'd', 's', 'L', 'c', 'm', 'r', 'B']);
// g 草 / p 道 / f 床(室内) / k 回転台の板 / d 土 / s 砂 / L はしご / c 谷(影なら歩ける) / m 石の床(塔) / r 敷物 / B 橋
// 歩けない: x 何もない / W 壁 / w 水 / X 柵・積み木の山・岩 / C 光の当たる谷(cell が返す) / e 台の縁(柵) / v 床の穴(塔)
export const BLOCKING = new Set(['chest', 'npc', 'handle', 'dial', 'shelf', 'sign', 'item', 'boss', 'goal', 'post', 'bed', 'counter', 'socketDeco', 'tree', 'statue', 'clockface']);
// 置いても通れなくなる(軸・台座になる)くぼみの種類。歯車の軸は、歯車があってもなくても通れない
export const SOLID_SOCKETS = new Set(['gear', 'cutout']);

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function newGimmickState(area) {
  const gs = { disc: {}, ring: {}, lamp: area.lampStart ?? 0, gp: {}, items: {}, held: null };
  for (const d of area.discs || []) gs.disc[d.id] = d.start || 0;
  for (const r of area.rings || []) gs.ring[r.id] = r.start || 0;
  for (const o of area.objects) {
    if (o.type === 'item') gs.items[o.item] = o.startIn || 'home';
    if (o.type === 'socket' && o.kind === 'gear') gs.gp[o.id] = 0;
  }
  return gs;
}

export function cloneGS(gs) {
  return { disc: { ...gs.disc }, ring: { ...gs.ring }, lamp: gs.lamp, gp: { ...gs.gp }, items: { ...gs.items }, held: gs.held };
}

// 回転: 上から見て時計回りに k*90°  (dx,dz) -> (-dz, dx)
export function rot(dx, dz, k) {
  k = ((k % 4) + 4) % 4;
  for (let i = 0; i < k; i++) [dx, dz] = [-dz, dx];
  return [dx, dz];
}

export function inDisc(d, x, z) {
  const dx = x - d.cx, dz = z - d.cz;
  return dx * dx + dz * dz <= (d.r + 0.5) * (d.r + 0.5);
}
export function inRing(r, x, z) {
  const dx = x - r.cx, dz = z - r.cz;
  const q = dx * dx + dz * dz;
  return q > (r.r1 + 0.5) * (r.r1 + 0.5) && q <= (r.r2 + 0.5) * (r.r2 + 0.5);
}

// そのマスを動かしている台・輪(なければ null)
export function moverAt(area, l, x, z) {
  for (const d of area.discs || []) if (d.l === l && inDisc(d, x, z)) return { m: d, kind: 'disc' };
  for (const r of area.rings || []) if (r.l === l && inRing(r, x, z)) return { m: r, kind: 'ring' };
  return null;
}
const turnOf = (gs, mv) => (mv.kind === 'disc' ? gs.disc[mv.m.id] : gs.ring[mv.m.id]) || 0;

// 回る部分に入っているマスなら、元のデータ(向き0)での位置を返す
export function sourcePos(area, gs, l, x, z) {
  const mv = moverAt(area, l, x, z);
  if (!mv) return [x, z];
  const [sx, sz] = rot(x - mv.m.cx, z - mv.m.cz, -turnOf(gs, mv));
  return [mv.m.cx + sx, mv.m.cz + sz];
}

// 物の今の位置(回転台・外周の床の上の物は、いっしょに回る)。o.x,o.z は向き0のときの位置
const MV = new WeakMap();
function moverOf(area, o) {
  let mv = MV.get(o);
  if (mv === undefined) {
    mv = moverAt(area, o.l, o.x, o.z);
    if (mv && mv.m.cx === o.x && mv.m.cz === o.z) mv = null; // 軸の上の物は回っても同じ場所
    MV.set(o, mv);
  }
  return mv;
}
export function objPos(area, gs, o) {
  const mv = moverOf(area, o);
  if (!mv) return [o.x, o.z];
  const [dx, dz] = rot(o.x - mv.m.cx, o.z - mv.m.cz, turnOf(gs, mv));
  return [mv.m.cx + dx, mv.m.cz + dz];
}

export function indexObjects(area) {
  // 物の一覧を、レベルとマスで引けるようにする(回らない物だけ。回る物は objPos で探す)
  if (area._idx) return area._idx;
  const fixed = new Map();
  const moving = [];
  const byId = {};
  const itemByName = {};
  const pend = new Map();
  for (const o of area.objects) {
    byId[o.id] = o;
    if (o.type === 'item') itemByName[o.item] = o;
    if (o.type === 'pendulum') for (const [x, z] of o.cells || [[o.x, o.z]]) pend.set(o.l + ':' + x + ':' + z, o);
    if (moverOf(area, o)) moving.push(o);
    else {
      const k = o.l + ':' + o.x + ':' + o.z;
      if (!fixed.has(k)) fixed.set(k, []);
      fixed.get(k).push(o);
    }
  }
  const sockets = area.objects.filter((o) => o.type === 'socket');
  area._idx = { fixed, moving, byId, itemByName, sockets, pend };
  return area._idx;
}

export function itemObj(area, itemName) {
  return indexObjects(area).itemByName[itemName];
}

export function objectsAt(area, gs, l, x, z) {
  const idx = indexObjects(area);
  const out = (idx.fixed.get(l + ':' + x + ':' + z) || []).slice();
  for (const o of idx.moving) {
    if (o.l !== l) continue;
    const mv = moverOf(area, o).m;
    if (Math.abs(x - mv.cx) > 12 || Math.abs(z - mv.cz) > 12) continue;
    if ((x - mv.cx) ** 2 + (z - mv.cz) ** 2 !== (o.x - mv.cx) ** 2 + (o.z - mv.cz) ** 2) continue; // 回っても中心からの距離は同じ
    const [px, pz] = objPos(area, gs, o);
    if (px === x && pz === z) out.push(o);
  }
  return out.filter((o) => isPresent(area, gs, o));
}

// ピンセットで動かす物は、元の場所にあるときだけそこにある。hideFlag / showFlag は area._flags を見る
export function isPresent(area, gs, o) {
  if (o.type === 'item') return gs.items[o.item] === 'home';
  if (o.hideFlag && area._flags && area._flags[o.hideFlag]) return false;
  if (o.showFlag && !(area._flags && area._flags[o.showFlag])) return false;
  return true;
}

// ソケットに置かれた物の名前(なければ null)
export function socketContent(gs, socketId) {
  for (const it in gs.items) if (gs.items[it] === socketId) return it;
  return null;
}

// ---------------------------------------------------------------- 影(ランプの森)
// 影を落とす物(caster)は、幹のマス (x,z) ではなく、幹の1つ南の列 z+1 から wide 列ぶん、
// 光と反対の向きへ、幹の列から len マス落ちる(angle 0 東の光 → 西へ / 2 西の光 → 東へ)。
// angle 1(真上)の caster は影を落とさない。kind:'arch' は angle の光のとき rects の範囲がそのまま影。
export function casterCells(c) {
  const out = [];
  if (c.kind === 'arch') {
    for (const [x0, z0, x1, z1] of c.rects) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, z]);
    return out;
  }
  if (c.angle === 1) return out;
  const dir = c.angle === 0 ? -1 : 1;
  for (let k = 1; k <= (c.wide || 1); k++) for (let i = 0; i <= c.len; i++) out.push([c.x + dir * i, c.z + k]);
  return out;
}

// 今の影のマスの集まり(レベル0)。切り絵の木をくぼみに立てると caster が増える
export function activeCasters(area, gs) {
  const list = (area.casters || []).filter((c) => c.angle === gs.lamp);
  for (const s of indexObjects(area).sockets) {
    if (s.kind !== 'cutout' || !s.caster) continue;
    if (!socketContent(gs, s.id)) continue;
    if (s.caster.angle !== gs.lamp) continue;
    list.push({ id: s.id, l: s.l, x: s.x, z: s.z, ...s.caster });
  }
  return list;
}
export function shadowSet(area, gs) {
  const cut = indexObjects(area).sockets.filter((s) => s.kind === 'cutout' && socketContent(gs, s.id)).map((s) => s.id).join(',');
  const key = gs.lamp + '|' + cut;
  area._shadow = area._shadow || new Map();
  let set = area._shadow.get(key);
  if (!set) {
    set = new Set();
    const W = area.levels[0].w;
    for (const c of activeCasters(area, gs)) for (const [x, z] of casterCells(c)) set.add((c.l || 0) * 1e6 + z * W + x);
    area._shadow.set(key, set);
  }
  return set;
}

// ---------------------------------------------------------------- 振り子(時計塔)
// 振り子 { type:'pendulum', cells:[[x,z]...], period, phase, jamSocket? }
//   jamSocket つき: そのくぼみに物がはさまるまで、ずっとふさぐ
//   ほか: opt.beat(BGM の拍)が与えられたときだけ、(beat + phase) % period < period/2 の間ふさぐ。
//         opt.beat が無い(ソルバー)ときは「待てば通れる」のでふさがない
export function pendulumBlocks(gs, o, beat) {
  if (o.jamSocket) return !socketContent(gs, o.jamSocket);
  if (beat == null) return false;
  const p = o.period || 4;
  return ((beat + (o.phase || 0)) % p + p) % p < p / 2;
}

// マスの今の様子 { h, t, block, objs }。opt = { beat }(ゲームだけ)
export function cell(area, gs, l, x, z, opt) {
  const L = area.levels[l];
  if (!L || x < 0 || z < 0 || x >= L.w || z >= L.d) return null;
  const [sx, sz] = sourcePos(area, gs, l, x, z);
  const i = sz * L.w + sx;
  let h = L.h[i];
  let t = L.t[i];
  const objs = objectsAt(area, gs, l, x, z);
  let block = false;
  for (const o of objs) {
    if (o.type === 'socket') {
      const it = socketContent(gs, o.id);
      if (SOLID_SOCKETS.has(o.kind)) block = true;
      else if (it) {
        if (o.kind === 'plank') { t = 'B'; h = o.h ?? h; }
        if (o.kind === 'ladder') t = 'L';
        if (o.kind === 'block' || o.kind === 'wedge') { t = 'p'; h = o.h ?? h + 1; }
      }
    } else if (BLOCKING.has(o.type)) block = true;
  }
  const idx = indexObjects(area);
  if (idx.pend.size) {
    const p = idx.pend.get(l + ':' + x + ':' + z);
    if (p && pendulumBlocks(gs, p, opt && opt.beat)) block = true;
  }
  if (t === 'c' && !shadowSet(area, gs).has(l * 1e6 + z * L.w + x)) t = 'C'; // 光の当たる谷 = 歩けない
  return { h, t, block, objs };
}

export function walkable(c) {
  return !!c && !c.block && WALK.has(c.t);
}

export function canStep(a, b) {
  if (!walkable(b)) return false;
  if (a.t === 'L' || b.t === 'L') return true;
  return Math.abs(a.h - b.h) <= 1;
}

export function stairsAt(area, l, x, z) {
  const idx = indexObjects(area);
  return (idx.fixed.get(l + ':' + x + ':' + z) || []).find((o) => o.type === 'stairs');
}

// 1マスの隣(階段で別の階にとぶのも含む)
export function neighbors(area, gs, l, x, z, opt) {
  const out = [];
  const a = cell(area, gs, l, x, z, opt);
  if (!a || !walkable(a)) return out;
  for (const [dx, dz] of DIRS) {
    const b = cell(area, gs, l, x + dx, z + dz, opt);
    if (b && canStep(a, b)) out.push([l, x + dx, z + dz]);
  }
  const st = stairsAt(area, l, x, z);
  if (st && st.to && walkable(cell(area, gs, st.to.l, st.to.x, st.to.z, opt))) out.push([st.to.l, st.to.x, st.to.z]);
  return out;
}

// 経路探索(幅優先)。goalFn(l,x,z) が true になるマスまでの道のりを返す
export function findPath(area, gs, from, goalFn, maxN = 40000, opt) {
  const key = (l, x, z) => l * 100000 + z * 300 + x;
  const prev = new Map();
  const q = [from];
  prev.set(key(...from), null);
  let n = 0;
  for (let qi = 0; qi < q.length && n++ < maxN; qi++) {
    const cur = q[qi];
    if (goalFn(...cur)) {
      const path = [];
      let c = cur;
      while (c) { path.push(c); c = prev.get(key(...c)); }
      return path.reverse();
    }
    for (const nb of neighbors(area, gs, ...cur, opt)) {
      const k = key(...nb);
      if (!prev.has(k)) { prev.set(k, cur); q.push(nb); }
    }
  }
  return null;
}

// 調べられるかどうか: 物のとなり(ランプ台・階段・出口などの「乗る物」は上)
export const STAND_ON = new Set(['lampStation', 'exit', 'stairs', 'spawnPad']);

export function interactCells(area, gs, o) {
  const [x, z] = objPos(area, gs, o);
  if (STAND_ON.has(o.type)) return [[o.l, x, z]];
  return DIRS.map(([dx, dz]) => [o.l, x + dx, z + dz]);
}

// 出口が開いているか。needFlag は flags で、または「その旗を立てるくぼみ」に物が置かれていれば開く
export function exitOpen(area, gs, o, flags = {}) {
  if (!o.needFlag) return true;
  if (flags[o.needFlag]) return true;
  return indexObjects(area).sockets.some((s) => s.flag === o.needFlag && socketContent(gs, s.id));
}

// 物をくぼみに置けるか(種類・大きさ・accepts)
export function fits(area, itemName, sock) {
  const it = itemObj(area, itemName);
  if (!it || it.kind !== sock.kind) return false;
  if (sock.accepts && !sock.accepts.includes(itemName)) return false;
  if (sock.kind === 'gear' && sock.size && (it.size || 'small') !== sock.size) return false;
  return true;
}

// ---------------------------------------------------------------- ギミックを動かす(純粋な関数)
// 戻り値: { ok, gs, player:[l,x,z], msg, flag }   player は [l,x,z](台の上で回すと主人公も回る)
//   msg: need-tweezers / hands-full / socket-full / wrong-kind / standing / empty
//   flag: くぼみに置いて旗が立つとき、その旗の名前(立てるのはゲームの役目)
export function applyInteract(area, gs0, o, player, abilities = {}) {
  const gs = cloneGS(gs0);
  let p = player.slice();
  let msg = null;
  let ok = true;
  let flag = null;
  const turnDisc = (d) => {
    gs.disc[d.id] = (gs.disc[d.id] + 1) % 4;
    if (p[0] === d.l && inDisc(d, p[1], p[2])) {
      const [dx, dz] = rot(p[1] - d.cx, p[2] - d.cz, 1);
      p = [d.l, d.cx + dx, d.cz + dz];
    }
  };
  const turnRing = (rid, seen = new Set()) => {
    if (seen.has(rid)) return;
    seen.add(rid);
    const r = (area.rings || []).find((q) => q.id === rid);
    gs.ring[rid] = (gs.ring[rid] + 1) % 4;
    if (p[0] === r.l && inRing(r, p[1], p[2])) {
      const [dx, dz] = rot(p[1] - r.cx, p[2] - r.cz, 1);
      p = [r.l, r.cx + dx, r.cz + dz];
    }
    for (const s of indexObjects(area).sockets) {
      if (s.kind !== 'gear' || !s.link || s.link.from !== rid) continue;
      const it = socketContent(gs, s.id);
      if (!it) continue;
      if (itemObj(area, it).size === 'large') {
        // 大きい歯車は半分だけ回す: 印 gp が半回転ずつ進み、1周(2回)で相手の輪が1回まわる
        gs.gp[s.id] ^= 1;
        if (gs.gp[s.id] === 0) turnRing(s.link.to, seen);
      } else turnRing(s.link.to, seen);
    }
  };
  switch (o.type) {
    case 'handle': {
      const d = area.discs.find((q) => q.id === o.disc);
      turnDisc(d);
      break;
    }
    case 'lampStation':
      gs.lamp = (gs.lamp + 1) % 3; // 東(0) → 真上(1) → 西(2) → 東
      break;
    case 'dial':
      if (!o.ring) { ok = false; msg = 'broken'; break; }
      turnRing(o.ring);
      break;
    case 'item':
      if (!abilities.tweezers) { ok = false; msg = 'need-tweezers'; break; }
      if (gs.held) { ok = false; msg = 'hands-full'; break; }
      if (gs.items[o.item] !== 'home') { ok = false; msg = 'empty'; break; }
      gs.items[o.item] = 'held';
      gs.held = o.item;
      break;
    case 'socket': {
      if (!abilities.tweezers) { ok = false; msg = 'need-tweezers'; break; }
      const inside = socketContent(gs, o.id);
      const [sx, sz] = objPos(area, gs, o);
      const onIt = p[0] === o.l && p[1] === sx && p[2] === sz;
      if (gs.held) {
        if (inside) { ok = false; msg = 'socket-full'; break; }
        if (!fits(area, gs.held, o)) { ok = false; msg = 'wrong-kind'; break; }
        if (onIt) { ok = false; msg = 'standing'; break; }
        gs.items[gs.held] = o.id;
        gs.held = null;
        if (o.kind === 'gear') gs.gp[o.id] = 0;
        if (o.flag) flag = o.flag;
      } else if (inside) {
        // 置いた物をもう一度つまむ(付けかえ)。その上に自分が立っているときはだめ
        if (onIt) { ok = false; msg = 'standing'; break; }
        gs.items[inside] = 'held';
        gs.held = inside;
        if (o.kind === 'gear') gs.gp[o.id] = 0;
      } else { ok = false; msg = 'empty'; }
      break;
    }
    default:
      ok = false;
  }
  return { ok, gs: ok ? gs : gs0, player: ok ? p : player, msg, flag };
}

// 状態を文字列にする(セーブの比較・テスト用。ソルバーは自前の数値の鍵を使う)
export function gsKey(gs) {
  return JSON.stringify([gs.disc, gs.ring, gs.lamp, gs.gp, gs.items, gs.held]);
}

// エリアを出る(または、持ったまま戦闘で負ける)と、ピンセットで運んでいて「くぼみに置いていない物」は元の場所に戻る
export function resetLooseItems(gs) {
  const out = cloneGS(gs);
  for (const [k, v] of Object.entries(out.items)) if (v === 'held') out.items[k] = 'home';
  out.held = null;
  return out;
}

// 出口で「部品を置いてから出よう」を出すか
export function mustDropBeforeExit(gs) {
  return !!gs.held;
}

export const GIMMICK_TYPES = new Set(['handle', 'lampStation', 'dial', 'item', 'socket']);
