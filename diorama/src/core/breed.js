// 配合: 子の種族・おさがりパーツ・わざ受けつぎ・伸びボーナス・部品表。規則は docs/DESIGN.md §5。
// 子の種族の決め方は tools/check/breed_check.mjs の child() と同じ(テストで全組み合わせを照らし合わせる)。
import { SLOTS } from './db.js';
import { createMonster, partsOf, learnedAt } from './stats.js';
import { toRng } from './rng.js';
import { addCaught, removeMonster, removeItem, count, addItem } from './inventory.js';

export const BREED_MIN_LV = 10;
export const MAX_STAR = 3;
export const MAX_INHERIT_SKILLS = 2;
export const MAX_BONUS = 0.5;
export const PART_REWARDS = [
  { id: 'parts5', need: 5, item: 'screw', n: 1 },
  { id: 'parts10', need: 10, item: 'kirarinis', n: 1 },
  { id: 'parts20', need: 20, item: 'gearpin', n: 3 },
  { id: 'parts30', need: 30, item: 'goldscrew', n: 1 },
  { id: 'parts45', need: 45, title: '部品の目利き' },
];

const matchPat = (db, pat, id) => pat === '*' || pat === id || (pat.startsWith('*') && db.sp(id).mat === pat.slice(1));

// 親が今つけているパーツの名前 ['tsumiking.head', ...](おさがりなら元の種族のパーツ)
export function wornParts(db, mon) { return partsOf(db, mon).map((p) => `${p.from}.${p.srcSlot}`); }

/**
 * 子の種族。sp1・sp2 は種族 id。flags は旗、parts は親2体が付けているパーツの名前の配列。
 * 返す: { id, special?, m?, b? }   親になれない種族なら null
 */
export function childSpecies(db, sp1, sp2, flags = {}, parts = []) {
  const s1 = db.sp(sp1), s2 = db.sp(sp2);
  if (s1.noBreed || s2.noBreed) return null;
  for (const sp of db.breed.special) {
    if (sp.needFlag && !flags[sp.needFlag]) continue;
    if (sp.needPart && !parts.includes(sp.needPart)) continue;
    if ((matchPat(db, sp.a, sp1) && matchPat(db, sp.b, sp2)) || (matchPat(db, sp.a, sp2) && matchPat(db, sp.b, sp1))) return { id: sp.child, special: sp };
  }
  const m = db.breed.material[s1.mat][s2.mat];
  const bd = db.breed.body[s1.body][s2.body];
  return { id: db.breed.species[m][bd], m, b: bd };
}

// 親になれる種族の一覧と、全組み合わせの表 { [sp1]: { [sp2]: 子id } }
export function parentSpecies(db) { return Object.values(db.species).filter((s) => !s.noBreed).map((s) => s.id); }
export function breedTable(db, flags = {}) {
  const ps = parentSpecies(db);
  return Object.fromEntries(ps.map((a) => [a, Object.fromEntries(ps.map((b) => [b, childSpecies(db, a, b, flags)?.id ?? null]))]));
}

// その親から受けつぐときの、おさがりの記録(★と履歴)
export function inheritRecord(db, parent, slot) {
  const rec = parent.parts?.[slot];
  if (rec) return { from: rec.from, slot: rec.slot, star: Math.min(MAX_STAR, rec.star + 1), shiny: !!rec.shiny, history: [...(rec.history || [rec.from]), parent.sp] };
  return { from: parent.sp, slot, star: 1, shiny: !!parent.shiny, history: [parent.sp] };
}

// 配合できるか。できないなら理由('lv' | 'same' | 'noBreed' | 'locked')
export function canBreed(db, a, b, save) {
  if (save && !save.flags?.breedUnlocked) return { ok: false, why: 'locked' };
  if (a === b) return { ok: false, why: 'same' };
  if (db.sp(a.sp).noBreed || db.sp(b.sp).noBreed) return { ok: false, why: 'noBreed' };
  if (a.lv < BREED_MIN_LV || b.lv < BREED_MIN_LV) return { ok: false, why: 'lv' };
  return { ok: true };
}

// 道具から、受けつげるパーツの数
export function maxParts(db, items = []) {
  let n = 1;
  for (const id of items) n = Math.max(n, 1 + (db.items[id]?.breed?.extraPart || 0));
  return Math.min(3, n);
}

/**
 * 配合の見開き(UI 用の下見)。
 * 返す: { child:{id, special}, partChoices:[{from:'a'|'b', slot, label, stat, pct, trait, skill, star(受けついだ後), gold, shiny, history}],
 *         skillChoices:[わざid](親2体の4つの枠。重なりなし), maxParts, bonus, gen, ok, why }
 */
export function breedPreview(db, a, b, { flags = {}, items = [], save = null } = {}) {
  const c = childSpecies(db, a.sp, b.sp, flags, [...wornParts(db, a), ...wornParts(db, b)]);
  const partChoices = [];
  for (const [who, p] of [['a', a], ['b', b]]) {
    for (const slot of SLOTS) {
      const rec = inheritRecord(db, p, slot);
      const def = db.sp(rec.from).parts[rec.slot];
      partChoices.push({ from: who, slot, src: `${rec.from}.${rec.slot}`, label: def.label, stat: def.stat, pct: def.pct, trait: def.trait || null, skill: def.skill || null,
        star: rec.star, gold: rec.star >= MAX_STAR, shiny: rec.shiny, history: rec.history });
    }
  }
  const skillChoices = [...new Set([...a.skills, ...b.skills])];
  const can = canBreed(db, a, b, save);
  return { child: c, partChoices, skillChoices, maxParts: maxParts(db, items), bonus: childBonus(a, b), gen: Math.max(a.gen || 0, b.gen || 0) + 1, ok: can.ok && !!c, why: can.why };
}

export function childBonus(a, b) {
  return Math.min(MAX_BONUS, Math.round(((a.lv + b.lv) / 200 + 0.5 * Math.max(a.bonus || 0, b.bonus || 0)) * 1000) / 1000);
}

/**
 * 配合する。親は呼ぶ側が手持ち・預かりから消す(inventory.removeMonster)。
 * opts: { parts:[{from:'a'|'b', slot}](maxParts まで。同じ場所は1つだけ。省略すると受けつがない), skills:[わざid](2つまで),
 *         items:[道具id](screw / goldscrew / kirarinis。数は呼ぶ側がへらす), flags, rng, nick, keep:[わざid](4つをこえたとき残すわざ) }
 * 返す: { child(個体), events:[…], overflow:[あふれたわざ] }
 */
export function breed(db, a, b, opts = {}) {
  const rng = toRng(opts.rng);
  const flags = opts.flags || {};
  const items = opts.items || [];
  const c = childSpecies(db, a.sp, b.sp, flags, [...wornParts(db, a), ...wornParts(db, b)]);
  if (!c) throw new Error('この2体は配合できない');
  if (a === b) throw new Error('同じ個体どうしは配合できない');
  const limit = maxParts(db, items);
  const picks = (opts.parts || []).slice(0, limit);
  const parts = { head: null, back: null, tail: null };
  for (const p of picks) {
    if (!SLOTS.includes(p.slot)) throw new Error('パーツの場所がちがう: ' + p.slot);
    if (parts[p.slot]) throw new Error('同じ場所のパーツは1つだけ: ' + p.slot);
    parts[p.slot] = inheritRecord(db, p.from === 'b' ? b : a, p.slot);
  }
  const parentSkills = new Set([...a.skills, ...b.skills]);
  const inherit = (opts.skills || []).filter((k) => parentSkills.has(k)).slice(0, MAX_INHERIT_SKILLS);
  const keepShiny = items.some((id) => db.items[id]?.breed?.keepShiny) && (a.shiny || b.shiny);
  const child = createMonster(db, {
    sp: c.id, lv: 1, rng, parts, inherit, nick: opts.nick ?? null,
    bonus: childBonus(a, b), gen: Math.max(a.gen || 0, b.gen || 0) + 1,
    born: 'breed', parents: [a.sp, b.sp], ...(keepShiny ? { shiny: true } : {}),
  });
  // 4つをこえたわざ: keep があればそれを残す
  const all = [...new Set([...learnedAt(db, c.id, 1), ...inherit])];
  let overflow = [];
  if (opts.keep?.length) {
    child.skills = opts.keep.filter((k) => all.includes(k)).slice(0, 4);
    overflow = all.filter((k) => !child.skills.includes(k));
  } else overflow = all.filter((k) => !child.skills.includes(k));
  const events = [
    { type: 'breedStart', a: a.sp, b: b.sp, child: c.id, special: c.special ? c.special.hint : null },
    ...SLOTS.filter((s) => parts[s]).map((s) => ({ type: 'partAttach', slot: s, src: `${parts[s].from}.${parts[s].slot}`, star: parts[s].star, gold: parts[s].star >= MAX_STAR, shiny: parts[s].shiny })),
    ...inherit.map((k) => ({ type: 'skillInherit', skill: k })),
    { type: 'born', sp: c.id, shiny: child.shiny, gen: child.gen, bonus: child.bonus },
  ];
  return { child, events, overflow };
}

// 部品表に登録(受けついだパーツ)。dex.parts['nejiko.back'] = 1(登録)| 2(金)。新しく増えたマスを返す
export function registerParts(dex, child) {
  dex.parts = dex.parts || {};
  const added = [];
  for (const slot of SLOTS) {
    const rec = child.parts?.[slot];
    if (!rec) continue;
    const key = `${rec.from}.${rec.slot}`;
    const v = rec.star >= MAX_STAR ? 2 : 1;
    if ((dex.parts[key] || 0) < v) { dex.parts[key] = v; added.push({ key, gold: v === 2 }); }
  }
  return added;
}
export function partsCount(dex) {
  const v = Object.values(dex?.parts || {});
  return { registered: v.filter((x) => x >= 1).length, gold: v.filter((x) => x >= 2).length };
}
// 部品表のごほうびで、まだもらっていないものを返す(rewards に印をつける)
export function claimPartRewards(dex, rewards) {
  const n = partsCount(dex).registered;
  const got = [];
  for (const r of PART_REWARDS) if (n >= r.need && !rewards[r.id]) { rewards[r.id] = true; got.push(r); }
  return got;
}

/**
 * セーブの上で配合する(工房の配合台)。親2体を消し、道具をへらし、子を手持ち(いっぱいなら預かり)へ。
 * 部品表の登録・ごほうび・旗 firstBreed・stats.breeds もここで。
 * 返す: { ok, why?, child, uid, where, events, newParts, rewards }
 */
export function breedInSave(db, save, uidA, uidB, opts = {}) {
  const a = save.monsters[uidA], b = save.monsters[uidB];
  if (!a || !b) return { ok: false, why: 'missing' };
  const can = canBreed(db, a, b, save);
  if (!can.ok) return { ok: false, why: can.why };
  const items = (opts.items || []).filter((id) => count(save, id) > 0);
  const r = breed(db, a, b, { ...opts, items, flags: save.flags });
  for (const id of items) removeItem(save, id, 1);
  removeMonster(save, uidA); removeMonster(save, uidB);
  const where = addCaught(save, r.child);
  save.flags.firstBreed = true;
  save.stats = save.stats || {};
  save.stats.breeds = (save.stats.breeds || 0) + 1;
  const newParts = registerParts(save.dex, r.child);
  save.rewards = save.rewards || {};
  const rewards = claimPartRewards(save.dex, save.rewards);
  for (const rw of rewards) if (rw.item) addItem(save, rw.item, rw.n);
  return { ok: true, child: r.child, uid: r.child.uid, where, events: r.events, overflow: r.overflow, newParts, rewards };
}
