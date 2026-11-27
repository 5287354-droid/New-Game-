// UI の入力: いちばん上に開いている UI の層が、キー・A/B ボタンを受けとる。
// 層がなければ setFallback の関数(フィールド)へ流す。
// 選べる要素には class "ui-sel" をつける。矢印キーは画面上の位置で近い方へ動く。
import { sfx } from './dom.js';

const stack = [];
let fallback = null;
const watchers = new Set();
/** 層が積まれた・外れたときに呼ばれる(パッドが自分を隠すのに使う) */
export function onStackChange(fn) { watchers.add(fn); return () => watchers.delete(fn); }
const notify = () => watchers.forEach((f) => { try { f(stack.length); } catch (e) { /* なし */ } });

/** キーの名前: a b up down left right menu rotL rotR */
export const KEYMAP = {
  z: 'a', Z: 'a', Enter: 'a', ' ': 'a',
  x: 'b', X: 'b', Backspace: 'b',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Escape: 'menu', q: 'rotL', Q: 'rotL', e: 'rotR', E: 'rotR',
};

/**
 * 層を積む。layer = { el, scope?():Element, onKey?(key):bool, onBack?(), noNav? }
 * scope は矢印で動く範囲(なければ el)。
 */
export function pushLayer(layer) {
  stack.push(layer);
  notify();
  queueMicrotask(() => ensureCur(layer));
  return layer;
}
export function popLayer(layer) {
  const i = stack.lastIndexOf(layer);
  if (i >= 0) { stack.splice(i, 1); notify(); }
}
export const topLayer = () => stack[stack.length - 1] || null;
export const hasLayer = () => stack.length > 0;
export function setFallback(fn) { fallback = fn; }

/** ボタンやキーから呼ぶ。消費したら true */
export function press(key) {
  const L = topLayer();
  if (!L) { fallback && fallback(key); return false; }
  if (L.onKey && L.onKey(key) === true) return true;
  if (key === 'b') { if (L.onBack) { sfx('cancel'); L.onBack(); } return true; }
  if (L.noNav) return true;
  const scope = (L.scope && L.scope()) || L.el;
  if (key === 'a') { const c = cur(scope); if (c) c.click(); return true; }
  if (['up', 'down', 'left', 'right'].includes(key)) { move(scope, key); return true; }
  if (key === 'menu' && L.onBack && L.menuCloses) { L.onBack(); }
  return true;
}

const sels = (scope) => [...scope.querySelectorAll('.ui-sel')].filter((e) => !e.disabled && e.offsetParent !== null && !e.closest('[hidden]'));
export const cur = (scope) => scope.querySelector('.ui-sel.is-cur:not([disabled])');

export function setCur(el, quiet) {
  if (!el) return;
  const L = topLayer();
  const scope = (L && ((L.scope && L.scope()) || L.el)) || el.parentElement;
  scope.querySelectorAll('.ui-sel.is-cur').forEach((e) => e !== el && e.classList.remove('is-cur'));
  if (!el.classList.contains('is-cur')) { el.classList.add('is-cur'); if (!quiet) sfx('cursor'); }
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

export function ensureCur(layer) {
  const scope = (layer.scope && layer.scope()) || layer.el;
  if (!scope || cur(scope)) return;
  const first = sels(scope)[0];
  if (first) first.classList.add('is-cur');
}

function move(scope, dir) {
  const list = sels(scope);
  if (!list.length) return;
  const c = cur(scope);
  if (!c) { setCur(list[0]); return; }
  const r = c.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bestScore = Infinity;
  for (const e of list) {
    if (e === c) continue;
    const q = e.getBoundingClientRect();
    const x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
    const main = dir === 'up' ? -y : dir === 'down' ? y : dir === 'left' ? -x : x;
    const side = dir === 'up' || dir === 'down' ? Math.abs(x) : Math.abs(y);
    if (main <= 2) continue;
    const s = main + side * 2.2;
    if (s < bestScore) { bestScore = s; best = e; }
  }
  if (!best) { // はしまで来たら反対のはしへまわる(縦の一列のとき)
    const idx = list.indexOf(c);
    if (dir === 'down') best = list[(idx + 1) % list.length];
    if (dir === 'up') best = list[(idx - 1 + list.length) % list.length];
  }
  if (best) setCur(best);
}

// マウス・指を乗せたら、そこにカーソル
document.addEventListener('pointerover', (ev) => {
  const t = ev.target.closest && ev.target.closest('.ui-sel');
  if (t && ev.pointerType === 'mouse' && !t.disabled) setCur(t, true);
});

// キーボード
document.addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) {
    if (ev.key === 'Escape') { ev.target.blur(); }
    return;
  }
  const k = KEYMAP[ev.key];
  if (!k) return;
  if (press(k)) ev.preventDefault();
});
