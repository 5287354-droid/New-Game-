/* 天気ごとの owLoop 1フレームの時間を測る(390x844 @3x、CPU 4倍遅く)。使い方: node tools/test/perf_wx.js */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => server.listen(0, r)); const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`http://localhost:${server.address().port}/index.html`); await page.waitForFunction(() => typeof state !== 'undefined' && state);
  await page.evaluate(() => { H.starter({ id: 'ibote' }); ui.dlg = null; state.bgm = false; state.sound = false; state.town = 'komorebi'; state.ow = null; ui.tab = 'map'; owEnsureState(); render(); });
  await new Promise(r => setTimeout(r, 1000));
  const res = await page.evaluate(async () => { const out = {}, orig = wxNow;
    for (const w of [...WXK]) { window.wxNow = () => w; state.time = w === 'hoshi' ? 3 : 1; OWC.held = 'right'; const ts = []; const ol = owLoop;
      const t0 = performance.now(); let n = 0; await new Promise(res => { const f = () => { const a = performance.now(); owDraw(); ts.push(performance.now() - a); if (++n < 120) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      OWC.held = null; ts.sort((a, b) => a - b); out[w] = { avg: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(2), p95: +ts[Math.floor(ts.length * .95)].toFixed(2), fps: +(120000 / (performance.now() - t0)).toFixed(0) }; }
    window.wxNow = orig; return out; });
  console.log(JSON.stringify(res, null, 1)); await browser.close(); server.close();
})();
