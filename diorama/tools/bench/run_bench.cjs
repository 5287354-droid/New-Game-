// Phase 0 計測を Playwright で回す。
//   python3 -m http.server 8101 --directory diorama   (別の端末で)
//   node diorama/tools/bench/run_bench.cjs [出力JSON]
// スクショは diorama/docs/shots/phase0_*.png、数字は JSON に出す。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BENCH_URL || 'http://localhost:8101/tools/bench/bench.html';
const SHOTS = path.join(__dirname, '../../docs/shots');
const OUT = process.argv[2] || path.join(__dirname, 'results.json');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWS = [
  { name: 'portrait', w: 390, h: 844 },
  { name: 'landscape', w: 844, h: 390 },
];
const CASES = [
  { q: 'monsters=naive&terrain=inst', tag: 'naive_inst' },
  { q: 'monsters=merged&terrain=inst', tag: 'merged_inst' },
  { q: 'monsters=batched&terrain=inst', tag: 'batched_inst' },
  { q: 'monsters=merged&terrain=merged', tag: 'merged_merged' },
  { q: 'monsters=batched&terrain=merged', tag: 'batched_merged' },
  { q: 'monsters=naive&terrain=inst&shadow=0', tag: 'naive_inst_noshadow' },
  { q: 'monsters=naive&terrain=inst&cam=near', tag: 'naive_inst_near' },
  { q: 'monsters=batched&terrain=merged&cam=near', tag: 'batched_merged_near' },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const results = [];
  for (const dpr of [1, 2]) for (const v of VIEWS) for (const c of CASES) {
    // 全組み合わせは多いので、dpr2 は代表の2つだけ
    if (dpr === 2 && !['naive_inst', 'batched_merged'].includes(c.tag)) continue;
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto(`${BASE}?${c.q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench, null, { timeout: 120000 });
    await page.waitForTimeout(300);
    const b = await page.evaluate(() => window.__bench);
    const shot = `phase0_${c.tag}_${v.name}_dpr${dpr}.png`;
    await page.screenshot({ path: path.join(SHOTS, shot) });
    const row = { tag: c.tag, view: v.name, dpr, shot: `docs/shots/${shot}`, errors, ...b };
    delete row.files; delete row.perSpecies;
    if (!results.length) { row.files = b.files; row.perSpecies = b.perSpecies; }
    results.push(row);
    console.log([c.tag, v.name, 'dpr' + dpr, 'tris', b.tris, `(main ${b.mainTris}/sh ${b.shadowTris})`, 'calls', b.calls, `(main ${b.mainCalls}/sh ${b.shadowCalls})`, 'MB', (b.bytes / 1048576).toFixed(2), 'init', b.ms.init + 'ms', errors.length ? 'ERR ' + errors.join(' | ') : ''].join(' '));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
})();
