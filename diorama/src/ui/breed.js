// 配合の画面: 組立説明書の見開き。
// ①親2体をえらぶ → ②子の予想 → ③おさがりパーツ → ④わざ(2つまで) → 組み立て(①切りはなす ②組み合わせる ③パチッ)。
// 子の種族・能力の計算は core/breed.js(predict コールバック)。3D の子は data-slot="breed-child" の div に置く。
import { h, pn, num, step, sfx, wait, reduced, put } from './dom.js';
import { openLayer, part, runner, btn, closeBtn, monCard, matChip, elBox, stars, PART_SLOT, STAT } from './widgets.js';
import { setCur } from './input.js';
import { snapIn, clickMark, banner, hop } from './fx.js';

const STEPS = ['親', '予想', 'おさがり', 'わざ'];
const SLOTS = ['head', 'back', 'tail'];

/**
 * @param {{
 *  candidates: (import('./menu.js').MonView & {id:string, skills:{id:string,name:string,el?:string,mp?:number,part?:boolean}[]})[],
 *  minLv?: number,  maxParts?: 1|2|3,  maxSkills?: number,
 *  predict: (aId:string, bId:string) => (null | {ok?:boolean, reason?:string, species:{name:string, mat:string, body?:string, no?:number}, stats:{hp:number,mp:number,atk:number,def:number,spd:number,int:number}, bonus?:number, gen?:number, native:{head:{label:string},back:{label:string},tail:{label:string}}, skills?:{id:string,name:string,el?:string}[], note?:string}),
 *  onConfirm: (pick:{a:string, b:string, parts:{from:'a'|'b', slot:'head'|'back'|'tail'}[], skills:string[]}) => (any|Promise<any>),
 *  onStage?: (slotEl:HTMLElement, info:{phase:'preview'|'assemble', a?:string, b?:string, pick?:object, result?:any}) => void,
 *  onDone?: (result:any) => void,
 *  onClose?: () => void,
 * }} d
 */
export function openBreed(d) {
  const minLv = d.minLv ?? 10, maxParts = d.maxParts ?? 1, maxSkills = d.maxSkills ?? 2;
  const st = { step: 0, a: null, b: null, parts: [], skills: [], pred: null };
  const byId = (id) => d.candidates.find((c) => c.id === id);

  const stepsEl = h('div', { class: 'ui-br__steps' });
  const leftBody = h('div', { class: 'ui-page__scroll' });
  const footL = h('div', { class: 'ui-br__foot' });
  const stage = h('div', { class: 'ui-slot3d ui-br__stage', 'data-label': 'CHILD 3D', data: { slot: 'breed-child' } });
  const predEl = h('div', { class: 'ui-br__child' });
  const left = h('section', { class: 'ui-page' },
    h('div', { class: 'ui-head' }, pn('H-1'), h('h2', null, '配合 — 組み立て手順'), h('div', { class: 'ui-head__r' }, closeBtn(() => close()))),
    stepsEl, leftBody, footL, h('span', { class: 'ui-page__folio' }, 'P.12'));
  const right = h('section', { class: 'ui-page' },
    h('div', { class: 'ui-head' }, pn('H-2'), h('h2', null, 'できあがり予想')),
    h('div', { class: 'ui-page__scroll' }, stage, predEl), h('span', { class: 'ui-page__folio' }, 'P.13'));
  const spread = h('div', { class: 'ui-spread ui-br', style: { '--fold': '58%' } }, left, right);
  const ui = openLayer(spread, { scrim: true, from: 'up', onBack: () => back(), scope: () => left });

  function close() { ui.close(); d.onClose && d.onClose(); }
  function back() { if (st.step === 0) { if (st.b) { st.b = null; render(); } else if (st.a) { st.a = null; render(); } else close(); } else { st.step--; render(); } }

  function renderSteps() {
    put(stepsEl, ...STEPS.flatMap((s, i) => [
      i ? h('i', { class: 'sep' }) : null,
      step(i + 1, i === st.step ? 'is-on' : i < st.step ? 'is-done' : ''), h('span', { class: 'lab' }, s)]));
  }

  // ---------- 左のページ ----------
  function render() {
    renderSteps();
    put(footL, );
    if (st.step === 0) stepParents();
    else if (st.step === 1) stepPreview();
    else if (st.step === 2) stepParts();
    else stepSkills();
    renderPred();
    const first = leftBody.querySelector('.ui-sel:not([disabled])') || footL.querySelector('.ui-sel:not([disabled])');
    if (first) setCur(first, true);
  }

  function slotBox(id, label) {
    const m = id && byId(id);
    return h('div', { class: 'ui-br__slot' + (m ? ' is-set' : '') }, m ? monCard(m) : label);
  }

  function stepParents() {
    const list = d.candidates.map((m, i) => part({
      code: 'B-' + (i + 1), label: monCard(m), disabled: m.lv < minLv, picked: m.id === st.a || m.id === st.b,
      sub: m.lv < minLv ? `Lv${minLv} から` : null,
      onClick: () => {
        if (m.id === st.a) st.a = st.b, st.b = null;
        else if (m.id === st.b) st.b = null;
        else if (!st.a) st.a = m.id;
        else if (!st.b) st.b = m.id;
        else st.b = m.id;
        sfx('snap');
        render();
      },
    }));
    put(leftBody, 
      h('div', { class: 'ui-br__pair' }, slotBox(st.a, '親 1 を えらぶ'), h('span', { class: 'ui-br__plus' }, '+'), slotBox(st.b, '親 2 を えらぶ')),
      h('div', { class: 'ui-note', style: { marginBottom: '10px' } }, h('div', { class: 'ui-note__h' }, '注意'), `Lv${minLv} 以上の2体から、1体の子が組み上がります。親の2体は いなくなります。`),
      runner('B', 'なかま と あずかり', list));
    footL.append(h('span', { class: 'count' }, `${[st.a, st.b].filter(Boolean).length} / 2`),
      h('div', { class: 'ui-btnrow' }, btn('つぎへ ▶', () => { st.step = 1; render(); }, 'ui-btn--ink', { disabled: !(st.a && st.b && st.pred && st.pred.ok !== false) })));
  }

  function stepPreview() {
    const p = st.pred;
    put(leftBody, 
      h('div', { class: 'ui-br__pair' }, slotBox(st.a), h('span', { class: 'ui-br__plus' }, '+'), slotBox(st.b)),
      h('div', { class: 'ui-note' }, h('div', { class: 'ui-note__h' }, '組み合わせ'),
        `${matName(byId(st.a).mat)} × ${matName(byId(st.b).mat)} → `, h('b', null, p.species.name), '(' + matName(p.species.mat) + ')',
        p.note ? h('div', { class: 'ui-small', style: { marginTop: '4px' } }, p.note) : null),
      h('div', { class: 'ui-small ui-mute', style: { marginTop: '10px' } }, '子は Lv1 から。親のレベルの合計で、伸びにボーナスがつきます。'));
    footL.append(btn('◀ もどる', back), h('div', { class: 'ui-btnrow' }, btn('おさがりを えらぶ ▶', () => { st.step = 2; render(); }, 'ui-btn--ink')));
  }

  function stepParts() {
    const grid = h('div', { class: 'ui-br__picks' });
    for (const who of ['a', 'b']) {
      const m = byId(st[who]);
      grid.append(h('h4', null, pn(who === 'a' ? 'P-1' : 'P-2', 'ui-pn--line'), m.name, 'の パーツ'));
      for (const s of SLOTS) {
        const p = (m.parts || {})[s] || { label: '—' };
        const on = st.parts.some((x) => x.from === who && x.slot === s);
        const nextStar = Math.min(3, (p.from ? (p.star || 1) : 0) + 1);
        grid.append(part({
          code: (who === 'a' ? 'P' : 'Q') + '-' + (SLOTS.indexOf(s) + 1), picked: on,
          label: [h('span', { class: 'ui-small ui-mute' }, PART_SLOT[s] + ' '), p.label],
          sub: [p.stat ? `${STAT[p.stat]}+${p.pct}%` : '', p.trait ? ' 特性つき' : '', p.skill ? ' パーツわざ' : '', ' → ', '★'.repeat(nextStar)],
          end: stars(p.star),
          onClick: () => {
            const i = st.parts.findIndex((x) => x.from === who && x.slot === s);
            if (i >= 0) st.parts.splice(i, 1);
            else {
              st.parts = st.parts.filter((x) => x.slot !== s); // 同じ場所は1つだけ
              st.parts.push({ from: who, slot: s });
              while (st.parts.length > maxParts) st.parts.shift();
            }
            sfx('snap');
            render();
          },
        }));
      }
    }
    put(leftBody, 
      h('div', { class: 'ui-note', style: { marginBottom: '10px' } }, h('div', { class: 'ui-note__h' }, 'おさがりパーツ'),
        `親のパーツを `, h('b', null, maxParts + ' か所'), ` 受けつぎます。子の素材の色で塗りなおされます。おさがりをそのまま受けつぐと ★ が増えます(★3 で金つぎ)。`),
      grid);
    footL.append(btn('◀ もどる', back), h('span', { class: 'count' }, `${st.parts.length} / ${maxParts}`),
      h('div', { class: 'ui-btnrow' }, btn('わざを えらぶ ▶', () => { st.step = 3; render(); }, 'ui-btn--ink')));
  }

  function stepSkills() {
    const seen = new Set();
    const all = [];
    for (const who of ['a', 'b']) for (const s of byId(st[who]).skills || []) if (!s.part && !seen.has(s.id)) { seen.add(s.id); all.push({ ...s, who }); }
    const grid = h('div', { class: 'ui-br__picks' }, ...all.map((s, i) => part({
      code: 'W-' + (i + 1), label: [elBox(s.el || 'none'), ' ', s.name], sub: byId(st[s.who]).name + ' から', picked: st.skills.includes(s.id),
      onClick: () => {
        const k = st.skills.indexOf(s.id);
        if (k >= 0) st.skills.splice(k, 1); else { st.skills.push(s.id); while (st.skills.length > maxSkills) st.skills.shift(); }
        sfx('snap'); render();
      },
    })));
    put(leftBody, 
      h('div', { class: 'ui-note', style: { marginBottom: '10px' } }, h('div', { class: 'ui-note__h' }, 'わざの受けつぎ'), `親のわざから ${maxSkills} つまで。パーツわざは、パーツといっしょに受けつぎます。`),
      grid);
    footL.append(btn('◀ もどる', back), h('span', { class: 'count' }, `${st.skills.length} / ${maxSkills}`),
      h('div', { class: 'ui-btnrow' }, btn('組み立てる', () => confirm(), 'ui-btn--acc')));
  }

  // ---------- 右のページ: 予想 ----------
  let lastPair = '';
  function renderPred() {
    const pair = st.a && st.b ? st.a + '+' + st.b : '';
    if (pair !== lastPair) {
      lastPair = pair;
      st.pred = pair ? d.predict(st.a, st.b) : null;
      if (st.pred) d.onStage && d.onStage(stage, { phase: 'preview', a: st.a, b: st.b, pick: { parts: st.parts } });
      if (st.step === 0) { const nb = footL.querySelector('.ui-btn--ink'); if (nb) nb.disabled = !(st.pred && st.pred.ok !== false); }
    } else if (st.pred) d.onStage && d.onStage(stage, { phase: 'preview', a: st.a, b: st.b, pick: { parts: st.parts } });
    const p = st.pred;
    if (!p) { put(predEl, h('div', { class: 'ui-mute', style: { padding: '10px 0' } }, '親を2体 えらぶと、ここに 子の予想が出ます')); return; }
    if (p.ok === false) { put(predEl, h('div', { class: 'ui-note' }, h('div', { class: 'ui-note__h' }, 'この組み合わせは できない'), p.reason || '')); return; }
    const partsRow = h('div', { class: 'ui-parts3' }, ...SLOTS.map((s) => {
      const inh = st.parts.find((x) => x.slot === s);
      if (inh) {
        const src = byId(st[inh.from]).parts[s];
        const star = Math.min(3, (src.from ? (src.star || 1) : 0) + 1);
        return h('div', { class: ['ui-partcard', 'is-hand', star >= 2 && 'is-n' + star] }, h('h4', null, h('span', { class: 'ui-small ui-mute' }, PART_SLOT[s]), stars(star)), h('div', null, src.label), h('div', { class: 'where' }, 'おさがり: ' + byId(st[inh.from]).name));
      }
      return h('div', { class: 'ui-partcard' }, h('h4', null, h('span', { class: 'ui-small ui-mute' }, PART_SLOT[s])), h('div', null, (p.native[s] || {}).label || '—'), h('div', { class: 'where' }, 'うまれつき'));
    }));
    put(predEl, 
      h('div', { class: 'ui-br__pred' }, p.species.no ? pn('No.' + String(p.species.no).padStart(2, '0')) : null, h('h3', null, p.species.name), matChip(p.species.mat),
        p.gen ? h('span', { class: 'ui-small' }, p.gen + '代目') : null, p.bonus ? h('span', { class: 'ui-small' }, `伸び +${Math.round(p.bonus * 100)}%`) : null),
      h('div', { class: 'ui-br__stats' }, ...Object.entries(p.stats).map(([k, v]) => h('div', null, h('span', null, STAT[k]), h('span', { class: 'ui-num' + (p.bonus ? ' up' : '') }, v)))),
      partsRow,
      st.skills.length ? h('div', { class: 'ui-skills' }, ...st.skills.map((id) => { const s = [...byId(st.a).skills, ...byId(st.b).skills].find((x) => x.id === id); return h('div', { class: 'ui-skill' }, elBox(s.el || 'none'), s.name, h('span', { class: 'ui-small', style: { marginLeft: 'auto' } }, '受けつぎ')); })) : null);
  }
  const matName = (m) => ({ water: '水', fire: '火', paper: '紙', stone: '石', tin: 'ブリキ', cloth: '布' }[m] || m);

  // ---------- 組み立て ----------
  async function confirm() {
    const pick = { a: st.a, b: st.b, parts: st.parts.slice(), skills: st.skills.slice() };
    const result = await d.onConfirm(pick);
    await playAssembly(result, pick);
  }

  /**
   * 組み立ての演出(①切りはなす ②組み合わせる ③パチッ)。onConfirm のあとに自動で流れる。
   * 単独でも呼べる(ギャラリー用)
   */
  async function playAssembly(result, pick = { parts: st.parts }) {
    const handSlots = new Set((pick.parts || []).map((p) => p.slot));
    const name = (result && (result.name || result.species?.name)) || st.pred?.species.name || '???';
    const panels = [1, 2, 3].map((n) => h('div', { class: 'ui-asm__p is-wait' },
      h('header', null, step(n), h('b', null, ['ランナーから 切りはなす', '組み合わせる', 'パチッと はめる'][n - 1]))));
    const doneRow = h('div', { class: 'ui-asm__done', hidden: true });
    const asm = h('div', { class: 'ui-asm' },
      h('div', { class: 'ui-asm__head' }, pn('H-3'), h('h2', null, `組み立て — ${name}`)),
      h('div', { class: 'ui-asm__panels' }, ...panels), doneRow);
    spread.append(asm);
    snapIn(asm, { from: 'scale', burst: false, sound: 'open' });
    const svgs = [svgCut(handSlots), svgJoin(handSlots), svgSnap(handSlots)];
    panels.forEach((p, i) => p.append(svgs[i]));
    const sp = reduced() ? 0.01 : 1;

    // ① 切りはなす
    await on(panels[0]);
    const nip = svgs[0].querySelector('.nipper');
    for (const g of svgs[0].querySelectorAll('.gatecut')) {
      const [gx, gy] = g.dataset.at.split(',').map(Number);
      await anim(nip, [{ transform: nip.style.transform || 'translate(150px,10px)' }, { transform: `translate(${gx}px,${gy}px)` }], 180 * sp);
      nip.style.transform = `translate(${gx}px,${gy}px)`;
      await anim(nip.querySelector('.jaw'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(0)' }], 120 * sp);
      g.style.display = 'none';
      sfx('cut');
      const pid = g.dataset.part;
      const pe = svgs[0].querySelector(`[data-p="${pid}"]`);
      anim(pe, [{ transform: 'translate(0,0)' }, { transform: 'translate(0,7px) rotate(4deg)' }], 200 * sp).then(() => (pe.style.transform = 'translate(0,7px) rotate(4deg)'));
      await wait(110 * sp);
    }
    await anim(nip, [{ opacity: 1 }, { opacity: 0 }], 150 * sp);
    done(panels[0]);

    // ② 組み合わせる
    await on(panels[1]);
    const movers = [...svgs[1].querySelectorAll('[data-move]')];
    for (const m of movers) {
      const [dx, dy] = m.dataset.move.split(',').map(Number);
      sfx('slide');
      await anim(m, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], 300 * sp, 'cubic-bezier(.5,0,.3,1)');
      m.style.transform = `translate(${dx}px,${dy}px)`;
    }
    svgs[1].querySelectorAll('.arrow,.arrowhead').forEach((a) => (a.style.opacity = '.25'));
    done(panels[1]);

    // ③ パチッ
    await on(panels[2]);
    const slot3d = h('div', { class: 'ui-slot3d', 'data-label': 'CHILD 3D', data: { slot: 'breed-child-final' } });
    panels[2].append(slot3d);
    d.onStage && d.onStage(slot3d, { phase: 'assemble', result, pick });
    const fig = svgs[2].querySelector('.fig');
    for (const s of svgs[2].querySelectorAll('[data-snap]')) {
      await anim(s, [{ transform: 'translate(0,-16px)', opacity: 0 }, { transform: 'translate(0,2px)', opacity: 1, offset: 0.7 }, { transform: 'translate(0,0)', opacity: 1 }], 200 * sp, 'cubic-bezier(.3,1.6,.5,1)');
      s.style.opacity = 1;
      sfx('snap');
      await wait(60 * sp);
    }
    const pachi = svgs[2].querySelector('.pachiG');
    pachi.style.opacity = 1;
    clickMark(fig, { len: 12 });
    anim(pachi, [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(.95)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], 220 * sp);
    hop(fig, 10);
    sfx('snap', { big: true });
    await wait(260 * sp);
    // 最後に、台の上でくるりと回る(3D 側。2D の絵も Y 回転で見せる)
    await anim(fig, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }], 700 * sp, 'cubic-bezier(.4,0,.2,1)');
    done(panels[2]);
    await banner('完成!', { sub: `${name} が 組み上がった`, code: 'H-4', kind: 'done', hold: 900 });
    doneRow.hidden = false;
    const ok = btn('つぎへ ▶', () => { close(); d.onDone && d.onDone(result); }, 'ui-btn--ink');
    put(doneRow, step('✓', 'is-done'), h('b', null, name), h('span', { class: 'ui-mute ui-small' }, 'なかまに くわわった'), ok);
    snapIn(doneRow, { from: 'down' });
    setCur(ok, true);
    ui.layer.scope = () => doneRow;
  }
  async function on(p) { p.classList.remove('is-wait'); p.classList.add('is-on'); snapIn(p.querySelector('header .ui-step'), { sound: 'snap' }); await wait(reduced() ? 0 : 160); }
  function done(p) { p.classList.remove('is-on'); p.querySelector('header .ui-step').classList.add('is-done'); }
  function anim(el, kf, ms, easing = 'cubic-bezier(.2,.9,.25,1)') {
    if (!el) return Promise.resolve();
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center';
    return el.animate(kf, { duration: Math.max(1, ms), easing, fill: 'forwards' }).finished.catch(() => {});
  }

  render();
  return { close, playAssembly, get state() { return { ...st }; } };
}

// ---------- 説明書の絵(SVG) ----------
const NS = 'http://www.w3.org/2000/svg';
function svg(inner, vb = '0 0 200 150') { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb); s.setAttribute('preserveAspectRatio', 'xMidYMid meet'); s.innerHTML = inner; return s; }
const SHAPE = {
  body: (x, y) => `<ellipse class="part" cx="${x}" cy="${y}" rx="30" ry="25"/><circle cx="${x - 9}" cy="${y - 4}" r="4" fill="#1B1915"/><circle cx="${x + 9}" cy="${y - 4}" r="4" fill="#1B1915"/>`,
  head: (x, y, hand) => `<path class="part${hand ? ' hand' : ''}" d="M${x - 16} ${y + 8} Q${x - 18} ${y - 12} ${x} ${y - 14} Q${x + 18} ${y - 12} ${x + 16} ${y + 8} Z"/><line class="thin" x1="${x - 6}" y1="${y - 4}" x2="${x + 6}" y2="${y - 4}"/>`,
  back: (x, y, hand) => `<path class="part${hand ? ' hand' : ''}" d="M${x - 12} ${y + 10} L${x - 8} ${y - 12} L${x} ${y - 4} L${x + 8} ${y - 12} L${x + 12} ${y + 10} Z"/>`,
  tail: (x, y, hand) => `<path class="part${hand ? ' hand' : ''}" d="M${x - 14} ${y + 6} Q${x - 4} ${y - 16} ${x + 14} ${y - 8} Q${x + 2} ${y - 4} ${x - 4} ${y + 10} Z"/>`,
};
function svgCut(hand) {
  // ランナーの枠 + 4つの部品(胴・頭・背中・しっぽ)。おさがりのパーツはアクセント色
  const pos = { body: [62, 100], head: [62, 40], back: [140, 40], tail: [140, 100] };
  let parts = '', gates = '';
  for (const [k, [x, y]] of Object.entries(pos)) {
    parts += `<g data-p="${k}">${k === 'body' ? SHAPE.body(x, y) : SHAPE[k](x, y, hand.has(k))}<text x="${x + (k === 'body' ? 24 : 16)}" y="${y + (k === 'body' ? 24 : 18)}">${{ body: 'A1', head: 'A2', back: 'A3', tail: 'A4' }[k]}</text></g>`;
    const gx = x < 100 ? x + (k === 'body' ? 30 : 17) : x - 17, gy = y;
    const rx = 100;
    gates += `<g class="gatecut" data-part="${k}" data-at="${(gx + rx) / 2 - 10},${gy - 12}"><rect class="gate" x="${Math.min(gx, rx)}" y="${gy - 2.5}" width="${Math.abs(rx - gx)}" height="5"/></g>`;
  }
  return svg(`<rect class="runner" x="6" y="8" width="188" height="134" rx="8"/><rect class="runner" x="97" y="12" width="6" height="126" rx="2"/>
    <rect class="runner" x="14" y="16" width="172" height="118" rx="5" fill="none"/>
    ${gates}${parts}
    <g class="nipper" style="transform:translate(150px,10px)"><path class="ink" d="M10 22 L2 2" /><g class="jaw"><path class="ink" d="M10 22 L18 2"/></g><path class="ink" d="M10 22 L4 40 M10 22 L18 40" stroke-width="4"/></g>`);
}
function svgJoin(hand) {
  return svg(`${SHAPE.body(100, 98)}
    <g data-move="0,26">${SHAPE.head(100, 34, hand.has('head'))}</g>
    <g data-move="-22,18">${SHAPE.back(158, 62, hand.has('back'))}</g>
    <g data-move="18,4">${SHAPE.tail(40, 104, hand.has('tail'))}</g>
    <path class="arrow" d="M100 48 L100 60"/><path class="arrowhead" d="M94 60 L106 60 L100 68 Z"/>
    <path class="arrow" d="M150 70 L136 78"/><path class="arrowhead" d="M138 72 L134 84 L130 76 Z"/>
    <path class="arrow" d="M52 104 L62 104"/><path class="arrowhead" d="M62 98 L62 110 L70 104 Z"/>`);
}
function svgSnap(hand) {
  return svg(`<ellipse cx="100" cy="132" rx="56" ry="8" fill="none" stroke="#1B1915" stroke-width="2" stroke-dasharray="4 4"/>
    <g class="fig" style="transform-origin:100px 90px">${SHAPE.body(100, 98)}
      <g data-snap style="opacity:0">${SHAPE.head(100, 60, hand.has('head'))}</g>
      <g data-snap style="opacity:0">${SHAPE.back(136, 80, hand.has('back'))}</g>
      <g data-snap style="opacity:0">${SHAPE.tail(58, 108, hand.has('tail'))}</g></g>
    <g class="pachiG" style="opacity:0;transform-origin:160px 30px"><text class="pachi" x="138" y="34">パチッ</text>
      <path class="snap" d="M130 44 L122 52 M142 48 L142 58 M120 36 L110 36"/></g>`);
}
