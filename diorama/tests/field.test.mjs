// フィールドの動き(src/field/)のテスト。最後に、ソルバーの手順を field の関数で再生して、ゴール・ぬしまで行けることを確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createField, STEP_MS } from '../src/field/field.js';
import { loadArea } from '../tools/solver/solver.mjs';
import * as G from '../src/core/grid.js';

const run = (f, maxMs = 120000) => { const ev = []; for (let t = 0; t < maxMs && (f.path || f.initEvents.length) && !f.busy; t += 100) ev.push(...f.update(100)); return ev; };
const types = (ev) => ev.map((e) => e.t);

test('歩く: 押し続けでその向きへ1マスずつ、壁で止まる。走ると速い', () => {
  const f = createField(loadArea('village'), { monsters: false });
  assert.deepEqual(f.pos(), [0, 6, 5]);
  f.hold(1);
  const ev = f.update(STEP_MS.walk * 2);
  assert.deepEqual(f.pos(), [0, 6, 7]);
  assert.equal(ev.filter((e) => e.t === 'move').length, 2);
  f.hold(3, true);
  f.update(STEP_MS.run * 2);
  assert.deepEqual(f.pos(), [0, 6, 5]);
  f.hold(3);
  const ev2 = f.update(STEP_MS.walk * 4);
  assert.ok(types(ev2).includes('bump'));
  f.release();
});

test('自動で歩く: タップした所まで経路で歩き、着いたら止まる。物をタップするとそこで調べる', () => {
  const f = createField(loadArea('village'), { monsters: false });
  f.walkTo([0, 6, 9]);
  run(f);
  assert.deepEqual(f.pos(), [0, 6, 9]);
  const f2 = createField(loadArea('village'), { monsters: false });
  f2.tapObject('v_home_shelf');
  const ev = run(f2);
  const c = ev.find((e) => e.t === 'chest');
  assert.equal(c.item, 'patch');
  assert.deepEqual(types(f2.use('v_home_shelf')).filter((t) => t !== 'turn'), ['read']); // 2回目は中身なし
});

test('階段: 乗るとほかの階へ。はしごの屋根裏の隠し棚', () => {
  const f = createField(loadArea('village'), { monsters: false });
  f.tapObject('v_home_attic');
  const ev = run(f);
  assert.ok(types(ev).includes('stairs'));
  assert.equal(f.player.l, 1);
  assert.equal(ev.find((e) => e.t === 'chest').item, 'gearpin');
});

test('話す: 目の前の人。夜は住人が家に帰る', () => {
  const f = createField(loadArea('village'), { monsters: false, at: { l: 0, x: 20, z: 11 }, dir: 3 });
  const ev = f.interact();
  assert.equal(ev.find((e) => e.t === 'talk').id, 'inkyo');
  const ev2 = f.setClock(60);
  assert.ok(ev2.some((e) => e.t === 'npcMove' && e.id === 'inkyo'));
  assert.equal(f.interact()[0].t, 'nothing');
  assert.ok(!G.walkable(f.cellAt(0, 38, 5))); // 夜のご隠居は村長の家
});

test('回転台: 乗ったまま回すと主人公もいっしょに回る / 台の上の人形も回る', () => {
  const area = loadArea('tsumiki');
  const f = createField(area, { monsters: false, at: { l: 0, x: 30, z: 38 }, dir: 3 });
  f.puppets.push({ id: 'p1', rule: 0, sp: 'koroishi', lv: 3, l: 0, x: 30, z: 40, dir: 1, wait: 1e9, stun: 0 });
  const ev = f.interact();
  const r = ev.find((e) => e.t === 'rotate');
  assert.equal(r.id, 'A');
  assert.equal(r.player, true);
  assert.deepEqual(f.pos(), [0, 29, 37]);
  assert.deepEqual(r.puppets[0].to, [0, 27, 37]);
});

test('魔物の人形: 出現の表から出て歩き回る。触れたら戦闘、後ろからなら先制。倒すとしばらく出ない', () => {
  const area = loadArea('tsumiki');
  const f = createField(area, { rng: 5 });
  const ev0 = f.update(10);
  const spawned = ev0.filter((e) => e.t === 'spawn');
  assert.ok(spawned.length >= 10);
  assert.ok(f.puppets.some((p) => p.rare && p.rareId === 'ts_rare_haribote'));
  for (const p of f.puppets) if (!p.rare && area.spawns[p.rule].x0 != null) {
    const s = area.spawns[p.rule];
    assert.ok(p.x >= s.x0 && p.x <= s.x1 && p.z >= s.z0 && p.z <= s.z1);
  }
  // 後ろから触れる
  const p = f.puppets.find((q) => !q.rare);
  p.dir = 0; p.wait = 1e9;
  const [px, pz] = [p.x, p.z];
  f.setPos([p.l, px - 1, pz]);
  f.player.dir = 0;
  const ev = [];
  f.step(0, false, ev);
  const e = ev.find((q) => q.t === 'encounter');
  assert.equal(e.first, 'player');
  assert.equal(f.busy, 'battle');
  assert.equal(f.update(1000).length, 0); // 戦闘中は止まる
  const n = f.puppets.length;
  const ev2 = f.battleEnd(p.id, 'win');
  assert.ok(ev2.some((q) => q.t === 'despawn'));
  assert.equal(f.puppets.length, n - 1);
  f.update(100);
  assert.equal(f.puppets.filter((q) => q.rule === p.rule).length, area.spawns[p.rule].n - 1); // しばらく出ない
  f.update(91000);
  assert.equal(f.puppets.filter((q) => q.rule === p.rule).length, area.spawns[p.rule].n);
});

test('夕方だけの魔物 / 影の魔物はランプで消える', () => {
  const ts = loadArea('tsumiki');
  const f = createField(ts, { rng: 2, clock: 600 });
  f.update(10);
  const ev = ts.spawns.findIndex((s) => s.cond === 'evening');
  assert.equal(f.puppets.filter((p) => p.rule === ev).length, 0);
  f.setClock(1100);
  assert.ok(f.puppets.filter((p) => p.rule === ev).length > 0);
  const fo = loadArea('forest');
  const g = createField(fo, { rng: 3, at: { l: 0, x: 8, z: 34 } });
  g.update(10);
  const sh = fo.spawns.findIndex((s) => s.cond === 'shadow');
  const before = g.puppets.filter((p) => p.rule === sh);
  assert.ok(before.length > 0);
  const lev = g.interact(); // ランプ台
  assert.ok(lev.some((e) => e.t === 'lamp'));
  for (const p of g.puppets.filter((q) => q.rule === sh)) assert.ok(G.shadowSet(g.view, g.gs).has(p.z * 56 + p.x) || fo.levels[0].t[p.z * 56 + p.x] === 'c');
});

test('光の当たる谷に踏みこむと、直前の足場にもどる', () => {
  const f = createField(loadArea('forest'), { monsters: false, at: { l: 0, x: 13, z: 30 } });
  const ev = [];
  f.step(0, false, ev); // (14,30) は西の光では光が当たっている
  assert.ok(types(ev).includes('fall'));
  assert.deepEqual(f.pos(), [0, 13, 30]);
});

test('ピンセット: 持つ・置く・付けかえ。持ったまま出口で止められ、出ると置いていない物は戻る', () => {
  const area = loadArea('village');
  const f = createField(area, { monsters: false, abilities: { tweezers: true } });
  f.tapObject('v_gear'); let ev = run(f);
  assert.ok(ev.some((e) => e.t === 'pick' && e.item === 'v_gear'));
  f.walkTo([0, 23, 37]); run(f);
  f.hold(1); ev = f.update(STEP_MS.walk);
  assert.ok(ev.some((e) => e.t === 'say' && e.key === 'dropFirst'));
  f.release();
  f.tapObject('v_tower_axle'); ev = run(f);
  assert.ok(ev.some((e) => e.t === 'place' && e.flag === 'openTower'));
  f.tapObject('v_tower_axle'); ev = run(f); // 付けかえ(もう一度つまむ)
  assert.equal(f.gs.held, 'v_gear');
  const st = f.leave();
  assert.equal(st.gs.items.v_gear, 'home');
  assert.equal(st.gs.held, null);
  // 正しく置いた物は覚えている
  const g = createField(area, { monsters: false, abilities: { tweezers: true } });
  g.tapObject('v_gear'); run(g); g.tapObject('v_tower_axle'); run(g);
  const st2 = g.leave();
  assert.equal(st2.gs.items.v_gear, 'v_tower_axle');
  const h = createField(area, { monsters: false, state: st2, entry: 'tower' });
  h.walkTo([0, 23, 12]); ev = run(h);
  assert.ok(ev.some((e) => e.t === 'exit' && e.to === 'tower'));
});

test('振り子: 拍でふさぐ。押し戻す・自動で歩くときは待つ', () => {
  const area = loadArea('tower');
  let beat = 0;
  const pend = area.objects.find((o) => o.id === 'tw_pend_20');
  const [cx, cz] = pend.cells[1];
  const f = createField(area, { monsters: false, at: { l: 3, x: cx, z: cz }, beat: () => beat });
  beat = (4 - pend.phase) % 4; // ふさぐ拍
  const ev = f.update(10);
  assert.ok(ev.some((e) => e.t === 'pushed' && e.why === 'pendulum'));
  assert.notDeepEqual(f.pos(), [3, cx, cz]);
});

// ---------------------------------------------------------------- 通しプレイの土台
function replay(id, targetId, abilities = { tweezers: true }, flags = {}) {
  const area = loadArea(id);
  const plan = JSON.parse(readFileSync(new URL(`../tools/solver/plans/${id}.json`, import.meta.url))).targets[targetId];
  let f = createField(area, { monsters: false, abilities, flags });
  const log = [];
  for (const st of plan.steps) {
    if (st.walk) {
      const o = area.objects.find((q) => q.type === 'stairs' && q.l === st.walk[0] && q.x === st.walk[1] && q.z === st.walk[2]);
      if (f.pos().join() !== st.walk.join()) { const e = f.walkTo(st.walk); assert.notEqual(e[0].t, 'noPath', `${targetId}: ${st.walk} に行けない`); log.push(...run(f)); }
      const want = o ? [o.to.l, o.to.x, o.to.z] : st.walk;
      if (!(f.busy === 'left')) assert.deepEqual(f.pos(), want, `${targetId}: ${st.walk} に着かない`);
    } else if (st.exit) {
      assert.ok(log.some((e) => e.t === 'exit'), 'exit');
      f = createField(area, { monsters: false, abilities, flags, state: log.filter((e) => e.t === 'exit').pop().state });
    } else if (st.use) {
      const o = area.objects.find((q) => q.id === st.use);
      if (o.type === 'stairs' || o.type === 'exit') continue;
      const ev = f.use(st.use);
      assert.ok(!ev.some((e) => e.t === 'gimmickFail' || e.t === 'tooFar'), `${targetId}: ${st.use} ${JSON.stringify(ev)}`);
      log.push(...ev);
    }
  }
  return log;
}

test('通しプレイ: つみき野のゴール・ランプの森のぬし・時計塔のボスと文字盤・村の塔の入口', () => {
  assert.ok(replay('tsumiki', 'ts_goal').some((e) => e.t === 'goal' && e.flag === 'clearTsumiki'));
  assert.ok(replay('forest', 'fo_boss').some((e) => e.t === 'boss' && e.species === 'kageboushi'));
  assert.ok(replay('tower', 'tw_boss').some((e) => e.t === 'boss' && e.species === 'tokeimori'));
  assert.ok(replay('tower', 'tw_clock', { tweezers: true }, { beatTokeimori: true }).some((e) => e.t === 'goal' && e.flag === 'ending'));
  assert.ok(replay('village', 'v_exit_tower_23').some((e) => e.t === 'exit' && e.to === 'tower'));
});

test('通しプレイ: 全エリアの宝箱すべて(ソルバーの手順を field で再生)', () => {
  for (const id of ['village', 'tsumiki', 'forest', 'tower']) {
    const plans = JSON.parse(readFileSync(new URL(`../tools/solver/plans/${id}.json`, import.meta.url))).targets;
    for (const k of Object.keys(plans)) {
      const area = loadArea(id);
      const t = area.objects.find((o) => o.id === k);
      if (!t || t.type !== 'chest') continue;
      const log = replay(id, k);
      assert.ok(log.some((e) => e.t === 'chest' && e.id === k), `${id} ${k}`);
    }
  }
});

test('振り子: 自動で歩くとき、ふさがれていたら待ってから通る', () => {
  const area = loadArea('tower');
  let beat = 0;
  const pend = area.objects.find((o) => o.id === 'tw_pend_20');
  const [cx, cz] = [15, 2]; // 振り子の線 (15,2)(16,2) を、西 (14,2) から東 (17,2) へ横切る
  const blockBeat = (4 - pend.phase) % 4;
  // 振り子の線の手前(西)から東へ
  const f = createField(area, { monsters: false, at: { l: 3, x: cx - 1, z: cz }, beat: () => beat });
  beat = blockBeat;
  f.walkTo([3, cx + 2, cz]);
  const ev = f.update(500);
  assert.ok(ev.some((e) => e.t === 'wait'));
  assert.deepEqual(f.pos(), [3, cx - 1, cz]);
  beat = blockBeat + 2;
  run(f);
  assert.deepEqual(f.pos(), [3, cx + 2, cz]);
});
