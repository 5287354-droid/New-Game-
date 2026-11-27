import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { db, ROOT } from './_db.mjs';
import { childSpecies, breedTable, parentSpecies, breed, breedPreview, inheritRecord, childBonus, canBreed, breedInSave, registerParts, claimPartRewards, wornParts } from '../src/core/breed.js';
import { createMonster, calcStats, traitsOf } from '../src/core/stats.js';
import { newSave } from '../src/core/save.js';
import { addCaught, addItem } from '../src/core/inventory.js';
import { makeRng } from '../src/core/rng.js';

const ALL_FLAGS = { beatKageboushi: true };
const PS = parentSpecies(db);
const mk = (sp, lv = 10, o = {}) => createMonster(db, { sp, lv, shiny: false, ...o });

test('配合表が全組み合わせ(19×19)で埋まっている', () => {
  assert.equal(PS.length, 19);
  assert.ok(!PS.includes('tokeimori'));
  for (const flags of [{}, ALL_FLAGS]) {
    const t = breedTable(db, flags);
    for (const a of PS) for (const b of PS) {
      const c = t[a][b];
      assert.ok(db.species[c], `${a}×${b} → ${c}`);
      assert.notEqual(c, 'tokeimori');
      assert.equal(c, t[b][a], `左右で食いちがう ${a}×${b}`);
    }
  }
  // 素材・型・種族の表も全部埋まっていて、種族の素材が合っている
  const br = db.breed;
  for (const a of br.order) for (const b of br.order) assert.ok(br.order.includes(br.material[a][b]));
  for (const a of br.bodyOrder) for (const b of br.bodyOrder) assert.ok(br.bodyOrder.includes(br.body[a][b]));
  for (const m of br.order) for (const b of br.bodyOrder) assert.equal(db.sp(br.species[m][b]).mat, m);
  assert.equal(childSpecies(db, 'tokeimori', 'nejiko'), null);
});

test('DESIGN.md §5-1 の3つの表と同じ結果(特別な組み合わせ以外の全部)', () => {
  const md = readFileSync(join(ROOT, 'docs', 'DESIGN.md'), 'utf8');
  const table = (title) => {
    const i = md.indexOf('\n' + title);
    const rows = md.slice(i).split('\n').filter((l) => l.startsWith('|')).slice(0, 8);
    const cells = rows.map((r) => r.split('|').slice(1, -1).map((c) => c.replace(/\*/g, '').trim()));
    const head = cells[0].slice(1);
    return Object.fromEntries(cells.slice(2).map((r) => [r[0], Object.fromEntries(head.map((h, j) => [h, r[j + 1]]))]));
  };
  const MAT = { 水: 'water', 火: 'fire', 紙: 'paper', 石: 'stone', ブ: 'tin', ブリキ: 'tin', 布: 'cloth' };
  const BODY = { まる: 'maru', しずく: 'shizuku', 四つ足: 'yotsuashi', 鳥: 'tori', へび: 'hebi', 人形: 'ningyo' };
  const byName = Object.fromEntries(Object.values(db.species).map((s) => [s.name, s.id]));
  const tm = table('**素材 × 素材**'), tb = table('**型 × 型**'), ts = table('**素材 × 型 → 種族**');
  let checked = 0;
  for (const a of PS) for (const b of PS) {
    const r = childSpecies(db, a, b, ALL_FLAGS);
    if (r.special) continue;
    const A = db.sp(a), B = db.sp(b);
    const nm = (o, k) => Object.keys(o).find((x) => MAT[x] === k || BODY[x] === k);
    const m = MAT[tm[nm(tm, A.mat)][nm(tm[nm(tm, A.mat)], B.mat)]];
    const bd = BODY[tb[nm(tb, A.body)][nm(tb[nm(tb, A.body)], B.body)]];
    const sp = byName[ts[nm(ts, m)][nm(ts[nm(ts, m)], bd)]];
    assert.equal(r.id, sp, `${a}×${b}`);
    checked++;
  }
  assert.ok(checked > 300, `照らし合わせた数 ${checked}`);
});

test('tools/check/breed_check.mjs も通る(child() と同じ規則のデータ)', () => {
  const out = execFileSync('node', [join(ROOT, 'tools/check/breed_check.mjs')], { encoding: 'utf8' });
  assert.match(out, /OK:/);
});

test('特別な組み合わせ: 旗とパーツの条件', () => {
  assert.equal(childSpecies(db, 'felton', 'origarasu').id, 'hotarubin'); // 旗なし → 表(布+紙=水、まる+鳥=鳥)
  assert.notEqual(childSpecies(db, 'felton', 'origarasu').id, 'kageboushi');
  assert.equal(childSpecies(db, 'felton', 'origarasu', ALL_FLAGS).id, 'kageboushi');
  assert.equal(childSpecies(db, 'kamishibai', 'felton', ALL_FLAGS).id, 'kageboushi');
  assert.equal(childSpecies(db, 'nejiko', 'tsumiking').id, 'burikishi');
  assert.equal(childSpecies(db, 'zenmainu', 'matchbo').id, 'hibachineko');
  assert.equal(childSpecies(db, 'jarihebi', 'watabou').id, 'nuihebi');
  assert.equal(childSpecies(db, 'perari', 'zenmainu').id, 'haribote');
  assert.equal(childSpecies(db, 'hotarubin', 'koroishi').id, 'tsumiking');
  // つみきの冠をかぶったブリキ → ブリキシ(相手はだれでも)
  const crowned = mk('zenmainu', 10, { parts: { head: { from: 'tsumiking', slot: 'head', star: 1, history: ['tsumiking'] } } });
  assert.ok(wornParts(db, crowned).includes('tsumiking.head'));
  const plain = mk('perari');
  assert.equal(childSpecies(db, 'zenmainu', 'perari').id, 'haribote');
  assert.equal(breedPreview(db, crowned, plain).child.id, 'burikishi');
  // 冠をかぶっているのがブリキでない親でも、もう片方がブリキなら
  const crownedInk = mk('inky', 10, { parts: { head: { from: 'tsumiking', slot: 'head', star: 1 } } });
  assert.equal(breedPreview(db, crownedInk, mk('nejiko')).child.id, 'burikishi');
  assert.notEqual(breedPreview(db, crownedInk, mk('perari')).child.id, 'burikishi');
  // カゲボウシは表からは生まれない
  for (const a of PS) for (const b of PS) { const r = childSpecies(db, a, b, ALL_FLAGS); if (r.id === 'kageboushi') assert.ok(r.special); }
});

test('配合でしか生まれない4種が作れる(野生の種族から幅優先)', () => {
  const only = Object.values(db.species).filter((s) => s.breedOnly && !s.noBreed).map((s) => s.id);
  assert.deepEqual(only.sort(), ['burikishi', 'hibachineko', 'kageboushi', 'nuihebi']);
  const wild = Object.values(db.species).filter((s) => !s.breedOnly && !s.boss).map((s) => s.id);
  const have = new Set(wild);
  for (let grew = true; grew;) {
    grew = false;
    for (const a of [...have]) for (const b of [...have]) {
      const c = childSpecies(db, a, b, ALL_FLAGS).id;
      if (!have.has(c)) { have.add(c); grew = true; }
    }
  }
  for (const t of only) assert.ok(have.has(t), `${t} に届かない`);
  // 設計の道筋どおり、実際に個体で作る
  const flags = ALL_FLAGS;
  assert.equal(breed(db, mk('nejiko'), mk('matchbo'), { flags }).child.sp, 'nuihebi');
  assert.equal(breed(db, mk('matchbo'), mk('origarasu'), { flags }).child.sp, 'hibachineko');
  assert.equal(breed(db, mk('felton'), mk('origarasu'), { flags }).child.sp, 'kageboushi');
  const tk = breed(db, mk('koroishi'), mk('hotarubin'), { flags }).child;
  assert.equal(tk.sp, 'tsumiking');
  tk.lv = 10;
  assert.equal(breed(db, mk('nejiko'), tk, { flags }).child.sp, 'burikishi');
  // 配合で生まれたカゲボウシは、ぬしのHP倍率がつかない
  const kg = breed(db, mk('felton'), mk('origarasu'), { flags }).child;
  assert.ok(!kg.isBoss);
  assert.equal(calcStats(db, kg).hp, Math.floor(52 * 1 * (1 + kg.bonus) * 1));
});

test('おさがり: 1か所を選ぶ・★を代々重ねる・3代で金つぎ・履歴', () => {
  const rng = makeRng(7);
  const g0 = mk('nejiko');
  const r1 = breed(db, g0, mk('matchbo'), { parts: [{ from: 'a', slot: 'back' }], rng });
  const c1 = r1.child;
  assert.deepEqual(c1.parts.back, { from: 'nejiko', slot: 'back', star: 1, shiny: false, history: ['nejiko'] });
  assert.equal(c1.parts.head, null);
  assert.ok(r1.events.some((e) => e.type === 'partAttach' && e.slot === 'back' && e.star === 1));
  c1.lv = 10;
  const c2 = breed(db, mk('felton'), c1, { parts: [{ from: 'b', slot: 'back' }], rng }).child;
  assert.equal(c2.parts.back.star, 2);
  assert.deepEqual(c2.parts.back.history, ['nejiko', 'nuihebi']);
  c2.lv = 10;
  const r3 = breed(db, c2, mk('koroishi'), { parts: [{ from: 'a', slot: 'back' }], rng });
  assert.equal(r3.child.parts.back.star, 3);
  assert.ok(r3.events.some((e) => e.type === 'partAttach' && e.gold));
  assert.equal(traitsOf(db, r3.child).windupStart.gold, true);
  r3.child.lv = 10;
  const c4 = breed(db, r3.child, mk('koroishi'), { parts: [{ from: 'a', slot: 'back' }], rng }).child;
  assert.equal(c4.parts.back.star, 3); // 上限 ★3
  assert.equal(c4.parts.back.history.length, 4);
  // 1か所だけ(道具なし)。2か所目は無視
  const one = breed(db, mk('nejiko'), mk('matchbo'), { parts: [{ from: 'a', slot: 'back' }, { from: 'b', slot: 'head' }] }).child;
  assert.equal(one.parts.head, null);
  // つなぎネジで2か所、金のつなぎネジで3か所
  const two = breed(db, mk('nejiko'), mk('matchbo'), { items: ['screw'], parts: [{ from: 'a', slot: 'back' }, { from: 'b', slot: 'head' }, { from: 'b', slot: 'tail' }] }).child;
  assert.ok(two.parts.back && two.parts.head && !two.parts.tail);
  const three = breed(db, mk('nejiko'), mk('matchbo'), { items: ['goldscrew'], parts: [{ from: 'a', slot: 'back' }, { from: 'b', slot: 'head' }, { from: 'b', slot: 'tail' }] }).child;
  assert.ok(three.parts.back && three.parts.head && three.parts.tail);
  assert.throws(() => breed(db, mk('nejiko'), mk('matchbo'), { items: ['screw'], parts: [{ from: 'a', slot: 'back' }, { from: 'b', slot: 'back' }] }));
  // きらりの親のパーツは、きらり色のまま
  const sh = mk('nejiko', 10, { shiny: true });
  assert.equal(inheritRecord(db, sh, 'tail').shiny, true);
});

test('わざの受けつぎ(2つまで)・伸びボーナス・代・きらりニス', () => {
  const a = mk('nejiko', 20), b = mk('perari', 20);
  const r = breed(db, a, b, { skills: ['gearsaw', 'heal', 'fold'] });
  const kids = r.child.skills;
  assert.ok(kids.includes('gearsaw') && kids.includes('heal') && !kids.includes('fold'));
  assert.ok(kids.length <= 4);
  assert.equal(breed(db, a, b, { skills: ['wave'] }).child.skills.includes('wave'), false); // 親が持っていないわざは受けつがない
  assert.equal(childBonus({ lv: 10 }, { lv: 10 }), 0.1);
  assert.equal(childBonus({ lv: 20, bonus: 0.1 }, { lv: 20, bonus: 0.1 }), 0.25);
  assert.equal(childBonus({ lv: 30, bonus: 0.5 }, { lv: 30, bonus: 0.5 }), 0.5);
  const c = r.child;
  assert.equal(c.gen, 1); assert.equal(c.born, 'breed'); assert.deepEqual(c.parents, ['nejiko', 'perari']);
  assert.equal(c.lv, 1);
  c.lv = 10;
  assert.equal(breed(db, c, mk('perari')).child.gen, 2);
  const shiny = mk('nejiko', 10, { shiny: true });
  const rng = makeRng(1);
  assert.equal(breed(db, shiny, mk('matchbo'), { items: ['kirarinis'], rng }).child.shiny, true);
  // 条件
  assert.equal(canBreed(db, mk('nejiko', 9), mk('perari')).why, 'lv');
  assert.equal(canBreed(db, a, a).why, 'same');
  assert.equal(canBreed(db, a, b, { flags: {} }).why, 'locked');
  assert.equal(canBreed(db, a, b, { flags: { breedUnlocked: true } }).ok, true);
});

test('セーブの上の配合: 親が消え、子が入り、部品表・ごほうび・旗', () => {
  const s = newSave();
  s.flags.breedUnlocked = true;
  addCaught(s, mk('nejiko')); addCaught(s, mk('matchbo'));
  addItem(s, 'screw', 1);
  const [ua, ub] = s.party;
  const r = breedInSave(db, s, ua, ub, { parts: [{ from: 'a', slot: 'back' }, { from: 'b', slot: 'head' }], items: ['screw'] });
  assert.equal(r.ok, true);
  assert.equal(r.child.sp, 'nuihebi');
  assert.deepEqual(s.party, [r.uid]);
  assert.ok(!s.monsters[ua] && !s.monsters[ub]);
  assert.equal(s.bag.screw, undefined);
  assert.equal(s.flags.firstBreed, true);
  assert.equal(s.dex.parts['nejiko.back'], 1);
  assert.equal(s.dex.parts['matchbo.head'], 1);
  assert.equal(s.dex.caught.nuihebi, 1);
  // 5個でつなぎネジ
  s.dex.parts = { a: 1, b: 1, c: 1, d: 1, e: 2 };
  const got = claimPartRewards(s.dex, s.rewards);
  assert.deepEqual(got.map((x) => x.id), ['parts5']);
  assert.deepEqual(claimPartRewards(s.dex, s.rewards), []);
  assert.deepEqual(registerParts({ parts: {} }, { parts: { head: { from: 'x', slot: 'head', star: 3 } } }), [{ key: 'x.head', gold: true }]);
  // Lv が足りない
  addCaught(s, mk('perari', 5));
  assert.equal(breedInSave(db, s, s.party[0], s.party[1]).why, 'lv');
});
