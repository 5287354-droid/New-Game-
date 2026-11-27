// 図鑑(パーツ一覧の見開き)と部品表(57 + 金57 マス)。3D ビューアは data-slot="dex-viewer" の div に置く。
import { h, pn, num, sfx, put } from './dom.js';
import { openLayer, part, runner, btn, closeBtn, matChip, stars, PART_SLOT, STAT, MAT } from './widgets.js';
import { setCur } from './input.js';
import { snapIn } from './fx.js';

const PRIZES = [[5, 'つなぎネジ'], [10, 'きらりニス'], [20, '金のピン×3'], [30, '金のつなぎネジ'], [45, '部品の目利き']];

/**
 * @param {{
 *  species: {id:string, no:number, name:string, mat:string, body:string, desc?:string, where?:string,
 *            parts:{head:{label:string,stat?:string,pct?:number,trait?:string,skill?:string}, back:object, tail:object}, boss?:boolean}[],
 *  state: Object<string, 'unseen'|'seen'|'caught'>,     // 種の id → 見た/つかまえた
 *  bom?: Object<string, 0|1|2>,                         // 'nejiko.back' → 0 なし / 1 登録 / 2 金(★3)
 *  bodies?: Object<string,string>,
 *  onSelect?: (speciesId:string, viewerEl:HTMLElement) => void,   // 3D ビューアに出す
 *  onClose?: () => void,
 *  tab?: 'dex'|'bom'
 * }} d
 */
export function openDex(d) {
  let tab = d.tab || 'dex';
  let curId = null;
  const leftBody = h('div', { class: 'ui-page__scroll' });
  const rightBody = h('div', { class: 'ui-page__scroll' });
  const viewer = h('div', { class: 'ui-slot3d ui-dex__view', 'data-label': 'VIEWER 3D — 指で回す', data: { slot: 'dex-viewer' } });
  const tabs = h('div', { class: 'ui-dex__tabs' });
  const rate = h('div', { class: 'ui-dex__rate' });
  const left = h('section', { class: 'ui-page' },
    h('div', { class: 'ui-head' }, pn('Z-1'), h('h2', null, 'パーツ一覧'), h('div', { class: 'ui-head__r' }, tabs, closeBtn(() => close()))),
    rate, leftBody, h('span', { class: 'ui-page__folio' }, 'P.02'));
  const right = h('section', { class: 'ui-page' }, rightBody, h('span', { class: 'ui-page__folio' }, 'P.03'));
  const spread = h('div', { class: 'ui-spread ui-dex', style: { '--fold': '50%' } }, left, right);
  const ui = openLayer(spread, { scrim: true, from: 'up', onBack: () => close(), scope: () => left });
  function close() { ui.close(); d.onClose && d.onClose(); }

  const total = d.species.length;
  const caught = () => d.species.filter((s) => d.state[s.id] === 'caught').length;
  const seen = () => d.species.filter((s) => d.state[s.id] && d.state[s.id] !== 'unseen').length;
  const bomCount = (lv) => Object.values(d.bom || {}).filter((v) => v >= lv).length;
  const bomTotal = d.species.filter((s) => !s.noParts).length * 3;

  function render() {
    put(tabs, 
      btn('図鑑', () => { tab = 'dex'; render(); }, tab === 'dex' ? 'is-on' : ''),
      btn('部品表', () => { tab = 'bom'; render(); }, tab === 'bom' ? 'is-on' : ''));
    if (tab === 'dex') {
      put(rate, h('span', null, '見た ', num(seen()), '/' + total), h('span', null, 'なかま ', num(caught()), '/' + total),
        h('span', null, num(Math.round(caught() / total * 100)), '%'));
      put(leftBody, h('div', { class: 'ui-dex__grid' }, ...d.species.map((s) => {
        const stt = d.state[s.id] || 'unseen';
        const c = h('button', {
          class: `ui-dexcell ui-sel is-${stt}`, type: 'button',
          on: { click: () => { sfx('ok'); show(s.id); } },
        }, pn(String(s.no).padStart(2, '0')),
        h('span', { class: `ui-dexcell__sil is-${s.body}`, style: { '--c': (MAT[s.mat] || MAT.none).color } }),
        h('b', null, stt === 'unseen' ? '? ? ?' : s.name),
        stt === 'caught' ? h('span', { class: 'ui-dexcell__mark ui-status' }, '済') : null);
        c.addEventListener('pointerenter', () => stt !== 'unseen' && show(s.id, true));
        return c;
      })));
      show(curId || (d.species.find((s) => d.state[s.id] && d.state[s.id] !== 'unseen') || d.species[0]).id, true);
    } else {
      put(rate, h('span', null, '登録 ', num(bomCount(1)), '/' + bomTotal), h('span', null, '金 ', num(bomCount(2)), '/' + bomTotal));
      const g = h('div', { class: 'ui-bom' }, h('span'), ...['head', 'back', 'tail'].map((k) => h('span', { class: 'ui-bom__h' }, PART_SLOT[k])));
      for (const s of d.species) {
        if (s.noParts) continue;
        const known = d.state[s.id] && d.state[s.id] !== 'unseen';
        g.append(h('span', { class: 'ui-bom__sp' }, pn(String(s.no).padStart(2, '0')), known ? s.name : '???'));
        for (const k of ['head', 'back', 'tail']) {
          const v = (d.bom || {})[`${s.id}.${k}`] || 0;
          g.append(h('span', { class: ['ui-bomcell', v === 0 && 'is-empty', v === 2 && 'is-gold'] }, v ? s.parts[k].label : '—', h('i', { class: 'gold' })));
        }
      }
      put(leftBody, g);
      bomRight();
    }
  }

  function show(id, quiet) {
    curId = id;
    if (tab !== 'dex') return;
    const s = d.species.find((x) => x.id === id);
    const stt = d.state[id] || 'unseen';
    if (!quiet) { const c = [...leftBody.querySelectorAll('.ui-dexcell')][d.species.indexOf(s)]; if (c) setCur(c, true); }
    if (stt === 'unseen') {
      put(rightBody, h('div', { class: 'ui-head' }, pn('No.' + String(s.no).padStart(2, '0')), h('h2', null, '? ? ?')), viewer, h('div', { class: 'ui-mute', style: { marginTop: '8px' } }, 'まだ 見ていない'));
      return;
    }
    const partRows = h('div', { class: 'ui-parts3' }, ...['head', 'back', 'tail'].map((k) => {
      const p = s.parts[k] || {};
      return h('div', { class: 'ui-partcard' + ((d.bom || {})[`${id}.${k}`] === 2 ? ' is-n3' : '') },
        h('h4', null, h('span', { class: 'ui-small ui-mute' }, PART_SLOT[k])), h('div', null, p.label),
        p.stat ? h('div', { class: 'ui-small' }, `${STAT[p.stat]} +${p.pct}%`) : null,
        p.trait ? h('div', { class: 'where' }, '特性つき') : p.skill ? h('div', { class: 'where' }, 'パーツわざ') : null);
    }));
    put(rightBody, 
      h('div', { class: 'ui-head' }, pn('No.' + String(s.no).padStart(2, '0')), h('h2', null, s.name), matChip(s.mat), h('span', { class: 'ui-small' }, (d.bodies || {})[s.body] || s.body), stt === 'caught' ? h('span', { class: 'ui-status' }, 'なかま') : h('span', { class: 'ui-small ui-mute' }, '見ただけ')),
      viewer,
      h('div', { class: 'ui-dex__info', style: { marginTop: '8px' } },
        s.desc ? h('div', { class: 'ui-dex__desc' }, s.desc) : null,
        s.where ? h('div', { class: 'ui-small ui-mute' }, 'すみか: ' + s.where) : null,
        h('div', { class: 'ui-small' }, '部品(A-1 胴は型。頭・背中・しっぽは おさがりにできる)'), partRows));
    d.onSelect && d.onSelect(id, viewer);
    if (!quiet) snapIn(rightBody.firstChild, { from: 'right', burst: false, sound: false });
  }

  function bomRight() {
    const n = bomCount(1);
    put(rightBody, 
      h('div', { class: 'ui-head' }, pn('Z-2'), h('h2', null, '部品表のごほうび')),
      h('div', { class: 'ui-note' }, h('div', { class: 'ui-note__h' }, '部品表'), 'おさがりとして 受けついだ パーツが 登録されます。★3(金つぎ)で受けつぐと、金のマスに。'),
      h('div', { class: 'ui-list', style: { marginTop: '10px' } }, ...PRIZES.map(([k, name], i) => h('div', { class: 'ui-part' + (n >= k ? ' is-picked' : ' is-off'), style: { minHeight: '40px' } },
        pn('R-' + (i + 1)), h('span', { class: 'ui-part__main' }, name, h('small', null, `${k} 個 登録で 親方から`)), h('span', { class: 'ui-part__end' }, n >= k ? 'もらった' : `あと ${k - n}`)))));
  }

  render();
  return { close, show: (id) => show(id), setTab: (t) => { tab = t; render(); } };
}
