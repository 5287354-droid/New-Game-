// 会話の窓: 名前の札・文字送り・選択肢・注意書き(チュートリアル)。
import { h, pn, sfx, put } from './dom.js';
import { openLayer, runner, part } from './widgets.js';
import { typewriter, snapIn } from './fx.js';
import { setCur } from './input.js';

/**
 * 会話の窓を作る。1つ作って使い回す。
 * @param {{speed?:number}} [opt] speed = 1文字の ms(0 で一度に出す)
 */
export function createDialog(opt = {}) {
  let ui = null, box, nameEl, textEl, choicesWrap, tw = null, onAdvance = null;

  function ensure() {
    if (ui) return;
    nameEl = h('div', { class: 'ui-dlg__name' });
    textEl = h('div', { class: 'ui-dlg__text' });
    box = h('div', { class: 'ui-dlg', on: { click: () => advance() } }, nameEl, textEl, h('i', { class: 'ui-dlg__next' }));
    choicesWrap = h('div', { class: 'ui-dlg__choices' });
    box.append(choicesWrap);
    ui = openLayer(box, { from: 'down', sound: 'open', noNav: false, onBack: () => advance(true), onKey: (k) => { if (k === 'a' && !box.classList.contains('is-choice')) { advance(); return true; } return false; }, scope: () => choicesWrap });
  }

  function advance(isBack) {
    if (box.classList.contains('is-choice')) { if (isBack && cancelIndex != null) choose(cancelIndex); return; }
    if (tw && !tw.finished()) { tw.skip(); return; }
    if (onAdvance) { const f = onAdvance; onAdvance = null; sfx('ok'); f(); }
  }
  let cancelIndex = null, chooseFn = null;
  function choose(i) { if (chooseFn) { const f = chooseFn; chooseFn = null; f(i); } }

  /**
   * 1つ話す。
   * @param {{name?:string, code?:string, text:string, choices?:string[], cancel?:number, note?:boolean, speed?:number}} line
   *   name: 話す人(注意書きなら省略可) / code: 名前の札の前の部品番号 / choices: 選択肢 / cancel: B で選ばれる番号 / note: 注意書きの枠
   * @param {(choice?:number)=>void} [cb]
   * @returns {Promise<number|undefined>} 選んだ番号(選択肢がなければ undefined)
   */
  function say(line, cb) {
    ensure();
    box.classList.toggle('ui-dlg--note', !!line.note);
    put(nameEl, 
      line.code ? pn(line.code) : null,
      h('b', null, line.note ? (line.name || '注意') : (line.name || '')));
    nameEl.hidden = !line.name && !line.note;
    put(choicesWrap, );
    box.classList.remove('is-choice');
    box.classList.add('is-typing');
    tw = typewriter(textEl, line.text, { speed: line.speed ?? opt.speed ?? 32 });
    return new Promise((resolve) => {
      const fin = (v) => { cb && cb(v); resolve(v); };
      tw.done.then(() => {
        box.classList.remove('is-typing');
        if (!line.choices || !line.choices.length) { onAdvance = () => fin(undefined); return; }
        box.classList.add('is-choice');
        cancelIndex = line.cancel ?? null;
        const items = line.choices.map((c, i) => part({ code: 'A-' + (i + 1), label: c, onClick: () => { put(choicesWrap, ); box.classList.remove('is-choice'); choose(i); } }));
        const r = runner('A', 'えらぶ', items);
        choicesWrap.append(r);
        chooseFn = fin;
        setCur(items[0], true);
        snapIn(r, { from: 'right', sound: 'snap' });
      });
    });
  }

  /** いくつか続けて話す。最後の選択の番号を返す */
  async function script(lines, cb) {
    let last;
    for (const l of lines) last = await say(typeof l === 'string' ? { text: l } : l);
    close();
    cb && cb(last);
    return last;
  }

  function close() { if (ui) { ui.close(); ui = null; tw = null; onAdvance = null; chooseFn = null; } }

  return { say, script, close, get isOpen() { return !!ui; } };
}
