import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './_db.mjs';
import { makeRng, fixedRng } from '../src/core/rng.js';
import { GROW, createMonster, calcStats, xpForLevel, levelForXp, gainXp, learnSkill, partsOf, partPct, traitsOf, partSkills, usableSkills, learnedAt, xpMulOf, battleXp, battleGold, healFull } from '../src/core/stats.js';

test('経験値の表は DESIGN §3-2 の式(定数は GROW。docs/BALANCE.md)', () => {
  assert.deepEqual([2, 5, 10, 15, 20, 30].map(xpForLevel), [2, 5, 10, 15, 20, 30].map((L) => Math.floor(GROW.xpA * Math.pow(L - 1, GROW.xpP))));
  assert.ok([3, 4, 5, 10, 20, 30].every((L) => xpForLevel(L) > xpForLevel(L - 1)), 'Lv が上がるほど多く要る');
  assert.equal(xpForLevel(1), 0);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(xpForLevel(10)), 10);
  assert.equal(levelForXp(xpForLevel(10) - 1), 9);
  assert.equal(levelForXp(1e9), 30);
});

test('能力値の式: Lv・伸びボーナス・パーツ%・ぬしのHP倍率', () => {
  const n = createMonster(db, { sp: 'nejiko', lv: 5, shiny: false });
  // ネジコ base atk 15 × 1.4 × (1 + ばね3%) = 21.63 → 21
  const st = calcStats(db, n);
  assert.equal(st.atk, 21);
  assert.equal(st.spd, Math.floor(17 * 1.4 * 1.05));
  assert.equal(n.hp, st.hp);
  const b = createMonster(db, { sp: 'nejiko', lv: 5, shiny: false, bonus: 0.5 });
  assert.equal(calcStats(db, b).atk, Math.floor(15 * 1.4 * 1.5 * 1.03));
  const k1 = createMonster(db, { sp: 'kageboushi', lv: 14, shiny: false });
  const k2 = createMonster(db, { sp: 'kageboushi', lv: 14, shiny: false, boss: true });
  assert.equal(calcStats(db, k2).hp, Math.floor(calcStats(db, k1).hp * db.sp('kageboushi').hpMul));
  // Lv1 は base(パーツ%込み)
  const p = createMonster(db, { sp: 'perari', lv: 1, shiny: false });
  assert.equal(calcStats(db, p).int, Math.floor(db.sp('perari').base.int * 1.05));
});

test('作成: その Lv までのわざ(新しい4つ)、受けついだわざを優先', () => {
  const n = createMonster(db, { sp: 'nejiko', lv: 30, shiny: false });
  assert.deepEqual(n.skills, ['tinpunch', 'sharpen', 'gearsaw', 'clang']);
  assert.deepEqual(learnedAt(db, 'nejiko', 1), ['tackle', 'windup']);
  const c = createMonster(db, { sp: 'nejiko', lv: 30, shiny: false, inherit: ['heal', 'spark'] });
  assert.equal(c.skills.length, 4);
  assert.ok(c.skills.includes('heal') && c.skills.includes('spark'));
});

test('色違いは 1/256(種つき乱数で 25600 回)', () => {
  const rng = makeRng(42);
  let n = 0;
  for (let i = 0; i < 25600; i++) if (createMonster(db, { sp: 'nejiko', lv: 1, rng }).shiny) n++;
  assert.ok(n > 60 && n < 145, `色違い ${n}`);
  assert.equal(createMonster(db, { sp: 'nejiko', rng: fixedRng([0.001]) }).shiny, true);
  assert.equal(createMonster(db, { sp: 'nejiko', rng: fixedRng([0.5]) }).shiny, false);
  assert.equal(createMonster(db, { sp: 'nejiko', rng: fixedRng([0.01]), shinyRate: 1 / 64 }).shiny, true);
});

test('おさがりパーツ: ★の倍率・特性・パーツわざ', () => {
  const m = createMonster(db, { sp: 'koroishi', lv: 10, shiny: false, parts: { back: { from: 'nejiko', slot: 'back', star: 2, shiny: false, history: ['nejiko', 'koroishi'] } } });
  const ps = partsOf(db, m);
  assert.equal(ps[1].inherited, true);
  assert.equal(ps[1].mul, 1.5);
  const pct = partPct(db, m);
  assert.equal(pct.spd, 7.5); // ねじ巻き 5% × 1.5
  assert.equal(pct.hp, 0); // こけ石(hp5)は入れかわった
  assert.equal(pct.def, 9); // ころ頭6 + しっぽ3
  assert.deepEqual(Object.keys(traitsOf(db, m)), ['windupStart']);
  const g = createMonster(db, { sp: 'koroishi', lv: 10, shiny: false, parts: { back: { from: 'nejiko', slot: 'back', star: 3 } } });
  assert.equal(traitsOf(db, g).windupStart.gold, true);
  const f = createMonster(db, { sp: 'nejiko', lv: 10, shiny: false, parts: { tail: { from: 'burikishi', slot: 'tail', star: 1 } } });
  assert.deepEqual(partSkills(db, f), ['knightcharge']);
  assert.ok(usableSkills(db, f).includes('knightcharge'));
  // 生まれつきのパーツわざも使える(ペラリのしおり)
  const p = createMonster(db, { sp: 'perari', lv: 1, shiny: false });
  assert.deepEqual(partSkills(db, p), ['papershield']);
});

test('レベルアップ: 出来事・HP が増える・わざを覚える・4つ埋まっていたら learnFull', () => {
  const n = createMonster(db, { sp: 'nejiko', lv: 4, shiny: false });
  const hp0 = n.hp;
  const ev = gainXp(db, n, xpForLevel(5) - n.xp);
  assert.equal(n.lv, 5);
  assert.ok(ev.some((e) => e.type === 'levelUp' && e.lv === 5));
  assert.ok(ev.some((e) => e.type === 'learn' && e.skill === 'tinpunch'));
  assert.ok(n.hp > hp0);
  const full = createMonster(db, { sp: 'nejiko', lv: 16, shiny: false });
  assert.equal(full.skills.length, 4);
  const ev2 = gainXp(db, full, xpForLevel(17) - full.xp);
  assert.ok(ev2.some((e) => e.type === 'learnFull' && e.skill === 'gearsaw'));
  assert.equal(learnSkill(full, 'gearsaw', 'tackle'), true);
  assert.ok(full.skills.includes('gearsaw') && !full.skills.includes('tackle'));
  assert.equal(learnSkill(full, 'gearsaw', 0), false); // もう覚えている
  // 上限 Lv30
  const top = createMonster(db, { sp: 'nejiko', lv: 29, shiny: false });
  gainXp(db, top, 1e6);
  assert.equal(top.lv, 30);
  assert.equal(top.xp, xpForLevel(30));
  // 1度に何段も上がる
  const lo = createMonster(db, { sp: 'perari', lv: 1, shiny: false });
  const ev3 = gainXp(db, lo, xpForLevel(10));
  assert.equal(ev3.filter((e) => e.type === 'levelUp').length, 9);
});

test('ごほうびの式と生まれたての子', () => {
  const e = [createMonster(db, { sp: 'koroishi', lv: 6, shiny: false })];
  assert.equal(battleXp(db, e), db.sp('koroishi').xp * 6 / GROW.xpDiv);
  assert.equal(battleGold(db, e), db.sp('koroishi').gold * 6 / GROW.goldDiv);
  assert.equal(xpMulOf({ born: 'breed', lv: 9 }), 1.5);
  assert.equal(xpMulOf({ born: 'breed', lv: 10 }), 1);
  assert.equal(xpMulOf({ born: 'scout', lv: 3 }), 1);
  const m = createMonster(db, { sp: 'nejiko', lv: 5, shiny: false }); m.hp = 0; m.status = 'burn';
  healFull(db, m);
  assert.equal(m.hp, calcStats(db, m).hp); assert.equal(m.status, null);
});
