// UI ギャラリーのスクショ(縦 390×844 / 横 844×390)と、簡単な検査。
//   cd diorama && python3 -m http.server 8106 &   node tools/ui/shoot.cjs [scene の絞りこみ]
// 検査: ページのエラーなし / 押せるボタンが 44px 以上 / 画面の外にはみ出していない / 影・にじみを使っていない
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:8106/tools/ui/gallery.html';
const OUT = path.join(__dirname, '../../docs/shots');
const SIZES = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const SCENES = ['title', 'name', 'field', 'dialog', 'dialog_choice', 'note', 'menu', 'party', 'detail', 'items', 'settings', 'save',
  'battle', 'battle_skill', 'battle_target', 'battle_lamp', 'battle_clock', 'breed', 'breed_parts', 'breed_skills', 'breed_asm',
  'dex', 'bom', 'shop', 'inn', 'storage', 'got'];
const WAIT = { battle_target: 260, breed_asm: 200 };

(async () => {
  const filter = process.argv[2];
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const problems = [];
  for (const [orient, vp] of Object.entries(SIZES)) {
    for (const s of SCENES) {
      if (filter && !filter.split(',').some((f) => s.includes(f))) continue;
      const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      p.on('pageerror', (e) => problems.push(`[${s} ${orient}] pageerror ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && problems.push(`[${s} ${orient}] console ${m.text()}`));
      await p.goto(`${BASE}?scene=${s}&shot=1`);
      await p.waitForFunction(() => window.__ui && (window.__ui.ready || window.__ui.error), null, { timeout: 30000 });
      const err = await p.evaluate(() => window.__ui.error);
      if (err) problems.push(`[${s} ${orient}] ${err}`);
      await p.waitForTimeout(WAIT[s] ?? 700);
      const check = await p.evaluate(() => {
        const out = [];
        const W = innerWidth, H = innerHeight;
        for (const el of document.querySelectorAll('.ui-root button, .ui-root .ui-sel')) {
          if (!el.offsetParent || el.closest('.ui-kana') || el.closest('.ui-dots')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (Math.min(r.width, r.height) < 36) out.push(`small ${el.className.split(' ')[0]} "${el.textContent.trim().slice(0, 10)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) {
            // スクロールの中なら、はみ出しは許す
            let sc = el.parentElement, inScroll = false;
            while (sc) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) { inScroll = true; break; } sc = sc.parentElement; }
            if (!inScroll) out.push(`offscreen ${el.className.split(' ')[0]} "${el.textContent.trim().slice(0, 10)}"`);
          }
        }
        for (const el of document.querySelectorAll('.ui-root *')) {
          const cs = getComputedStyle(el);
          if (cs.boxShadow !== 'none' || cs.textShadow !== 'none' || (cs.filter && cs.filter !== 'none')) { out.push('shadow/filter ' + el.className); break; }
        }
        return [...new Set(out)].slice(0, 8);
      });
      check.forEach((c) => problems.push(`[${s} ${orient}] ${c}`));
      await p.screenshot({ path: path.join(OUT, `ui_${s}_${orient}.png`) });
      await p.close();
      process.stdout.write('.');
    }
  }
  await b.close();
  console.log('\n' + (problems.length ? problems.join('\n') : 'OK: 問題なし'));
  fs.writeFileSync(path.join(OUT, 'ui_check.txt'), problems.join('\n') || 'OK');
})();
