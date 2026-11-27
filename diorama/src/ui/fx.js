// 演出の小道具。ヒットストップ・人形の跳ね・画面のゆれは 3D 側。
// UI 側は、3D と同じ瞬間に呼べる「数字が引き出し線つきで跳ねて出る」「札がパチッとはまる」などを持つ。
// どれも Web Animations API。freeze(ms) で UI の動きもヒットストップに合わせて止められる。
import { h, fxLayer, uiRoot, sfx, wait, reduced } from './dom.js';

const EASE_OUT = 'cubic-bezier(.2,.9,.25,1)';
const EASE_SNAP = 'cubic-bezier(.3,1.6,.5,1)';
let flip = 0;

const KIND_LABEL = { crit: '急所', weak: '弱点', resist: 'いまひとつ', heal: '回復', mp: 'MP', miss: '', guard: 'ガード' };

/**
 * ダメージ・回復の数字。説明書の「引き出し線 + 部品番号」の形で出る。
 * @param {number} x 画面の座標(px)。3D の人形の頭の位置を project して渡す
 * @param {number} y
 * @param {number|string} value 数字(miss のときは無視)
 * @param {{kind?:'dmg'|'crit'|'weak'|'resist'|'heal'|'mp'|'miss'|'guard', dir?:'l'|'r', delay?:number, hold?:number}} [o]
 * @returns {Promise<void>} 消えたら解決
 */
export function popNumber(x, y, value, o = {}) {
  const kind = o.kind || 'dmg';
  const dir = o.dir || ((flip++ & 1) ? 'l' : 'r');
  const len = kind === 'crit' || kind === 'weak' ? 46 : 34;
  const dx = dir === 'r' ? len : -len, dy = -len * 0.85;
  const label = KIND_LABEL[kind];
  const text = kind === 'miss' ? 'MISS' : (kind === 'heal' || kind === 'mp' ? '+' : '') + value;
  const svg = `<svg class="ui-pop__lead" width="${Math.abs(dx) + 8}" height="${Math.abs(dy) + 8}" style="left:${dir === 'r' ? -4 : dx - 4}px;top:${dy - 4}px">
    <circle cx="${dir === 'r' ? 4 : Math.abs(dx) + 4}" cy="${Math.abs(dy) + 4}" r="3"/>
    <line x1="${dir === 'r' ? 4 : Math.abs(dx) + 4}" y1="${Math.abs(dy) + 4}" x2="${dir === 'r' ? Math.abs(dx) + 4 : 4}" y2="4"/></svg>`;
  const tag = h('div', { class: 'ui-pop__tag' }, h('b', { class: 'ui-num' }, text), label ? h('i', null, label) : null);
  const el = h('div', { class: `ui-pop ui-pop--${kind} ui-pop--${dir}`, style: { left: x + 'px', top: y + 'px' }, html: svg });
  tag.style.left = dx + 'px'; tag.style.top = dy + 'px';
  el.append(tag);
  fxLayer().append(el);
  const delay = o.delay || 0, hold = o.hold ?? (kind === 'crit' || kind === 'weak' ? 900 : 650);
  const line = el.querySelector('line');
  const L = Math.hypot(dx, dy);
  line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
  const r = reduced();
  line.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: r ? 1 : 90, delay, fill: 'forwards', easing: 'linear' });
  const big = kind === 'crit' || kind === 'weak' ? 1.7 : 1.4;
  const a = tag.animate(r ? [{ opacity: 0 }, { opacity: 1 }] : [
    { transform: `translate(-50%,-50%) translateY(-22px) scale(${big})`, opacity: 0 },
    { transform: 'translate(-50%,-50%) translateY(0) scale(.88)', opacity: 1, offset: 0.35 },
    { transform: 'translate(-50%,-50%) translateY(-7px) scale(1.06)', offset: 0.6 },
    { transform: 'translate(-50%,-50%) translateY(0) scale(1)', offset: 0.8 },
    { transform: 'translate(-50%,-50%) translateY(-2px) scale(1)', offset: 0.9 },
    { transform: 'translate(-50%,-50%) translateY(0) scale(1)', opacity: 1 },
  ], { duration: 380, delay: delay + 70, fill: 'both', easing: 'linear' });
  setTimeout(() => sfx(kind === 'heal' || kind === 'mp' ? 'heal' : kind === 'miss' ? 'miss' : kind === 'crit' || kind === 'weak' ? 'crit' : 'hit'), delay + 70);
  return a.finished.then(() => wait(hold)).then(() =>
    el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 220, fill: 'forwards', easing: 'ease-in' }).finished
  ).then(() => el.remove(), () => el.remove());
}

/**
 * 札・パネルがパチッとはまる。はまった瞬間に効果音 'snap'(と、まわりに4本の「カチッ」線)
 * @param {Element} el
 * @param {{from?:'up'|'down'|'left'|'right'|'scale', burst?:boolean, delay?:number, sound?:string|false}} [o]
 */
export function snapIn(el, o = {}) {
  const from = o.from || 'scale';
  const off = { up: 'translateY(-26px)', down: 'translateY(26px)', left: 'translateX(-30px)', right: 'translateX(30px)', scale: 'scale(1.18)' }[from];
  const delay = o.delay || 0;
  const r = reduced();
  const a = el.animate(r ? [{ opacity: 0 }, { opacity: 1 }] : [
    { transform: off + ' rotate(-2deg)', opacity: 0 },
    { transform: 'translate(0,0) scale(.965) rotate(.6deg)', opacity: 1, offset: 0.62 },
    { transform: 'translate(0,0) scale(1.012)', offset: 0.82 },
    { transform: 'none', opacity: 1 },
  ], { duration: 240, delay, fill: 'backwards', easing: EASE_OUT });
  setTimeout(() => {
    if (o.sound !== false) sfx(o.sound || 'snap');
    if (o.burst !== false && !r) clickMark(el);
  }, delay + 150);
  return a.finished.catch(() => {});
}

/** 説明書の「カチッ」の線(四隅に短い線が2本ずつ) */
export function clickMark(el, o = {}) {
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const g = 7, l = o.len || 9;
  const m = h('div', { class: 'ui-click', style: { left: r.left - g + 'px', top: r.top - g + 'px', width: r.width + g * 2 + 'px', height: r.height + g * 2 + 'px' } });
  for (const c of ['tl', 'tr', 'bl', 'br']) m.append(h('i', { class: 'c-' + c, style: { '--l': l + 'px' } }));
  fxLayer().append(m);
  m.animate([{ opacity: 1, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.5 }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 300, easing: 'ease-out' }).finished.then(() => m.remove());
}

/** 札が横にふるえる(HP の札が打たれたとき) */
export function shake(el, power = 1) {
  if (reduced()) return Promise.resolve();
  const p = 5 * power;
  return el.animate([
    { transform: 'translateX(0)' }, { transform: `translateX(${-p}px)` }, { transform: `translateX(${p * 0.8}px)` },
    { transform: `translateX(${-p * 0.5}px)` }, { transform: `translateX(${p * 0.25}px)` }, { transform: 'translateX(0)' },
  ], { duration: 260, easing: 'linear' }).finished.catch(() => {});
}

/** 跳ねる(縦に1回ぽよん) */
export function hop(el, height = 8) {
  if (reduced()) return Promise.resolve();
  return el.animate([
    { transform: 'translateY(0) scale(1,1)' }, { transform: `translateY(${-height}px) scale(.96,1.05)`, offset: 0.4 },
    { transform: 'translateY(0) scale(1.06,.94)', offset: 0.75 }, { transform: 'translateY(0) scale(1,1)' },
  ], { duration: 280, easing: EASE_OUT }).finished.catch(() => {});
}

/**
 * ゲージを減らす(増やす)。減るときは、元の長さに斜線の「なごり」が残って遅れて縮む
 * bar は .ui-gauge 要素(中に <i class="fill">)
 */
export function setGauge(bar, ratio, o = {}) {
  ratio = Math.max(0, Math.min(1, ratio));
  const fill = bar.querySelector('.fill');
  let ghost = bar.querySelector('.ghost');
  if (!ghost) { ghost = h('i', { class: 'ghost' }); bar.insertBefore(ghost, fill); }
  const prev = parseFloat(fill.style.width || '100') / 100;
  fill.style.width = ratio * 100 + '%';
  bar.classList.toggle('is-low', ratio <= 0.25 && !bar.classList.contains('ui-gauge--mp') && !bar.classList.contains('ui-gauge--stat'));
  if (o.instant || ratio >= prev) { ghost.style.transition = 'none'; ghost.style.width = ratio * 100 + '%'; return; }
  ghost.style.transition = 'none';
  ghost.style.width = prev * 100 + '%';
  void ghost.offsetWidth;
  ghost.style.transition = `width 420ms ${EASE_OUT} ${o.lag ?? 380}ms`;
  ghost.style.width = ratio * 100 + '%';
}

/** 数字をカウントさせる(HP の数字など) */
export function countTo(el, to, ms = 360) {
  const from = parseFloat(el.textContent) || 0;
  if (reduced() || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * UI の動きを ms だけ止める(3D のヒットストップと合わせる)
 */
export function freeze(ms = 70) {
  const anims = uiRoot().getAnimations({ subtree: true }).filter((a) => a.playState === 'running');
  anims.forEach((a) => a.pause());
  return wait(ms).then(() => anims.forEach((a) => { try { a.play(); } catch (e) { /* 消えた */ } }));
}

/**
 * 大きな札(勝ち・スカウト成功・完成など)。説明書の「完成!」の枠
 * @param {string} text
 * @param {{sub?:string, code?:string, hold?:number, kind?:'win'|'scout'|'done'|'lose'}} [o]
 */
export function banner(text, o = {}) {
  const el = h('div', { class: 'ui-banner ui-banner--' + (o.kind || 'done') },
    h('div', { class: 'ui-banner__plate' },
      o.code ? h('span', { class: 'ui-pn ui-pn--big' }, o.code) : null,
      h('b', null, text),
      o.sub ? h('small', null, o.sub) : null));
  fxLayer().append(el);
  const plate = el.firstChild;
  sfx(o.kind === 'lose' ? 'close' : 'fanfare');
  return snapIn(plate, { from: 'scale', sound: 'snap' })
    .then(() => wait(o.hold ?? 1300))
    .then(() => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished)
    .then(() => el.remove());
}

/**
 * 文字送り。'**ことば**' はアクセント色の下線で強調。
 * @returns {{done:Promise<void>, skip:()=>void, finished:()=>boolean}}
 */
export function typewriter(el, text, o = {}) {
  const speed = o.speed ?? 32; // 1文字の ms
  el.textContent = '';
  const parts = String(text).split(/(\*\*[^*]+\*\*)/);
  const spans = [];
  for (const p of parts) {
    if (!p) continue;
    const em = p.startsWith('**');
    const t = em ? p.slice(2, -2) : p;
    const host = em ? h('b', { class: 'ui-em' }) : el;
    if (em) el.append(host);
    for (const ch of t) {
      if (ch === '\n') { host.append(h('br')); continue; }
      const s = h('span', { class: 'ui-ch' }, ch);
      host.append(s); spans.push(s);
    }
  }
  let i = 0, timer = null, resolve;
  const done = new Promise((r) => (resolve = r));
  const finish = () => { clearTimeout(timer); spans.forEach((s) => s.classList.add('on')); i = spans.length; resolve(); };
  if (speed <= 0 || reduced()) finish();
  else {
    const tick = () => {
      if (i >= spans.length) return finish();
      const s = spans[i++]; s.classList.add('on');
      if (i % 2 === 1 && s.textContent.trim()) sfx('type');
      const pause = /[。!?!?…]/.test(s.textContent) ? speed * 6 : /[、,]/.test(s.textContent) ? speed * 3 : speed;
      timer = setTimeout(tick, pause);
    };
    tick();
  }
  return { done, skip: finish, finished: () => i >= spans.length };
}

export { wait };
