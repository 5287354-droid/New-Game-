// 道具・お金・お店・手持ちと預かり・宿屋。セーブ(§7の形)を直接書きかえる関数の集まり。
import { calcStats, healFull } from './stats.js';

export const PARTY_MAX = 6;
export const BOX_MAX = 60;
export const GOLD_MAX = 999999;
export const BAG_MAX = 99;
export const INN_PRICE = 0; // 体験版の宿屋はただ(ワタおかみのおもてなし)
export const MORNING = 360; // 宿屋で休むと朝6時

// ---------- 道具 ----------
export const count = (save, id) => save.bag?.[id] || 0;
export function addItem(save, id, n = 1) {
  save.bag = save.bag || {};
  save.bag[id] = Math.min(BAG_MAX, (save.bag[id] || 0) + n);
  return save.bag[id];
}
export function removeItem(save, id, n = 1) {
  if (count(save, id) < n) return false;
  save.bag[id] -= n;
  if (save.bag[id] <= 0) delete save.bag[id];
  return true;
}
// 戦闘で使える道具か / フィールドで使える道具か
export const isBattleItem = (it) => !!(it && (it.hp || it.hpAll || it.mp || it.rev || it.cure || it.scout || it.escape));
export const isFieldItem = (it) => !!(it && (it.hp || it.hpAll || it.mp || it.rev || it.cure));

/**
 * フィールド(メニュー)で道具を使う。target は個体(hpAll なら省略)。
 * 返す: { ok, why?, changes:[{uid?, hp?, mp?, cured?, revived?}] }
 */
export function useFieldItem(db, save, id, target = null) {
  const it = db.it(id);
  if (!isFieldItem(it)) return { ok: false, why: 'notField' };
  if (count(save, id) <= 0) return { ok: false, why: 'none' };
  const changes = [];
  const one = (mon) => {
    const st = calcStats(db, mon);
    const ch = { mon };
    if (it.rev) { if (mon.hp > 0) return null; mon.hp = Math.max(1, Math.floor(st.hp * it.rev)); ch.revived = true; ch.hp = mon.hp; return ch; }
    if (mon.hp <= 0) return null;
    if (it.hp || it.hpAll) { if (mon.hp >= st.hp && !it.cure) return null; mon.hp = Math.min(st.hp, mon.hp + (it.hp || it.hpAll)); ch.hp = mon.hp; }
    if (it.mp) { if (mon.mp >= st.mp) return null; mon.mp = Math.min(st.mp, mon.mp + it.mp); ch.mp = mon.mp; }
    if (it.cure) { if (!mon.status) return null; mon.status = null; ch.cured = true; }
    return ch;
  };
  if (it.hpAll) for (const uid of save.party) { const c = one(save.monsters[uid]); if (c) changes.push({ uid, ...c }); }
  else if (target) { const c = one(target); if (c) changes.push(c); }
  if (!changes.length) return { ok: false, why: 'noEffect' };
  removeItem(save, id, 1);
  return { ok: true, changes };
}

// ---------- お金・お店 ----------
export function addGold(save, n) { save.gold = Math.max(0, Math.min(GOLD_MAX, (save.gold || 0) + n)); return save.gold; }

// open:'forest' の道具は、旗 openForest が立つまで並ばない(エリア id → 'open' + 先頭を大文字)
export const openFlag = (area) => 'open' + area[0].toUpperCase() + area.slice(1);
export function shopList(db, save) {
  return db.shop.map((id) => db.it(id)).filter((it) => it.price > 0 && (!it.open || save.flags?.[openFlag(it.open)]));
}
export const sellPrice = (it) => it.sell ?? Math.floor((it.price || 0) / 2);

export function buy(db, save, id, n = 1) {
  const it = db.it(id);
  if (!shopList(db, save).includes(it)) return { ok: false, why: 'notSold' };
  const cost = it.price * n;
  if ((save.gold || 0) < cost) return { ok: false, why: 'gold' };
  if (count(save, id) + n > BAG_MAX) return { ok: false, why: 'full' };
  save.gold -= cost;
  addItem(save, id, n);
  return { ok: true, gold: save.gold, have: count(save, id) };
}
export function sell(db, save, id, n = 1) {
  const it = db.it(id);
  const price = sellPrice(it);
  if (price <= 0 || it.breed) return { ok: false, why: 'cantSell' };
  if (!removeItem(save, id, n)) return { ok: false, why: 'none' };
  addGold(save, price * n);
  return { ok: true, gold: save.gold, have: count(save, id) };
}

// ---------- 手持ちと預かり ----------
export function newUid(save) {
  save.nextUid = Math.max(save.nextUid || 1, 1 + Math.max(0, ...Object.keys(save.monsters || {}).map((k) => +k.replace(/\D/g, '') || 0)));
  return 'm' + save.nextUid++;
}

// 個体を仲間に加える(スカウト・配合・最初の1体)。手持ちが6なら預かりへ。どちらもいっぱいなら 'full'
export function addCaught(save, mon) {
  save.monsters = save.monsters || {};
  save.party = save.party || []; save.box = save.box || [];
  let where;
  if (save.party.length < PARTY_MAX) where = 'party';
  else if (save.box.length < BOX_MAX) where = 'box';
  else return 'full';
  const uid = newUid(save);
  mon.uid = uid;
  save.monsters[uid] = mon;
  save[where].push(uid);
  save.dex = save.dex || { seen: {}, caught: {}, parts: {} };
  save.dex.seen[mon.sp] = Math.max(1, save.dex.seen[mon.sp] || 0);
  save.dex.caught[mon.sp] = (save.dex.caught[mon.sp] || 0) + 1;
  return where;
}
export function removeMonster(save, uid) {
  save.party = save.party.filter((u) => u !== uid);
  save.box = save.box.filter((u) => u !== uid);
  const m = save.monsters[uid];
  delete save.monsters[uid];
  return m;
}
export const partyMons = (save) => save.party.map((u) => save.monsters[u]);

export function toBox(save, uid) {
  if (!save.party.includes(uid)) return { ok: false, why: 'notInParty' };
  if (save.party.length <= 1) return { ok: false, why: 'last' };
  if (save.box.length >= BOX_MAX) return { ok: false, why: 'boxFull' };
  save.party = save.party.filter((u) => u !== uid); save.box.push(uid);
  return { ok: true };
}
export function toParty(save, uid) {
  if (!save.box.includes(uid)) return { ok: false, why: 'notInBox' };
  if (save.party.length >= PARTY_MAX) return { ok: false, why: 'partyFull' };
  save.box = save.box.filter((u) => u !== uid); save.party.push(uid);
  return { ok: true };
}
// 手持ちと預かりを1体ずつ入れかえる
export function swapBox(save, partyUid, boxUid) {
  const i = save.party.indexOf(partyUid), j = save.box.indexOf(boxUid);
  if (i < 0 || j < 0) return { ok: false };
  save.party[i] = boxUid; save.box[j] = partyUid;
  return { ok: true };
}
// 手持ちのならびを変える(先頭3体が台に出る)
export function reorderParty(save, order) {
  if (order.length !== save.party.length || order.some((u) => !save.party.includes(u))) return { ok: false };
  save.party = [...order];
  return { ok: true };
}
// 手持ちに、たおれていない魔物がいるか
export const hasAbleMonster = (save) => save.party.some((u) => save.monsters[u]?.hp > 0);

// ---------- 宿屋 ----------
export function restAtInn(db, save, innId = 'village') {
  if ((save.gold || 0) < INN_PRICE) return { ok: false, why: 'gold' };
  save.gold -= INN_PRICE;
  for (const uid of save.party) healFull(db, save.monsters[uid]);
  save.lastInn = innId;
  save.clock = MORNING;
  return { ok: true };
}
// 工房の預かり棚の魔物も含めて全回復(工房に預けると元気になる)
export function healBox(db, save) { for (const uid of save.box) healFull(db, save.monsters[uid]); }
