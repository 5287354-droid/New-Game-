// エリアに入ったときの名札・宝箱や道具を手に入れた札。どちらも入力を止めない(自動で消える)。
import { h, sfx, wait, uiRoot, AREAS, setArea } from './dom.js';
import { snapIn } from './fx.js';

function layer() {
  const w = h('div', { class: 'ui-layer is-pass' });
  uiRoot().insertBefore(w, uiRoot().querySelector('.ui-fxlayer'));
  return w;
}
const out = (w, el) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 220, fill: 'forwards' }).finished.then(() => w.remove());

/**
 * エリアの名札。アクセント色も切りかえる。
 * @param {string} areaId village tsumiki forest tower workbench
 * @param {{sub?:string, hold?:number, floor?:string}} [o] floor: 時計塔の「3F」など
 */
export async function showAreaPlate(areaId, o = {}) {
  const a = setArea(areaId);
  const w = layer();
  const el = h('div', { class: 'ui-plate' },
    h('div', { class: 'ui-plate__box' }, h('small', null, 'BOX'), h('b', null, a.box)),
    h('div', { class: 'ui-plate__name' }, h('b', null, a.name + (o.floor ? ' ' + o.floor : '')),
      h('small', null, o.sub ?? ['ルール: ', h('em', null, a.verb)])));
  w.append(el);
  await snapIn(el, { from: 'left', sound: 'snap' });
  await wait(o.hold ?? 2200);
  await out(w, el);
}

const ICON = {
  item: '<svg viewBox="0 0 40 40"><rect x="9" y="12" width="22" height="18" rx="3"/><path d="M15 12 V8 H25 V12"/></svg>',
  chest: '<svg viewBox="0 0 40 40"><path d="M6 18 Q6 8 20 8 Q34 8 34 18 Z"/><rect x="6" y="18" width="28" height="14"/><rect x="17" y="16" width="6" height="8"/></svg>',
  gold: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="7"/></svg>',
  part: '<svg viewBox="0 0 40 40"><rect x="5" y="17" width="8" height="6"/><rect x="27" y="17" width="8" height="6"/><rect x="12" y="10" width="16" height="20" rx="3"/></svg>',
  key: '<svg viewBox="0 0 40 40"><path d="M10 8 L16 26 L13 32 M30 8 L24 26 L27 32"/><circle cx="20" cy="22" r="3"/></svg>',
};

/**
 * 手に入れた札。
 * @param {{name:string, count?:number, kind?:'item'|'chest'|'gold'|'part'|'key', desc?:string, head?:string, hold?:number}} o
 *   kind=key は大事なもの(ピンセットなど)
 */
export async function showGot(o) {
  const w = layer();
  const el = h('div', { class: 'ui-got' },
    h('div', { class: 'ui-got__icon', html: ICON[o.kind || 'item'] }),
    h('div', { class: 'ui-got__txt' },
      h('small', null, o.head || (o.kind === 'chest' ? '宝箱を あけた!' : o.kind === 'key' ? 'だいじな もの' : '手に入れた!')),
      h('b', null, o.name, o.count > 1 ? h('span', { class: 'ui-num' }, '×' + o.count) : null),
      o.desc ? h('p', null, o.desc) : null));
  w.append(el);
  sfx(o.kind === 'gold' ? 'coin' : 'fanfare');
  await snapIn(el, { from: 'up', sound: 'snap' });
  await wait(o.hold ?? 1800);
  await out(w, el);
}
