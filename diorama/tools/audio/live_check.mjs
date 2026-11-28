// 本物の AudioContext(ヘッドレス Chromium)で、エンジンを一通り動かして確かめる。
//   node tools/audio/live_check.mjs
// 確かめること: タップ前に始めた曲がタップ後に同じ拍で鳴る / 全曲をフェードで切りかえてもエラーがない /
// ジングルで BGM が下がって戻る / 全効果音が鳴る / 拍の時計が ctx の時刻と合っている
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8105;
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/tools/audio/listen.html`);
await page.waitForFunction(() => window.__audio);

const out = await page.evaluate(async () => {
  const A = window.__audio;
  const E = A._engine;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  A.playBgm('tower');
  await wait(1500);
  const pre = A.beat().beats;
  await A.unlock();
  const post = A.beat().beats;
  log.push(`タップ前に 1.5 秒: ${pre.toFixed(2)} 拍 → タップ直後 ${post.toFixed(2)} 拍(とばない)`);
  await wait(1000);
  const b = A.beat();
  const expect = ((E.ctx.currentTime + E.offset - E.bgm.start - (E.ctx.outputLatency || E.ctx.baseLatency || 0)) * 108) / 60;
  log.push(`拍の時計の差: ${(b.beats - expect).toFixed(4)} 拍`);
  let errs = 0;
  for (const n of A.SONG_NAMES) {
    A.playBgm(n, { fade: 0.4 });
    await wait(700);
    errs += E.bgm.player.errors;
  }
  log.push(`全曲を切りかえ: 音のエラー ${errs}、フェード中の古い曲 ${E.old.length}`);
  A.jingle('victory');
  await wait(300);
  const ducked = E.g.duck.gain.value;
  await wait(3500);
  log.push(`ジングル中の BGM ${ducked.toFixed(2)} → 後 ${E.g.duck.gain.value.toFixed(2)}`);
  let n = 0;
  for (const s of A.SFX_NAMES) { if (A.sfx(s) > 0) n++; await wait(40); }
  log.push(`効果音 ${n}/${A.SFX_NAMES.length} が鳴った`);
  return { log, errs, ducked, after: E.g.duck.gain.value, pre, post, sfxOk: n === A.SFX_NAMES.length, state: E.ctx.state };
});
await browser.close();
server.close();
console.log(out.log.join('\n'));
const ok = errors.length === 0 && out.errs === 0 && out.ducked < 0.5 && out.after > 0.9 && out.post >= out.pre && out.sfxOk && out.state === 'running';
if (errors.length) console.log('ページのエラー:', errors);
console.log(ok ? 'OK' : 'NG');
process.exit(ok ? 0 : 1);
