// タイトル(組立説明書の表紙)と名前入力。
import { h, pn, num, sfx, put } from './dom.js';
import { openLayer, part, btn } from './widgets.js';
import { setCur } from './input.js';
import { snapIn } from './fx.js';

/**
 * タイトル画面。表紙の絵の場所(data-slot="title-art")に 3D の作業台を置ける。
 * @param {{hasSave?:boolean, version?:string, onNew:()=>void, onContinue?:()=>void, onSettings?:()=>void}} d
 * @returns {{close():void, artEl:HTMLElement}}
 */
export function openTitle(d) {
  const art = h('div', { class: 'ui-slot3d', 'data-label': 'COVER ART 3D', data: { slot: 'title-art' } });
  const items = [
    part({ code: 'A-1', label: 'はじめから', sub: '組み立てを はじめる', onClick: () => { close(); d.onNew(); } }),
    part({ code: 'A-2', label: 'つづきから', sub: d.hasSave ? 'セーブした ところから' : 'セーブが ありません', disabled: !d.hasSave, onClick: () => { close(); d.onContinue && d.onContinue(); } }),
    part({ code: 'A-3', label: '設定', sub: '画質・音', onClick: () => d.onSettings && d.onSettings() }),
  ];
  const cover = h('div', { class: 'ui-cover' },
    h('div', { class: 'ui-cover__band' }, h('b', null, 'DIORAMA KIT'), h('span', null, 'No.' + (d.kitNo || '001')), h('span', null, '体験版')),
    h('div', { class: 'ui-cover__logo' }, h('small', null, 'くみたて 配合 RPG'),
      h('h1', null, h('span', null, 'ジ'), 'オラマ', h('br'), '魔物', h('span', null, '記')),
      h('div', { class: 'en' }, 'DIORAMA  MAMONO  KI')),
    h('div', { class: 'ui-cover__art' }, art,
      h('span', { class: 'callout', style: { left: '6%', bottom: '8%' } }, pn('A-1'), 'ネジコ'),
      h('span', { class: 'callout', style: { right: '6%', top: '14%' } }, pn('B-4'), '時計塔')),
    h('div', { class: 'ui-cover__menu' }, ...items),
    h('div', { class: 'ui-cover__foot' },
      h('span', { class: 'ui-cover__age' }, '対象年齢', num('8'), 'さい以上'),
      h('span', { class: 'ui-cover__parts' }, h('i'), h('i'), h('i')),
      h('span', { class: 'ui-num', style: { fontSize: '12px' } }, 'VER ' + (d.version || '0.1'))));
  const wrap = h('div', { class: 'ui-title' }, cover);
  const ui = openLayer(wrap, { from: 'scale', sound: 'open', scope: () => cover });
  setCur(items[d.hasSave ? 1 : 0], true);
  function close() { ui.close(); }
  return { close, artEl: art };
}

const KANA = {
  ひらがな: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもや゛ゆ゜よらりるれろわをんーゃゅょっぁぃぅぇぉ',
  カタカナ: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤ゛ユ゜ヨラリルレロワヲンーャュョッァィゥェォ',
  'ABC': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
};
const DAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ', う: 'ゔ' };
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * 名前入力。かなの表 + スマホのキーボード(入力欄)のどちらでも。
 * @param {{title?:string, initial?:string, max?:number, onDone:(name:string)=>void, onCancel?:()=>void}} d
 */
export function openNameEntry(d) {
  const max = d.max ?? 6;
  let name = [...(d.initial || '')].slice(0, max);
  let set = 'ひらがな';
  const boxes = h('div', { class: 'ui-name__boxes' });
  const input = h('input', { class: 'ui-name__input', maxlength: max, autocomplete: 'off', 'aria-label': '名前' });
  const grid = h('div', { class: 'ui-kana' });
  const tabs = h('div', { class: 'ui-name__tabs' });
  const okBtn = btn('けってい', () => done(), 'ui-btn--ink');
  const panel = h('div', { class: 'ui-name' },
    h('div', { class: 'ui-head' }, pn('N-1'), h('h2', null, d.title || 'なまえを つけてください')),
    h('div', { class: 'ui-name__field' }, boxes,
      btn('キーボード', () => { input.value = name.join(''); input.focus(); }, '', { sound: 'cursor' })),
    input, tabs, grid,
    h('div', { class: 'ui-btnrow', style: { marginTop: '8px' } }, btn('けす', () => del(), '', { sound: 'cancel' }), okBtn));
  const ui = openLayer(panel, { scrim: true, onBack: () => del(), scope: () => panel });
  input.addEventListener('input', () => { name = [...input.value].slice(0, max); renderBoxes(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); done(); } });

  function renderBoxes() {
    put(boxes, ...Array.from({ length: max }, (_, i) => h('span', { class: i === name.length ? 'is-next' : '' }, name[i] || '')));
    okBtn.disabled = !name.join('').trim();
  }
  function renderGrid() {
    put(tabs, ...Object.keys(KANA).map((k) => btn(k, () => { set = k; renderGrid(); }, k === set ? 'is-on' : '', { sound: 'cursor' })));
    put(grid, ...[...KANA[set]].map((c) => h('button', { class: 'ui-sel', type: 'button', on: { click: () => key(c) } }, c)));
  }
  function key(c) {
    if (c === '゛' || c === '゜') {
      const last = name[name.length - 1]; if (!last) return;
      const kata = /[ァ-ヶ]/.test(last), base = toHira(last);
      const t = (c === '゛' ? DAKU : HANDAKU)[base]; if (!t) return;
      name[name.length - 1] = kata ? toKata(t) : t;
    } else if (name.length < max) name.push(c);
    else return sfx('cancel');
    sfx('type'); renderBoxes();
    snapIn(boxes.children[Math.max(0, name.length - 1)], { burst: false, sound: false });
  }
  function del() { if (!name.length) { if (d.onCancel) { ui.close(); d.onCancel(); } return; } name.pop(); renderBoxes(); }
  function done() { const n = name.join('').trim(); if (!n) return; sfx('ok'); ui.close(); d.onDone(n); }
  renderBoxes(); renderGrid();
  return { close: () => ui.close() };
}
