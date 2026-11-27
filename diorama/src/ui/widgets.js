// 部品どうしで使い回す小さな形: ランナー・部品(選べる項目)・ゲージ・なかまの札・層を開く/閉じる。
import { h, pn, num, uiRoot, sfx, clear } from './dom.js';
import { pushLayer, popLayer, setCur } from './input.js';
import { setGauge, snapIn } from './fx.js';

/** 素材の色(monsters.json の materials と同じ。データがなくても動くように持っておく) */
export const MAT = {
  water: { name: '水', color: '#3f74b8' }, fire: { name: '火', color: '#e0562a' }, paper: { name: '紙', color: '#eadfc4' },
  stone: { name: '石', color: '#8f8b82' }, tin: { name: 'ブリキ', color: '#a9b6c0' }, cloth: { name: '布', color: '#cf8aa8' },
  none: { name: '無', color: '#F4F1EA' },
};
export function setMaterials(materials) { for (const [k, v] of Object.entries(materials || {})) MAT[k] = { name: v.name, color: v.color }; }
export const PART_SLOT = { head: '頭', back: '背中', tail: 'しっぽ' };
export const STAT = { hp: 'HP', mp: 'MP', atk: 'こうげき', def: 'まもり', spd: 'すばやさ', int: 'かしこさ' };
export const STATUS = { sleep: 'ねむり', burn: 'こげ', stain: 'しみ', rust: 'さび' };

export const matChip = (m) => { const d = MAT[m] || MAT.none; return h('span', { class: 'ui-mat', style: { '--c': d.color } }, h('i'), d.name); };
export const elBox = (m) => !m || m === 'none' ? null : h('i', { class: 'ui-el', style: { '--c': (MAT[m] || MAT.none).color }, title: (MAT[m] || MAT.none).name });
export const stars = (n) => n ? h('span', { class: 'ui-star ui-star--' + n }, '★'.repeat(n)) : null;

/** ランナー(枠)。letter は札の文字、title は札の名前 */
export function runner(letter, title, children, cls = '') {
  return h('div', { class: 'ui-runner ' + cls },
    h('div', { class: 'ui-runner__tag' }, h('b', null, letter), title ? h('span', null, title) : null),
    h('div', { class: 'ui-runner__body' }, children));
}

/**
 * 部品(選べる項目)
 * @param {{code?:string, label:any, sub?:any, end?:any, disabled?:boolean, picked?:boolean, onClick?:Function, cls?:string, data?:object}} o
 */
export function part(o) {
  const b = h('button', {
    class: ['ui-part', 'ui-sel', o.cls, o.picked && 'is-picked'], type: 'button', disabled: !!o.disabled, data: o.data,
    on: { click: (ev) => { if (b.disabled) return; setCur(b, true); sfx(o.sound || 'ok'); o.onClick && o.onClick(ev); } },
  },
  o.code ? pn(o.code) : null,
  h('span', { class: 'ui-part__main' }, o.label, o.sub != null ? h('small', null, o.sub) : null),
  o.end != null ? h('span', { class: 'ui-part__end' }, o.end) : null);
  return b;
}

export function btn(label, onClick, cls = '', o = {}) {
  const b = h('button', { class: 'ui-btn ui-sel ' + cls, type: 'button', disabled: !!o.disabled, on: { click: () => { if (b.disabled) return; sfx(o.sound || 'ok'); onClick && onClick(); } } }, label);
  return b;
}
export function closeBtn(onClick) {
  return h('button', { class: 'ui-close ui-sel', type: 'button', 'aria-label': 'とじる', on: { click: () => { sfx('cancel'); onClick(); } } });
}

/** ゲージ */
export function gauge(ratio, mp = false) {
  const g = h('div', { class: 'ui-gauge' + (mp === 'stat' ? ' ui-gauge--stat' : mp ? ' ui-gauge--mp' : '') }, h('i', { class: 'fill' }));
  setGauge(g, ratio, { instant: true });
  return g;
}

/**
 * なかまの札(メニュー・宿屋・預かり所・配合で共通)
 * mon = { name, lv, mat, hp, maxHp, mp, maxMp, color?, status?, down? }
 */
export function monCard(mon) {
  const down = mon.down || mon.hp <= 0;
  return h('span', { class: 'ui-mon' },
    h('span', { class: 'ui-mon__face' + (down ? ' is-down' : ''), style: { '--c': mon.color || (MAT[mon.mat] || MAT.none).color } }),
    h('span', { class: 'ui-mon__top' }, h('span', { class: 'ui-mon__name' }, mon.name), matChip(mon.mat),
      mon.status ? h('span', { class: 'ui-status' }, STATUS[mon.status] || mon.status) : null,
      h('span', { class: 'ui-mon__lv' }, mon.lv)),
    mon.maxHp != null ? h('span', { class: 'ui-mon__bars' },
      'HP', gauge(mon.hp / mon.maxHp), h('span', { class: 'ui-num' }, mon.hp, h('small', null, '/' + mon.maxHp)),
      'MP', gauge(mon.mp / Math.max(1, mon.maxMp), true), h('span', { class: 'ui-num' }, mon.mp, h('small', null, '/' + mon.maxMp))) : null);
}

/**
 * 層を開く。el を UI の根に足し、入力の層を積む。
 * @returns {{el, layer, close():void, closed:Promise<void>}}
 */
export function openLayer(el, o = {}) {
  const wrap = h('div', { class: 'ui-layer ' + (o.cls || '') }, o.scrim ? h('div', { class: 'ui-scrim', on: { click: () => o.onBack && o.onBack() } }) : null, el);
  uiRoot().insertBefore(wrap, uiRoot().querySelector('.ui-fxlayer'));
  let resolve;
  const closed = new Promise((r) => (resolve = r));
  const layer = pushLayer({ el: wrap, scope: o.scope, onBack: o.onBack, onKey: o.onKey, noNav: o.noNav, menuCloses: o.menuCloses });
  if (o.snap !== false) snapIn(el, { from: o.from || 'scale', sound: o.sound ?? 'open', burst: false });
  let done = false;
  return {
    el: wrap, layer, closed,
    close() {
      if (done) return; done = true;
      popLayer(layer);
      wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' }).finished.then(() => wrap.remove(), () => wrap.remove());
      resolve();
    },
  };
}

export { clear, num, pn };
