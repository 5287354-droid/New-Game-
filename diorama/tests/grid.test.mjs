// grid.js の規則のテスト(小さな手作りのエリアと、本物のマップ)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/grid.js';
import { loadArea } from '../tools/solver/solver.mjs';

function flat(w, d, t = 'g', h = 1) { return { w, d, y: 0, h: new Array(w * d).fill(h), t: t.repeat(w * d) }; }
const mk = (extra) => ({ id: 't', levels: [flat(20, 20)], objects: [], discs: [], rings: [], ...extra });

test('rot: 時計回りに90°ずつ、4回で元どおり', () => {
  assert.deepEqual(G.rot(1, 0, 1), [-0, 1]);
  assert.deepEqual(G.rot(0, -1, 1), [1, 0]);
  assert.deepEqual(G.rot(3, 2, 4), [3, 2]);
});

test('回転台: ハンドルで回すと、台の上の主人公と物もいっしょに回る', () => {
  const a = mk({ discs: [{ id: 'A', l: 0, cx: 10, cz: 10, r: 4, start: 0 }] });
  a.objects.push({ id: 'h', type: 'handle', l: 0, x: 10, z: 10, disc: 'A' }, { id: 'blk', type: 'item', item: 'blk', kind: 'block', l: 0, x: 11, z: 7 });
  let gs = G.newGimmickState(a);
  const r = G.applyInteract(a, gs, a.objects[0], [0, 10, 12]);
  assert.equal(r.gs.disc.A, 1);
  assert.deepEqual(r.player, [0, 8, 10]);
  assert.deepEqual(G.objPos(a, r.gs, a.objects[1]), [13, 11]);
  gs = r.gs;
  for (let i = 0; i < 3; i++) gs = G.applyInteract(a, gs, a.objects[0], [0, 0, 0]).gs;
  assert.equal(gs.disc.A, 0);
});

function towerish() {
  const a = mk({ levels: [flat(25, 25, 'm'), flat(25, 25, 'm')], rings: [{ id: 'r0', l: 0, cx: 12, cz: 12, r1: 3, r2: 8 }, { id: 'r1', l: 1, cx: 12, cz: 12, r1: 3, r2: 8 }] });
  a.objects.push(
    { id: 'dial', type: 'dial', l: 0, x: 12, z: 12, ring: 'r0' },
    { id: 'big', type: 'item', item: 'big', kind: 'gear', size: 'large', l: 0, x: 2, z: 2 },
    { id: 'small', type: 'item', item: 'small', kind: 'gear', size: 'small', l: 0, x: 3, z: 2 },
    { id: 'ax', type: 'socket', kind: 'gear', size: 'large', l: 0, x: 13, z: 13, link: { from: 'r0', to: 'r1' } },
  );
  return a;
}

test('歯車: 軸のマスは、歯車があってもなくても通れない(ISSUES の件)', () => {
  const a = towerish();
  let gs = G.newGimmickState(a);
  assert.equal(G.walkable(G.cell(a, gs, 0, 13, 13)), false);
  gs = G.applyInteract(a, gs, a.objects[1], [0, 2, 3], { tweezers: true }).gs;
  gs = G.applyInteract(a, gs, a.objects[3], [0, 13, 14], { tweezers: true }).gs;
  assert.equal(G.socketContent(gs, 'ax'), 'big');
  assert.equal(G.walkable(G.cell(a, gs, 0, 13, 13)), false);
});

test('歯車の連動: 大きい歯車は半分(2回で1回)、外すと切れる', () => {
  const a = towerish();
  const T = { tweezers: true };
  let gs = G.newGimmickState(a);
  gs = G.applyInteract(a, gs, a.objects[1], [0, 2, 3], T).gs;
  gs = G.applyInteract(a, gs, a.objects[3], [0, 13, 14], T).gs;
  const turn = () => { gs = G.applyInteract(a, gs, a.objects[0], [0, 12, 13]).gs; };
  turn(); assert.deepEqual([gs.ring.r0, gs.ring.r1], [1, 0]);
  turn(); assert.deepEqual([gs.ring.r0, gs.ring.r1], [2, 1]);
  turn(); turn(); assert.deepEqual([gs.ring.r0, gs.ring.r1], [0, 2]);
  gs = G.applyInteract(a, gs, a.objects[3], [0, 13, 14], T).gs; // 外す(付けかえ)
  assert.equal(gs.held, 'big');
  turn(); assert.deepEqual([gs.ring.r0, gs.ring.r1], [1, 2]);
});

test('歯車: 大きさの合わない軸には置けない。1:1 の小さい歯車', () => {
  const a = towerish();
  const T = { tweezers: true };
  let gs = G.newGimmickState(a);
  gs = G.applyInteract(a, gs, a.objects[2], [0, 3, 3], T).gs;
  const r = G.applyInteract(a, gs, a.objects[3], [0, 13, 14], T);
  assert.equal(r.ok, false);
  assert.equal(r.msg, 'wrong-kind');
  a.objects[3].size = 'small';
  gs = G.applyInteract(a, gs, a.objects[3], [0, 13, 14], T).gs;
  gs = G.applyInteract(a, gs, a.objects[0], [0, 12, 13]).gs;
  assert.deepEqual([gs.ring.r0, gs.ring.r1], [1, 1]);
});

test('ピンセット: なしでは持てない・1つまで・種類が合うくぼみだけ・上に立つと取れない', () => {
  const a = mk();
  a.objects.push(
    { id: 'p', type: 'item', item: 'p', kind: 'plank', l: 0, x: 5, z: 5 },
    { id: 'q', type: 'item', item: 'q', kind: 'block', l: 0, x: 7, z: 5 },
    { id: 's', type: 'socket', kind: 'plank', l: 0, x: 10, z: 10, h: 1 },
    { id: 'sb', type: 'socket', kind: 'block', l: 0, x: 12, z: 10, h: 2 },
  );
  let gs = G.newGimmickState(a);
  assert.equal(G.applyInteract(a, gs, a.objects[0], [0, 5, 6]).msg, 'need-tweezers');
  const T = { tweezers: true };
  gs = G.applyInteract(a, gs, a.objects[0], [0, 5, 6], T).gs;
  assert.equal(G.applyInteract(a, gs, a.objects[1], [0, 7, 6], T).msg, 'hands-full');
  assert.equal(G.applyInteract(a, gs, a.objects[3], [0, 12, 11], T).msg, 'wrong-kind');
  gs = G.applyInteract(a, gs, a.objects[2], [0, 10, 11], T).gs;
  assert.equal(gs.items.p, 's');
  assert.equal(G.cell(a, gs, 0, 10, 10).t, 'B');
  gs = G.applyInteract(a, gs, a.objects[1], [0, 7, 6], T).gs;
  gs = G.applyInteract(a, gs, a.objects[3], [0, 12, 11], T).gs;
  assert.equal(G.cell(a, gs, 0, 12, 10).h, 2);
  assert.equal(G.applyInteract(a, gs, a.objects[3], [0, 12, 10], T).msg, 'standing');
  // 付けかえ: もう一度つまめる
  gs = G.applyInteract(a, gs, a.objects[2], [0, 10, 11], T).gs;
  assert.equal(gs.held, 'p');
});

test('エリアを出ると、置いていない物だけ元に戻る', () => {
  const gs = { disc: {}, ring: {}, lamp: 0, gp: {}, items: { a: 'held', b: 'sock', c: 'home' }, held: 'a' };
  const r = G.resetLooseItems(gs);
  assert.deepEqual(r.items, { a: 'home', b: 'sock', c: 'home' });
  assert.equal(r.held, null);
  assert.equal(G.mustDropBeforeExit(gs), true);
});

test('影: 幹の1つ南の列から落ちる。切り絵の木を立てると影が増える', () => {
  const a = mk({ levels: [flat(20, 10, 'c', 2)], lampStart: 2, casters: [{ id: 't', l: 0, x: 5, z: 3, angle: 2, len: 3, wide: 1 }] });
  a.objects.push({ id: 'cut', type: 'item', item: 'cut', kind: 'cutout', l: 0, x: 1, z: 1 }, { id: 'so', type: 'socket', kind: 'cutout', l: 0, x: 10, z: 6, caster: { angle: 0, len: 2, wide: 1 } });
  let gs = G.newGimmickState(a);
  assert.equal(G.walkable(G.cell(a, gs, 0, 5, 3)), false); // 幹の列には落ちない
  for (const x of [5, 6, 7, 8]) assert.equal(G.walkable(G.cell(a, gs, 0, x, 4)), true);
  assert.equal(G.walkable(G.cell(a, gs, 0, 9, 4)), false);
  gs = { ...gs, lamp: 0 };
  assert.equal(G.walkable(G.cell(a, gs, 0, 6, 4)), false);
  const T = { tweezers: true };
  gs = G.applyInteract(a, gs, a.objects[0], [0, 1, 2], T).gs;
  gs = G.applyInteract(a, gs, a.objects[1], [0, 10, 5], T).gs;
  for (const x of [8, 9, 10]) assert.equal(G.walkable(G.cell(a, gs, 0, x, 7)), true);
  assert.equal(G.walkable(G.cell(a, gs, 0, 10, 6)), false); // 台座は通れない
});

test('ランプ台: 東 → 真上 → 西 → 東', () => {
  const a = mk({ lampStart: 0 });
  a.objects.push({ id: 'L', type: 'lampStation', l: 0, x: 1, z: 1 });
  let gs = G.newGimmickState(a);
  const seq = [];
  for (let i = 0; i < 3; i++) { gs = G.applyInteract(a, gs, a.objects[0], [0, 1, 1]).gs; seq.push(gs.lamp); }
  assert.deepEqual(seq, [1, 2, 0]);
});

test('振り子: くさびをはさむまでふさぐ / 拍の振り子はゲームの拍でだけふさぐ', () => {
  const a = mk();
  a.objects.push(
    { id: 'pj', type: 'pendulum', l: 0, x: 5, z: 5, cells: [[5, 5], [5, 6]], jamSocket: 'sw', period: 4 },
    { id: 'pb', type: 'pendulum', l: 0, x: 9, z: 5, cells: [[9, 5]], period: 4, phase: 0 },
    { id: 'sw', type: 'socket', kind: 'wedge', l: 0, x: 4, z: 5, h: 2 },
    { id: 'w', type: 'item', item: 'w', kind: 'wedge', l: 0, x: 1, z: 1 },
  );
  let gs = G.newGimmickState(a);
  assert.equal(G.walkable(G.cell(a, gs, 0, 5, 6)), false);
  assert.equal(G.walkable(G.cell(a, gs, 0, 9, 5)), true);
  assert.equal(G.walkable(G.cell(a, gs, 0, 9, 5, { beat: 0 })), false);
  assert.equal(G.walkable(G.cell(a, gs, 0, 9, 5, { beat: 2 })), true);
  gs = G.applyInteract(a, gs, a.objects[3], [0, 1, 2], { tweezers: true }).gs;
  gs = G.applyInteract(a, gs, a.objects[2], [0, 3, 5], { tweezers: true }).gs;
  assert.equal(G.walkable(G.cell(a, gs, 0, 5, 6)), true);
});

test('出口: needFlag は旗か、その旗のくぼみに物があれば開く', () => {
  const a = mk();
  a.objects.push({ id: 'e', type: 'exit', l: 0, x: 1, z: 1, needFlag: 'openTower' }, { id: 'ax', type: 'socket', kind: 'gear', l: 0, x: 3, z: 3, flag: 'openTower' }, { id: 'g', type: 'item', item: 'g', kind: 'gear', l: 0, x: 5, z: 5 });
  let gs = G.newGimmickState(a);
  assert.equal(G.exitOpen(a, gs, a.objects[0]), false);
  assert.equal(G.exitOpen(a, gs, a.objects[0], { openTower: true }), true);
  gs = G.applyInteract(a, gs, a.objects[2], [0, 5, 6], { tweezers: true }).gs;
  const r = G.applyInteract(a, gs, a.objects[1], [0, 3, 4], { tweezers: true });
  assert.equal(r.flag, 'openTower');
  assert.equal(G.exitOpen(a, r.gs, a.objects[0]), true);
});

test('本物のマップ: 大きさと建物(村は 48×40・8棟、時計塔のホールは広場の中央)', () => {
  const v = loadArea('village');
  assert.equal(v.levels[0].w, 48);
  assert.equal(v.levels[0].d, 40);
  assert.equal(v.buildings.length, 8);
  const t = v.buildings.find((b) => b.id === 'tower');
  assert.deepEqual([t.x0, t.z0, t.x1, t.z1], [19, 11, 28, 19]);
  const ts = loadArea('tsumiki');
  assert.equal(ts.discs.length, 5);
  for (const d of ts.discs) assert.equal(G.walkable(G.cell(ts, G.newGimmickState(ts), 0, d.cx, d.cz)), false, '回転台の中心は軸');
  const f = loadArea('forest');
  assert.equal(f.lampStart, 2);
  assert.equal(f.objects.filter((o) => o.type === 'lampStation').length, 7);
  const tw = loadArea('tower');
  assert.equal(tw.levels.length, 6);
  assert.equal(tw.objects.filter((o) => o.type === 'chest').length, 11);
});

test('くぼみの accepts: 形の合う積み木だけはまる(ほかの階の積み木は wrong-kind)', () => {
  const a = mk();
  a.objects.push(
    { id: 'b1', type: 'item', item: 'b1', kind: 'block', l: 0, x: 5, z: 5 },
    { id: 'b5', type: 'item', item: 'b5', kind: 'block', l: 0, x: 8, z: 5 },
    { id: 's5', type: 'socket', kind: 'block', accepts: ['b5'], l: 0, x: 12, z: 10, h: 2 },
  );
  const T = { tweezers: true };
  let gs = G.applyInteract(a, G.newGimmickState(a), a.objects[0], [0, 5, 6], T).gs;
  assert.equal(G.applyInteract(a, gs, a.objects[2], [0, 12, 11], T).msg, 'wrong-kind');
  gs = G.newGimmickState(a);
  gs = G.applyInteract(a, gs, a.objects[1], [0, 8, 6], T).gs;
  assert.equal(G.applyInteract(a, gs, a.objects[2], [0, 12, 11], T).ok, true);
});
