// UI の土台: 要素づくり・UI の根・エリアのアクセント色・効果音のつなぎ口。
// three に依存しない。DOM だけ。

/** h('div', {class, style, on:{click}, data:{k}, ...attrs}, ...children) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

/** 部品番号の札 "A-1" */
export const pn = (code, cls = '') => h('span', { class: 'ui-pn ' + cls }, code);
/** 数字(Barlow Condensed) */
export const num = (v, cls = '') => h('span', { class: 'ui-num ' + cls }, String(v));
/** ①②③ の丸数字 */
export const step = (n, cls = '') => h('span', { class: 'ui-step ' + cls }, String(n));
/** 部品番号を作る: letter='A', i=0 → 'A-1' */
export const code = (letter, i) => `${letter}-${i + 1}`;

// ---- UI の根 ----
let root = null;
export function uiRoot() {
  if (!root) {
    root = document.querySelector('.ui-root') || h('div', { class: 'ui-root' });
    if (!root.isConnected) document.body.append(root);
    root.append(h('div', { class: 'ui-fxlayer' }));
  }
  return root;
}
export const fxLayer = () => uiRoot().querySelector('.ui-fxlayer');

// ---- エリアのアクセント色(1色だけ) ----
export const AREAS = {
  village: { name: 'ネジマキ村', box: '01', accent: '#E3A72F', on: '#1B1915', verb: 'めくる' },
  tsumiki: { name: 'つみき野', box: '02', accent: '#8DBA3A', on: '#1B1915', verb: 'まわす' },
  forest: { name: 'ランプの森', box: '03', accent: '#2C4A80', on: '#F4F1EA', verb: 'てらす' },
  tower: { name: 'ゼンマイ時計塔', box: '04', accent: '#D8462A', on: '#F4F1EA', verb: 'つなぐ' },
  workbench: { name: '作業台', box: '00', accent: '#E3A72F', on: '#1B1915', verb: 'えらぶ' },
};
export function setArea(id) {
  const a = AREAS[id] || AREAS.village;
  const s = document.documentElement.style;
  s.setProperty('--accent', a.accent);
  s.setProperty('--on-accent', a.on);
  document.documentElement.dataset.area = id;
  return a;
}

// ---- 効果音のつなぎ口(sound-lab が setSfx でつなぐ) ----
// 鳴らす名前: cursor ok cancel open close snap cut slide pop coin type hit crit heal miss scout fanfare
let sfxFn = null;
export function setSfx(fn) { sfxFn = fn; }
export function sfx(name, opt) { try { sfxFn && sfxFn(name, opt); } catch (e) { /* 音で UI を止めない */ } }

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** replaceChildren の null を飛ばす版(null が "null" の文字にならないように) */
export function put(el, ...children) { clear(el); append(el, children); return el; }
