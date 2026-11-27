// マス目とギミックの規則。ブラウザ(ゲーム本体)と node(ソルバー・テスト)の両方で使う。three.js に依存しない。
//
// エリアのデータ(data/areas/*.json)
//   levels[l] = { w, d, y, h:[高さ], t:"地面の種類の文字列" }   マス番号 = z * w + x
//   objects  = [{ id, type, l, x, z, ... }]
//   discs    = 回転台 [{ id, l, cx, cz, r }]           (つみき野)
//   rings    = 回る外周の床 [{ id, l, cx, cz, r1, r2 }] (時計塔)
//   shadow   = { "0":[マス番号], "1":[...], "2":[...] }  ランプの角度ごとの影(ランプの森)
//
// ギミックの状態 gs = { disc:{id:向き}, ring:{id:向き}, lamp:0..2, gp:{歯車ソケットid:0|1}, items:{物id:'home'|ソケットid}, held:null|物id }

export const WALK = new Set(['g', 'p', 'f', 'k', 'd', 's', 'L', 'c', 'm', 'r', 'B']);
// g 草 / p 道 / f 床(室内) / k 回転台の板 / d 土 / s 砂 / L はしご / c 谷(影なら歩ける) / m 石の床(塔) / r 敷物 / B 橋
export const BLOCKING = new Set(['chest', 'npc', 'handle', 'dial', 'shelf', 'sign', 'item', 'boss', 'goal', 'post', 'bed', 'counter', 'socketDeco', 'tree', 'statue']);

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function newGimmickState(area) {
  const gs = { disc: {}, ring: {}, lamp: area.lampStart ?? 0, gp: {}, items: {}, held: null };
  for (const d of area.discs || []) gs.disc[d.id] = d.start || 0;
  for (const r of area.rings || []) gs.ring[r.id] = r.start || 0;
  for (const o of area.objects) {
    if (o.type === 'item') gs.items[o.item] = 'home';
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

// 回る部分に入っているマスなら、元のデータでの位置を返す
function source(area, gs, l, x, z) {
  for (const d of area.discs || []) {
    if (d.l === l && inDisc(d, x, z)) {
      const [sx, sz] = rot(x - d.cx, z - d.cz, -gs.disc[d.id]);
      return [d.cx + sx, d.cz + sz, d, gs.disc[d.id]];
    }
  }
  for (const r of area.rings || []) {
    if (r.l === l && inRing(r, x, z)) {
      const [sx, sz] = rot(x - r.cx, z - r.cz, -gs.ring[r.id]);
      return [r.cx + sx, r.cz + sz, r, gs.ring[r.id]];
    }
  }
  return [x, z, null, 0];
}

// 物の今の位置(回転台・外周の床の上の物は、いっしょに回る)
export function objPos(area, gs, o) {
  for (const d of area.discs || []) {
    if (d.l === o.l && inDisc(d, o.x, o.z)) {
      const [dx, dz] = rot(o.x - d.cx, o.z - d.cz, gs.disc[d.id]);
      return [d.cx + dx, d.cz + dz];
    }
  }
  for (const r of area.rings || []) {
    if (r.l === o.l && inRing(r, o.x, o.z)) {
      const [dx, dz] = rot(o.x - r.cx, o.z - r.cz, gs.ring[r.id]);
      return [r.cx + dx, r.cz + dz];
    }
  }
  return [o.x, o.z];
}

export function indexObjects(area) {
  // 物の一覧を、レベルとマスで引けるようにする(回らない物だけ。回る物は objPos で探す)
  if (area._idx) return area._idx;
  const fixed = new Map();
  const moving = [];
  const byId = {};
  for (const o of area.objects) {
    byId[o.id] = o;
    const onMover = (area.discs || []).some((d) => d.l === o.l && inDisc(d, o.x, o.z)) ||
      (area.rings || []).some((r) => r.l === o.l && inRing(r, o.x, o.z));
    if (onMover) moving.push(o);
    else {
      const k = o.l + ':' + o.x + ':' + o.z;
      if (!fixed.has(k)) fixed.set(k, []);
      fixed.get(k).push(o);
    }
  }
  const sockets = area.objects.filter((o) => o.type === 'socket');
  area._idx = { fixed, moving, byId, sockets };
  return area._idx;
}

export function objectsAt(area, gs, l, x, z) {
  const idx = indexObjects(area);
  const out = (idx.fixed.get(l + ':' + x + ':' + z) || []).slice();
  for (const o of idx.moving) {
    if (o.l !== l) continue;
    const [px, pz] = objPos(area, gs, o);
    if (px === x && pz === z) out.push(o);
  }
  return out.filter((o) => isPresent(area, gs, o));
}

// ピンセットで動かす物は、家にあるときだけそこにある
export function isPresent(area, gs, o) {
  if (o.type === 'item') return gs.items[o.item] === 'home';
  if (o.hideFlag && area._flags && area._flags[o.hideFlag]) return false;
  if (o.showFlag && !(area._flags && area._flags[o.showFlag])) return false;
  return true;
}

// ソケットに置かれた物(なければ null)
export function socketContent(gs, socketId) {
  for (const [it, where] of Object.entries(gs.items)) if (where === socketId) return it;
  return null;
}

// マスの今の様子 { h, t, block, obj[] }
export function cell(area, gs, l, x, z) {
  const L = area.levels[l];
  if (!L || x < 0 || z < 0 || x >= L.w || z >= L.d) return null;
  const [sx, sz] = source(area, gs, l, x, z);
  const i = sz * L.w + sx;
  let h = L.h[i];
  let t = L.t[i];
  const objs = objectsAt(area, gs, l, x, z);
  let block = false;
  for (const o of objs) {
    if (o.type === 'socket') {
      const it = socketContent(gs, o.id);
      if (it) {
        if (o.kind === 'plank') { t = 'B'; h = o.h ?? h; }
        if (o.kind === 'ladder') t = 'L';
        if (o.kind === 'block') { t = 'p'; h = o.h ?? h + 1; }
      } else if (o.kind === 'block' || o.kind === 'gear') {
        block = o.kind === 'gear';
      }
    } else if (BLOCKING.has(o.type)) block = true;
  }
  if (t === 'c') {
    const sh = area.shadow && area.shadow[gs.lamp];
    if (!(sh && sh.includes(z * L.w + x))) t = 'C'; // 光の当たる谷 = 落ちる
  }
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
export function neighbors(area, gs, l, x, z) {
  const out = [];
  const a = cell(area, gs, l, x, z);
  if (!a) return out;
  for (const [dx, dz] of DIRS) {
    const b = cell(area, gs, l, x + dx, z + dz);
    if (b && canStep(a, b)) out.push([l, x + dx, z + dz]);
  }
  const st = stairsAt(area, l, x, z);
  if (st && st.to) out.push([st.to.l, st.to.x, st.to.z]);
  return out;
}

// 経路探索(幅優先)。goalFn(l,x,z) が true になるマスまでの道のりを返す
export function findPath(area, gs, from, goalFn, maxN = 20000) {
  const key = (l, x, z) => l * 100000 + z * 300 + x;
  const prev = new Map();
  const q = [from];
  prev.set(key(...from), null);
  let n = 0;
  while (q.length && n++ < maxN) {
    const cur = q.shift();
    if (goalFn(...cur)) {
      const path = [];
      let k = key(...cur);
      let c = cur;
      while (c) { path.push(c); c = prev.get(key(...c)); }
      return path.reverse();
    }
    for (const nb of neighbors(area, gs, ...cur)) {
      const k = key(...nb);
      if (!prev.has(k)) { prev.set(k, cur); q.push(nb); }
    }
  }
  return null;
}

// 調べられるかどうか: 物のとなり(ランプ台・階段などの「乗る物」は上)
export const STAND_ON = new Set(['lampStation', 'exit', 'stairs', 'spawnPad']);

export function interactCells(area, gs, o) {
  const [x, z] = objPos(area, gs, o);
  if (STAND_ON.has(o.type)) return [[o.l, x, z]];
  return DIRS.map(([dx, dz]) => [o.l, x + dx, z + dz]);
}

// ---------------------------------------------------------------- ギミックを動かす(純粋な関数)
// 戻り値: { gs, moved:[{l,x,z}->{l,x,z}] , msg }  player は [l,x,z]
export function applyInteract(area, gs0, o, player, abilities = {}) {
  const gs = cloneGS(gs0);
  let p = player.slice();
  let msg = null;
  let ok = true;
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
      const big = area.objects.find((q) => q.type === 'item' && q.item === it)?.size === 'large';
      if (big) {
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
      gs.lamp = (gs.lamp + 1) % 3;
      break;
    case 'dial':
      turnRing(o.ring);
      break;
    case 'item':
      if (!abilities.tweezers) { ok = false; msg = 'need-tweezers'; break; }
      if (gs.held) { ok = false; msg = 'hands-full'; break; }
      gs.items[o.item] = 'held';
      gs.held = o.item;
      break;
    case 'socket': {
      if (!abilities.tweezers) { ok = false; msg = 'need-tweezers'; break; }
      const inside = socketContent(gs, o.id);
      if (gs.held) {
        if (inside) { ok = false; msg = 'socket-full'; break; }
        const itemObj = area.objects.find((q) => q.type === 'item' && q.item === gs.held);
        if (itemObj.kind !== o.kind) { ok = false; msg = 'wrong-kind'; break; }
        // 置こうとしたマスに自分が立っていたらだめ
        gs.items[gs.held] = o.id;
        gs.held = null;
        if (o.kind === 'gear') gs.gp[o.id] = 0;
      } else if (inside) {
        // ソケットの物をもう一度つまむ(付けかえのため)
        const [sx, sz] = objPos(area, gs, o);
        if (p[0] === o.l && p[1] === sx && p[2] === sz) { ok = false; msg = 'standing'; break; }
        gs.items[inside] = 'held';
        gs.held = inside;
      } else { ok = false; msg = 'empty'; }
      break;
    }
    default:
      ok = false;
  }
  return { ok, gs, player: p, msg };
}

// ソルバー用: 状態を文字列にする
export function gsKey(gs) {
  return JSON.stringify([gs.disc, gs.ring, gs.lamp, gs.gp, gs.items, gs.held]);
}

// エリアを出ると、ピンセットで運んだ物のうち「ソケットに置いていない物」は元に戻る
export function resetLooseItems(gs) {
  const out = cloneGS(gs);
  for (const [k, v] of Object.entries(out.items)) if (v === 'held') out.items[k] = 'home';
  out.held = null;
  return out;
}

export const GIMMICK_TYPES = new Set(['handle', 'lampStation', 'dial', 'item', 'socket']);
