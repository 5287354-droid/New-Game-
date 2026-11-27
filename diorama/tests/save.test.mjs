import test from 'node:test';
import assert from 'node:assert/strict';
import { db, fixture } from './_db.mjs';
import { SAVE_VERSION, KEYS, migrate, newSave, validate, serialize, deserialize, exportText, importText, createStore, memoryStorage, resetLooseItems } from '../src/core/save.js';
import { createMonster } from '../src/core/stats.js';
import { addCaught } from '../src/core/inventory.js';
import { createBattle, submit } from '../src/core/battle.js';

test('v1 → v2 の移行: 中身が失われない', () => {
  const v1 = fixture('save_v1.json');
  const before = structuredClone(v1);
  const v2 = migrate(v1);
  assert.deepEqual(v1, before, 'もとのオブジェクトは書きかえない');
  assert.equal(v2.v, SAVE_VERSION);
  assert.deepEqual(validate(v2), []);
  // 失われないもの
  for (const k of ['savedAt', 'playMs', 'clock', 'lastInn', 'flags', 'abilities', 'gold', 'bag', 'party', 'box', 'dex', 'books']) assert.deepEqual(v2[k], v1[k], k);
  for (const [uid, m] of Object.entries(v1.monsters)) {
    const n = v2.monsters[uid];
    for (const k of ['sp', 'nick', 'lv', 'xp', 'hp', 'mp', 'skills', 'status', 'shiny', 'gen', 'bonus', 'parents', 'born']) assert.deepEqual(n[k], m[k], `${uid}.${k}`);
    assert.deepEqual(n.parts, m.parts, `${uid} のおさがりの履歴`);
    assert.equal(n.uid, uid);
  }
  assert.equal(v2.player.name, 'ピン'); assert.equal(v2.player.x, 30); assert.equal(v2.player.cam, 0);
  assert.equal(v2.stats.battles, 41); assert.equal(v2.stats.defeats, 0);
  assert.equal(v2.nextUid, 8);
  // ギミックの状態はそのまま、持っていた物だけ元へ
  assert.deepEqual(v2.areas.tsumiki.gs.disc, { A: 0, B: 1 });
  assert.equal(v2.areas.tsumiki.gs.items.ts_plank, 'ts_sock_plank');
  assert.equal(v2.areas.tsumiki.gs.held, null);
  assert.equal(v2.areas.forest.gs.lamp, 2);
  assert.deepEqual(v2.rewards, {});
  // 今の版はそのまま
  assert.deepEqual(migrate(v2), v2);
  assert.throws(() => migrate({ v: 99 }));
});

test('移行のあとも遊べる(戦闘・新しい uid)', () => {
  const s = migrate(fixture('save_v1.json'));
  const party = s.party.map((u) => s.monsters[u]);
  const b = createBattle(db, { allies: party, enemies: [createMonster(db, { sp: 'koroishi', lv: 3 })], seed: 1 });
  submit(b, {});
  const where = addCaught(s, createMonster(db, { sp: 'perari', lv: 3 }));
  assert.equal(where, 'party');
  assert.ok(s.monsters.m8);
  assert.deepEqual(validate(s), []);
});

test('保存と読みこみ(差しかえた保存先)・手動とオートの新しい方', async () => {
  const mem = memoryStorage();
  const store = createStore(mem);
  const s = newSave('テスト');
  addCaught(s, createMonster(db, { sp: 'nejiko', lv: 5 }));
  s.areas.tsumiki = { gs: { items: { ts_ladder: 'home' }, held: 'ts_ladder' }, opened: [] };
  assert.equal(store.has('manual'), false);
  assert.equal(store.load('manual'), null);
  store.save(s, 'manual');
  assert.ok(mem.getItem(KEYS.manual));
  const back = store.load('manual');
  assert.equal(back.player.name, 'テスト');
  assert.equal(back.areas.tsumiki.gs.held, null);
  assert.deepEqual(validate(back), []);
  await new Promise((r) => setTimeout(r, 5));
  s.gold = 999;
  store.save(s, 'auto');
  assert.equal(store.loadLatest().gold, 999);
  // v1 の文字列が入っていても読める
  mem.setItem(KEYS.manual, JSON.stringify(fixture('save_v1.json')));
  assert.equal(store.load('manual').v, SAVE_VERSION);
  store.remove('auto');
  assert.equal(store.has('auto'), false);
  store.saveSettings({ quality: 'mid' });
  assert.deepEqual(store.loadSettings(), { quality: 'mid' });
  // localStorage がない node でも createStore() が動く
  assert.ok(createStore().backend);
});

test('書き出し / 読みこみ(テキスト。日本語の名前も)', () => {
  const s = newSave('ピンセット');
  addCaught(s, createMonster(db, { sp: 'nejiko', lv: 5, nick: 'ねじまる' }));
  const t = exportText(s);
  assert.match(t, /^DMK1:[A-Za-z0-9+/=]+$/);
  const r = importText(t);
  assert.equal(r.player.name, 'ピンセット');
  assert.equal(Object.values(r.monsters)[0].nick, 'ねじまる');
  assert.deepEqual(importText(serialize(s)).player, s.player);
  // v1 の書き出しも読める
  const v1 = fixture('save_v1.json');
  const b64 = 'DMK1:' + Buffer.from(JSON.stringify(v1), 'utf8').toString('base64');
  assert.equal(importText(b64).v, SAVE_VERSION);
  assert.throws(() => importText('DMK1:@@@'));
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('形の検査', () => {
  const s = newSave();
  assert.deepEqual(validate(s), []);
  s.party.push('m99');
  assert.ok(validate(s).length);
  assert.deepEqual(resetLooseItems({ areas: { a: { gs: { items: {}, held: 'x' } } } }).areas.a.gs, { items: { x: 'home' }, held: null });
});
