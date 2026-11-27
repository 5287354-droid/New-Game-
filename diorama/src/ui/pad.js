// スマホの操作ボタン: A(決定・調べる)・B(キャンセル・押している間は走る)・⟲ ⟳(カメラ)・≡(メニュー)。
// UI の層が開いていれば A/B はその層へ、なければ onButton(フィールド)へ。
import { h, uiRoot } from './dom.js';
import { press, hasLayer, onStackChange } from './input.js';

/**
 * @param {{onButton?:(name:'a'|'b'|'rotL'|'rotR'|'menu', down:boolean)=>void, auto?:boolean}} o
 *   auto: マウスのある画面では A/B/⟲⟳ を隠す(≡ だけ残す)
 *   keepOnLayer: UI の層(会話・メニュー・戦闘)が開いても隠さない(ふつうは隠す。層の中は指で直接さわれるので)
 * @returns {{el, setMode(mode:'field'|'ui'|'menuonly'|'hidden'):void, destroy():void}}
 */
export function createPad(o = {}) {
  const mk = (name, cls, content, label) => {
    const b = h('button', { class: `ui-pad__btn ${cls}`, type: 'button', 'aria-label': label, data: { k: name } }, content);
    const down = (ev) => {
      ev.preventDefault();
      b.setPointerCapture?.(ev.pointerId);
      b.classList.add('is-down');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* なし */ }
      if (hasLayer()) { press(name); } else { o.onButton && o.onButton(name, true); }
    };
    const up = (ev) => {
      if (!b.classList.contains('is-down')) return;
      b.classList.remove('is-down');
      if (!hasLayer()) o.onButton && o.onButton(name, false);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const el = h('div', { class: 'ui-pad' + (o.auto ? ' is-auto' : '') },
    mk('rotL', 'ui-pad__rot ui-pad__rl', '⟲', 'カメラを左に回す'),
    mk('rotR', 'ui-pad__rot ui-pad__rr', '⟳', 'カメラを右に回す'),
    mk('b', 'ui-pad__b', ['B', h('small', null, 'もどる')], 'B'),
    mk('a', 'ui-pad__a', ['A', h('small', null, 'しらべる')], 'A'),
    mk('menu', 'ui-pad__menu', [h('i'), h('i'), h('i')], 'メニュー'));
  const root = uiRoot();
  root.insertBefore(el, root.firstChild);
  const off = o.keepOnLayer ? null : onStackChange((n) => el.classList.toggle('is-layer', n > 0));
  el.classList.toggle('is-layer', !o.keepOnLayer && hasLayer());
  return {
    el,
    /** field: 全部 / ui: カメラボタンを隠す / menuonly: ≡ だけ / hidden: 全部隠す */
    setMode(mode) { el.classList.toggle('is-ui', mode === 'ui'); el.classList.toggle('is-menuonly', mode === 'menuonly'); el.classList.toggle('is-hidden', mode === 'hidden'); },
    /** A の下の小さな文字(しらべる・はなす・つまむ・おく など) */
    setALabel(t) { el.querySelector('.ui-pad__a small').textContent = t; },
    destroy() { off && off(); el.remove(); },
  };
}
