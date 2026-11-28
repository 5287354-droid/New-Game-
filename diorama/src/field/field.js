// フィールドの動き(three に依存しない。node でテストできる)。描画と UI は、返ってくる「出来事の列」をアニメにする。
//
//   const f = createField(area, { state: save.areas[area.id], flags: save.flags, abilities: save.abilities,
//                                 clock: save.clock, rng, beat: (ms) => 拍の番号, monsters: true, entry: 'south' });
//   f.hold(dir, run) / f.release()      押し続けでその向きへ歩く(dir: 0 東 +x / 1 南 +z / 2 西 -x / 3 北 -z)
//   f.walkTo([l,x,z]) / f.tapObject(id) タップした所まで自動で歩く(物なら、となりまで歩いて調べる)
//   f.interact() / f.use(id)            目の前(乗る物は足もと)の物を調べる・話す・動かす
//   f.update(ms)                        時間を進める(歩く・人形・振り子)。出来事の配列を返す
//   f.setClock(clock)                   時刻(住人の昼・夜の位置、夕方の魔物)
//   f.battleEnd(puppetId, 'win'|'scout'|'flee'|'lose')
//   f.leave()                           エリアを出る → セーブに入れる areaState(置いていない物は戻る)
// どの関数も「出来事の配列」を返す(形は docs/INTERFACES.md の field の節)。
import * as G from '../core/grid.js';
import { timeOfDay } from '../core/story.js';
import { toRng } from '../core/rng.js';
import { fillSpawns, pruneSpawns, wander, rollPack } from './monsters.js';

export const STEP_MS = { walk: 220, run: 130 };
export const DIR_NAMES = ['east', 'south', 'west', 'north'];
// 拍の仮の関数(120 BPM)。音響班の本物ができたら opts.beat で差しかえる
export const defaultBeat = (ms) => Math.floor(ms / 500);
// 自動で歩くとき、通り道にしないマス(乗ると何かが起きる物)。行き先ならよい
const NO_THROUGH = new Set(['exit', 'lampStation']);

const key = (l, x, z) => l + ':' + x + ':' + z;
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function newAreaState(area) {
  return { gs: G.newGimmickState(area), opened: [], rares: {} };
}

export function createField(area, opts = {}) {
  const f = new Field(area, opts);
  return f;
}

export class Field {
  constructor(area, opts = {}) {
    this.area = area;
    this.opts = { monsters: true, ...opts };
    this.rng = toRng(opts.rng ?? 1);
    this.flags = opts.flags || {};
    this.abilities = opts.abilities || {};
    this.beatFn = opts.beat || defaultBeat;
    this.state = opts.state ? structuredClone(opts.state) : newAreaState(area);
    this.state.opened = this.state.opened || [];
    this.state.rares = this.state.rares || {};
    this.state.gs = G.resetLooseItems(this.state.gs || G.newGimmickState(area));
    this.gs = this.state.gs;
    this.clock = opts.clock ?? 360;
    this.time = 0;
    this.puppets = [];
    this.cooldown = []; // { rule, until }
    this.path = null;
    this.held = null; // 押し続けている向き { dir, run }
    this.moveAcc = 0;
    this.busy = null; // 'battle' | 'left' | null(止まっているあいだは動かない)
    this.tod = timeOfDay(this.clock);
    this.buildView();
    const ent = opts.at || area.entries[opts.entry || area.entry];
    this.player = { l: ent.l, x: ent.x, z: ent.z, dir: opts.dir ?? 3, running: false };
    this.lastSafe = [ent.l, ent.x, ent.z];
    this.prev = [ent.l, ent.x, ent.z];
    this.initEvents = [];
    fillSpawns(this, this.initEvents);
  }

  // 住人を今の時間帯の位置に置いた「見え方」。grid の関数にはこれを渡す
  buildView() {
    const night = this.tod === 'night';
    const objects = this.area.objects.map((o) => (o.type === 'npc' && night && o.night ? { ...o, l: o.night.l ?? o.l, x: o.night.x, z: o.night.z, at: 'night' } : o));
    this.view = { ...this.area, objects, _flags: this.flags };
    delete this.view._idx; delete this.view._shadow;
  }

  timeOfDay() { return this.tod; }
  beat() { return this.beatFn(this.time); }
  cellAt(l, x, z, beat) { return G.cell(this.view, this.gs, l, x, z, beat == null ? undefined : { beat }); }
  puppetAt(l, x, z) { return this.puppets.find((p) => p.l === l && p.x === x && p.z === z); }
  pos() { return [this.player.l, this.player.x, this.player.z]; }
  objById(id) { return this.view.objects.find((o) => o.id === id); }

  // ------------------------------------------------------------ 歩く
  hold(dir, run = false) { this.held = { dir, run }; this.path = null; return []; }
  release() { this.held = null; return []; }

  // 経路(自動で歩く)。歩くのに 0手でつながるマスだけ。出口・ランプ台は行き先のときだけ通る
  findPath(goal) {
    const start = this.pos();
    const goalK = key(...goal);
    const prev = new Map([[key(...start), null]]);
    const q = [start];
    for (let i = 0; i < q.length && i < 60000; i++) {
      const cur = q[i];
      if (key(...cur) === goalK) {
        const out = [];
        for (let c = cur; c; c = prev.get(key(...c))) out.push(c);
        return out.reverse().slice(1);
      }
      if (i > 0 && !same(cur, goal) && this.cellAt(...cur).objs.some((o) => NO_THROUGH.has(o.type))) continue;
      for (const nb of G.neighbors(this.view, this.gs, ...cur)) {
        const k = key(...nb);
        if (!prev.has(k)) { prev.set(k, cur); q.push(nb); }
      }
    }
    return null;
  }

  walkTo(goal, then = null) {
    const p = this.findPath(goal);
    if (!p) return [{ t: 'noPath', to: goal }];
    this.held = null;
    this.path = { nodes: p, then, goal };
    return [{ t: 'walkStart', to: goal, steps: p.length }];
  }

  // 物をタップ: いちばん近い「調べられるマス」まで歩いて、着いたら調べる
  tapObject(id) {
    const o = this.objById(id);
    if (!o) return [{ t: 'noPath', id }];
    const cells = G.interactCells(this.view, this.gs, o).filter((c) => G.walkable(this.cellAt(...c)));
    if (cells.some((c) => same(c, this.pos()))) return this.use(id);
    let best = null;
    for (const c of cells) { const p = this.findPath(c); if (p && (!best || p.length < best.p.length)) best = { c, p }; }
    if (!best) return [{ t: 'noPath', id }];
    this.held = null;
    this.path = { nodes: best.p, then: id, goal: best.c };
    return [{ t: 'walkStart', to: best.c, steps: best.p.length, then: id }];
  }

  // 1マス進む。ev に出来事を足す。進めたら true
  step(dir, run, ev, auto = false) {
    const p = this.player;
    if (p.dir !== dir) { p.dir = dir; ev.push({ t: 'turn', dir }); }
    const [dx, dz] = G.DIRS[dir];
    const to = [p.l, p.x + dx, p.z + dz];
    // 魔物の人形に触れた
    const pp = this.puppetAt(...to);
    if (pp && pp.stun <= 0) { this.startEncounter(pp, dir === pp.dir ? 'player' : null, ev); return false; }
    const a = this.cellAt(...this.pos()), b = this.cellAt(...to, this.beat());
    if (!b) { ev.push({ t: 'bump', at: to }); return false; }
    // 光の当たる谷: 踏みこむと落ちて、直前の足場にもどる(痛みなし)
    if (b.t === 'C' && Math.abs(a.h - b.h) <= 1) {
      ev.push({ t: 'move', from: this.pos(), to, dir, run, dur: run ? STEP_MS.run : STEP_MS.walk });
      ev.push({ t: 'fall', at: to, back: this.pos() });
      return false;
    }
    if (!G.canStep(a, b)) {
      const blockedByPendulum = G.canStep(a, this.cellAt(...to)); // 拍なしなら通れる = 振り子がふさいでいる
      if (blockedByPendulum && auto) return 'wait';
      ev.push({ t: 'bump', at: to, why: blockedByPendulum ? 'pendulum' : 'blocked' });
      return false;
    }
    const from = this.pos();
    this.prev = from;
    p.x = to[1]; p.z = to[2];
    p.running = run;
    ev.push({ t: 'move', from, to, dir, run, dur: run ? STEP_MS.run : STEP_MS.walk, h: b.h, ladder: a.t === 'L' || b.t === 'L' });
    this.lastSafe = this.pos();
    this.afterArrive(ev);
    return true;
  }

  // 新しいマスに着いたとき: 階段・出口・人形
  afterArrive(ev) {
    const here = this.pos();
    const st = G.stairsAt(this.view, ...here);
    if (st && st.to) {
      const to = [st.to.l, st.to.x, st.to.z];
      this.player.l = to[0]; this.player.x = to[1]; this.player.z = to[2];
      ev.push({ t: 'stairs', id: st.id, from: here, to, up: !!st.up });
      this.lastSafe = to;
      return;
    }
    const ex = this.cellAt(...here).objs.find((o) => o.type === 'exit');
    if (ex) {
      if (!G.exitOpen(this.view, this.gs, ex, this.flags)) { ev.push({ t: 'exitClosed', id: ex.id, needFlag: ex.needFlag }); this.pushBack(ev, 'exitClosed'); return; }
      if (G.mustDropBeforeExit(this.gs)) { ev.push({ t: 'say', key: 'dropFirst', item: this.gs.held }); this.pushBack(ev, 'holding'); return; }
      this.path = null; this.held = null;
      this.busy = 'left';
      ev.push({ t: 'exit', id: ex.id, to: ex.to, entry: ex.entry, state: this.leaveState() });
      return;
    }
    if (this.cellAt(...here).objs.some((o) => o.type === 'lampStation') && this.path && this.path.nodes.length) this.stop(ev, 'gimmick');
  }

  pushBack(ev, why) {
    const from = this.pos();
    let to = this.prev;
    if (same(to, from) || !G.walkable(this.cellAt(...to, this.beat()))) {
      // 直前のマスが使えないときは、歩ける となり
      to = G.DIRS.map(([dx, dz]) => [from[0], from[1] + dx, from[2] + dz]).find((c) => G.walkable(this.cellAt(...c, this.beat())) && G.canStep(this.cellAt(...from), this.cellAt(...c))) || to;
    }
    this.player.l = to[0]; this.player.x = to[1]; this.player.z = to[2];
    this.lastSafe = to;
    this.path = null;
    ev.push({ t: 'pushed', from, to, why });
  }

  stop(ev, why) {
    if (this.path) ev.push({ t: 'stop', why, at: this.pos() });
    this.path = null;
    this.held = null;
  }

  // 足もとが歩けなくなっていたら(ランプ・回転・振り子)、直前の足場へ
  checkFooting(ev) {
    const c = this.cellAt(...this.pos(), this.beat());
    if (G.walkable(c)) return;
    if (c && c.t === 'C') { ev.push({ t: 'fall', at: this.pos(), back: this.lastSafe }); this.setPos(this.lastSafe); return; }
    if (c && c.block && !this.cellAt(...this.pos()).block) { this.pushBack(ev, 'pendulum'); return; }
  }
  setPos(p) { this.player.l = p[0]; this.player.x = p[1]; this.player.z = p[2]; }

  // ------------------------------------------------------------ 時間
  update(ms) {
    const ev = this.initEvents.splice(0);
    if (this.busy) return ev;
    this.time += ms;
    // 振り子に押し戻される
    this.checkFooting(ev);
    // 主人公の移動
    this.moveAcc += ms;
    const stepMs = () => ((this.held ? this.held.run : this.player.running) ? STEP_MS.run : STEP_MS.walk);
    let guard = 0;
    while (!this.busy && this.moveAcc >= stepMs() && guard++ < 64) {
      if (this.path) {
        if (!this.path.nodes.length) { this.arrive(ev); break; }
        const nx = this.path.nodes[0];
        const cur = this.pos();
        if (same(nx, cur)) { this.path.nodes.shift(); continue; }
        const d = G.DIRS.findIndex(([dx, dz]) => cur[0] === nx[0] && cur[1] + dx === nx[1] && cur[2] + dz === nx[2]);
        if (d < 0) { const re = this.findPath(this.path.goal); if (!re) { this.stop(ev, 'lost'); break; } this.path.nodes = re; continue; }
        this.moveAcc -= stepMs();
        const r = this.step(d, this.player.running, ev, true);
        if (r === 'wait') { ev.push({ t: 'wait', why: 'pendulum' }); break; }
        if (r === true) this.path && this.path.nodes.shift();
        else { this.stop(ev, 'blocked'); break; }
        if (this.path && !this.path.nodes.length) { this.arrive(ev); break; }
      } else if (this.held) {
        this.moveAcc -= stepMs();
        this.step(this.held.dir, this.held.run, ev);
      } else { this.moveAcc = 0; break; }
    }
    // 人形
    if (!this.busy) for (const p of this.puppets.slice()) { if (this.busy) break; wander(this, p, ms, ev); }
    this.cooldown = this.cooldown.filter((c) => c.until > this.time);
    if (!this.busy) fillSpawns(this, ev);
    return ev;
  }

  arrive(ev) {
    const then = this.path && this.path.then;
    this.path = null;
    ev.push({ t: 'arrive', at: this.pos() });
    if (then) ev.push(...this.use(then));
  }

  setClock(clock) {
    this.clock = clock;
    const tod = timeOfDay(clock);
    if (tod === this.tod) return [];
    const ev = [{ t: 'period', tod }];
    const before = new Map(this.view.objects.filter((o) => o.type === 'npc').map((o) => [o.id, [o.l, o.x, o.z]]));
    this.tod = tod;
    this.buildView();
    for (const o of this.view.objects) if (o.type === 'npc' && !same(before.get(o.id), [o.l, o.x, o.z])) ev.push({ t: 'npcMove', id: o.id, from: before.get(o.id), to: [o.l, o.x, o.z] });
    pruneSpawns(this, ev);
    fillSpawns(this, ev);
    return ev;
  }

  // ------------------------------------------------------------ 調べる
  frontCell() { const [dx, dz] = G.DIRS[this.player.dir]; return [this.player.l, this.player.x + dx, this.player.z + dz]; }

  // 目の前の物(なければ足もとの乗る物)
  target() {
    const front = this.cellAt(...this.frontCell());
    const o = front && front.objs.find((q) => !G.STAND_ON.has(q.type) && q.type !== 'tree' && q.type !== 'arch');
    if (o) return o;
    const under = this.cellAt(...this.pos()).objs.find((q) => G.STAND_ON.has(q.type));
    if (under) return under;
    // くぼみ(通れる種類)は目の前のマスそのものに物として入っている
    return null;
  }

  interact() {
    if (this.busy) return [];
    const o = this.target();
    if (!o) return [{ t: 'nothing' }];
    return this.doInteract(o);
  }

  // 物を指定して調べる(となりにいなければ何もしない)。向きもそちらへ
  use(id) {
    const o = this.objById(id);
    if (!o) return [{ t: 'nothing', id }];
    const cells = G.interactCells(this.view, this.gs, o);
    if (!cells.some((c) => same(c, this.pos()))) return [{ t: 'tooFar', id }];
    const ev = [];
    if (!G.STAND_ON.has(o.type)) {
      const [ox, oz] = G.objPos(this.view, this.gs, o);
      const d = G.DIRS.findIndex(([dx, dz]) => this.player.x + dx === ox && this.player.z + dz === oz);
      if (d >= 0 && d !== this.player.dir) { this.player.dir = d; ev.push({ t: 'turn', dir: d }); }
    }
    return ev.concat(this.doInteract(o));
  }

  doInteract(o) {
    const ev = [];
    this.stop(ev, 'interact');
    if (G.GIMMICK_TYPES.has(o.type)) return ev.concat(this.gimmick(o));
    const opened = this.state.opened;
    switch (o.type) {
      case 'chest':
        if (opened.includes(o.id)) ev.push({ t: 'chestEmpty', id: o.id });
        else { opened.push(o.id); ev.push({ t: 'chest', id: o.id, item: o.item, qty: o.qty || 1, book: o.book }); }
        break;
      case 'shelf':
        if (o.item && !opened.includes(o.id)) { opened.push(o.id); ev.push({ t: 'chest', id: o.id, item: o.item, qty: o.qty || 1, flag: o.flag, shelf: true, text: o.text }); }
        else ev.push({ t: 'read', id: o.id, text: o.text, book: o.book });
        break;
      case 'npc': {
        const [ox, oz] = [o.x, o.z];
        const face = G.DIRS.findIndex(([dx, dz]) => ox + dx === this.player.x && oz + dz === this.player.z);
        ev.push({ t: 'talk', id: o.id, name: o.name, role: o.role, lines: o.talk || [], face });
        break;
      }
      case 'sign': case 'statue': case 'post': case 'bed': case 'counter':
        ev.push({ t: 'read', id: o.id, text: o.text, role: o.role });
        break;
      case 'boss':
        if (this.flags[o.flag]) ev.push({ t: 'read', id: o.id, text: 'beaten' });
        else { this.busy = 'battle'; ev.push({ t: 'boss', id: o.id, species: o.species, lv: o.lv, flag: o.flag }); }
        break;
      case 'goal': ev.push({ t: 'goal', id: o.id, flag: o.flag, text: o.text }); break;
      case 'clockface':
        if (o.needFlag && !this.flags[o.needFlag]) ev.push({ t: 'read', id: o.id, text: o.text, locked: true });
        else ev.push({ t: 'goal', id: o.id, flag: o.flag, text: o.text });
        break;
      case 'stairs': case 'exit': break;
      default: ev.push({ t: 'nothing', id: o.id });
    }
    return ev;
  }

  // ギミックを動かす(grid.applyInteract)。回る台の上の人形もいっしょに回す
  gimmick(o) {
    const ev = [];
    const before = this.gs;
    const r = G.applyInteract(this.view, this.gs, o, this.pos(), this.abilities);
    if (!r.ok) { ev.push({ t: 'gimmickFail', id: o.id, msg: r.msg }); return ev; }
    this.gs = this.state.gs = r.gs;
    const carried = !same(r.player, this.pos());
    if (carried) this.setPos(r.player);
    switch (o.type) {
      case 'handle': {
        const d = this.area.discs.find((q) => q.id === o.disc);
        const pups = this.rotatePuppets(d, 1, (p) => p.l === d.l && G.inDisc(d, p.x, p.z));
        ev.push({ t: 'rotate', kind: 'disc', id: d.id, to: r.gs.disc[d.id], by: o.id, player: carried, puppets: pups });
        break;
      }
      case 'dial': {
        for (const rg of this.area.rings || []) {
          const n = (r.gs.ring[rg.id] - before.ring[rg.id] + 4) % 4;
          if (!n) continue;
          const pups = this.rotatePuppets(rg, n, (p) => p.l === rg.l && G.inRing(rg, p.x, p.z));
          ev.push({ t: 'rotate', kind: 'ring', id: rg.id, to: r.gs.ring[rg.id], by: o.id, player: carried && this.player.l === rg.l, puppets: pups, linked: rg.id !== o.ring });
        }
        for (const k of Object.keys(r.gs.gp)) if (r.gs.gp[k] !== before.gp[k]) ev.push({ t: 'gearHalf', socket: k, gp: r.gs.gp[k] });
        break;
      }
      case 'lampStation':
        ev.push({ t: 'lamp', id: o.id, lamp: r.gs.lamp, shadow: [...G.shadowSet(this.view, r.gs)] });
        pruneSpawns(this, ev);
        break;
      case 'item':
        ev.push({ t: 'pick', item: o.item, from: o.id });
        break;
      case 'socket':
        if (before.held) ev.push({ t: 'place', item: before.held, socket: o.id, flag: r.flag });
        else ev.push({ t: 'pick', item: r.gs.held, from: o.id });
        if (r.flag) ev.push({ t: 'flag', flag: r.flag });
        break;
    }
    this.checkFooting(ev);
    return ev;
  }

  rotatePuppets(m, n, inside) {
    const out = [];
    for (const p of this.puppets) {
      if (!inside(p)) continue;
      const [dx, dz] = G.rot(p.x - m.cx, p.z - m.cz, n);
      const from = [p.l, p.x, p.z];
      p.x = m.cx + dx; p.z = m.cz + dz; p.dir = (p.dir + n) % 4;
      out.push({ id: p.id, from, to: [p.l, p.x, p.z] });
    }
    return out;
  }

  // ------------------------------------------------------------ 戦闘
  startEncounter(p, first, ev) {
    if (this.busy) return null;
    this.busy = 'battle';
    this.path = null; this.held = null;
    const e = { t: 'encounter', puppet: p.id, species: p.sp, lv: p.lv, count: p.rare ? 1 : rollPack(this.rng, p.pack), rule: p.rule, first, rare: !!p.rare, rareId: p.rareId, shinyRate: p.shinyRate };
    ev.push(e);
    return e;
  }

  // 戦闘のあと。win/scout: 人形を消す(しばらく出ない。レアはもう出ない)/ flee: 少しのあいだ触れない / lose: ゲームが宿屋へ
  battleEnd(puppetId, result) {
    const ev = [];
    this.busy = null;
    const i = this.puppets.findIndex((p) => p.id === puppetId);
    if (i >= 0) {
      const p = this.puppets[i];
      if (result === 'win' || result === 'scout') {
        this.puppets.splice(i, 1);
        if (p.rare) this.state.rares[p.rareId] = true;
        else this.cooldown.push({ rule: p.rule, until: this.time + (this.opts.respawnMs ?? 90000) });
        ev.push({ t: 'despawn', id: p.id, why: result });
      } else if (result === 'flee') { p.stun = 2000; p.wait = 2000; }
    }
    if (result === 'lose') {
      this.gs = this.state.gs = G.resetLooseItems(this.gs);
      ev.push({ t: 'lost', state: this.leaveState() });
      this.busy = 'left';
    }
    return ev;
  }

  // ------------------------------------------------------------ 出る
  leaveState() {
    return { gs: G.resetLooseItems(this.gs), opened: this.state.opened.slice(), rares: { ...this.state.rares } };
  }
  leave() {
    this.busy = 'left';
    return this.leaveState();
  }
}
