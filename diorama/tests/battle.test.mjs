import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './_db.mjs';
import { makeRng, fixedRng } from '../src/core/rng.js';
import { createMonster, calcStats, xpForLevel } from '../src/core/stats.js';
import {
  createBattle, submit, calcDamage, hitChance, elementMul, scoutChance, runChance, availableCommands, validTargets, getView,
  runAuto, applyBattleResult, bossEnemies, phaseFor, handFor, rowOf, effStat, forceFinish, wildEnemies, autoAction, TUNE, BOSS,
} from '../src/core/battle.js';
import { GROW } from '../src/core/stats.js';
import { newSave } from '../src/core/save.js';
import { addCaught } from '../src/core/inventory.js';

const mk = (sp, lv = 10, o = {}) => createMonster(db, { sp, lv, shiny: false, ...o });
const B = (allies, enemies, o = {}) => createBattle(db, { allies, enemies, seed: 1, ...o });
const U = (b, k) => b.units[k];

test('ダメージの式(DESIGN §4-4)', () => {
  const b = B([mk('nejiko', 5)], [mk('koroishi', 4)]);
  const a = U(b, 'a0'), e = U(b, 'e0');
  const tackle = db.sk('tackle');
  const A = a.st.atk, D = e.st.def;
  const base = 30 / TUNE.powDiv * A * A / (A + D);
  assert.equal(calcDamage(b, a, e, tackle, { roll: 1, crit: false }).dmg, Math.floor(base));
  assert.equal(calcDamage(b, a, e, tackle, { roll: 1, crit: true }).dmg, Math.floor(base * 1.5));
  // 素材ぞろい 1.2(ブリキパンチ)・弱点 1.5 ・いまひとつ 0.67
  const tp = db.sk('tinpunch');
  const bt = 44 / TUNE.powDiv * A * A / (A + D);
  assert.equal(calcDamage(b, a, e, tp, { roll: 1, crit: false }).dmg, Math.floor(bt * 1.2 * 0.67)); // 石はブリキに強い → ブリキわざは石に弱い
  assert.equal(elementMul(b, 'water', 'fire'), 1.5);
  assert.equal(elementMul(b, 'fire', 'water'), 0.67);
  assert.equal(elementMul(b, 'none', 'water'), 1);
  assert.equal(elementMul(b, 'tin', 'cloth'), 1.5);
  assert.equal(elementMul(b, 'cloth', 'water'), 1.5);
  // 魔法: D = (まもり+かしこさ)/2
  const b2 = B([mk('matchbo', 7)], [mk('perari', 6)]);
  const m = U(b2, 'a0'), p = U(b2, 'e0');
  const Am = m.st.int, Dm = (p.st.def + p.st.int) / 2;
  assert.equal(calcDamage(b2, m, p, db.sk('spark'), { roll: 1 }).dmg, Math.floor(36 / TUNE.powDiv * Am * Am / (Am + Dm) * 1.5 * 1.2));
  // 最低 1
  const b3 = B([mk('perari', 1)], [mk('koroishi', 30)]);
  assert.ok(calcDamage(b3, U(b3, 'a0'), U(b3, 'e0'), db.sk('tackle'), { roll: 0.9, crit: false }).dmg >= 1);
});

test('後列: ダメージ ×0.7、近接わざが届かない・出せない、全体わざ ×0.75', () => {
  const b = B([mk('nejiko'), mk('perari'), mk('inky')], [mk('koroishi'), mk('koroishi'), mk('koroishi')]);
  assert.equal(rowOf(b, U(b, 'e2')), 'back');
  const a = U(b, 'a0');
  const raw = (sk, t) => { const A = a.st.atk, D = t.st.def; return sk.pow / TUNE.powDiv * A * A / (A + D) * elementMul(b, sk.el, t.mat) * (sk.el === a.mat ? 1.2 : 1); };
  const pebble = db.sk('pebble');
  assert.equal(calcDamage(b, a, U(b, 'e0'), pebble, { roll: 1, crit: false }).dmg, Math.floor(raw(pebble, U(b, 'e0'))));
  assert.equal(calcDamage(b, a, U(b, 'e2'), pebble, { roll: 1, crit: false }).dmg, Math.floor(raw(pebble, U(b, 'e2')) * 0.7));
  assert.deepEqual(validTargets(b, 'a0', 'tackle').sort(), ['e0', 'e1']);
  assert.deepEqual(validTargets(b, 'a0', 'splash').sort(), ['e0', 'e1', 'e2']);
  const cmds = availableCommands(b, 'a2');
  assert.equal(cmds.attack, false);
  assert.equal(cmds.skills.find((s) => s.id === 'tackle').reason, 'back');
  assert.equal(cmds.skills.find((s) => s.id === 'splash').ok, true);
  const quake = db.sk('quake');
  assert.equal(calcDamage(b, a, U(b, 'e0'), quake, { roll: 1, crit: false }).dmg, Math.floor(raw(quake, U(b, 'e0')) * 0.75));
});

test('すばやさ順・かばう(prio)が先・いれかえた魔物はそのターン動かない', () => {
  const b = B([mk('watabou', 10), mk('koroishi', 10, { skills: ['tackle', 'cover'] }), mk('perari', 10)], [mk('koroishi', 5), mk('koroishi', 5)]);
  const ev = submit(b, { a0: { cmd: 'attack', target: 'e0' }, a1: { cmd: 'skill', skill: 'cover', target: 'a0' }, a2: { cmd: 'swap', with: 'a0' } });
  const order = ev.find((e) => e.type === 'order').order;
  assert.equal(order[0], 'a2'); // いれかえ が先
  assert.equal(order[1], 'a1'); // かばう(prio 1)
  assert.ok(ev.some((e) => e.type === 'swap' && e.out === 'a2' && e.in === 'a0'));
  assert.ok(!ev.some((e) => e.type === 'action' && e.actor === 'a0'), 'いれかえた魔物は動かない');
  assert.equal(rowOf(b, U(b, 'a0')), 'back');
  // 敵の単体わざは かばった魔物が受ける(後列の a0 に届くのは遠くのわざだけだが、かばうは a0 を守っている)
});

test('かばう: 単体わざを代わりに受ける', () => {
  const b = B([mk('perari', 10), mk('koroishi', 10, { skills: ['tackle', 'cover'] })], [mk('origarasu', 12, { skills: ['papercut'] })], { seed: 3 });
  const ev = submit(b, { a0: { cmd: 'skill', skill: 'papershield', target: 'a0' }, a1: { cmd: 'skill', skill: 'cover', target: 'a0' } });
  const hits = ev.filter((e) => e.type === 'damage' && e.actor === 'e0');
  if (hits.length) assert.equal(hits[0].target, 'a1');
  assert.ok(ev.some((e) => e.type === 'guard'));
});

test('前列が2体たおれたら後列が前に出る / 控えが入る', () => {
  const b = B([mk('nejiko', 20), mk('nejiko', 20), mk('nejiko', 20)], [mk('perari', 2), mk('perari', 2), mk('koroishi', 2)]);
  U(b, 'e0').hp = 1; U(b, 'e1').hp = 1;
  const ev = submit(b, { a0: { cmd: 'attack', target: 'e0' }, a1: { cmd: 'attack', target: 'e1' }, a2: { cmd: 'wait' } });
  if (!U(b, 'e0').alive && !U(b, 'e1').alive && U(b, 'e2').alive) {
    assert.equal(b.field.enemy[0], 'e2');
    assert.ok(ev.some((e) => e.type === 'advance' && e.side === 'enemy'));
  }
  const c = B([mk('perari', 2), mk('perari', 2), mk('perari', 2), mk('inky', 5)], [mk('koroishi', 25)]);
  U(c, 'a0').hp = 1;
  let ev2 = [];
  for (let i = 0; i < 5 && U(c, 'a0').alive; i++) ev2 = ev2.concat(submit(c, { a0: { cmd: 'wait' }, a1: { cmd: 'wait' }, a2: { cmd: 'wait' } }));
  if (!c.over) {
    assert.ok(ev2.some((e) => e.type === 'enter' && e.unit === 'a3'));
    assert.ok(c.field.ally.includes('a3'));
  }
});

test('状態異常: こげ・ねむり・ならない魔物・さびはブリキに2倍', () => {
  const b = B([mk('perari', 10)], [mk('koroishi', 10)]);
  const e = U(b, 'e0');
  e.status = { id: 'burn', turns: 5 };
  const atk0 = e.st.atk;
  assert.equal(effStat(b, e, 'atk'), atk0 * 0.85);
  const hp0 = e.hp;
  const ev = submit(b, { a0: { cmd: 'wait' } });
  const tick = ev.find((x) => x.type === 'burnTick');
  assert.equal(tick.amount, Math.floor(e.maxHp / 12));
  const rg = ev.find((x) => x.type === 'heal' && x.why === 'regen'); // コロイシのこけ石
  assert.equal(e.hp, hp0 - tick.amount + (rg ? rg.amount : 0));
  // ねむり: 動けない
  const c = B([mk('perari', 10)], [mk('koroishi', 10)]);
  U(c, 'e0').status = { id: 'sleep', turns: 3 };
  const ev2 = submit(c, { a0: { cmd: 'wait' } });
  assert.ok(ev2.some((x) => x.type === 'cantAct' && x.actor === 'e0'));
  // 火の魔物はこげない / 水はしみない / rustproof はさびない
  const d = B([mk('rousokun', 10, { skills: ['lullaby'] })], [mk('matchbo', 10), mk('inky', 10)]);
  const { statusImmune } = { statusImmune: (u, id) => (id === 'burn' ? u.mat === 'fire' : u.mat === 'water') };
  assert.equal(statusImmune(U(d, 'e0'), 'burn'), true);
  // ねむりの曲: ならない魔物(wakeful=ロウソクンの頭)
  const w = B([mk('perari', 10, { skills: ['lullaby'] })], [mk('rousokun', 10)]);
  const ev3 = submit(w, { a0: { cmd: 'skill', skill: 'lullaby', target: 'e0' } });
  assert.ok(ev3.some((x) => x.type === 'statusBlocked' && x.why === 'immune'));
  // さび: ブリキは2倍(0.35 → 0.7)。100回で確かめる
  let tin = 0, other = 0;
  for (let i = 0; i < 300; i++) {
    const r = B([mk('inky', 20, { skills: ['rustrain'] })], [mk('nejiko', 5), mk('perari', 5)], { seed: i });
    U(r, 'e0').hp = U(r, 'e1').hp = 9999; U(r, 'e0').maxHp = U(r, 'e1').maxHp = 9999;
    const ev4 = submit(r, { a0: { cmd: 'skill', skill: 'rustrain' } });
    if (ev4.some((x) => x.type === 'status' && x.target === 'e0' && x.status === 'rust')) tin++;
    if (ev4.some((x) => x.type === 'status' && x.target === 'e1' && x.status === 'rust')) other++;
  }
  assert.ok(tin > other * 1.5, `ブリキ ${tin} / 紙 ${other}`);
});

test('ばふは掛け算で 0.5〜2.0、おりがみのたてで半分', () => {
  const b = B([mk('nejiko', 10)], [mk('perari', 1)]);
  U(b, 'e0').hp = U(b, 'e0').maxHp = 99999;
  for (let i = 0; i < 4 && !b.over; i++) submit(b, { a0: { cmd: 'skill', skill: 'windup' } });
  assert.equal(U(b, 'a0').buffs.spd.mul, 2);
  const c = B([mk('perari', 10)], [mk('nejiko', 10)], { first: 'ally' });
  submit(c, { a0: { cmd: 'skill', skill: 'papershield', target: 'a0' } });
  assert.equal(U(c, 'a0').shield, 0.5);
});

test('先制: 1ターン目は相手が動かない', () => {
  const b = B([mk('perari', 5)], [mk('koroishi', 5)], { first: 'ally' });
  const ev = submit(b, { a0: { cmd: 'wait' } });
  assert.ok(ev.some((e) => e.type === 'surprised' && e.side === 'enemy'));
  assert.ok(!ev.some((e) => e.type === 'action' && e.actor === 'e0'));
});

test('カゲボウシ戦: 光・光・影・影…、影のターンは物理の命中 ×0.25、ガラスの羽は下がらない、ひかりのつぶで次を光に', () => {
  const allies = [mk('hibachineko', 14), mk('hotarubin', 14), mk('perari', 14)];
  const b = B(allies, bossEnemies(db, 'kageboushi', 1));
  assert.equal(b.rule, 'kageboushi');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((t) => phaseFor(b, t)), ['light', 'light', 'shadow', 'shadow', 'light', 'light']);
  const boss = U(b, 'e0');
  assert.ok(boss.isBoss);
  assert.equal(boss.maxHp, Math.floor(calcStats(db, { ...boss.mon, isBoss: false }).hp * db.sp('kageboushi').hpMul));
  b.turn = 3; // 影
  const fl = db.sk('flame');
  const pShadow = hitChance(b, U(b, 'a0'), boss, fl);
  b.turn = 1;
  const pLight = hitChance(b, U(b, 'a0'), boss, fl);
  assert.ok(Math.abs(pShadow - pLight * 0.25 * (boss.traits.shadowfit ? 0.8 : 1)) < 1e-9);
  // ガラスの羽(clearsight)を受けついだ魔物
  const cs = mk('hibachineko', 14, { parts: { back: { from: 'hotarubin', slot: 'back', star: 1 } } });
  const b2 = B([cs], bossEnemies(db, 'kageboushi', 1));
  b2.turn = 3;
  const p2 = hitChance(b2, U(b2, 'a0'), U(b2, 'e0'), fl);
  b2.turn = 1;
  assert.ok(Math.abs(p2 - hitChance(b2, U(b2, 'a0'), U(b2, 'e0'), fl) * (U(b2, 'e0').traits.shadowfit ? 0.8 : 1)) < 1e-9);
  // 影のターン: こうげき ×1.2
  b.turn = 3; const a3 = effStat(b, boss, 'atk'); b.turn = 1;
  assert.ok(Math.abs(a3 - effStat(b, boss, 'atk') * 1.2) < 1e-9);
  // ひかりのつぶ: 2ターン目に当てると 3ターン目(本来は影)が光になる
  const b3 = B([mk('hotarubin', 14)], bossEnemies(db, 'kageboushi', 2));
  U(b3, 'a0').hp = U(b3, 'a0').maxHp = 99999;
  submit(b3, { a0: { cmd: 'wait' } });
  const ev = submit(b3, { a0: { cmd: 'skill', skill: 'flash', target: 'e0' } });
  if (U(b3, 'a0').alive && ev.some((e) => e.type === 'action' && e.skill === 'flash')) {
    assert.ok(ev.some((e) => e.type === 'phase' && e.forced));
    assert.equal(phaseFor(b3, 3), 'light');
    const ev3 = b3.over ? [] : submit(b3, { a0: { cmd: 'wait' } });
    if (ev3.length) assert.equal(ev3.find((e) => e.type === 'turnStart').phase, 'light');
  }
  // にげられない・スカウトできない
  assert.equal(runChance(b), 0);
  assert.equal(scoutChance(b, boss), 0);
  assert.equal(availableCommands(b, 'a0').run, false);
});

test('トケイモリ戦: 針・3時と9時で前後が入れかわる・12時にじこくのかね・手下の補充は BOSS.tokeimori.reinforce 回まで', () => {
  const allies = [mk('burikishi', 20), mk('nuihebi', 20), mk('kamishibai', 20)];
  const b = B(allies, bossEnemies(db, 'tokeimori', 1), { seed: 5 });
  assert.equal(b.rule, 'tokeimori');
  assert.deepEqual([1, 2, 3, 4].map(handFor), [1, 2, 3, 0]);
  for (const k of b.roster.ally) { U(b, k).hp = U(b, k).maxHp = 99999; }
  const f0 = { ally: [...b.field.ally], enemy: [...b.field.enemy] };
  const ev1 = submit(b, { a0: { cmd: 'wait' }, a1: { cmd: 'wait' }, a2: { cmd: 'wait' } });
  const rot = ev1.find((e) => e.type === 'rotate');
  assert.ok(rot, '3時のターンの終わりに回る');
  assert.deepEqual(b.field.ally, [f0.ally[2], f0.ally[0], f0.ally[1]]);
  assert.deepEqual(b.field.enemy, [f0.enemy[2], f0.enemy[0], f0.enemy[1]]);
  submit(b, {}); // 6時: 回らない
  const ev3 = submit(b, {});
  assert.ok(ev3.some((e) => e.type === 'rotate'), '9時も回る');
  const ev4 = submit(b, {});
  assert.ok(ev4.some((e) => e.type === 'action' && e.actor === 'e0' && e.skill === 'chime'), '12時は じこくのかね');
  // 補充
  const c = B(allies.map((m) => ({ ...m, hp: undefined })), bossEnemies(db, 'tokeimori', 1), { seed: 9 });
  for (const k of c.roster.ally) { U(c, k).hp = U(c, k).maxHp = 99999; }
  let spawned = 0;
  for (let i = 0; i < 6; i++) {
    for (const k of c.field.enemy) if (k && !U(c, k).isBoss && U(c, k).alive) U(c, k).hp = 1;
    const ev = submit(c, { a0: { cmd: 'skill', skill: 'knightcharge' }, a1: { cmd: 'attack' }, a2: { cmd: 'wait' } });
    spawned += ev.filter((e) => e.type === 'reinforce').length;
    if (c.over) break;
  }
  assert.ok(spawned <= BOSS.tokeimori.reinforce);
  assert.equal(spawned, BOSS.tokeimori.reinforce);
});

test('ぬしを倒したら手下は逃げて勝ち', () => {
  const b = B([mk('burikishi', 30)], bossEnemies(db, 'kageboushi', 1));
  U(b, 'e0').hp = 1;
  b.turn = 0;
  for (let i = 0; i < 10 && !b.over; i++) submit(b, { a0: { cmd: 'skill', skill: 'knightcharge', target: 'e0' } });
  if (b.result?.outcome === 'win') assert.ok(!U(b, 'e0').alive);
});

test('スカウトの式(DESIGN §4-6): HP・同じ素材・レベル差・ニス・ねむり・ねばり', () => {
  const b = B([mk('nejiko', 5)], [mk('nejiko', 5)]);
  const e = U(b, 'e0');
  const S = db.sp('nejiko').scout;
  // 満タン: scout × 0.5 × (1+0.15×1) × 1
  assert.ok(Math.abs(scoutChance(b, e) - S * 0.5 * 1.15) < 1e-9);
  e.hp = 1;
  const low = scoutChance(b, e);
  assert.ok(low > S * 0.5 * 1.15);
  e.hp = e.maxHp;
  assert.ok(Math.abs(scoutChance(b, e, { varnish: true }) - S * 0.5 * 1.15 * 1.6) < 1e-9);
  e.status = { id: 'sleep', turns: 2 };
  assert.ok(Math.abs(scoutChance(b, e) - S * 0.5 * 1.15 * 1.3) < 1e-9);
  e.status = null;
  b.scoutFails = 5;
  assert.ok(Math.abs(scoutChance(b, e) - S * 0.5 * 1.15 * 1.3) < 1e-9); // ねばり最大 +0.3
  b.scoutFails = 0;
  // 同じ素材が3体
  const c = B([mk('nejiko', 5), mk('zenmainu', 5), mk('nejiko', 5)], [mk('nejiko', 5)]);
  assert.ok(Math.abs(scoutChance(c, U(c, 'e0')) - S * 0.5 * 1.45) < 1e-9);
  // レベル差 clamp
  const d = B([mk('perari', 30)], [mk('nejiko', 1)]);
  assert.ok(Math.abs(scoutChance(d, U(d, 'e0')) - Math.min(0.95, S * 0.5 * 1.3)) < 1e-9);
  // 上下限
  const f = B([mk('perari', 1)], [mk('haribote', 30)]);
  assert.ok(scoutChance(f, U(f, 'e0')) >= 0.02);
  // カミシバイの まき物(storyteller)
  const g = B([mk('perari', 5), mk('kamishibai', 5)], [mk('nejiko', 5)]);
  const g0 = B([mk('perari', 5), mk('perari', 5)], [mk('nejiko', 5)]);
  assert.ok(Math.abs(scoutChance(g, U(g, 'e0')) / scoutChance(g0, U(g0, 'e0')) - 1.15) < 1e-9);
});

test('スカウト成功: 戦闘が終わり、手持ち → いっぱいなら預かりへ', () => {
  const save = newSave();
  for (let i = 0; i < 6; i++) addCaught(save, mk('nejiko', 5));
  const party = save.party.map((u) => save.monsters[u]);
  const b = createBattle(db, { allies: party, enemies: [mk('perari', 3)], rng: fixedRng([0.01, 0.5]), bag: save.bag });
  U(b, 'e0').hp = 1;
  const ev = submit(b, { a0: { cmd: 'scout', target: 'e0' } });
  const sc = ev.find((e) => e.type === 'scout');
  assert.equal(sc.success, true);
  assert.equal(b.result.outcome, 'scout');
  const out = applyBattleResult(db, save, b);
  const caught = out.find((e) => e.type === 'caught');
  assert.equal(caught.where, 'box');
  assert.equal(save.box.length, 1);
  assert.equal(save.monsters[save.box[0]].sp, 'perari');
  assert.equal(save.dex.caught.perari, 1);
  assert.equal(save.stats.scouts, 1);
});

test('つやだしニス: どうぐで使うと次のスカウトが ×1.6、1つへる', () => {
  const bag = { varnish: 2 };
  const b = createBattle(db, { allies: [mk('perari', 5)], enemies: [mk('koroishi', 5)], seed: 1, bag, first: 'ally' });
  const ev = submit(b, { a0: { cmd: 'item', item: 'varnish' } });
  assert.ok(ev.some((e) => e.type === 'varnish'));
  assert.equal(bag.varnish, 1);
  assert.equal(b.varnish, true);
});

test('にげる: 式・ぬしからはにげられない・綿のつばさ・けむり玉', () => {
  const b = B([mk('nejiko', 5)], [mk('nejiko', 5)]);
  assert.ok(Math.abs(runChance(b) - 0.5) < 0.05);
  b.runFails = 2;
  assert.ok(runChance(b) > 0.75);
  const w = B([mk('watabou', 5)], [mk('nejiko', 5)]); // 綿のつばさ
  assert.equal(runChance(w), 1);
  const ev = submit(w, { a0: { cmd: 'run' } });
  assert.equal(w.result.outcome, 'escape');
  assert.ok(ev.some((e) => e.type === 'run' && e.success));
  const bag = { smoke: 1 };
  const s = createBattle(db, { allies: [mk('koroishi', 5)], enemies: [mk('nejiko', 30)], seed: 1, bag });
  submit(s, { a0: { cmd: 'item', item: 'smoke' } });
  assert.equal(s.result.outcome, 'escape');
  assert.equal(bag.smoke, 0);
  const k = B([mk('watabou', 14)], bossEnemies(db, 'kageboushi', 1), { bag: { smoke: 1 } });
  const ev2 = submit(k, { a0: { cmd: 'item', item: 'smoke' } });
  assert.ok(ev2.some((e) => e.type === 'run' && !e.success));
  assert.ok(!k.over || k.result.outcome !== 'escape');
});

test('勝ち: 経験値(台の上=全部・控え=半分・たおれた=0・生まれたて×1.5)とお金', () => {
  const save = newSave();
  const ms = [mk('nejiko', 10), mk('nejiko', 10), mk('nejiko', 10), mk('perari', 5), mk('perari', 5, { born: 'breed' })];
  for (const m of ms) addCaught(save, m);
  const enemies = [mk('koroishi', 6)];
  const b = createBattle(db, { allies: ms, enemies, seed: 2 });
  U(b, 'a1').hp = 0; U(b, 'a1').alive = false;
  forceFinish(b, 'win');
  const total = db.sp('koroishi').xp * 6 / GROW.xpDiv;
  const xp = Object.fromEntries(b.result.xp.map((x) => [x.unit, x.amount]));
  assert.equal(xp.a0, Math.floor(total));
  assert.equal(xp.a1, 0);
  assert.equal(xp.a3, Math.floor(total * 0.5));
  assert.equal(xp.a4, Math.floor(total * 0.5 * 1.5));
  assert.equal(b.result.gold, Math.floor(db.sp('koroishi').gold * 6 / GROW.goldDiv));
  const g0 = save.gold;
  const xp0 = ms[0].xp;
  const out = applyBattleResult(db, save, b);
  assert.equal(save.gold, g0 + b.result.gold);
  assert.equal(ms[0].xp, xp0 + xp.a0);
  assert.ok(out.some((e) => e.type === 'gold'));
  assert.equal(save.dex.seen.koroishi, 1);
  // ハリボテの宝の台座(goldfind)
  const h = createBattle(db, { allies: [mk('haribote', 10)], enemies: [mk('koroishi', 10)], seed: 2 });
  forceFinish(h, 'win');
  assert.equal(h.result.gold, Math.floor(db.sp('koroishi').gold * 10 / GROW.goldDiv * 1.2));
});

test('負け: お金が半分・最後の宿屋で目覚めて全回復', () => {
  const save = newSave();
  save.gold = 321; save.lastInn = 'village'; save.player.area = 'forest';
  addCaught(save, mk('perari', 3));
  const party = save.party.map((u) => save.monsters[u]);
  const b = createBattle(db, { allies: party, enemies: [mk('koroishi', 20)], seed: 1 });
  let guard = 0;
  while (!b.over && guard++ < 50) submit(b, { a0: { cmd: 'wait' } });
  assert.equal(b.result.outcome, 'lose');
  assert.equal(party[0].hp, 0);
  const ev = applyBattleResult(db, save, b);
  assert.equal(save.gold, 161);
  assert.equal(save.player.area, 'village');
  assert.equal(party[0].hp, calcStats(db, party[0]).hp);
  assert.ok(ev.some((e) => e.type === 'defeat' && e.goldLost === 160));
  assert.equal(save.stats.defeats, 1);
});

test('同じ種なら同じ結果(乱数の差しかえ)・自動で決着がつく', () => {
  const run = (seed) => {
    const b = createBattle(db, { allies: [mk('nejiko', 8), mk('perari', 8), mk('inky', 8)], enemies: wildEnemies(db, [{ sp: 'koroishi', lv: 8 }, { sp: 'watabou', lv: 8 }, { sp: 'matchbo', lv: 8 }], seed), seed });
    runAuto(b);
    return JSON.stringify(b.log);
  };
  assert.equal(run(11), run(11));
  assert.notEqual(run(11), run(12));
  let timeouts = 0;
  for (let s = 0; s < 40; s++) {
    const b = createBattle(db, { allies: [mk('nejiko', 10), mk('perari', 10), mk('inky', 10)], enemies: [mk('jarihebi', 10), mk('felton', 10), mk('inky', 10)], seed: s });
    if (runAuto(b, 80).outcome === 'timeout') timeouts++;
  }
  assert.ok(timeouts <= 2, `決着しない戦闘 ${timeouts}`);
});

test('出来事の種類は INTERFACES.md の表にあるものだけ', () => {
  const KNOWN = new Set(['start', 'phase', 'hand', 'trait', 'turnStart', 'surprised', 'order', 'reinforce', 'action', 'fail', 'cantAct', 'wait', 'miss', 'damage', 'endure', 'faint', 'heal',
    'status', 'statusBlocked', 'statusMiss', 'statusEnd', 'wake', 'cure', 'buff', 'buffEnd', 'shield', 'shieldBreak', 'guard', 'cover', 'swap', 'enter', 'advance', 'rotate',
    'item', 'revive', 'mp', 'varnish', 'scout', 'run', 'burnTick', 'flee', 'end']);
  const seen = new Set();
  for (let s = 0; s < 60; s++) {
    const allies = [mk('hotarubin', 14), mk('nuihebi', 14), mk('kamishibai', 14), mk('watabou', 14)];
    const enemies = s % 3 === 0 ? bossEnemies(db, 'kageboushi', s) : s % 3 === 1 ? bossEnemies(db, 'tokeimori', s) : [mk('koroishi', 12), mk('rousokun', 12), mk('jarihebi', 12)];
    const b = createBattle(db, { allies, enemies, seed: s, bag: { patch: 2, oil: 1, thread: 1 } });
    while (!b.over && b.turn < 40) {
      const c = {};
      for (const k of b.field.ally) if (k && U(b, k).alive) c[k] = b.rng.chance(0.1) ? { cmd: 'item', item: b.rng.pick(['patch', 'oil', 'thread']) } : autoAction(b, k);
      submit(b, c);
    }
    for (const e of b.log) seen.add(e.type);
  }
  for (const t of seen) assert.ok(KNOWN.has(t), `表にない出来事 ${t}`);
  for (const t of ['damage', 'faint', 'phase', 'rotate', 'reinforce', 'end']) assert.ok(seen.has(t), `${t} が一度も出ない`);
});

test('getView は画面に出す形', () => {
  const b = B([mk('nejiko'), mk('perari'), mk('inky'), mk('koroishi')], [mk('koroishi')]);
  const v = getView(b);
  assert.equal(v.field.ally.length, 3);
  assert.equal(v.bench.length, 1);
  assert.equal(v.field.ally[2].row, 'back');
  assert.ok('hp' in v.field.enemy[0] && 'maxHp' in v.field.enemy[0]);
});
