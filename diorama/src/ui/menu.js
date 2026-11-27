// メニュー(≡): A-1 なかま / A-2 どうぐ / A-3 図鑑 / A-4 設定 / A-5 セーブ。
// 中身(道具を使う・セーブする)は呼び出し側のコールバック。UI は表示と選んだ結果だけ。
import { h, pn, num, sfx, put } from './dom.js';
import { openLayer, runner, part, btn, closeBtn, monCard, matChip, elBox, stars, gauge, PART_SLOT, STAT } from './widgets.js';
import { setCur } from './input.js';
import { snapIn, banner } from './fx.js';

/**
 * @typedef {Object} MonView なかま1体の表示用データ
 * @property {string} name
 * @property {string} [species]  種の名前(name がニックネームのとき)
 * @property {number} lv
 * @property {string} mat        素材の id(water fire paper stone tin cloth)
 * @property {number} hp @property {number} maxHp @property {number} mp @property {number} maxMp
 * @property {string} [status]   sleep burn stain rust
 * @property {string} [color]
 * @property {{atk:number,def:number,spd:number,int:number}} [stats]
 * @property {number} [xp] @property {number} [nextXp]
 * @property {number} [gen]      代
 * @property {number} [bonus]    伸びボーナス(0〜0.5)
 * @property {{name:string, el?:string, mp?:number, part?:boolean}[]} [skills]
 * @property {Object<string,{label:string, from?:string, star?:number, stat?:string, pct?:number, trait?:string}>} [parts] head back tail
 */

/**
 * メニューを開く。
 * @param {{
 *  money:number, playTime?:string, place?:string,
 *  party:MonView[], items:{id:string,name:string,count:number,desc?:string,field?:boolean,target?:'one'|'all'|'down'}[],
 *  settings:{quality:'low'|'mid'|'high', bgm:number, se:number},
 *  onUseItem?:(itemId:string, targetIndex:number|null)=>({ok:boolean,msg?:string,party?:MonView[],items?:any[]}|void),
 *  onSwap?:(i:number,j:number)=>(MonView[]|void),
 *  onOpenDex?:()=>void,
 *  onSettings?:(s:{quality:string,bgm:number,se:number}, changed:string)=>void,
 *  getExport?:()=>string, onImport?:(text:string)=>({ok:boolean,msg?:string}),
 *  onSave?:()=>({ok:boolean,msg?:string}|Promise<{ok:boolean,msg?:string}>),
 *  onClose?:()=>void
 * }} d
 */
export function openMenu(d) {
  const st = { ...d };
  const ENTRIES = [
    ['なかま', 'ならびと くわしく', () => partySheet()],
    ['どうぐ', 'つかう', () => itemSheet()],
    ['図鑑', 'パーツ一覧', () => { close(); d.onOpenDex && d.onOpenDex(); }],
    ['設定', '画質・音・書き出し', () => settingsSheet()],
    ['セーブ', '手動セーブ 1枠', () => saveSheet()],
  ];
  const items = ENTRIES.map(([label, sub, fn], i) => part({ code: 'A-' + (i + 1), label, sub, onClick: fn }));
  const moneyEl = num(st.money);
  const panel = h('div', { class: 'ui-menu' },
    runner('A', 'メニュー', items),
    h('div', { class: 'ui-menu__money' }, h('span', { class: 'ui-small' }, 'おかね'), moneyEl),
    h('div', { class: 'ui-menu__info' }, h('span', null, st.place || ''), h('span', { class: 'ui-num' }, st.playTime || '')));
  const ui = openLayer(panel, { scrim: true, from: 'right', onBack: () => close(), menuCloses: true, scope: () => panel });
  setCur(items[0], true);

  function close() { ui.close(); d.onClose && d.onClose(); }

  // ---------- なかま ----------
  function partySheet() {
    let swapFrom = null;
    const body = h('div', { class: 'ui-list' });
    const foot = h('div', { class: 'ui-sheet__foot' }, h('span', null, h('kbd', null, 'A'), ' くわしく'), h('span', null, h('kbd', null, 'B'), ' もどる'));
    const swapBtn = btn('ならびかえ', () => { swapFrom = swapFrom === null ? -1 : null; render(); });
    const sheet = h('div', { class: 'ui-sheet' },
      h('div', { class: 'ui-head' }, pn('A-1'), h('h2', null, 'なかま'), h('span', { class: 'ui-mute ui-small' }, '先頭の3体が台に出る'), h('div', { class: 'ui-head__r' }, swapBtn, closeBtn(() => s.close()))),
      h('div', { class: 'ui-sheet__body' }, runner('B', 'なかま', body)), foot);
    const s = openLayer(sheet, { onBack: () => { if (swapFrom !== null) { swapFrom = null; render(); } else s.close(); } });
    function render() {
      swapBtn.textContent = swapFrom === null ? 'ならびかえ' : 'やめる';
      put(body, ...st.party.map((m, i) => part({
        code: 'B-' + (i + 1), label: monCard(m), picked: swapFrom === i,
        cls: i < 3 ? '' : 'is-reserve',
        end: h('span', { class: 'ui-small ui-hide-narrow' + (i > 2 ? ' ui-mute' : '') }, i === 2 ? '後列' : i < 2 ? '前列' : 'ひかえ'),
        sub: null,
        onClick: () => {
          if (swapFrom === null) return monDetail(m, i);
          if (swapFrom === -1) { swapFrom = i; render(); return; }
          const j = swapFrom; swapFrom = null;
          if (i !== j) {
            const r = d.onSwap && d.onSwap(j, i);
            if (Array.isArray(r)) st.party = r; else { const p = st.party.slice(); [p[i], p[j]] = [p[j], p[i]]; st.party = p; }
            sfx('snap');
          }
          render();
        },
      })));
      put(foot.firstChild, h('kbd', null, 'A'), swapFrom === null ? ' くわしく' : swapFrom === -1 ? ' 1体目をえらぶ' : ' 入れかえる相手をえらぶ');
    }
    render();
  }

  function monDetail(m, i) {
    const slot = h('div', { class: 'ui-slot3d', 'data-label': '3D VIEW', data: { slot: 'mon-detail' } });
    const stats = m.stats || {};
    const kv = h('dl', { class: 'ui-kv' },
      ...['atk', 'def', 'spd', 'int'].flatMap((k) => [h('dt', null, STAT[k]), h('dd', null, gauge(Math.min(1, (stats[k] || 0) / 60), 'stat')), h('dd', null, num(stats[k] ?? '-'))]));
    const parts = h('div', { class: 'ui-parts3' }, ...['head', 'back', 'tail'].map((k) => {
      const p = (m.parts || {})[k] || {};
      return h('div', { class: ['ui-partcard', p.from && 'is-hand', p.star >= 2 && 'is-n' + p.star] },
        h('h4', null, h('span', { class: 'ui-small ui-mute' }, PART_SLOT[k]), stars(p.star)),
        h('div', null, p.label || '—'),
        p.stat ? h('div', { class: 'ui-small' }, `${STAT[p.stat]} +${p.pct}%`) : null,
        p.from ? h('div', { class: 'where' }, 'おさがり: ' + p.from) : h('div', { class: 'where' }, 'うまれつき'));
    }));
    const skills = h('div', { class: 'ui-skills' }, ...(m.skills || []).map((sk) => h('div', { class: 'ui-skill' + (sk.part ? ' ui-skill--part' : '') }, elBox(sk.el || 'none'), sk.name, sk.mp ? num(sk.mp) : h('span', { class: 'ui-num' }, '—'))));
    const sheet = h('div', { class: 'ui-sheet' },
      h('div', { class: 'ui-head' }, pn('B-' + (i + 1)), h('h2', null, m.name), matChip(m.mat), h('span', { class: 'ui-num', style: { fontSize: '18px' } }, 'Lv' + m.lv), h('div', { class: 'ui-head__r' }, closeBtn(() => s.close()))),
      h('div', { class: 'ui-sheet__body' },
        h('div', { class: 'ui-detail' },
          h('div', null, slot, h('div', { class: 'ui-small ui-mute', style: { marginTop: '4px' } }, (m.species && m.species !== m.name ? m.species + ' / ' : '') + (m.gen ? m.gen + '代目' : 'スカウト') + (m.bonus ? ` / 伸び +${Math.round(m.bonus * 100)}%` : ''))),
          h('div', null,
            h('div', { class: 'ui-mon__bars', style: { fontSize: '12px', marginBottom: '6px' } },
              'HP', gauge(m.hp / m.maxHp), h('span', { class: 'ui-num' }, m.hp + '/' + m.maxHp),
              'MP', gauge(m.mp / Math.max(1, m.maxMp), true), h('span', { class: 'ui-num' }, m.mp + '/' + m.maxMp),
              'EXP', gauge(m.nextXp ? (m.xp || 0) / m.nextXp : 0), h('span', { class: 'ui-num' }, m.nextXp ? 'あと ' + Math.max(0, m.nextXp - (m.xp || 0)) : '—')),
            kv)),
        h('hr', { class: 'ui-hr' }),
        h('div', { class: 'ui-small', style: { margin: '0 0 4px' } }, 'パーツ(★ = なじみ)'), parts,
        h('div', { class: 'ui-small', style: { margin: '10px 0 4px' } }, 'わざ(点線 = パーツわざ・5つ目の枠)'), skills));
    const s = openLayer(sheet, { onBack: () => s.close() });
    d.onDetail && d.onDetail(m, i, slot);
  }

  // ---------- どうぐ ----------
  function itemSheet() {
    const body = h('div', { class: 'ui-list' });
    const desc = h('div', { class: 'ui-shop__desc' }, 'どうぐを えらんでください');
    const msg = h('div', { class: 'ui-msgline' });
    const sheet = h('div', { class: 'ui-sheet' },
      h('div', { class: 'ui-head' }, pn('A-2'), h('h2', null, 'どうぐ'), h('div', { class: 'ui-head__r' }, closeBtn(() => s.close()))),
      h('div', { class: 'ui-sheet__body' }, runner('C', 'どうぐ', body)), desc, msg);
    const s = openLayer(sheet, { onBack: () => s.close() });
    function render() {
      const list = st.items.filter((it) => it.count > 0);
      if (!list.length) put(body, h('div', { class: 'ui-mute' }, 'なにも もっていない'));
      else put(body, ...list.map((it, i) => {
        const b = part({
          code: 'C-' + (i + 1), label: it.name, sub: it.field === false ? '戦闘で使う' : null, end: h('span', { class: 'ui-num' }, '×' + it.count),
          onClick: () => {
            if (it.field === false) { msg.textContent = 'いまは つかえない'; msg.classList.add('is-err'); return; }
            if (it.target === 'all' || it.target === 'none') return use(it, null);
            pickTarget(it, (ti) => use(it, ti));
          },
        });
        b.addEventListener('focus', () => (desc.textContent = it.desc || ''));
        b.addEventListener('pointerenter', () => (desc.textContent = it.desc || ''));
        return b;
      }));
    }
    function use(it, ti) {
      const r = (d.onUseItem && d.onUseItem(it.id, ti)) || { ok: true };
      if (r.party) st.party = r.party;
      if (r.items) st.items = r.items; else if (r.ok) it.count--;
      msg.classList.toggle('is-err', !r.ok);
      msg.textContent = r.msg || (r.ok ? `${it.name} を つかった` : 'つかえなかった');
      sfx(r.ok ? 'heal' : 'cancel');
      render();
    }
    render();
    // カーソルが動いたら説明を出す
    const obs = new MutationObserver(() => { const c = body.querySelector('.is-cur'); if (c) { const i = [...body.children].indexOf(c); const it = st.items.filter((x) => x.count > 0)[i]; if (it) desc.textContent = it.desc || ''; } });
    obs.observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /** なかまを1体えらぶ小さな窓 */
  function pickTarget(it, cb) {
    const list = h('div', { class: 'ui-list' }, ...st.party.map((m, i) => part({
      code: 'B-' + (i + 1), label: monCard(m),
      disabled: it.target === 'down' ? !(m.hp <= 0) : false,
      onClick: () => { s.close(); cb(i); },
    })));
    const sheet = h('div', { class: 'ui-sheet', style: { maxWidth: '460px' } },
      h('div', { class: 'ui-head' }, pn('C'), h('h2', null, `${it.name} → だれに?`), h('div', { class: 'ui-head__r' }, closeBtn(() => s.close()))),
      h('div', { class: 'ui-sheet__body' }, runner('B', 'なかま', list)));
    const s = openLayer(sheet, { scrim: true, onBack: () => s.close() });
  }

  // ---------- 設定 ----------
  function settingsSheet() {
    const set = { ...st.settings };
    const emit = (k) => { st.settings = { ...set }; d.onSettings && d.onSettings({ ...set }, k); };
    const seg = h('div', { class: 'ui-seg' }, ...[['low', '低'], ['mid', '中'], ['high', '高']].map(([v, t]) =>
      h('button', { class: 'ui-sel' + (set.quality === v ? ' is-on' : ''), type: 'button', on: { click: (e) => { set.quality = v; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === e.currentTarget)); sfx('ok'); emit('quality'); } } }, t)));
    const dots = (key) => {
      const wrap = h('div', { class: 'ui-dots', role: 'group' });
      const render = () => put(wrap, 
        h('button', { class: 'zero ui-sel' + (set[key] === 0 ? ' is-on' : ''), type: 'button', 'aria-label': '切', on: { click: () => { set[key] = 0; render(); sfx('ok'); emit(key); } } }, '切'),
        ...[1, 2, 3, 4, 5].map((n) => h('button', { class: 'ui-sel' + (n <= set[key] ? ' is-on' : ''), type: 'button', 'aria-label': String(n), on: { click: (e) => { set[key] = n; render(); wrap.querySelectorAll('button')[n].classList.add('is-cur'); sfx(key === 'se' ? 'cursor' : 'ok'); emit(key); } } },
          h('i', { style: { height: 6 + n * 5 + 'px' } }))));
      render();
      return wrap;
    };
    const msg = h('div', { class: 'ui-msgline' });
    const ta = h('textarea', { class: 'ui-textarea', placeholder: '書き出した文字を ここに はりつけて「読みこむ」', spellcheck: false });
    const sheet = h('div', { class: 'ui-sheet' },
      h('div', { class: 'ui-head' }, pn('A-4'), h('h2', null, '設定'), h('div', { class: 'ui-head__r' }, closeBtn(() => s.close()))),
      h('div', { class: 'ui-sheet__body' }, h('div', { class: 'ui-set' },
        h('div', { class: 'ui-set__row' }, h('label', null, pn('D-1', 'ui-pn--line'), '画質'), seg),
        h('div', { class: 'ui-small ui-mute', style: { marginTop: '-8px' } }, '低 = 影1枚・ぼかしなし / 中 = やわらかい影・ぼかし / 高 = すき間の暗がり・こまかく'),
        h('div', { class: 'ui-set__row' }, h('label', null, pn('D-2', 'ui-pn--line'), 'BGM'), dots('bgm')),
        h('div', { class: 'ui-set__row' }, h('label', null, pn('D-3', 'ui-pn--line'), '効果音'), dots('se')),
        h('div', { class: 'ui-set__row', style: { borderBottom: 0 } }, h('label', null, pn('D-4', 'ui-pn--line'), 'セーブの書き出し / 読みこみ'),
          h('div', { class: 'ui-btnrow' },
            btn('書き出す', () => { ta.value = d.getExport ? d.getExport() : ''; ta.select(); try { navigator.clipboard?.writeText(ta.value); msg.textContent = '書き出して、コピーしました'; } catch (e) { msg.textContent = '書き出しました。文字を コピーしてください'; } msg.classList.remove('is-err'); }),
            btn('読みこむ', () => { const r = d.onImport ? d.onImport(ta.value) : { ok: false, msg: 'まだ つながっていません' }; msg.textContent = r.msg || (r.ok ? '読みこみました' : '読みこめませんでした'); msg.classList.toggle('is-err', !r.ok); sfx(r.ok ? 'snap' : 'cancel'); }))),
        ta, msg)));
    const s = openLayer(sheet, { onBack: () => s.close() });
  }

  // ---------- セーブ ----------
  function saveSheet() {
    const msg = h('div', { class: 'ui-msgline', style: { textAlign: 'center' } }, 'いまの ところを 1枠に セーブします');
    const yes = btn('セーブする', async () => {
      yes.disabled = true;
      const r = (d.onSave && (await d.onSave())) || { ok: true };
      msg.textContent = r.msg || (r.ok ? 'セーブしました' : 'セーブできませんでした');
      msg.classList.toggle('is-err', !r.ok);
      if (r.ok) { snapIn(stamp, { from: 'up' }); stamp.hidden = false; }
      setTimeout(() => s.close(), 900);
    }, 'ui-btn--ink');
    const stamp = h('div', { class: 'ui-pn ui-pn--acc ui-pn--big', hidden: true, style: { margin: '6px auto 0', display: 'flex', width: 'fit-content', padding: '0 10px' } }, 'SAVED');
    const box = h('div', { class: 'ui-inn' }, runner('E', 'セーブ', [msg, stamp, h('div', { class: 'ui-btnrow' }, btn('やめる', () => s.close()), yes)], 'ui-runner--flat'));
    const s = openLayer(box, { scrim: true, onBack: () => s.close() });
    setCur(yes, true);
  }

  return {
    close,
    /** お金・なかま・道具が変わったら */
    update(nd) { Object.assign(st, nd); if (nd.money != null) moneyEl.textContent = nd.money; },
  };
}
