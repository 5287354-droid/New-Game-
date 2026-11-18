/* 描画の検証用ヘルパ: ルートを一時HTTPサーバで配信し、src/game.html を Playwright で開く */
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
async function open(page = 'src/game.html') {
  const server = http.createServer((q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(`http://localhost:${server.address().port}/${page}`);
  await pg.waitForFunction(() => typeof SP !== 'undefined' && typeof sprite === 'function');
  return { pg, errs, close: async () => { await browser.close(); server.close(); } };
}
module.exports = { open, ROOT };
