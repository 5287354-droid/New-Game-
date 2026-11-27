// ソルバーのテスト: 全エリアで「全部届く・詰みなし・ピンセットの印どおり・設計図の手数」、手順が通しで遊べること
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkArea, loadArea, replayPlan, writePlans } from '../tools/solver/solver.mjs';

const results = {};
for (const id of ['village', 'tsumiki', 'forest', 'tower']) {
  test(`${id}: 全部届く・詰まない・ピンセットの印どおり`, () => {
    const r = checkArea(id);
    results[id] = r;
    assert.deepEqual(r.errors, []);
    assert.equal(r.yes.unreached.length, 0);
    assert.equal(r.yes.stuck, 0);
    writePlans(r);
  });
  test(`${id}: 手順(plans/${id}.json)を grid.js の規則で通しで遊べる`, () => {
    const plans = JSON.parse(readFileSync(new URL(`../tools/solver/plans/${id}.json`, import.meta.url)));
    const area = loadArea(id);
    for (const [k, plan] of Object.entries(plans.targets)) assert.equal(replayPlan(area, plan), null, k);
  });
}

test('つみき野: ゴールまで最少6操作(A×2・C×2・E×1・D×1)', () => {
  const r = results.tsumiki || checkArea('tsumiki');
  const plan = r.yes.plan('ts_goal');
  assert.equal(plan.ops, 6);
  const uses = plan.steps.filter((s) => s.use && s.use !== 'ts_goal').map((s) => s.use[0]);
  assert.deepEqual(uses.sort(), ['A', 'A', 'C', 'C', 'D', 'E']);
  assert.equal(r.no.states, 1540); // 企画参謀の抽象モデルと同じ状態数
});

test('ランプの森: ぬしまでランプ8回、操作0で入口の影の橋', () => {
  const r = results.forest || checkArea('forest');
  assert.equal(r.yes.reached.fo_boss.ops, 8);
  assert.equal(r.yes.reached.fo_chest_hollow.ops, 0);
  assert.equal(r.no.reached.fo_chest_nest, undefined);
});

test('時計塔: 1階2手・2〜3階3手・大きい歯車の付けかえが必須', () => {
  const r = results.tower || checkArea('tower');
  assert.equal(r.yes.reached.tw_up0.ops, 2);
  assert.equal(r.yes.reached.tw_up2.ops - r.yes.reached.tw_up1.ops + 1, 3);
  assert.ok(r.yes.reached.tw_up4.ops - r.yes.reached.tw_up3.ops >= 6);
  assert.equal(r.mustRemove, true);
  assert.equal(r.no.reached.tw_up2, undefined);
});

test('抜け道なし: つみき野の積み木は台Dを回さないと届かない / 塔5階の段は5階の積み木と4階の歯車のあとだけ', () => {
  const ts = results.tsumiki || checkArea('tsumiki');
  assert.ok(ts.mustUse.every((m) => m.ok), JSON.stringify(ts.mustUse));
  const tw = results.tower || checkArea('tower');
  assert.ok(tw.mustUse.every((m) => m.ok), JSON.stringify(tw.mustUse));
  assert.ok(tw.yes.reached.tw_chest_treasure.ops > tw.yes.reached.tw_up4.ops);
});
