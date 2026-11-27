// お店(買う・売る)・宿屋・預かり所。
import { h, pn, num, sfx, put } from './dom.js';
import { openLayer, part, runner, btn, closeBtn, monCard } from './widgets.js';
import { setCur } from './input.js';
import { snapIn, countTo, banner } from './fx.js';

/**
 * お店。
 * @param {{
 *  name?:string, money:number,
 *  stock:{id:string,name:string,price:number,desc?:string}[],
 *  bag:{id:string,name:string,count:number,price:number,desc?:string}[],   // 売れる物(price は売り値)
 *  onBuy:(id:string, n:number)=>({ok:boolean, money:number, msg?:string, bag?:any[]}),
 *  onSell?:(id:string, n:number)=>({ok:boolean, money:number, msg?:string, bag?:any[]}),
 *  onClose?:()=>void
 * }} d
 */
export function openShop(d) {
  const st = { mode: 'buy', sel: null, n: 1, money: d.money, bag: d.bag || [] };
  const list = h('div', { class: 'ui-list' });
  const desc = h('div', { class: 'ui-shop__desc' }, 'しなものを えらんでください');
  const moneyN = num(st.money);
  const qtyN = num(1);
  const totalN = num(0);
  const tabs = h('div', { class: 'ui-dex__tabs' });
  const buyBtn = btn('かう', () => deal(), 'ui-btn--ink');
  const qty = h('div', { class: 'ui-qty' }, btn('−', () => setN(st.n - 1), '', { sound: 'cursor' }), qtyN, btn('+', () => setN(st.n + 1), '', { sound: 'cursor' }));
  const sheet = h('div', { class: 'ui-sheet ui-shop' },
    h('div', { class: 'ui-head' }, pn('S-1'), h('h2', null, d.name || 'よろず屋'), h('div', { class: 'ui-head__r' }, h('div', { class: 'ui-coin' }, moneyN), closeBtn(() => close()))),
    tabs,
    h('div', { class: 'ui-sheet__body' }, runner('S', 'しなもの', list)),
    desc,
    h('div', { class: 'ui-shop__bar' }, qty, h('span', { class: 'total' }, 'ごうけい ', totalN, ' G'), h('div', { class: 'ui-btnrow' }, buyBtn)));
  const ui = openLayer(sheet, { onBack: () => close() });
  function close() { ui.close(); d.onClose && d.onClose(); }

  const rows = () => (st.mode === 'buy' ? d.stock : st.bag.filter((x) => x.count > 0));
  function render() {
    put(tabs, btn('かう', () => { st.mode = 'buy'; st.sel = null; render(); }, st.mode === 'buy' ? 'is-on' : ''),
      d.onSell ? btn('うる', () => { st.mode = 'sell'; st.sel = null; render(); }, st.mode === 'sell' ? 'is-on' : '') : null);
    buyBtn.textContent = st.mode === 'buy' ? 'かう' : 'うる';
    put(list, ...rows().map((it, i) => part({
      code: 'S-' + (i + 1), label: it.name, picked: st.sel === it.id,
      sub: st.mode === 'sell' ? `もっている ×${it.count}` : (st.bag.find((b) => b.id === it.id)?.count ? `もっている ×${st.bag.find((b) => b.id === it.id).count}` : null),
      end: h('span', { class: 'ui-num' }, it.price),
      disabled: st.mode === 'buy' && it.price > st.money,
      onClick: () => { st.sel = it.id; st.n = 1; desc.textContent = it.desc || ''; render(); setCur(buyBtn, true); },
    })));
    setN(st.n);
  }
  function cur() { return rows().find((x) => x.id === st.sel); }
  function setN(n) {
    const it = cur();
    const max = !it ? 1 : st.mode === 'buy' ? Math.max(1, Math.min(99, Math.floor(st.money / it.price))) : it.count;
    st.n = Math.max(1, Math.min(max, n));
    qtyN.textContent = st.n;
    totalN.textContent = it ? it.price * st.n : 0;
    buyBtn.disabled = !it || (st.mode === 'buy' && it.price * st.n > st.money);
  }
  function deal() {
    const it = cur(); if (!it) return;
    const r = st.mode === 'buy' ? d.onBuy(it.id, st.n) : d.onSell(it.id, st.n);
    if (r && r.ok) {
      countTo(moneyN, r.money); st.money = r.money; if (r.bag) st.bag = r.bag;
      sfx('coin'); desc.textContent = r.msg || `${it.name} を ${st.n}こ ${st.mode === 'buy' ? 'かった' : 'うった'}`;
      snapIn(moneyN.parentElement, { from: 'scale', sound: false });
    } else { sfx('cancel'); desc.textContent = (r && r.msg) || 'おかねが たりない'; }
    render();
  }
  render();
  return { close };
}

/**
 * 宿屋: 値段を見せて「とまる / やめる」。
 * @param {{name?:string, price:number, money:number, party?:any[], onStay:()=>({ok:boolean,msg?:string}|Promise<any>), onClose?:()=>void}} d
 */
export function openInn(d) {
  const msg = h('div', { class: 'ui-msgline', style: { textAlign: 'center' } }, 'ひと晩 やすむと、なかま みんなが 元気になります');
  const yes = btn('とまる', async () => {
    if (d.price > d.money) { msg.textContent = 'おかねが たりない'; msg.classList.add('is-err'); sfx('cancel'); return; }
    yes.disabled = true;
    const r = (await d.onStay()) || { ok: true };
    await banner('おはよう', { sub: r.msg || 'みんな 元気に なった', code: 'Z-z', kind: 'done', hold: 900 });
    close();
  }, 'ui-btn--ink');
  const box = h('div', { class: 'ui-inn' }, runner('I', d.name || 'ワタおかみの宿', [
    h('div', { class: 'ui-inn__price' }, h('span', null, 'ひと晩'), num(d.price)),
    h('div', { class: 'ui-small ui-mute', style: { textAlign: 'center' } }, 'もっている ', h('span', { class: 'ui-num' }, d.money + ' G')),
    d.party ? h('div', { class: 'ui-list', style: { margin: '8px 0' } }, ...d.party.slice(0, 3).map((m) => h('div', { class: 'ui-part', style: { minHeight: '40px' } }, monCard(m)))) : null,
    msg,
    h('div', { class: 'ui-btnrow' }, btn('やめる', () => close()), yes)], 'ui-runner--flat'));
  const ui = openLayer(box, { scrim: true, onBack: () => close() });
  setCur(yes, true);
  function close() { ui.close(); d.onClose && d.onClose(); }
  return { close };
}

/**
 * 預かり所: 手持ち(6体まで)と あずかり の見開き。部品をタップで反対側へ移す。
 * @param {{party:any[], box:any[], maxParty?:number,
 *   onMove:(from:'party'|'box', index:number)=>({ok:boolean, party:any[], box:any[], msg?:string}),
 *   onClose?:()=>void}} d
 */
export function openStorage(d) {
  const max = d.maxParty ?? 6;
  let party = d.party, box = d.box;
  const L = h('div', { class: 'ui-box__cols' }), R = h('div', { class: 'ui-box__cols' });
  const msg = h('div', { class: 'ui-msgline' });
  const cntL = h('span', { class: 'ui-box__count' }), cntR = h('span', { class: 'ui-box__count' });
  const left = h('section', { class: 'ui-page' },
    h('div', { class: 'ui-head' }, pn('K-1'), h('h2', null, '手持ち'), cntL, h('div', { class: 'ui-head__r' }, closeBtn(() => close()))),
    h('div', { class: 'ui-page__scroll' }, runner('K', 'てもち', L)), msg, h('span', { class: 'ui-page__folio' }, 'P.20'));
  const right = h('section', { class: 'ui-page' },
    h('div', { class: 'ui-head' }, pn('K-2'), h('h2', null, 'あずかり'), cntR),
    h('div', { class: 'ui-page__scroll' }, runner('L', 'あずかり', R)), h('span', { class: 'ui-page__folio' }, 'P.21'));
  const spread = h('div', { class: 'ui-spread ui-box', style: { '--fold': '50%' } }, left, right);
  const ui = openLayer(spread, { scrim: true, onBack: () => close() });
  function close() { ui.close(); d.onClose && d.onClose(); }
  function render() {
    cntL.textContent = `${party.length}/${max}`; cntR.textContent = `${box.length}`;
    put(L, ...party.map((m, i) => part({ code: 'K-' + (i + 1), label: monCard(m), end: '→', disabled: party.length <= 1, onClick: () => move('party', i) })));
    put(R, ...(box.length ? box.map((m, i) => part({ code: 'L-' + (i + 1), label: monCard(m), end: '←', disabled: party.length >= max, onClick: () => move('box', i) })) : [h('div', { class: 'ui-mute' }, 'あずかっている魔物は いない')]));
  }
  function move(from, i) {
    const r = d.onMove(from, i);
    if (!r || !r.ok) { msg.textContent = (r && r.msg) || 'うごかせない'; msg.classList.add('is-err'); return; }
    party = r.party; box = r.box; msg.textContent = r.msg || ''; msg.classList.remove('is-err');
    sfx('snap');
    render();
    const col = from === 'party' ? R : L;
    const last = col.lastElementChild; if (last) snapIn(last, { from: from === 'party' ? 'left' : 'right', sound: false });
  }
  render();
  return { close };
}
