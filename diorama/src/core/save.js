// セーブ: 版番号つきの JSON。保存先は差しかえられる(ブラウザは localStorage、node はメモリ)。形は docs/DESIGN.md §7。
//
//   const store = createStore()                 // localStorage があればそれ、なければメモリ
//   store.save(save, 'manual' | 'auto')          // 保存の前に resetLooseItems と savedAt
//   const save = store.load('manual')            // 古い版なら migrate を通す。なければ null
//   const text = exportText(save); importText(text)  // 書き出し / 読みこみ(base64)
//
// 版を上げるときは: SAVE_VERSION を上げ、MIGRATIONS[古い版] = (s) => 新しい形 を足し、tests/save.test.mjs に移行のテストを足す。

export const SAVE_VERSION = 2;
export const KEYS = { manual: 'diorama.save.v1', auto: 'diorama.auto.v1', settings: 'diorama.settings' }; // キーの名前は枠の名前(版は中の v)
const EXPORT_HEAD = 'DMK1:';

// 版 n → n+1 の移行
export const MIGRATIONS = {
  // v1 → v2: 魔物に uid を持たせ、次の uid(nextUid)・負けた回数・読んだ本・ごほうびの欄を足す。ピンセットで持っていた物(held)は元にもどす
  1: (s) => {
    const o = structuredClone(s);
    o.monsters = o.monsters || {};
    for (const [uid, m] of Object.entries(o.monsters)) {
      m.uid = uid;
      if (typeof m.status === 'object' && m.status) m.status = m.status.id || null;
      m.parts = { head: null, back: null, tail: null, ...(m.parts || {}) };
      m.gen = m.gen ?? 0; m.bonus = m.bonus ?? 0;
    }
    const nums = Object.keys(o.monsters).map((k) => +k.replace(/\D/g, '') || 0);
    o.nextUid = 1 + Math.max(0, ...nums);
    o.stats = { battles: 0, scouts: 0, breeds: 0, defeats: 0, ...(o.stats || {}) };
    o.books = o.books || [];
    o.rewards = o.rewards || {};
    o.player = { cam: 0, l: 0, dir: 2, ...(o.player || {}) };
    for (const a of Object.values(o.areas || {})) resetHeld(a.gs);
    o.v = 2;
    return o;
  },
};

export function migrate(s) {
  if (!s || typeof s !== 'object') throw new Error('セーブが読めない');
  let o = s;
  const from = o.v ?? 1;
  if (from > SAVE_VERSION) throw new Error(`新しすぎるセーブ(v${from})`);
  for (let v = from; v < SAVE_VERSION; v++) {
    const f = MIGRATIONS[v];
    if (!f) throw new Error(`v${v} からの移行がない`);
    o = f(o);
    if (o.v !== v + 1) throw new Error(`移行 v${v} の版番号がおかしい`);
  }
  return o;
}

// はじめから
export function newSave(name = 'ピン') {
  return {
    v: SAVE_VERSION,
    savedAt: null, playMs: 0,
    player: { name, area: 'village', l: 0, x: 0, z: 0, dir: 2, cam: 0 },
    clock: 360, lastInn: 'village',
    flags: {}, abilities: { tweezers: false },
    gold: 100, bag: {},
    party: [], box: [], monsters: {}, nextUid: 1,
    dex: { seen: {}, caught: {}, parts: {} }, rewards: {},
    areas: {}, books: [], starter: null,
    stats: { battles: 0, scouts: 0, breeds: 0, defeats: 0 },
  };
}

// ピンセットで持っていた物を元の場所へ(§6)
function resetHeld(gs) {
  if (!gs || gs.held == null) return;
  if (gs.items && gs.items[gs.held] == null) gs.items[gs.held] = 'home';
  gs.held = null;
}
export function resetLooseItems(save) { for (const a of Object.values(save.areas || {})) resetHeld(a.gs); return save; }

// 形のおかしいところを探す(空なら正しい)
export function validate(save) {
  const err = [];
  if (save.v !== SAVE_VERSION) err.push(`版が ${save.v}`);
  for (const k of ['player', 'flags', 'bag', 'party', 'box', 'monsters', 'dex', 'areas']) if (save[k] == null) err.push(`${k} がない`);
  if (err.length) return err;
  if (save.party.length > 6) err.push('手持ちが6をこえる');
  if (save.box.length > 60) err.push('預かりが60をこえる');
  for (const uid of [...save.party, ...save.box]) if (!save.monsters[uid]) err.push(`${uid} の個体がない`);
  const seen = new Set();
  for (const uid of [...save.party, ...save.box]) { if (seen.has(uid)) err.push(`${uid} が2か所にいる`); seen.add(uid); }
  for (const [uid, m] of Object.entries(save.monsters)) {
    if (!m.sp) err.push(`${uid} に種族がない`);
    if (!(m.lv >= 1 && m.lv <= 30)) err.push(`${uid} の Lv ${m.lv}`);
    if (!Array.isArray(m.skills) || m.skills.length > 4) err.push(`${uid} のわざ`);
    for (const s of ['head', 'back', 'tail']) { const p = m.parts?.[s]; if (p && !(p.star >= 1 && p.star <= 3)) err.push(`${uid}.${s} の★`); }
  }
  if (!(save.gold >= 0)) err.push('お金');
  return err;
}

// 文字列にする / 文字列から(移行つき)
export function serialize(save) { return JSON.stringify(save); }
export function deserialize(text) { return migrate(JSON.parse(text)); }

// 書き出し / 読みこみ(UTF-8 の JSON を base64。頭に 'DMK1:')
export function exportText(save) {
  const bytes = new TextEncoder().encode(serialize(resetLooseItems(structuredClone(save))));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return EXPORT_HEAD + btoa(bin);
}
export function importText(text) {
  let t = String(text).trim();
  if (t.startsWith(EXPORT_HEAD)) t = t.slice(EXPORT_HEAD.length);
  if (t.startsWith('{')) return deserialize(t); // 生の JSON もうけつける
  const bin = atob(t.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const s = deserialize(new TextDecoder().decode(bytes));
  const err = validate(s);
  if (err.length) throw new Error('セーブの形がおかしい: ' + err.join(' / '));
  return s;
}

// 保存先: localStorage と同じ形(getItem / setItem / removeItem)
export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

export function createStore(backend) {
  let be = backend;
  if (!be) { try { be = globalThis.localStorage; be?.getItem('x'); } catch { be = null; } }
  be = be || memoryStorage();
  return {
    backend: be,
    save(save, slot = 'manual') {
      resetLooseItems(save);
      save.v = SAVE_VERSION;
      save.savedAt = new Date().toISOString();
      be.setItem(KEYS[slot], serialize(save));
      return save.savedAt;
    },
    load(slot = 'manual') {
      const t = be.getItem(KEYS[slot]);
      if (!t) return null;
      return deserialize(t);
    },
    has(slot = 'manual') { return !!be.getItem(KEYS[slot]); },
    remove(slot = 'manual') { be.removeItem(KEYS[slot]); },
    // 手動とオートの新しい方(タイトルの「つづきから」)
    loadLatest() {
      const a = this.has('manual') ? this.load('manual') : null, b = this.has('auto') ? this.load('auto') : null;
      if (!a || !b) return a || b;
      return (a.savedAt || '') >= (b.savedAt || '') ? a : b;
    },
    saveSettings(o) { be.setItem(KEYS.settings, JSON.stringify(o)); },
    loadSettings() { try { return JSON.parse(be.getItem(KEYS.settings)) || {}; } catch { return {}; } },
  };
}
