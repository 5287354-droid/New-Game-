// 3対3のターン制の戦闘。式は docs/DESIGN.md §4。three に依存しない。
//
//   const b = createBattle(db, { allies:[個体…], enemies:[個体…], rng, bag, first })
//   b.startEvents                       … はじめの出来事(登場・特性)
//   const ev = submit(b, { a0:{cmd:'skill', skill:'tackle', target:'e1'}, a1:{cmd:'attack'}, a2:{cmd:'swap', with:'a3'} })
//   b.result                            … 終わったら { outcome:'win'|'lose'|'escape'|'scout', ... }
//   applyBattleResult(db, save, b)      … 経験値・お金・図鑑・スカウトした子・負けたときの処理をセーブに入れる
//
// 結果はすべて「出来事の列」で返す(演出班がアニメにする)。種類は docs/INTERFACES.md の battle の節。
// 魔物の位置: field[0] field[1] = 前列、field[2] = 後列。味方の4〜6体目は控え(bench)。
import { calcStats, traitsOf, usableSkills, displayName, battleXp, battleGold, xpMulOf, gainXp, createMonster, healFull } from './stats.js';
import { toRng } from './rng.js';
import { addCaught as defaultAddCaught } from './inventory.js';

export const ATTACK = { id: 'attack', name: 'たたかう', el: 'none', kind: 'phys', pow: 30, mp: 0, target: 'one', range: 'melee' };
export const BUFF_TURNS = 5;
export const CLOAK_TURNS = 3;
export const BACK_MUL = 0.7;
export const ALL_MUL = 0.75;
export const STAB_MUL = 1.2;
export const CRIT_RATE = 1 / 16;
export const CRIT_MUL = 1.5;
export const ADV = 1.5;
export const DISADV = 0.67;
const PRIO_FIRST = 3; // にげる・スカウト・いれかえ・どうぐ は わざより先

// ---------- 準備 ----------

/**
 * opts: { allies:[個体](手持ちの順。6まで), enemies:[個体](3まで。ぬし・ボスは isBoss), rng|seed, bag:{道具id:数}(使うとへる。セーブの bag をそのまま渡してよい),
 *         first:'ally'|'enemy'|null(先制), flags, rule:'kageboushi'|'tokeimori'(なければ敵から自動) }
 */
export function createBattle(db, opts) {
  const rng = toRng(opts.rng ?? opts.seed);
  const b = {
    db, rng, turn: 0, over: false, result: null, first: opts.first || null,
    bag: opts.bag || {}, flags: opts.flags || {},
    units: {}, field: { ally: [null, null, null], enemy: [null, null, null] }, roster: { ally: [], enemy: [] },
    kind: 'wild', rule: null, runFails: 0, scoutFails: 0, varnish: false,
    cover: {}, forceLight: 0, reinforce: null, pendingSpawn: 0, nextEnemy: 0,
    startEvents: [], log: [],
  };
  (opts.allies || []).slice(0, 6).forEach((m, i) => addUnit(b, 'ally', m, i));
  (opts.enemies || []).slice(0, 3).forEach((m, i) => addUnit(b, 'enemy', m, i));
  b.nextEnemy = b.roster.enemy.length;
  const boss = b.roster.enemy.map((k) => b.units[k]).find((u) => u.isBoss);
  if (boss) {
    b.kind = 'boss';
    b.rule = opts.rule ?? (['kageboushi', 'tokeimori'].includes(boss.mon.sp) ? boss.mon.sp : null);
  }
  if (b.rule === 'tokeimori') {
    const minion = b.roster.enemy.map((k) => b.units[k]).find((u) => !u.isBoss);
    b.reinforce = { sp: minion?.mon.sp || 'zenmainu', lv: minion?.mon.lv || 16, left: 2 };
  }
  // 並べる: 先頭からたおれていない3体
  for (const side of ['ally', 'enemy']) {
    let slot = 0;
    for (const k of b.roster[side]) { if (slot < 3 && b.units[k].alive) b.field[side][slot++] = k; }
    collapse(b, side);
  }
  const ev = b.startEvents;
  ev.push({ type: 'start', kind: b.kind, rule: b.rule, first: b.first, field: { ally: [...b.field.ally], enemy: [...b.field.enemy] } });
  if (b.rule === 'kageboushi') ev.push({ type: 'phase', phase: phaseFor(b, 1), next: phaseFor(b, 2) });
  if (b.rule === 'tokeimori') ev.push({ type: 'hand', hand: 0 });
  // 鈴(rattle): 相手みんなのすばやさ ×0.9(3ターン)
  for (const side of ['ally', 'enemy']) {
    if (onField(b, side).some((u) => u.traits.rattle)) {
      ev.push({ type: 'trait', trait: 'rattle', side });
      for (const t of onField(b, other(side))) applyBuff(b, t, 'spd', 0.9, 3, ev);
    }
  }
  b.log.push(...ev);
  return b;
}

function addUnit(b, side, mon, i) {
  const key = (side === 'ally' ? 'a' : 'e') + i;
  const st = calcStats(b.db, mon);
  const traits = traitsOf(b.db, mon);
  const u = {
    key, side, mon, sp: mon.sp, name: displayName(b.db, mon), mat: b.db.sp(mon.sp).mat,
    st, maxHp: st.hp, maxMp: st.mp,
    hp: Math.min(mon.hp ?? st.hp, st.hp), mp: Math.min(mon.mp ?? st.mp, st.mp),
    status: mon.status ? { id: typeof mon.status === 'string' ? mon.status : mon.status.id, turns: mon.status.turns ?? 4 } : null,
    buffs: {}, shield: 0, isBoss: !!mon.isBoss, traits,
    endure: traits.endure ? (traits.endure.star >= 3 ? 2 : 1) : 0,
    skipTurn: 0, alive: true,
  };
  if (side === 'enemy' && mon.hp == null) u.hp = st.hp;
  u.alive = u.hp > 0;
  b.units[key] = u;
  b.roster[side].push(key);
  return u;
}

// ぬし・ボス戦の敵のならび(DESIGN §4-8)。ぬしは前列の左
export function bossEnemies(db, which, rng) {
  if (which === 'kageboushi') return [
    createMonster(db, { sp: 'kageboushi', lv: 14, boss: true, shiny: false, born: 'boss' }),
    createMonster(db, { sp: 'origarasu', lv: 11, rng }),
    createMonster(db, { sp: 'origarasu', lv: 11, rng }),
  ];
  if (which === 'tokeimori') return [
    createMonster(db, { sp: 'tokeimori', lv: 20, boss: true, shiny: false, born: 'boss' }),
    createMonster(db, { sp: 'zenmainu', lv: 16, rng }),
    createMonster(db, { sp: 'zenmainu', lv: 16, rng }),
  ];
  throw new Error('ぬしがいない: ' + which);
}

// 野生の敵 [{sp, lv}] → 個体(色違いの抽選つき)
export function wildEnemies(db, list, rng, shinyRate) {
  rng = toRng(rng);
  return list.slice(0, 3).map((e) => createMonster(db, { sp: e.sp, lv: e.lv, rng, shinyRate }));
}

// ---------- ようす(UI 用) ----------

export const other = (side) => (side === 'ally' ? 'enemy' : 'ally');
export const unit = (b, key) => b.units[key];
export function rowOf(b, u) {
  const i = b.field[u.side].indexOf(u.key);
  return i < 0 ? 'bench' : i < 2 ? 'front' : 'back';
}
export function onField(b, side) { return b.field[side].map((k) => k && b.units[k]).filter((u) => u && u.alive); }
function frontAlive(b, side) { return b.field[side].slice(0, 2).map((k) => k && b.units[k]).filter((u) => u && u.alive); }

export function phaseFor(b, turn) {
  if (b.rule !== 'kageboushi') return null;
  if (b.forceLight === turn) return 'light';
  return Math.floor((turn - 1) / 2) % 2 === 0 ? 'light' : 'shadow';
}
export function handFor(turn) { return ((turn % 4) + 4) % 4; } // 0=12時 1=3時 2=6時 3=9時

// 画面に出すための写し
export function getView(b) {
  const uv = (k) => {
    if (!k) return null;
    const u = b.units[k];
    return { key: u.key, sp: u.sp, name: u.name, lv: u.mon.lv, hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, status: u.status?.id || null,
      row: rowOf(b, u), alive: u.alive, shiny: !!u.mon.shiny, isBoss: u.isBoss, shield: u.shield > 0,
      buffs: Object.fromEntries(Object.entries(u.buffs).map(([s, v]) => [s, { mul: v.mul, turns: v.turns }])) };
  };
  return {
    turn: b.turn, kind: b.kind, rule: b.rule, over: b.over, result: b.result,
    phase: phaseFor(b, b.turn + 1), nextPhase: phaseFor(b, b.turn + 2), hand: b.rule === 'tokeimori' ? handFor(b.turn) : null,
    field: { ally: b.field.ally.map(uv), enemy: b.field.enemy.map(uv) },
    bench: b.roster.ally.filter((k) => !b.field.ally.includes(k)).map(uv),
    bag: { ...b.bag },
  };
}

// その魔物が選べるコマンド
export function availableCommands(b, key) {
  const u = b.units[key];
  if (!u || !u.alive || rowOf(b, u) === 'bench' || u.side !== 'ally') return null;
  const row = rowOf(b, u);
  const skills = usableSkills(b.db, u.mon).map((id) => {
    const sk = b.db.sk(id);
    let reason = null;
    if (sk.range === 'melee' && row === 'back') reason = 'back';
    else if ((sk.mp || 0) > u.mp) reason = 'mp';
    return { id, ok: !reason, reason, part: !u.mon.skills.includes(id) };
  });
  const swap = b.roster.ally.filter((k) => k !== key && (b.units[k].alive || b.field.ally.includes(k)) && (rowOf(b, b.units[k]) !== 'bench' || b.units[k].alive));
  const items = Object.entries(b.bag).filter(([id, n]) => n > 0 && isBattleItem(b.db.items[id])).map(([id]) => id);
  return {
    attack: row === 'front', skills, swap, items,
    scout: b.kind === 'wild' && onField(b, 'enemy').some((e) => scoutBase(b, e) > 0),
    run: b.kind === 'wild',
  };
}
function isBattleItem(it) { return it && (it.hp || it.hpAll || it.mp || it.rev || it.cure || it.scout || it.escape); }

// わざの的になれる魔物の key
export function validTargets(b, key, skillId) {
  const u = b.units[key];
  const sk = skillId === 'attack' || !skillId ? ATTACK : b.db.sk(skillId);
  const t = sk.target;
  if (t === 'self') return [key];
  if (t === 'ally' || t === 'allies') return onField(b, u.side).map((x) => x.key);
  const opp = other(u.side);
  if (sk.range === 'melee') { const f = frontAlive(b, opp); return (f.length ? f : onField(b, opp)).map((x) => x.key); }
  return onField(b, opp).map((x) => x.key);
}

// ---------- 能力・命中・ダメージ ----------

export function effStat(b, u, stat, { ignoreGoodBuff = false } = {}) {
  let v = u.st[stat];
  const bf = u.buffs[stat];
  if (bf) v *= ignoreGoodBuff && bf.mul > 1 ? 1 : bf.mul;
  if (stat === 'atk') {
    if (u.status?.id === 'burn') v *= 0.85;
    if (b.rule === 'kageboushi' && u.isBoss && phaseFor(b, b.turn) === 'shadow') v *= 1.2;
  }
  if (stat === 'spd') {
    if (u.status?.id === 'rust') v *= 0.5;
    const w = u.traits.windupStart;
    if (w && b.turn <= (w.star >= 3 ? 2 : 1)) v *= 1.5;
    if (u.traits.mainspring && b.turn >= 3) v *= 1.2;
  }
  return v;
}

export function elementMul(b, el, defMat) {
  if (!el || el === 'none') return 1;
  if (b.db.beats[el] === defMat) return ADV;
  if (b.db.beats[defMat] === el) return DISADV;
  return 1;
}

export function hitChance(b, att, def, sk) {
  if (sk.kind !== 'phys') return sk.acc != null ? sk.acc / 100 : 1;
  const cs = att.traits.clearsight;
  let p = ((sk.acc ?? 95) / 100) * (0.9 + 0.1 * effStat(b, att, 'spd') / Math.max(1, effStat(b, def, 'spd')));
  p = Math.min(1, Math.max(0.5, p));
  if (att.status?.id === 'stain' && !cs) p *= 0.75;
  const cloak = !!def.buffs.eva;
  if (cloak) p *= 0.5;
  const shadow = b.rule === 'kageboushi' && phaseFor(b, b.turn) === 'shadow';
  if (shadow && def.isBoss && !cs) p *= 0.25;
  if (def.traits.shadowfit && (cloak || shadow)) p *= 0.8;
  if (cs && cs.star >= 3) p += 0.05;
  return Math.min(1, p);
}

/** ダメージの計算(乱数を使う)。opts.cover: かばう(まもり×1.2) */
export function calcDamage(b, att, def, sk, opts = {}) {
  const rng = opts.rng || b.rng;
  const phys = sk.kind === 'phys';
  const crit = opts.crit ?? (phys && !def.traits.nocrit && rng.chance(CRIT_RATE));
  const A = phys ? effStat(b, att, 'atk') : att.st.int;
  let D = phys ? effStat(b, def, 'def', { ignoreGoodBuff: crit }) : (effStat(b, def, 'def') + def.st.int) / 2;
  if (opts.cover) D *= 1.2;
  const base = (sk.pow / 16) * A * A / Math.max(1, A + D);
  const elem = elementMul(b, sk.el, def.mat);
  const stab = sk.el !== 'none' && sk.el === att.mat ? STAB_MUL : 1;
  const row = rowOf(b, def) === 'back' ? BACK_MUL * (def.traits.backguard ? 0.85 : 1) : 1;
  const all = sk.target === 'all' ? ALL_MUL : 1;
  const critM = crit ? CRIT_MUL : 1;
  let trait = 1;
  if (sk.el === 'water' && att.traits.inkpot) trait *= 1.1;
  if (sk.el === 'fire' && att.traits.burnproof) trait *= 1.1;
  const r = opts.roll ?? rng.range(0.9, 1.1);
  let dmg = Math.max(1, Math.floor(base * elem * stab * row * all * critM * trait * r));
  return { dmg, crit, elem };
}

// ---------- 状態・ばふ ----------

export function statusImmune(b, u, id) {
  if (id === 'sleep') return !!u.traits.wakeful;
  if (id === 'burn') return u.mat === 'fire' || !!u.traits.burnproof;
  if (id === 'stain') return u.mat === 'water';
  if (id === 'rust') return !!u.traits.rustproof;
  return false;
}
function tryStatus(b, u, id, chance, ev, loud) {
  if (!u.alive) return false;
  if (u.status || statusImmune(b, u, id)) { if (loud) ev.push({ type: 'statusBlocked', target: u.key, status: id, why: u.status ? 'already' : 'immune' }); return false; }
  let p = chance;
  if (id === 'rust' && u.mat === 'tin') p = Math.min(0.9, p * 2);
  if (!b.rng.chance(p)) { if (loud) ev.push({ type: 'statusMiss', target: u.key, status: id }); return false; }
  const [lo, hi] = b.db.statuses[id]?.turns || [4, 4];
  u.status = { id, turns: b.rng.int(lo, hi) };
  ev.push({ type: 'status', target: u.key, status: id, turns: u.status.turns });
  return true;
}
function applyBuff(b, u, stat, mul, turns, ev) {
  const old = u.buffs[stat]?.mul ?? 1;
  const nm = Math.min(2, Math.max(0.5, old * mul));
  u.buffs[stat] = { mul: nm, turns };
  ev.push({ type: 'buff', target: u.key, stat, mul: nm, by: mul, turns });
}

// ---------- 行動 ----------

/** 1ターン進める。cmds = { 味方の key: コマンド }。書いていない味方は自動で動く。出来事の列を返す */
export function submit(b, cmds = {}) {
  if (b.over) throw new Error('戦闘は終わっている');
  b.turn++;
  b.cover = {};
  const ev = [];
  const T = b.turn;
  // 補充(トケイモリの手下)
  while (b.pendingSpawn > 0 && b.reinforce?.left > 0) {
    const slot = b.field.enemy.findIndex((k) => !k || !b.units[k].alive);
    if (slot < 0) break;
    const m = createMonster(b.db, { sp: b.reinforce.sp, lv: b.reinforce.lv, rng: b.rng, shiny: false });
    const u = addUnit(b, 'enemy', m, b.nextEnemy++);
    b.field.enemy[slot] = u.key;
    b.reinforce.left--; b.pendingSpawn--;
    ev.push({ type: 'reinforce', unit: u.key, sp: u.sp, slot, left: b.reinforce.left });
  }
  if (!b.reinforce?.left) b.pendingSpawn = 0;
  const start = { type: 'turnStart', turn: T };
  if (b.rule === 'kageboushi') { start.phase = phaseFor(b, T); start.next = phaseFor(b, T + 1); }
  if (b.rule === 'tokeimori') start.hand = handFor(T);
  ev.push(start);

  // 行動を集める
  const acts = [];
  for (const side of ['ally', 'enemy']) {
    if (T === 1 && b.first && b.first !== side) { ev.push({ type: 'surprised', side }); continue; }
    for (const u of onField(b, side)) {
      let c = side === 'ally' ? cmds[u.key] : null;
      if (!c || !validCmd(b, u, c)) c = autoAction(b, u.key);
      if (b.rule === 'tokeimori' && u.isBoss && handFor(T) === 0) c = { cmd: 'skill', skill: 'chime', free: true };
      acts.push({ u, c, prio: prioOf(b, u, c), roll: effStat(b, u, 'spd') * b.rng.range(0.95, 1.05) });
    }
  }
  acts.sort((x, y) => y.prio - x.prio || y.roll - x.roll);
  ev.push({ type: 'order', order: acts.map((a) => a.u.key) });

  for (const a of acts) {
    if (b.over) break;
    const u = a.u;
    if (!u.alive || rowOf(b, u) === 'bench' || u.skipTurn === T) continue;
    act(b, u, a.c, ev);
    checkEnd(b, ev);
  }
  if (!b.over) endTurn(b, ev);
  b.log.push(...ev);
  return ev;
}

function prioOf(b, u, c) {
  if (['run', 'scout', 'swap', 'item'].includes(c.cmd)) return PRIO_FIRST;
  let p = 0;
  if (c.cmd === 'skill') p = b.db.sk(c.skill).prio || 0;
  if (u.traits.clockwork && b.turn % 3 === 0) p += 0.5;
  return p;
}

function validCmd(b, u, c) {
  const row = rowOf(b, u);
  switch (c.cmd) {
    case 'attack': return row === 'front';
    case 'skill': {
      if (!usableSkills(b.db, u.mon).includes(c.skill)) return false;
      const sk = b.db.sk(c.skill);
      return !(sk.range === 'melee' && row === 'back');
    }
    case 'swap': { const w = b.units[c.with]; return !!w && w.side === u.side && w !== u && (rowOf(b, w) !== 'bench' || w.alive); }
    case 'item': return (b.bag[c.item] || 0) > 0 && isBattleItem(b.db.items[c.item]);
    case 'scout': return b.kind === 'wild' && u.side === 'ally';
    case 'run': return u.side === 'ally';
    case 'wait': return true;
    default: return false;
  }
}

function act(b, u, c, ev) {
  if (u.status?.id === 'sleep' && ['attack', 'skill'].includes(c.cmd)) { ev.push({ type: 'cantAct', actor: u.key, why: 'sleep' }); return; }
  switch (c.cmd) {
    case 'attack': return useSkill(b, u, ATTACK, c.target, ev);
    case 'skill': return useSkill(b, u, b.db.sk(c.skill), c.target, ev, c.free);
    case 'swap': return doSwap(b, u, b.units[c.with], ev);
    case 'item': return useItem(b, u, c.item, c.target, ev);
    case 'scout': return doScout(b, u, c.target, ev, c.varnish);
    case 'run': return doRun(b, u, ev);
    default: ev.push({ type: 'wait', actor: u.key });
  }
}

function pickTarget(b, u, sk, want) {
  const list = validTargets(b, u.key, sk.id);
  if (want && list.includes(want)) return b.units[want];
  if (!list.length) return null;
  if (sk.target === 'ally') { // いちばん弱っている味方
    return list.map((k) => b.units[k]).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  }
  return b.units[b.rng.pick(list)];
}

function useSkill(b, u, sk, want, ev, free) {
  const row = rowOf(b, u);
  if (sk.range === 'melee' && row === 'back') { ev.push({ type: 'fail', actor: u.key, skill: sk.id, why: 'back' }); return; }
  const cost = free ? 0 : sk.mp || 0;
  if (cost > u.mp) { ev.push({ type: 'fail', actor: u.key, skill: sk.id, why: 'mp' }); return; }
  u.mp -= cost;
  let targets;
  if (sk.target === 'all') targets = validTargets(b, u.key, sk.id).map((k) => b.units[k]);
  else if (sk.target === 'allies') targets = onField(b, u.side);
  else if (sk.target === 'self') targets = [u];
  else { const t = pickTarget(b, u, sk, want); targets = t ? [t] : []; }
  ev.push({ type: 'action', actor: u.key, skill: sk.id, name: sk.name, targets: targets.map((t) => t.key), mp: cost });
  if (sk.also === 'cureSelf' && u.status) { ev.push({ type: 'cure', target: u.key, status: u.status.id }); u.status = null; }

  switch (sk.kind) {
    case 'phys': case 'mag': {
      for (let t of targets) {
        if (!t.alive) continue;
        let covered = false;
        if (sk.target === 'one' && t.side !== u.side && b.cover[t.key]) {
          const cv = b.units[b.cover[t.key]];
          if (cv && cv.alive && rowOf(b, cv) !== 'bench') { ev.push({ type: 'cover', by: cv.key, for: t.key }); t = cv; covered = true; }
        }
        const p = hitChance(b, u, t, sk);
        if (!b.rng.chance(p)) { ev.push({ type: 'miss', actor: u.key, target: t.key, chance: round(p) }); continue; }
        const { dmg, crit, elem } = calcDamage(b, u, t, sk, { cover: covered });
        const dealt = dealDamage(b, t, dmg, ev, { crit, elem, skill: sk.id, actor: u.key });
        if (sk.drain && dealt > 0 && u.alive) heal(b, u, Math.floor(dealt * sk.drain), ev, 'drain');
        if (sk.eff && t.alive) {
          if (sk.eff.status) tryStatus(b, t, sk.eff.status, sk.eff.chance ?? 1, ev, false);
          if (sk.eff.stat && b.rng.chance(sk.eff.chance ?? 1)) applyBuff(b, t, sk.eff.stat, sk.eff.mul, BUFF_TURNS, ev);
        }
      }
      if (sk.also === 'forceLight' && b.rule === 'kageboushi' && targets.length) {
        b.forceLight = b.turn + 1;
        ev.push({ type: 'phase', phase: phaseFor(b, b.turn), next: 'light', forced: true });
      }
      break;
    }
    case 'heal':
      for (const t of targets) if (t.alive) heal(b, t, Math.floor(sk.pow * (1 + u.st.int / 40)), ev, 'skill');
      break;
    case 'buff':
      for (const t of targets) {
        if (!t.alive) continue;
        if (sk.stat === 'shield') { t.shield = sk.mul; ev.push({ type: 'shield', target: t.key, mul: sk.mul }); }
        else if (sk.stat === 'eva') { t.buffs.eva = { mul: sk.mul, turns: CLOAK_TURNS }; ev.push({ type: 'buff', target: t.key, stat: 'eva', mul: sk.mul, by: sk.mul, turns: CLOAK_TURNS }); }
        else applyBuff(b, t, sk.stat, sk.mul, BUFF_TURNS, ev);
      }
      break;
    case 'debuff':
      for (const t of targets) {
        if (!t.alive) continue;
        if (!b.rng.chance(hitChance(b, u, t, sk))) { ev.push({ type: 'miss', actor: u.key, target: t.key }); continue; }
        applyBuff(b, t, sk.stat, sk.mul, BUFF_TURNS, ev);
      }
      break;
    case 'status':
      for (const t of targets) if (t.alive) tryStatus(b, t, sk.status, sk.chance ?? 1, ev, true);
      break;
    case 'guard':
      for (const t of targets) if (t !== u) { b.cover[t.key] = u.key; ev.push({ type: 'guard', actor: u.key, target: t.key }); }
      break;
    case 'cure':
      for (const t of targets) if (t.status) { ev.push({ type: 'cure', target: t.key, status: t.status.id }); t.status = null; }
      break;
  }
}

function round(x) { return Math.round(x * 1000) / 1000; }

function dealDamage(b, t, dmg, ev, info = {}) {
  if (t.shield) { dmg = Math.max(1, Math.floor(dmg * t.shield)); t.shield = 0; ev.push({ type: 'shieldBreak', target: t.key }); }
  let endured = false;
  if (dmg >= t.hp && t.endure > 0 && t.hp > 1) { dmg = t.hp - 1; t.endure--; endured = true; }
  const lost = Math.min(t.hp, dmg);
  t.hp = Math.max(0, t.hp - dmg);
  ev.push({ type: 'damage', target: t.key, amount: dmg, lost, hp: t.hp, maxHp: t.maxHp, crit: !!info.crit, elem: info.elem ?? 1, skill: info.skill, actor: info.actor, row: rowOf(b, t) });
  if (endured) ev.push({ type: 'endure', target: t.key, left: t.endure });
  if (t.hp <= 0) faint(b, t, ev);
  else if (t.status?.id === 'sleep' && b.rng.chance(0.5)) { t.status = null; ev.push({ type: 'wake', target: t.key }); }
  return lost;
}

function heal(b, t, amt, ev, why) {
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + Math.max(0, amt));
  ev.push({ type: 'heal', target: t.key, amount: t.hp - before, hp: t.hp, maxHp: t.maxHp, why });
}

function faint(b, t, ev) {
  t.alive = false; t.hp = 0; t.status = null; t.buffs = {}; t.shield = 0;
  ev.push({ type: 'faint', target: t.key, side: t.side });
  if (t.side === 'enemy' && b.rule === 'tokeimori' && !t.isBoss && b.reinforce?.left > 0) b.pendingSpawn++;
}

function doSwap(b, u, w, ev) {
  const f = b.field[u.side];
  const i = f.indexOf(u.key), j = f.indexOf(w.key);
  if (i < 0) return;
  if (j >= 0) { f[i] = w.key; f[j] = u.key; }
  else { if (!w.alive) return; f[i] = w.key; }
  w.skipTurn = b.turn;
  ev.push({ type: 'swap', side: u.side, out: u.key, in: w.key, from: i, to: j, field: [...f] });
}

function useItem(b, u, id, want, ev) {
  const it = b.db.it(id);
  if (!(b.bag[id] > 0)) { ev.push({ type: 'fail', actor: u.key, item: id, why: 'none' }); return; }
  const allies = b.roster.ally.map((k) => b.units[k]);
  let t = want ? b.units[want] : null;
  if (!t || t.side !== u.side) {
    if (it.rev) t = allies.find((x) => !x.alive);
    else if (it.cure) t = allies.find((x) => x.alive && x.status);
    else if (it.mp) t = allies.filter((x) => x.alive).sort((x, y) => x.mp / x.maxMp - y.mp / y.maxMp)[0];
    else t = allies.filter((x) => x.alive).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  }
  b.bag[id]--;
  ev.push({ type: 'item', actor: u.key, item: id, target: t?.key ?? null, left: b.bag[id] });
  if (it.escape) {
    if (b.kind !== 'wild') { ev.push({ type: 'run', actor: u.key, success: false, why: 'boss' }); return; }
    ev.push({ type: 'run', actor: u.key, success: true, why: 'item' });
    return finish(b, 'escape', ev);
  }
  if (it.scout) { b.varnish = true; ev.push({ type: 'varnish', mul: it.scout }); return; }
  if (it.hpAll) { for (const x of onField(b, u.side)) heal(b, x, it.hpAll, ev, 'item'); return; }
  if (!t) return;
  if (it.rev) {
    if (t.alive) return;
    t.alive = true; t.hp = Math.max(1, Math.floor(t.maxHp * it.rev));
    ev.push({ type: 'revive', target: t.key, hp: t.hp, maxHp: t.maxHp });
    return;
  }
  if (!t.alive) return;
  if (it.hp) heal(b, t, it.hp, ev, 'item');
  if (it.mp) { const bf = t.mp; t.mp = Math.min(t.maxMp, t.mp + it.mp); ev.push({ type: 'mp', target: t.key, amount: t.mp - bf, mp: t.mp }); }
  if (it.cure && t.status) { ev.push({ type: 'cure', target: t.key, status: t.status.id }); t.status = null; }
}

// ---------- スカウト・にげる ----------

function scoutBase(b, e) {
  const s = b.db.sp(e.sp);
  if (e.isBoss || s.boss || s.noScout) return 0;
  return s.scout || 0;
}

/** スカウトの成功率(DESIGN §4-6)。使う道具(ニス)は varnish */
export function scoutChance(b, e, { varnish = false } = {}) {
  const base = scoutBase(b, e);
  if (!base) return 0;
  const field = onField(b, 'ally');
  const same = field.filter((a) => a.mat === e.mat).length;
  const avgLv = field.length ? field.reduce((a, x) => a + x.mon.lv, 0) / field.length : 1;
  const lvMul = Math.min(1.3, Math.max(0.6, 1 + (avgLv - e.mon.lv) * 0.05));
  const item = varnish ? b.db.it('varnish').scout || 1.6 : 1;
  const sleep = e.status?.id === 'sleep' ? 1.3 : 1;
  let story = 1;
  for (const k of b.roster.ally) { const st = b.units[k].traits.storyteller; if (st && b.units[k].alive) story = Math.max(story, st.star >= 3 ? 1.3 : 1.15); }
  const grit = 1 + Math.min(0.3, 0.1 * b.scoutFails);
  const p = base * (1.5 - e.hp / e.maxHp) * (1 + 0.15 * same) * lvMul * item * sleep * story * grit;
  return Math.min(0.95, Math.max(0.02, p));
}

function doScout(b, u, want, ev, useVarnish) {
  let e = want && b.units[want];
  if (!e || e.side !== 'enemy' || !e.alive || rowOf(b, e) === 'bench') e = onField(b, 'enemy').sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  if (!e) return;
  if (useVarnish && (b.bag.varnish || 0) > 0 && !b.varnish) { b.bag.varnish--; b.varnish = true; ev.push({ type: 'item', actor: u.key, item: 'varnish', target: e.key, left: b.bag.varnish }); }
  const p = scoutChance(b, e, { varnish: b.varnish });
  b.varnish = false;
  if (p <= 0) { ev.push({ type: 'scout', actor: u.key, target: e.key, chance: 0, success: false, shakes: 0, why: 'boss' }); return; }
  const roll = b.rng.next();
  const success = roll < p;
  const shakes = success ? 3 : Math.min(2, Math.floor((p / Math.max(roll, 1e-9)) * 3));
  ev.push({ type: 'scout', actor: u.key, target: e.key, chance: round(p), success, shakes });
  if (!success) { b.scoutFails++; return; }
  e.mon.hp = e.hp; e.mon.mp = e.mp; e.mon.status = null;
  b.scouted = e;
  finish(b, 'scout', ev);
}

export function runChance(b) {
  if (b.kind !== 'wild') return 0;
  const al = onField(b, 'ally'), en = onField(b, 'enemy');
  if (al.some((a) => a.traits.escape)) return 1;
  const avg = (l) => l.reduce((a, x) => a + effStat(b, x, 'spd'), 0) / Math.max(1, l.length);
  const es = Math.max(1, avg(en));
  const p = Math.min(0.95, Math.max(0.2, 0.5 + (avg(al) - es) / (2 * es)));
  return Math.min(0.95, p + 0.15 * b.runFails);
}

function doRun(b, u, ev) {
  if (b.kind !== 'wild') { ev.push({ type: 'run', actor: u.key, success: false, why: 'boss' }); return; }
  const p = runChance(b);
  const ok = p >= 1 || b.rng.chance(p);
  ev.push({ type: 'run', actor: u.key, success: ok, chance: round(p), why: p >= 1 ? 'trait' : null });
  if (ok) finish(b, 'escape', ev); else b.runFails++;
}

// ---------- ターンの終わり ----------

function endTurn(b, ev) {
  const T = b.turn;
  for (const side of ['ally', 'enemy']) for (const u of onField(b, side)) {
    if (u.status?.id === 'burn') {
      const d = Math.max(1, Math.floor(u.maxHp / 12));
      u.hp = Math.max(0, u.hp - d);
      ev.push({ type: 'burnTick', target: u.key, amount: d, hp: u.hp });
      if (u.hp <= 0) { faint(b, u, ev); continue; }
    }
    if (u.traits.regen && u.hp < u.maxHp) heal(b, u, Math.max(1, Math.floor(u.maxHp / (u.traits.regen.star >= 3 ? 10 : 16))), ev, 'regen');
    if (u.status && --u.status.turns <= 0) { ev.push({ type: 'statusEnd', target: u.key, status: u.status.id }); u.status = null; }
    for (const [s, bf] of Object.entries(u.buffs)) if (--bf.turns <= 0) { delete u.buffs[s]; ev.push({ type: 'buffEnd', target: u.key, stat: s }); }
  }
  if (checkEnd(b, ev)) return;
  // トケイモリ: 3時・9時のターンの終わりに台が回り、前列と後列が入れかわる(後列→前列1、前列1→前列2、前列2→後列)
  if (b.rule === 'tokeimori' && (handFor(T) === 1 || handFor(T) === 3)) {
    for (const side of ['ally', 'enemy']) { const f = b.field[side]; b.field[side] = [f[2], f[0], f[1]]; }
    ev.push({ type: 'rotate', hand: handFor(T), field: { ally: [...b.field.ally], enemy: [...b.field.enemy] } });
  }
  // 控えから出す(味方)・後列を前へ
  const f = b.field.ally;
  for (let i = 0; i < 3; i++) {
    if (f[i] && b.units[f[i]].alive) continue;
    const next = b.roster.ally.find((k) => !f.includes(k) && b.units[k].alive);
    if (!next) continue;
    ev.push({ type: 'enter', side: 'ally', unit: next, slot: i, out: f[i] });
    f[i] = next;
  }
  for (const side of ['ally', 'enemy']) {
    const moved = collapse(b, side);
    if (moved) ev.push({ type: 'advance', side, unit: moved, field: [...b.field[side]] });
  }
}

// 前列が2体ともいないとき、後列が前に出る
function collapse(b, side) {
  const f = b.field[side];
  const ok = (k) => k && b.units[k].alive;
  if (!ok(f[0]) && !ok(f[1]) && ok(f[2])) { const k = f[2]; f[2] = f[0]; f[0] = k; return k; }
  return null;
}

function checkEnd(b, ev) {
  if (b.over) return true;
  const alive = (side) => b.roster[side].some((k) => b.units[k].alive);
  const bossDown = b.kind === 'boss' && b.roster.enemy.some((k) => b.units[k].isBoss && !b.units[k].alive);
  if (!alive('ally')) { finish(b, 'lose', ev); return true; }
  if (!alive('enemy') || bossDown) {
    if (bossDown) for (const k of b.roster.enemy) if (b.units[k].alive) { ev.push({ type: 'flee', target: k }); }
    finish(b, 'win', ev); return true;
  }
  return false;
}

function finish(b, outcome, ev) {
  if (b.over) return;
  b.over = true;
  // 味方の HP・MP・状態を個体にもどす(ねむりだけ治る)
  for (const k of b.roster.ally) {
    const u = b.units[k];
    u.mon.hp = u.hp; u.mon.mp = u.mp;
    u.mon.status = u.status && u.status.id !== 'sleep' ? u.status.id : null;
  }
  const defeated = b.roster.enemy.map((k) => b.units[k]).filter((u) => !u.alive);
  const res = { outcome, turns: b.turn, defeated: defeated.map((u) => ({ sp: u.sp, lv: u.mon.lv })), xp: [], gold: 0 };
  if (outcome === 'win' || outcome === 'scout') {
    const total = battleXp(b.db, defeated.map((u) => u.mon));
    for (const k of b.roster.ally) {
      const u = b.units[k];
      const share = !u.alive ? 0 : rowOf(b, u) === 'bench' ? 0.5 : 1;
      const amount = Math.floor(total * share * xpMulOf(u.mon));
      res.xp.push({ unit: k, idx: b.roster.ally.indexOf(k), amount });
    }
    let goldMul = 1;
    for (const k of b.roster.ally) { const g = b.units[k].traits.goldfind; if (g) goldMul = Math.max(goldMul, g.star >= 3 ? 1.4 : 1.2); }
    res.gold = Math.floor(battleGold(b.db, defeated.map((u) => u.mon)) * goldMul);
  }
  if (outcome === 'scout') res.scouted = b.scouted.mon;
  b.result = res;
  ev.push({ type: 'end', outcome, xp: res.xp, gold: res.gold, scouted: res.scouted ? b.scouted.key : null });
}

// デバッグ用: 片方を全部たおして決着させる('win' | 'lose')。出来事の列を返す
export function forceFinish(b, outcome = 'win') {
  const ev = [];
  if (b.over) return ev;
  const side = outcome === 'win' ? 'enemy' : 'ally';
  for (const k of b.roster[side]) { const u = b.units[k]; if (u.alive) { u.hp = 0; faint(b, u, ev); } }
  b.pendingSpawn = 0;
  checkEnd(b, ev);
  b.log.push(...ev);
  return ev;
}

// ---------- 自動の行動(敵の AI / シミュレーター / おまかせ) ----------

export function autoAction(b, key) {
  const u = b.units[key];
  const row = rowOf(b, u);
  const opts = usableSkills(b.db, u.mon).map((id) => b.db.sk(id))
    .filter((sk) => (sk.mp || 0) <= u.mp && !(sk.range === 'melee' && row === 'back'));
  const mates = onField(b, u.side);
  const foes = onField(b, other(u.side));
  // 回復
  const weak = mates.filter((m) => m.hp / m.maxHp < 0.4).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
  if (weak.length) {
    const hs = opts.filter((s) => s.kind === 'heal');
    if (hs.length && b.rng.chance(0.75)) {
      const all = hs.find((s) => s.target === 'allies');
      if (all && weak.length >= 2) return { cmd: 'skill', skill: all.id };
      return { cmd: 'skill', skill: hs[0].id, target: weak[0].key };
    }
  }
  const sick = mates.find((m) => m.status && m.status.id !== 'sleep');
  const cure = opts.find((s) => s.kind === 'cure');
  if (sick && cure && b.rng.chance(0.5)) return { cmd: 'skill', skill: cure.id, target: sick.key };
  // かばう(弱った後列以外の仲間を)
  const cov = opts.find((s) => s.kind === 'guard');
  if (cov && weak.length && weak[0] !== u && u.hp / u.maxHp > 0.6 && b.rng.chance(0.4)) return { cmd: 'skill', skill: cov.id, target: weak[0].key };
  // ばふ・でばふ・状態(ときどき)
  const sup = opts.filter((s) => {
    if (s.kind === 'buff') {
      if (s.stat === 'shield') return true;
      const t = s.target === 'self' ? u : null;
      return !t || !t.buffs[s.stat];
    }
    if (s.kind === 'status') return foes.some((f) => !f.status && !statusImmune(b, f, s.status));
    return s.kind === 'debuff';
  });
  if (sup.length && b.rng.chance(b.turn <= 2 ? 0.3 : 0.15)) {
    const s = b.rng.pick(sup);
    const tg = s.kind === 'status' ? foes.find((f) => !f.status && !statusImmune(b, f, s.status))?.key : undefined;
    return { cmd: 'skill', skill: s.id, target: tg };
  }
  // 攻撃: 期待ダメージがいちばん大きいもの(7割)/ ほかからランダム(3割)
  const atk = [...opts.filter((s) => s.kind === 'phys' || s.kind === 'mag')];
  if (row === 'front') atk.push(ATTACK);
  const cand = [];
  for (const s of atk) {
    const tg = validTargets(b, key, s.id).map((k) => b.units[k]);
    if (!tg.length) continue;
    const score = (t) => {
      const { dmg } = calcDamage(b, u, t, s, { crit: false, roll: 1 });
      return dmg * hitChance(b, u, t, s) * (s.target === 'all' ? tg.length : 1) * (dmg >= t.hp ? 1.5 : 1) - (s.mp || 0) * 0.3;
    };
    for (const t of s.target === 'all' ? [tg[0]] : tg) cand.push({ s, t, v: score(t) });
  }
  if (cand.length) {
    cand.sort((x, y) => y.v - x.v);
    const c = b.rng.chance(0.7) ? cand[0] : b.rng.pick(cand);
    return c.s === ATTACK ? { cmd: 'attack', target: c.t.key } : { cmd: 'skill', skill: c.s.id, target: c.t.key };
  }
  // 後列で何もできない → 前列の弱った仲間と入れかわる
  if (row === 'back') {
    const f = b.field[u.side].slice(0, 2).map((k) => k && b.units[k]).find((x) => x && x.alive);
    if (f && u.side === 'ally' && u.hp / u.maxHp > 0.5) return { cmd: 'swap', with: f.key };
  }
  return { cmd: 'wait' };
}

// 両方とも自動で最後まで(シミュレーター・テスト用)。maxTurns をこえたら 'timeout'
export function runAuto(b, maxTurns = 60) {
  while (!b.over && b.turn < maxTurns) submit(b, {});
  if (!b.over) { b.over = true; b.result = { outcome: 'timeout', turns: b.turn, xp: [], gold: 0, defeated: [] }; }
  return b.result;
}

// ---------- 結果をセーブに入れる ----------

/**
 * 戦闘の結果をセーブ(§7の形)に入れる。出来事の列を返す(レベルアップ・覚えるわざ・お金・負け)
 *   勝ち/スカウト: 経験値・お金・図鑑(seen/caught)・スカウトした子は手持ち or 預かりへ
 *   負け: お金が半分、最後の宿屋で目覚める(全回復)
 * party の個体は battle に渡したもの(save.monsters[uid] の同じオブジェクト)を書きかえる前提。
 */
export function applyBattleResult(db, save, b, addCaught = defaultAddCaught) {
  const r = b.result;
  const ev = [];
  save.stats = save.stats || {};
  save.stats.battles = (save.stats.battles || 0) + 1;
  save.dex = save.dex || { seen: {}, caught: {}, parts: {} };
  for (const k of b.roster.enemy) { const sp = b.units[k].sp; save.dex.seen[sp] = (save.dex.seen[sp] || 0) + 1; }
  if (r.outcome === 'win' || r.outcome === 'scout') {
    for (const x of r.xp) {
      const mon = b.units[x.unit].mon;
      if (x.amount > 0) for (const e of gainXp(db, mon, x.amount)) ev.push({ ...e, unit: x.unit });
    }
    save.gold = (save.gold || 0) + r.gold;
    ev.push({ type: 'gold', amount: r.gold, total: save.gold });
  }
  if (r.outcome === 'scout') {
    save.stats.scouts = (save.stats.scouts || 0) + 1;
    const mon = r.scouted; delete mon.isBoss;
    const where = addCaught(save, mon);
    ev.push({ type: 'caught', sp: mon.sp, uid: mon.uid ?? null, where, shiny: !!mon.shiny });
  }
  if (r.outcome === 'lose') {
    const lost = Math.floor((save.gold || 0) / 2);
    save.gold = (save.gold || 0) - lost;
    save.stats.defeats = (save.stats.defeats || 0) + 1;
    const inn = save.lastInn || 'village';
    if (save.player) save.player.area = inn;
    for (const uid of save.party || []) if (save.monsters?.[uid]) healFull(db, save.monsters[uid]);
    ev.push({ type: 'defeat', goldLost: lost, gold: save.gold, wakeAt: inn });
  }
  return ev;
}
