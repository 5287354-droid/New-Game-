import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './_db.mjs';
import { newSave } from '../src/core/save.js';
import { createMonster, calcStats } from '../src/core/stats.js';
import { addItem, removeItem, count, useFieldItem, shopList, buy, sell, addCaught, toBox, toParty, swapBox, reorderParty, restAtInn, addGold, newUid, removeMonster, hasAbleMonster, PARTY_MAX } from '../src/core/inventory.js';
import { check, talk, storyEvent, areaOpen, nextGoal, timeOfDay, advanceClock, clockText, completion, setFlag, canLeaveVillage } from '../src/core/story.js';

const mk = (sp, lv = 5) => createMonster(db, { sp, lv, shiny: false });

test('道具の出し入れ', () => {
  const s = newSave();
  addItem(s, 'patch', 3);
  assert.equal(count(s, 'patch'), 3);
  assert.equal(removeItem(s, 'patch', 4), false);
  assert.equal(removeItem(s, 'patch', 3), true);
  assert.equal(count(s, 'patch'), 0);
  assert.equal(addItem(s, 'patch', 500), 99);
});

test('フィールドで道具を使う: 回復・MP・起こす・状態異常・みんな', () => {
  const s = newSave();
  addCaught(s, mk('nejiko')); addCaught(s, mk('perari'));
  const [a, b] = s.party.map((u) => s.monsters[u]);
  const max = calcStats(db, a).hp;
  addItem(s, 'patch', 2);
  assert.equal(useFieldItem(db, s, 'patch', a).why, 'noEffect');
  a.hp = 1;
  assert.equal(useFieldItem(db, s, 'patch', a).ok, true);
  assert.equal(a.hp, Math.min(max, 46));
  assert.equal(count(s, 'patch'), 1);
  a.hp = 0;
  assert.equal(useFieldItem(db, s, 'patch', a).why, 'noEffect');
  addItem(s, 'oil');
  useFieldItem(db, s, 'oil', a);
  assert.equal(a.hp, Math.floor(max / 2));
  a.status = 'burn'; addItem(s, 'thread');
  useFieldItem(db, s, 'thread', a);
  assert.equal(a.status, null);
  a.hp = 1; b.hp = 1; addItem(s, 'spray');
  const r = useFieldItem(db, s, 'spray');
  assert.equal(r.changes.length, 2);
  assert.equal(useFieldItem(db, s, 'varnish', a).why, 'notField');
});

test('お店: 森がひらくまで並ばない物・買う・売る', () => {
  const s = newSave();
  s.gold = 100;
  const ids = () => shopList(db, s).map((i) => i.id);
  assert.ok(ids().includes('patch'));
  assert.ok(!ids().includes('bigpatch') && !ids().includes('spray'));
  assert.equal(buy(db, s, 'bigpatch').why, 'notSold');
  setFlag(s, 'openForest');
  assert.ok(ids().includes('bigpatch'));
  assert.equal(buy(db, s, 'patch', 3).ok, true);
  assert.equal(s.gold, 40);
  assert.equal(buy(db, s, 'oil').why, 'gold');
  assert.equal(sell(db, s, 'patch', 1).ok, true);
  assert.equal(s.gold, 50);
  addItem(s, 'gearpin');
  sell(db, s, 'gearpin');
  assert.equal(s.gold, 250);
  addItem(s, 'screw');
  assert.equal(sell(db, s, 'screw').why, 'cantSell');
  assert.equal(addGold(s, -1000), 0);
});

test('手持ちと預かり', () => {
  const s = newSave();
  for (let i = 0; i < 7; i++) assert.equal(addCaught(s, mk('nejiko')), i < PARTY_MAX ? 'party' : 'box');
  assert.equal(s.party.length, 6); assert.equal(s.box.length, 1);
  assert.equal(new Set([...s.party, ...s.box]).size, 7);
  assert.equal(toParty(s, s.box[0]).why, 'partyFull');
  const p0 = s.party[0], b0 = s.box[0];
  assert.equal(swapBox(s, p0, b0).ok, true);
  assert.equal(s.party[0], b0);
  assert.equal(toBox(s, s.party[5]).ok, true);
  assert.equal(toParty(s, s.box[0]).ok, true);
  assert.equal(reorderParty(s, [...s.party].reverse()).ok, true);
  assert.equal(reorderParty(s, ['m1']).ok, false);
  const u = newUid(s);
  assert.ok(!s.monsters[u]);
  removeMonster(s, s.party[0]);
  assert.equal(s.party.length, 5);
  const one = newSave(); addCaught(one, mk('perari'));
  assert.equal(toBox(one, one.party[0]).why, 'last');
  assert.equal(hasAbleMonster(one), true);
});

test('宿屋: 全回復・最後の宿屋・朝', () => {
  const s = newSave();
  addCaught(s, mk('nejiko'));
  const m = s.monsters[s.party[0]];
  m.hp = 0; m.status = 'rust'; s.clock = 1300;
  restAtInn(db, s, 'village');
  assert.equal(m.hp, calcStats(db, m).hp);
  assert.equal(m.status, null);
  assert.equal(s.clock, 360);
  assert.equal(timeOfDay(s.clock), 'morning');
});

test('旗と進行: 条件・会話の分岐・解禁・物語の出来事', () => {
  const s = newSave();
  assert.equal(nextGoal(s).id, 'name');
  storyEvent(s, 'name', { name: 'ピン' }); storyEvent(s, 'wake');
  assert.equal(canLeaveVillage(s), false);
  storyEvent(s, 'starter', { sp: 'nejiko' });
  assert.throws(() => storyEvent(s, 'starter', { sp: 'tokeimori' }));
  addCaught(s, mk('nejiko', 5));
  assert.equal(canLeaveVillage(s), true);
  assert.equal(areaOpen(s, 'tsumiki'), false);
  assert.deepEqual(storyEvent(s, 'talkChief').set, ['metChief', 'openTsumiki']);
  assert.equal(areaOpen(s, 'tsumiki'), true);
  assert.equal(storyEvent(s, 'talkChief').say, 'chief.hint');
  storyEvent(s, 'clearTsumiki');
  assert.deepEqual(storyEvent(s, 'talkChief').set, ['openForest']);
  assert.equal(areaOpen(s, 'forest'), true);
  // 配合: Lv10 がいないと親方は教えない
  assert.equal(storyEvent(s, 'talkBolt').say, 'bolt.grow');
  s.monsters[s.party[0]].lv = 10;
  assert.deepEqual(storyEvent(s, 'talkBolt').set, ['breedUnlocked']);
  storyEvent(s, 'beatKageboushi');
  assert.deepEqual(storyEvent(s, 'talkBolt').set, ['gotTweezers']);
  assert.equal(s.abilities.tweezers, true);
  assert.equal(areaOpen(s, 'tower'), false);
  storyEvent(s, 'openTower');
  assert.equal(areaOpen(s, 'tower'), true);
  storyEvent(s, 'floor', { n: 3 });
  assert.equal(s.flags.tw_f3, true);
  storyEvent(s, 'place', { id: 'ts_ladder' });
  assert.equal(s.flags.ts_ladder, true);
  assert.equal(nextGoal(s).id, 'tower');
  // 条件
  assert.equal(check(s, ['clearTsumiki', '!ending']), true);
  assert.equal(check(s, { any: ['ending', { lv: 10 }] }), true);
  assert.equal(check(s, { not: 'gotTweezers' }), false);
  assert.equal(check(s, { ability: 'tweezers' }), true);
  assert.equal(check(s, { party: 'nejiko' }), true);
  assert.equal(check(s, { gold: 1e6 }), false);
  assert.throws(() => check(s, { what: 1 }));
  const r = talk(s, [{ if: 'ending', say: 'おわり' }, { if: '!v_secret', say: ['ひみつ', 'だよ'], set: 'v_secret' }, { say: 'ふつう' }]);
  assert.deepEqual(r.say, ['ひみつ', 'だよ']);
  assert.deepEqual(r.set, ['v_secret']);
  assert.deepEqual(talk(s, [{ if: 'ending', say: 'x' }, { if: '!v_secret', say: 'y' }, { say: 'ふつう' }]).say, ['ふつう']);
});

test('時刻と達成率', () => {
  assert.deepEqual([0, 359, 360, 720, 1080, 1439].map(timeOfDay), ['night', 'night', 'morning', 'day', 'evening', 'evening']);
  const s = newSave();
  s.clock = 360;
  advanceClock(s, 5 * 60 * 1000); // 実時間5分 = 6時間
  assert.equal(s.clock, 720);
  assert.equal(clockText(s.clock), '12:00');
  advanceClock(s, 20 * 60 * 1000);
  assert.equal(s.clock, 720);
  assert.equal(check(s, { time: 'day' }), true);
  s.dex.caught = { nejiko: 1, perari: 1 };
  s.dex.parts = { 'nejiko.back': 2 };
  const c = completion(db, s);
  assert.equal(c.total, 20); assert.equal(c.caught, 2); assert.equal(c.dexPct, 10);
  assert.equal(c.partsTotal, 57); assert.equal(c.goldParts, 1);
});
