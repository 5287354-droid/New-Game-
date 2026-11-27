// 戦闘の画面(3D の対戦台の上に重ねる): 札(HP/MP)・コマンド・対象の選択・数字・メッセージ・ランプ/針の予告。
// 計算は core/battle.js。UI は「表示」と「選んだ結果を返す」だけ。
import { h, pn, num, sfx, wait, fxLayer, uiRoot, put } from './dom.js';
import { part, runner, btn, gauge, matChip, elBox, MAT, STATUS, openLayer } from './widgets.js';
import { setCur, pushLayer, popLayer } from './input.js';
import { popNumber, shake, hop, setGauge, countTo, snapIn, typewriter, banner, freeze } from './fx.js';

const BEATS = { water: 'fire', fire: 'paper', paper: 'stone', stone: 'tin', tin: 'cloth', cloth: 'water' };
const CMDS = [
  ['attack', 'たたかう'], ['skill', 'わざ'], ['swap', 'いれかえ'],
  ['item', 'どうぐ'], ['scout', 'スカウト'], ['run', 'にげる'],
];

/**
 * @typedef {Object} BattleMon
 * @property {string} id   戦闘の中で一意(例 'a0' 'f1')
 * @property {string} name @property {number} lv @property {string} mat
 * @property {number} hp @property {number} maxHp @property {number} [mp] @property {number} [maxMp]
 * @property {'front'|'back'} [row] @property {string} [status] @property {boolean} [boss]
 */

/**
 * 戦闘の UI を作る。
 * @param {{allies:BattleMon[], foes:BattleMon[], turn?:number}} init
 */
export function createBattleUI(init) {
  const mons = new Map();
  const tags = new Map();
  let anchors = {};
  let turnNo = init.turn || 1;

  const foesEl = h('div', { class: 'ui-bt__foes' });
  const alliesEl = h('div', { class: 'ui-bt__allies' });
  const msgText = h('div', { class: 'ui-bt__msgtext' });
  const turnEl = h('span', { class: 'ui-bt__turn' }, 'TURN ' + String(turnNo).padStart(2, '0'));
  const msgEl = h('div', { class: 'ui-bt__msg', on: { click: () => msgSkip && msgSkip() } }, turnEl, msgText);
  const panelEl = h('div', { class: 'ui-bt__panel', hidden: true });
  const lowEl = h('div', { class: 'ui-bt__low' }, msgEl, panelEl);
  const phaseEl = h('div', { class: 'ui-bt__phase', hidden: true });
  const marksEl = h('div', { class: 'ui-layer ui-bt__marks', style: { pointerEvents: 'none' } });
  const el = h('div', { class: 'ui-bt' }, foesEl, phaseEl, alliesEl, lowEl);
  const wrap = h('div', { class: 'ui-layer ui-pass' }, el, marksEl);
  wrap.style.pointerEvents = 'none';
  uiRoot().insertBefore(wrap, uiRoot().querySelector('.ui-fxlayer'));

  // 下のパネルの高さに合わせて、味方の札の位置を決める
  const ro = new ResizeObserver(() => {
    el.style.setProperty('--low-h', lowEl.offsetHeight + 'px');
    el.style.setProperty('--msg-h', msgEl.offsetHeight + 'px');
  });
  ro.observe(lowEl);

  function tag(m, side) {
    const t = h('button', { class: `ui-bm ${side === 'foe' ? 'is-foe' : ''}`, type: 'button', data: { id: m.id } });
    t.innerHTML = '';
    tags.set(m.id, t);
    renderTag(m.id);
    return t;
  }
  function renderTag(id) {
    const m = mons.get(id), t = tags.get(id);
    const isFoe = m.side === 'foe';
    const idx = (isFoe ? init.foes : init.allies).findIndex((x) => x.id === id);
    t.classList.toggle('is-back', m.row === 'back');
    t.classList.toggle('is-down', m.hp <= 0);
    put(t, 
      m.row === 'back' ? h('span', { class: 'ui-bm__row2' }, 'BACK') : null,
      h('span', { class: 'ui-bm__st' }, m.status ? h('span', { class: 'ui-status' }, STATUS[m.status] || m.status) : null, m.boss ? h('span', { class: 'ui-status' }, 'ぬし') : null),
      h('span', { class: 'ui-bm__row' }, h('span', { class: 'ui-bm__no' }, (isFoe ? 'E-' : 'P-') + (idx + 1)), h('span', { class: 'ui-bm__name' }, m.name), h('span', { class: 'ui-bm__lv' }, m.lv)),
      h('span', { class: 'ui-bm__row' }, matChip(m.mat)),
      (m.hpG = gauge(m.hp / m.maxHp)),
      !isFoe && m.maxMp ? (m.mpG = gauge((m.mp || 0) / m.maxMp, true)) : null,
      !isFoe ? h('span', { class: 'ui-bm__nums' }, h('span', null, h('small', null, 'HP '), (m.hpN = num(m.hp))), h('span', null, h('small', null, 'MP '), (m.mpN = num(m.mp ?? 0)))) : null);
  }
  for (const m of init.foes) mons.set(m.id, { ...m, side: 'foe', row: m.row || 'front' });
  for (const m of init.allies) mons.set(m.id, { ...m, side: 'ally', row: m.row || 'front' });
  foesEl.append(...init.foes.map((m) => tag(mons.get(m.id), 'foe')));
  alliesEl.append(...init.allies.map((m) => tag(mons.get(m.id), 'ally')));
  // 入ってくる: 札が上下からパチッ
  [...foesEl.children].forEach((t, i) => snapIn(t, { from: 'up', delay: 80 * i, sound: i ? false : 'snap', burst: false }));
  [...alliesEl.children].forEach((t, i) => snapIn(t, { from: 'down', delay: 240 + 80 * i, sound: i ? false : 'snap', burst: false }));

  // ---------- メッセージ ----------
  let msgSkip = null;
  /**
   * メッセージを出す。文字送りが終わってから hold ms 待つ(タップで飛ばせる)
   * @returns {Promise<void>}
   */
  function message(text, o = {}) {
    const tw = typewriter(msgText, text, { speed: o.speed ?? 22 });
    return new Promise((res) => {
      let t = null;
      const end = () => { msgSkip = null; clearTimeout(t); res(); };
      msgSkip = () => { if (!tw.finished()) tw.skip(); else end(); };
      tw.done.then(() => { if (o.hold === Infinity) return; t = setTimeout(end, o.hold ?? 600); });
    });
  }

  // ---------- 札の更新 ----------
  /**
   * 1体の値を変える。HP が減ったら札がふるえ、ゲージに「なごり」が残る
   * @param {string} id @param {Partial<BattleMon>} patch
   */
  function setMon(id, patch) {
    const m = mons.get(id); if (!m) return;
    const prevHp = m.hp, prevRow = m.row, prevSt = m.status;
    Object.assign(m, patch);
    if (patch.row !== undefined && patch.row !== prevRow || patch.status !== undefined && patch.status !== prevSt || patch.name || patch.lv) {
      renderTag(id); if (patch.row !== prevRow) snapIn(tags.get(id), { from: patch.row === 'back' ? 'down' : 'up' });
      return;
    }
    if (patch.hp !== undefined) {
      setGauge(m.hpG, m.hp / m.maxHp);
      if (m.hpN) countTo(m.hpN, Math.max(0, m.hp));
      if (m.hp < prevHp) shake(tags.get(id), m.hp <= 0 ? 1.6 : 1);
      if (m.hp > prevHp) hop(tags.get(id), 4);
      tags.get(id).classList.toggle('is-down', m.hp <= 0);
    }
    if (patch.mp !== undefined && m.mpG) { setGauge(m.mpG, m.mp / m.maxMp); countTo(m.mpN, m.mp); }
  }

  /** 3D の人形の画面上の位置。{ id: {x, y} }(頭の上)。数字・対象の印に使う */
  function setAnchors(a) { anchors = { ...anchors, ...a }; }
  function anchorOf(id) {
    if (anchors[id]) return anchors[id];
    const r = tags.get(id).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: mons.get(id).side === 'foe' ? r.bottom + 30 : r.top - 10 };
  }

  /**
   * 数字を出して、札も動かす(3D のヒットストップと同じ瞬間に呼ぶ)
   * @param {string} id @param {number} value
   * @param {'dmg'|'crit'|'weak'|'resist'|'heal'|'mp'|'miss'|'guard'} [kind]
   * @param {{newHp?:number, delay?:number}} [o] newHp を渡すとゲージも減らす
   */
  function pop(id, value, kind = 'dmg', o = {}) {
    const a = anchorOf(id);
    const p = popNumber(a.x, a.y, value, { kind, delay: o.delay, dir: mons.get(id).side === 'foe' ? 'r' : 'l' });
    if (o.newHp !== undefined) setTimeout(() => setMon(id, { hp: o.newHp }), (o.delay || 0) + 80);
    if (kind === 'crit' || kind === 'weak') setTimeout(() => freeze(60), (o.delay || 0) + 90);
    return p;
  }

  // ---------- 予告(ランプ・針) ----------
  /**
   * @param {null | {lamp:{now:'light'|'shadow', next:('light'|'shadow')[]}} | {clock:{hand:0|1|2|3, nextIn:number}}} ph
   *   lamp: カゲボウシ戦。今と、この先2ターンの光/影 / clock: トケイモリ戦。針(0=12時…3=9時)と、次に回るまでのターン
   */
  function setPhase(ph) {
    phaseEl.hidden = !ph;
    if (!ph) return;
    if (ph.lamp) {
      const L = ph.lamp, seq = [L.now, ...(L.next || [])].slice(0, 3);
      put(phaseEl, h('div', { class: 'ui-gaugeplate' },
        h('div', { class: 'ui-gaugeplate__h' }, pn('L', 'ui-pn--line'), 'ランプの予告'),
        h('div', { class: 'ui-lamp' }, ...seq.map((s, i) => h('span', { class: `is-${s}${i === 0 ? ' is-now' : ''}` }, h('b', null, s === 'light' ? '光' : '影'), i === 0 ? 'いま' : `+${i}`))),
        h('div', { class: 'ui-small', style: { marginTop: '3px', fontSize: '10px' } }, L.now === 'shadow' ? '影: 物理わざが当たりにくい' : '光: 攻めどき')));
    } else if (ph.clock) {
      const c = ph.clock;
      const ticks = [0, 1, 2, 3].map((i) => { const a = i * Math.PI / 2; return `<line class="tick" x1="${30 + Math.sin(a) * 22}" y1="${30 - Math.cos(a) * 22}" x2="${30 + Math.sin(a) * 27}" y2="${30 - Math.cos(a) * 27}"/>`; }).join('');
      const svg = `<svg viewBox="0 0 60 60"><circle class="face" cx="30" cy="30" r="27"/>${ticks}
        <line class="next" x1="30" y1="30" x2="30" y2="9" style="transform:rotate(${((c.hand + 1) % 4) * 90}deg)"/>
        <line class="hand" x1="30" y1="30" x2="30" y2="11" style="transform:rotate(${c.hand * 90}deg)"/><circle class="hub" cx="30" cy="30" r="3.5"/></svg>`;
      put(phaseEl, h('div', { class: 'ui-gaugeplate' },
        h('div', { class: 'ui-gaugeplate__h' }, pn('T', 'ui-pn--line'), '文字盤の針'),
        h('div', { class: 'ui-clock', html: svg + `<div><div class="ui-num" style="font-size:22px;line-height:1">${['12', '3', '6', '9'][c.hand]}<small style="font-size:11px">時</small></div><div style="font-size:10px">あと<b class="ui-num" style="font-size:15px"> ${c.nextIn} </b>ターンで<br>前と後ろが入れかわる</div></div>` })));
    }
    snapIn(phaseEl.firstChild, { from: 'right', burst: false, sound: false });
  }

  function setTurn(n) { turnNo = n; turnEl.textContent = 'TURN ' + String(n).padStart(2, '0'); snapIn(turnEl, { burst: false, sound: false }); }

  // ---------- コマンドをえらぶ ----------
  let layer = null;
  function showPanel(content, scope) {
    panelEl.hidden = false; el.classList.add('has-panel');
    put(panelEl, content);
    if (layer) popLayer(layer);
    layer = pushLayer({ el: panelEl, scope: () => scope || panelEl, onBack: () => backFn && backFn() });
    const first = (scope || panelEl).querySelector('.ui-sel:not([disabled])');
    if (first) setCur(first, true);
  }
  function hidePanel() {
    panelEl.hidden = true; el.classList.remove('has-panel'); put(panelEl, );
    if (layer) { popLayer(layer); layer = null; }
    clearTargets();
  }
  let backFn = null;

  /**
   * 1体ぶんのコマンドを聞く。
   * @param {string} actorId
   * @param {{
   *   skills?:{id:string,name:string,el?:string,mp?:number,kind?:string,range?:'melee'|'ranged',target?:'one'|'all'|'ally'|'allAllies'|'self',desc?:string,part?:boolean}[],
   *   items?:{id:string,name:string,count:number,target?:'ally'|'foe'|'all'|'down'|'none'}[],
   *   canScout?:boolean, canRun?:boolean, canBack?:boolean, prompt?:string
   * }} ctx
   * @param {(r:object)=>void} [cb]
   * @returns {Promise<{cmd:'attack'|'skill'|'swap'|'item'|'scout'|'run'|'back', skillId?:string, itemId?:string, target?:string|'all', swapWith?:string}>}
   */
  function askCommand(actorId, ctx = {}, cb) {
    const actor = mons.get(actorId);
    tags.forEach((t) => t.classList.remove('is-actor'));
    tags.get(actorId).classList.add('is-actor');
    hop(tags.get(actorId), 6);
    return new Promise((resolve) => {
      const done = (r) => { tags.get(actorId).classList.remove('is-actor'); hidePanel(); cb && cb(r); resolve(r); };
      const isBack = actor.row === 'back';
      const head = (title, back) => h('div', { class: 'ui-bt__actor' }, pn(tags.get(actorId).querySelector('.ui-bm__no').textContent, 'ui-pn--line'), h('b', null, actor.name), title ? h('span', null, '— ' + title) : null,
        back ? btn('もどる', back) : ctx.canBack ? btn('ひとり前へ', () => done({ cmd: 'back' })) : null);
      const top = () => {
        backFn = ctx.canBack ? () => done({ cmd: 'back' }) : null;
        message(ctx.prompt || `${actor.name}は どうする?`, { hold: Infinity, speed: 0 });
        const items = CMDS.map(([k, label], i) => part({
          code: 'A-' + (i + 1), label,
          disabled: (k === 'scout' && ctx.canScout === false) || (k === 'run' && ctx.canRun === false) || (k === 'item' && !(ctx.items || []).some((x) => x.count > 0)) || (k === 'attack' && isBack),
          sub: k === 'attack' && isBack ? '後列は届かない' : k === 'scout' && ctx.canScout === false ? 'できない' : null,
          onClick: () => onCmd(k),
        }));
        const grid = h('div', { class: 'ui-bt__cmd' }, ...items);
        showPanel(runner('A', 'コマンド', [head(), grid]), grid);
      };
      const onCmd = (k) => {
        if (k === 'attack') return pickTarget({ side: 'foe', melee: true }, top).then((t) => t && done({ cmd: 'attack', target: t }));
        if (k === 'run') return done({ cmd: 'run' });
        if (k === 'scout') return pickTarget({ side: 'foe', hint: 'スカウトする あいて' }, top).then((t) => t && done({ cmd: 'scout', target: t }));
        if (k === 'swap') return swapMenu();
        if (k === 'skill') return skillMenu();
        if (k === 'item') return itemMenu();
      };
      const skillMenu = () => {
        backFn = top;
        const list = (ctx.skills || []).map((s, i) => {
          const noMp = (s.mp || 0) > (actor.mp ?? 0);
          const noReach = s.range === 'melee' && isBack;
          const b = part({
            code: 'B-' + (i + 1), label: [elBox(s.el || 'none'), ' ', s.name], sub: noReach ? '後列からは出せない' : noMp ? 'MP がたりない' : s.desc,
            end: h('span', { class: 'ui-num' }, s.mp ? s.mp : '—'), disabled: noMp || noReach, cls: s.part ? 'is-partskill' : '',
            onClick: () => {
              const tgt = s.target || 'one';
              if (tgt === 'all' || tgt === 'allAllies' || tgt === 'self') return done({ cmd: 'skill', skillId: s.id, target: tgt === 'self' ? actorId : 'all' });
              const side = tgt === 'ally' ? 'ally' : 'foe';
              pickTarget({ side, melee: s.range === 'melee', el: s.el, allowDown: s.kind === 'revive' }, skillMenu).then((t) => t && done({ cmd: 'skill', skillId: s.id, target: t }));
            },
          });
          return b;
        });
        const grid = h('div', { class: 'ui-bt__sub' }, ...list);
        showPanel(runner('B', 'わざ', [head('わざ', top), grid]), grid);
      };
      const itemMenu = () => {
        backFn = top;
        const list = (ctx.items || []).filter((x) => x.count > 0).map((it, i) => part({
          code: 'C-' + (i + 1), label: it.name, end: h('span', { class: 'ui-num' }, '×' + it.count),
          onClick: () => {
            const t = it.target || 'ally';
            if (t === 'all' || t === 'none') return done({ cmd: 'item', itemId: it.id, target: 'all' });
            pickTarget({ side: t === 'foe' ? 'foe' : 'ally', allowDown: t === 'down', onlyDown: t === 'down' }, itemMenu).then((x) => x && done({ cmd: 'item', itemId: it.id, target: x }));
          },
        }));
        const grid = h('div', { class: 'ui-bt__sub' }, ...list);
        showPanel(runner('C', 'どうぐ', [head('どうぐ', top), grid]), grid);
      };
      const swapMenu = () => {
        backFn = top;
        const others = [...mons.values()].filter((m) => m.side === 'ally' && m.id !== actorId && m.row !== actor.row);
        const list = others.map((m, i) => part({ code: 'D-' + (i + 1), label: m.name, sub: (m.row === 'back' ? '後列' : '前列') + ' と入れかえる', end: h('span', { class: 'ui-num' }, m.hp + '/' + m.maxHp), disabled: m.hp <= 0 && actor.row === 'back', onClick: () => done({ cmd: 'swap', swapWith: m.id }) }));
        const grid = h('div', { class: 'ui-bt__sub' }, ...(list.length ? list : [h('div', { class: 'ui-mute' }, '入れかえる あいてが いない')]));
        showPanel(runner('D', 'いれかえ', [head('いれかえ(前列 ⇄ 後列)', top), grid]), grid);
      };
      // 対象をえらぶ: 札と、3D の人形の上の印のどちらでも
      const pickTarget = (o, back) => new Promise((res) => {
        backFn = () => { clearTargets(); res(null); back(); };
        const cands = [...mons.values()].filter((m) => m.side === o.side && (o.onlyDown ? m.hp <= 0 : o.allowDown || m.hp > 0));
        const front = cands.some((m) => m.row === 'front' && m.hp > 0);
        const ok = (m) => !(o.melee && o.side === 'foe' && m.row === 'back' && front);
        message(o.hint || (o.side === 'foe' ? 'だれを ねらう?' : 'だれに つかう?'), { hold: Infinity, speed: 0 });
        const pick = (id) => { sfx('ok'); clearTargets(); res(id); };
        const sels = [];
        for (const m of cands) {
          const t = tags.get(m.id);
          if (!ok(m)) continue;
          t.classList.add('is-target', 'ui-sel');
          t.onclick = () => pick(m.id);
          sels.push(t);
          if (o.el && BEATS[o.el] === m.mat) t.dataset.weak = '1';
          const a = anchors[m.id];
          if (a) {
            const mk = h('button', { class: 'ui-mark', type: 'button', style: { left: a.x + 'px', top: a.y + 'px' }, on: { click: () => pick(m.id) } }, pn(t.querySelector('.ui-bm__no').textContent));
            marksEl.append(mk);
            t.addEventListener('pointerenter', () => mk.classList.add('is-cur'));
          }
        }
        const scope = o.side === 'foe' ? foesEl : alliesEl;
        if (layer) popLayer(layer);
        layer = pushLayer({ el: scope, scope: () => scope, onBack: () => backFn && backFn() });
        if (sels[0]) setCur(sels[0], true);
        syncMarks();
      });
      top();
    });
  }
  function syncMarks() {
    // 札のカーソルと印のカーソルをそろえる
    const tick = () => {
      if (!marksEl.children.length) return;
      const curId = [...tags.entries()].find(([, t]) => t.classList.contains('is-cur') && t.classList.contains('is-target'))?.[0];
      [...marksEl.children].forEach((mk) => mk.classList.toggle('is-cur', mk.textContent === (curId && tags.get(curId).querySelector('.ui-bm__no').textContent)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function clearTargets() {
    tags.forEach((t) => { t.classList.remove('is-target', 'ui-sel', 'is-cur'); t.onclick = null; delete t.dataset.weak; });
    put(marksEl, );
  }

  return {
    el: wrap,
    askCommand, message, setMon, pop, setAnchors, setPhase, setTurn,
    /** いまの値(テスト用) */
    get: (id) => ({ ...mons.get(id) }),
    /** 札を取りかえる(仲間が入れかわったとき) */
    replace(id, m) { const old = mons.get(id); mons.set(id, { ...old, ...m }); renderTag(id); snapIn(tags.get(id), { from: old.side === 'foe' ? 'up' : 'down' }); },
    /** 勝ち・スカウト成功・負けの大きな札 */
    banner: (text, o) => banner(text, o),
    /** コマンドの窓をとじる(戦闘の途中で強制的に) */
    cancel: () => hidePanel(),
    destroy() { hidePanel(); ro.disconnect(); wrap.remove(); },
  };
}
