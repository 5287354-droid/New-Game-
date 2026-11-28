// 魔物の個体: 作成・能力値・パーツ・経験値とレベル・わざ。式は docs/DESIGN.md §3・§5-3。
// 個体の形はセーブ(§7)の monsters[uid] と同じ。uid はセーブ側でつける(inventory.addCaught / newUid)。
import { SLOTS, STATS, MAX_LV } from './db.js';
import { toRng } from './rng.js';

export const SHINY_RATE = 1 / 256;
export const STAR_MUL = { 1: 1.0, 2: 1.5, 3: 2.0 };
export const MAX_SKILLS = 4;
export const FRESH_XP_MUL = 1.5; // 生まれたての子(配合・Lv10未満)
// 成長とごほうびの定数(balancer が docs/BALANCE.md で決める。式の形は DESIGN §3 のまま)
export const GROW = {
  lvRate: 0.1,   // 能力(L) = base × (1 + lvRate × (L−1)) × …
  xpA: 1,        // T(L) = xpA × (L−1)^xpP
  xpP: 3,
  xpDiv: 1,      // 1戦闘の経験値 = Σ(xp × Lv ÷ xpDiv)
  goldDiv: 2,    // お金 = Σ(gold × Lv ÷ goldDiv)
};

// Lv L に上がるのに必要な経験値の合計
export function xpForLevel(L) {
  if (L <= 1) return 0;
  return Math.floor(GROW.xpA * Math.pow(L - 1, GROW.xpP));
}
export function levelForXp(xp) {
  let L = 1;
  while (L < MAX_LV && xp >= xpForLevel(L + 1)) L++;
  return L;
}

// その Lv までに覚えるわざ(新しい順に4つ)
export function learnedAt(db, sp, lv) {
  const list = db.sp(sp).learn.filter(([l]) => l <= lv).map(([, k]) => k);
  return [...new Set(list)].slice(-MAX_SKILLS);
}

/**
 * 個体を作る。
 * opts: { sp, lv=1, nick, skills(指定すると learn より優先), inherit(受けついだわざ), parts({head,back,tail}), bonus=0, gen=0,
 *         shiny(true/false。なければ shinyRate で抽選), shinyRate=1/256, rng, born='scout', parents=null, boss=false }
 */
export function createMonster(db, opts) {
  const s = db.sp(opts.sp);
  const lv = Math.max(1, Math.min(MAX_LV, opts.lv || 1));
  const rng = toRng(opts.rng);
  let skills = opts.skills ? [...opts.skills] : learnedAt(db, s.id, lv);
  if (opts.inherit?.length) {
    const inh = opts.inherit.filter((k) => !skills.includes(k));
    // 受けついだわざを優先して残し、あふれたら Lv で覚えたわざの古い方からはずす
    skills = [...skills.slice(Math.max(0, skills.length + inh.length - MAX_SKILLS)), ...inh].slice(0, MAX_SKILLS);
  }
  const shiny = opts.shiny ?? rng.chance(opts.shinyRate ?? SHINY_RATE);
  const mon = {
    sp: s.id, nick: opts.nick ?? null, lv, xp: xpForLevel(lv), hp: 0, mp: 0,
    skills, status: null, shiny,
    gen: opts.gen ?? 0, bonus: opts.bonus ?? 0,
    parts: { head: null, back: null, tail: null, ...(opts.parts || {}) },
    parents: opts.parents ?? null, born: opts.born ?? 'scout',
  };
  if (opts.boss) mon.isBoss = true; // ぬし・ボスとして出る個体(HP × hpMul、スカウト不可)
  const st = calcStats(db, mon);
  mon.hp = st.hp; mon.mp = st.mp;
  return mon;
}

// 3か所のパーツの中身(生まれつき or おさがり)。おさがりは { from, slot, star, shiny, history }
export function partsOf(db, mon) {
  return SLOTS.map((slot) => {
    const rec = mon.parts?.[slot];
    if (rec) {
      const def = db.sp(rec.from).parts[rec.slot];
      return { slot, from: rec.from, srcSlot: rec.slot, star: rec.star, mul: STAR_MUL[rec.star] || 1, def, shiny: !!rec.shiny, inherited: true, history: rec.history || [rec.from] };
    }
    const def = db.sp(mon.sp).parts[slot];
    return { slot, from: mon.sp, srcSlot: slot, star: 0, mul: 1, def, shiny: !!mon.shiny, inherited: false, history: [] };
  });
}

// パーツの能力% の合計 { hp: 5, spd: 7.5, ... }
export function partPct(db, mon) {
  const pct = Object.fromEntries(STATS.map((k) => [k, 0]));
  for (const p of partsOf(db, mon)) if (p.def?.stat) pct[p.def.stat] += p.def.pct * p.mul;
  return pct;
}

// 特性 { windupStart: { star: 1|2|3, gold: false }, ... }   生まれつきは star 0(★1 と同じ強さ)。同じ特性が2つあれば強い方
export function traitsOf(db, mon) {
  const out = {};
  for (const p of partsOf(db, mon)) {
    const t = p.def?.trait;
    if (!t) continue;
    if (!out[t] || out[t].star < p.star) out[t] = { star: p.star, gold: p.star >= 3, slot: p.slot };
  }
  return out;
}

// パーツわざ(4つの枠とは別の枠)。付けているパーツについているわざ全部(生まれつきもふくむ。4つの枠と同じものはのぞく)
export function partSkills(db, mon) {
  const out = [];
  for (const p of partsOf(db, mon)) if (p.def?.skill && !mon.skills.includes(p.def.skill) && !out.includes(p.def.skill)) out.push(p.def.skill);
  return out;
}
// 戦闘で使えるわざ全部
export function usableSkills(db, mon) { return [...mon.skills, ...partSkills(db, mon)]; }

// 能力値。ぬし・ボスとして出る個体(isBoss)だけ HP × hpMul
export function calcStats(db, mon) {
  const s = db.sp(mon.sp);
  const pct = partPct(db, mon);
  const lvMul = 1 + GROW.lvRate * (mon.lv - 1);
  const out = {};
  for (const k of STATS) out[k] = Math.max(1, Math.floor(s.base[k] * lvMul * (1 + (mon.bonus || 0)) * (1 + pct[k] / 100)));
  if (mon.isBoss && s.hpMul) out.hp = Math.floor(out.hp * s.hpMul);
  return out;
}

export function displayName(db, mon) { return mon.nick || db.sp(mon.sp).name; }

// 全回復(宿屋)。たおれていても起きる。状態異常も直る
export function healFull(db, mon) {
  const st = calcStats(db, mon);
  mon.hp = st.hp; mon.mp = st.mp; mon.status = null;
  return mon;
}

/**
 * 経験値を足す。レベルアップ・覚えるわざの出来事を返す。個体を書きかえる。
 * 返す出来事: { type:'xp', amount } / { type:'levelUp', lv, gain:{hp,..} } / { type:'learn', skill } / { type:'learnFull', skill }(4つ埋まっている。UI で忘れるわざを選んで learnSkill)
 */
export function gainXp(db, mon, amount) {
  const ev = [{ type: 'xp', amount }];
  if (mon.lv >= MAX_LV) return ev;
  mon.xp += amount;
  while (mon.lv < MAX_LV && mon.xp >= xpForLevel(mon.lv + 1)) {
    const before = calcStats(db, mon);
    mon.lv++;
    const after = calcStats(db, mon);
    const gain = Object.fromEntries(STATS.map((k) => [k, after[k] - before[k]]));
    if (mon.hp > 0) mon.hp = Math.min(after.hp, mon.hp + gain.hp);
    mon.mp = Math.min(after.mp, mon.mp + gain.mp);
    ev.push({ type: 'levelUp', lv: mon.lv, gain });
    for (const [l, k] of db.sp(mon.sp).learn) {
      if (l !== mon.lv || mon.skills.includes(k)) continue;
      if (mon.skills.length < MAX_SKILLS) { mon.skills.push(k); ev.push({ type: 'learn', skill: k }); }
      else ev.push({ type: 'learnFull', skill: k });
    }
  }
  if (mon.lv >= MAX_LV) mon.xp = Math.min(mon.xp, xpForLevel(MAX_LV));
  return ev;
}

// わざを覚える。forget に忘れるわざ(id か枠の番号)。4つ未満なら forget はいらない。覚えなかったら false
export function learnSkill(mon, skill, forget = null) {
  if (mon.skills.includes(skill)) return false;
  if (mon.skills.length < MAX_SKILLS) { mon.skills.push(skill); return true; }
  const i = typeof forget === 'number' ? forget : mon.skills.indexOf(forget);
  if (i < 0 || i >= mon.skills.length) return false;
  mon.skills[i] = skill;
  return true;
}

// 経験値の倍率(生まれたての子)
export function xpMulOf(mon) { return mon.born === 'breed' && mon.lv < 10 ? FRESH_XP_MUL : 1; }

// 戦闘のごほうび(敵の個体のならび)
export function battleXp(db, enemies) { return enemies.reduce((a, e) => a + db.sp(e.sp).xp * e.lv / GROW.xpDiv, 0); }
export function battleGold(db, enemies) { return enemies.reduce((a, e) => a + db.sp(e.sp).gold * e.lv / GROW.goldDiv, 0); }
