// 魔物の人形(シンボルエンカウント)。three に依存しない。field.js から使う。
//   出現の表 area.spawns の1行 = 1つの「群れの決まり」。決まった数 n の人形を、範囲の中に出して歩き回らせる。
//   cond: evening(夕方だけ)/ shadow(今の影の上だけ)/ light(光の当たる地面だけ)/ beat(振り子の拍で歩く、動きは同じ)
//   disc: 回転台の上(台といっしょに回る)
//   レア(area.rares)は光る台座で眠っている(動かない)。倒す・スカウトするともう出ない(areaState.rares[id] = true)
import * as G from '../core/grid.js';

export const RESPAWN_MS = 90000; // 倒した・スカウトした人形が、また出るまで(実時間)
export const WANDER_MS = [700, 1500];

let uidN = 0;

function pickWeighted(rng, list) {
  const tot = list.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * tot;
  for (const [id, w] of list) { if ((r -= w) < 0) return id; }
  return list[list.length - 1][0];
}

// その決まりが今ひらいているか(時刻)
// 群れの数: シンボル1体にふれると 1〜3 体が出る。pack = [1体, 2体, 3体] の割合(docs/BALANCE.md §5)。なければ1体
export function rollPack(rng, pack) {
  if (!pack) return 1;
  let r = rng.next() * pack.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pack.length; i++) if ((r -= pack[i]) < 0) return i + 1;
  return 1;
}

export function ruleActive(rule, tod) {
  if (rule.cond === 'evening') return tod === 'evening';
  return true;
}

// 人形が立てるマスか(決まりの範囲・条件)
export function ruleCellOk(f, rule, l, x, z) {
  if (rule.l != null && l !== rule.l) return false;
  if (rule.disc) {
    const d = (f.area.discs || []).find((q) => q.id === rule.disc);
    if (!d || !G.inDisc(d, x, z)) return false;
  } else if (rule.x0 != null && (x < rule.x0 || x > rule.x1 || z < rule.z0 || z > rule.z1)) return false;
  const c = f.cellAt(l, x, z);
  if (!G.walkable(c)) return false;
  if (c.objs.some((o) => G.STAND_ON.has(o.type))) return false;
  const W = f.area.levels[l].w;
  const inShadow = f.area.levels[l].t[z * W + x] === 'c' || G.shadowSet(f.view, f.gs).has(l * 1e6 + z * W + x);
  if (rule.cond === 'shadow' && !inShadow) return false;
  if (rule.cond === 'light' && inShadow) return false;
  return true;
}

export function makePuppet(f, rule, ri) {
  const cells = [];
  const L = f.area.levels[rule.l ?? 0];
  const l = rule.l ?? 0;
  const x0 = rule.disc ? 0 : rule.x0 ?? 0, x1 = rule.disc ? L.w - 1 : rule.x1 ?? L.w - 1;
  const z0 = rule.disc ? 0 : rule.z0 ?? 0, z1 = rule.disc ? L.d - 1 : rule.z1 ?? L.d - 1;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!ruleCellOk(f, rule, l, x, z)) continue;
    if (f.player.l === l && Math.abs(f.player.x - x) + Math.abs(f.player.z - z) < 5) continue;
    if (f.puppetAt(l, x, z)) continue;
    cells.push([x, z]);
  }
  if (!cells.length) return null;
  const [x, z] = f.rng.pick(cells);
  return {
    id: 'pp' + (++uidN), rule: ri, sp: pickWeighted(f.rng, rule.species), lv: f.rng.int(rule.lv[0], rule.lv[1]),
    l, x, z, dir: f.rng.int(0, 3), wait: f.rng.int(...WANDER_MS), stun: 0, rare: false, pack: rule.pack,
  };
}

// 決まりごとの数に足りない分を出す
export function fillSpawns(f, ev) {
  if (!f.opts.monsters) return;
  const tod = f.timeOfDay();
  (f.area.spawns || []).forEach((rule, ri) => {
    if (!ruleActive(rule, tod)) return;
    const have = f.puppets.filter((p) => p.rule === ri).length;
    const cool = f.cooldown.filter((c) => c.rule === ri).length;
    for (let i = have + cool; i < (rule.n || 1); i++) {
      const p = makePuppet(f, rule, ri);
      if (!p) break;
      f.puppets.push(p);
      ev.push({ t: 'spawn', puppet: { ...p } });
    }
  });
  for (const r of f.area.rares || []) {
    if (f.state.rares[r.id] || f.puppets.some((p) => p.rareId === r.id)) continue;
    const sp = Array.isArray(r.species) ? f.rng.pick(r.species) : r.species;
    const p = { id: 'rare_' + r.id, rareId: r.id, rule: -1, sp, lv: r.lv, l: r.l, x: r.x, z: r.z, dir: 1, wait: Infinity, stun: 0, rare: true, asleep: true, shinyRate: r.shinyRate };
    f.puppets.push(p);
    ev.push({ t: 'spawn', puppet: { ...p } });
  }
}

// 条件に合わなくなった人形を消す(時刻が変わった・ランプが変わった)
export function pruneSpawns(f, ev) {
  const tod = f.timeOfDay();
  f.puppets = f.puppets.filter((p) => {
    if (p.rare) return true;
    const rule = f.area.spawns[p.rule];
    const ok = ruleActive(rule, tod) && (rule.disc || ruleCellOk(f, rule, p.l, p.x, p.z));
    if (!ok) ev.push({ t: 'despawn', id: p.id, why: 'cond' });
    return ok;
  });
}

// 1体ぶん歩かせる。主人公に触れたら戦闘の出来事を返す
export function wander(f, p, dt, ev) {
  if (p.rare) return null;
  if (p.stun > 0) { p.stun -= dt; return null; }
  p.wait -= dt;
  if (p.wait > 0) return null;
  p.wait = f.rng.int(...WANDER_MS);
  const d = f.rng.int(0, 3);
  p.dir = d;
  const [dx, dz] = G.DIRS[d];
  const x = p.x + dx, z = p.z + dz;
  const rule = f.area.spawns[p.rule];
  if (f.player.l === p.l && f.player.x === x && f.player.z === z) {
    // 主人公の後ろから触れた → 敵の先制
    const first = f.player.dir === d ? 'enemy' : null;
    return f.startEncounter(p, first, ev);
  }
  const a = f.cellAt(p.l, p.x, p.z), b = f.cellAt(p.l, x, z);
  if (!a || !G.canStep(a, b) || !ruleCellOk(f, rule, p.l, x, z) || f.puppetAt(p.l, x, z)) { ev.push({ t: 'puppetTurn', id: p.id, dir: d }); return null; }
  ev.push({ t: 'puppetMove', id: p.id, from: [p.l, p.x, p.z], to: [p.l, x, z], dir: d });
  p.x = x; p.z = z;
  return null;
}
