// UI 部品の動きの検査(キーボードとタップで選んで、コールバックに正しい結果が返るか)。
//   cd diorama && python3 -m http.server 8106 &   node tools/ui/check.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8106/tools/ui/gallery.html';

const CASES = [
  ['dialog_choice: ↓ と Enter で 2つ目', 'dialog_choice', async (p) => {
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    return p.evaluate(() => window.__ui.choice);
  }, (v) => v === 1],
  ['battle: たたかう → 対象 → 結果', 'battle', async (p) => {
    await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    return p.evaluate(() => window.__ui.result);
  }, (v) => v && v.cmd === 'attack' && v.target === 'f0'],
  ['battle: たたかう → 後列(E-3)は近接で選べない', 'battle', async (p) => {
    await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    return p.evaluate(() => [...document.querySelectorAll('.ui-bm.is-target')].map((t) => t.dataset.id));
  }, (v) => v.join() === 'f0,f1'],
  ['battle: わざ → B でもどる → にげる', 'battle', async (p) => {
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
    await p.keyboard.press('x'); await p.waitForTimeout(80);
    await p.click('text=にげる'); await p.waitForTimeout(80);
    return p.evaluate(() => window.__ui.result);
  }, (v) => v && v.cmd === 'run'],
  ['battle: 3D の印をタップして対象', 'battle_target', async (p) => {
    await p.click('.ui-mark >> nth=1'); await p.waitForTimeout(80);
    return p.evaluate(() => window.__ui.result);
  }, (v) => v && v.cmd === 'skill' && v.target === 'f1'],
  ['settings: 画質 高 と BGM 5', 'settings', async (p) => {
    await p.click('.ui-seg >> text=高'); await p.click('.ui-dots >> nth=0 >> button >> nth=5');
    return p.evaluate(() => window.__ui.settings);
  }, (v) => v && v.quality === 'high' && v.bgm === 5],
  ['name: かなで「ネジコ」→ けってい', 'name', async (p) => {
    await p.click('.ui-name__tabs >> text=カタカナ'); await p.click('.ui-kana >> text=コ'); await p.click('text=けってい');
    return p.evaluate(() => window.__ui.name);
  }, (v) => v === 'ネジコ'],
  ['breed: 組み立て → つぎへ で onDone', 'breed_asm', async (p) => {
    await p.click('.ui-asm__done .ui-btn'); await p.waitForTimeout(80);
    return p.evaluate(() => window.__ui.bred && window.__ui.bred.pick);
  }, (v) => v && v.a === 'nejiko' && v.b === 'matchbo' && v.parts.length === 1 && v.parts[0].slot === 'tail' && v.skills.length === 2],
  ['field: パッドの A は onButton へ', 'field', async (p) => {
    await p.click('.ui-pad__a'); return p.evaluate(() => window.__ui.log.filter((x) => x.startsWith('pad:')));
  }, (v) => v.includes('pad:a:true') && v.includes('pad:a:false')],
  ['menu: Esc でとじる', 'menu', async (p) => {
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    return p.evaluate(() => !!document.querySelector('.ui-menu'));
  }, (v) => v === false],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  let fail = 0;
  for (const [name, scene, run, ok] of CASES) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${BASE}?scene=${scene}&shot=1`);
    await p.waitForFunction(() => window.__ui && (window.__ui.ready || window.__ui.error));
    await p.waitForTimeout(300);
    let v;
    try { v = await run(p); } catch (e) { errs.push(e.message); }
    const pass = !errs.length && ok(v);
    if (!pass) fail++;
    console.log(`${pass ? 'ok  ' : 'NG  '} ${name}${pass ? '' : '  → ' + JSON.stringify(v) + ' ' + errs.join(' / ')}`);
    await p.close();
  }
  await b.close();
  console.log(fail ? `${fail} 件 NG` : 'ぜんぶ ok');
  process.exit(fail ? 1 : 0);
})();
