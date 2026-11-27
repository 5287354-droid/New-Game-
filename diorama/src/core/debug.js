// 通しプレイ(Playwright)用のデバッグ口。main.js が window.__debug = makeCoreDebug({...}) として付ける。
// three に依存しない部分(旗・道具・魔物・戦闘・配合・セーブ)だけ。画面の操作(歩く・カメラ)は main.js 側で足す。
//
//   ctx = { db, getSave():save, setSave(save), store, getBattle():battle|null, onChange?() }
import { createMonster, gainXp, xpForLevel, healFull, calcStats } from './stats.js';
import { addCaught, addItem, addGold } from './inventory.js';
import { setFlag, STEPS, storyEvent, nextGoal } from './story.js';
import { submit, runAuto, getView, autoAction, forceFinish } from './battle.js';
import { breedInSave, breedPreview } from './breed.js';
import { exportText, importText, validate } from './save.js';

export function makeCoreDebug(ctx) {
  const S = () => ctx.getSave();
  const changed = (x) => { ctx.onChange?.(); return x; };
  const api = {
    state: () => S(),
    flags: () => ({ ...S().flags }),
    setFlag: (f, v = true) => changed(setFlag(S(), f, v)),
    story: (ev, arg) => changed(storyEvent(S(), ev, arg)),
    goal: () => nextGoal(S()),
    // その場面の手前まで旗を全部立てる(例: skipTo('forest') → ランプの森に入れる状態)
    skipTo(stepId) {
      const i = STEPS.findIndex((s) => s.id === stepId);
      if (i < 0) throw new Error('場面がない: ' + stepId);
      const extra = { chief: ['openTsumiki'], report: ['breedUnlocked'] };
      for (const s of STEPS.slice(0, i)) setFlag(S(), s.done);
      for (const s of STEPS.slice(0, i)) for (const f of extra[s.id] || []) setFlag(S(), f);
      if (S().flags.metChief) setFlag(S(), 'openTsumiki');
      if (S().flags.gotTweezers) S().abilities.tweezers = true;
      return changed(Object.keys(S().flags));
    },
    give: (item, n = 1) => changed(addItem(S(), item, n)),
    gold: (n) => changed(addGold(S(), n)),
    addMon(sp, lv = 5, opts = {}) {
      const m = createMonster(ctx.db, { sp, lv, ...opts });
      const where = addCaught(S(), m);
      return changed({ uid: m.uid, where });
    },
    setLv(uid, lv) {
      const m = S().monsters[uid];
      const ev = gainXp(ctx.db, m, Math.max(0, xpForLevel(lv) - m.xp));
      healFull(ctx.db, m);
      return changed(ev);
    },
    healAll: () => changed(S().party.forEach((u) => healFull(ctx.db, S().monsters[u]))),
    party: () => S().party.map((u) => ({ uid: u, ...S().monsters[u], stats: calcStats(ctx.db, S().monsters[u]) })),
    // 戦闘
    battle: () => (ctx.getBattle() ? getView(ctx.getBattle()) : null),
    turn: (cmds = {}) => { const b = ctx.getBattle(); return b ? submit(b, cmds) : null; },
    autoTurn: () => { const b = ctx.getBattle(); if (!b) return null; const c = {}; for (const k of b.field.ally) if (k && b.units[k].alive) c[k] = autoAction(b, k); return submit(b, c); },
    autoBattle: (max = 60) => { const b = ctx.getBattle(); return b ? runAuto(b, max) : null; },
    // 敵を全部たおす / 味方を全部たおす(その場で決着。出来事の列を返す)
    winBattle() { const b = ctx.getBattle(); return b ? forceFinish(b, 'win') : null; },
    loseBattle() { const b = ctx.getBattle(); return b ? forceFinish(b, 'lose') : null; },
    // 配合
    breedPreview: (a, b, opts) => breedPreview(ctx.db, S().monsters[a], S().monsters[b], { flags: S().flags, save: S(), ...opts }),
    breed: (a, b, opts) => changed(breedInSave(ctx.db, S(), a, b, opts)),
    // セーブ
    save: (slot = 'manual') => ctx.store.save(S(), slot),
    load: (slot = 'manual') => { const s = ctx.store.load(slot); if (s) ctx.setSave(s); return !!s; },
    exportText: () => exportText(S()),
    importText: (t) => { const s = importText(t); ctx.setSave(s); return true; },
    validate: () => validate(S()),
  };
  return api;
}
