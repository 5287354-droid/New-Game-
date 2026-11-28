// 曲・ジングル・効果音を OfflineAudioContext で書き出して、ピークと RMS を測る(Playwright)。
//   node tools/audio/levels.mjs                 測って表を出す(tools/audio/levels.json にも書く)
//   node tools/audio/levels.mjs --apply         曲の RMS がそろうように src/audio/songs.js の SONG_TRIM を書きかえる
//   node tools/audio/levels.mjs --only=village  1曲だけ
// ポート 8105 で diorama/ を配信する(自分で立てる)。
//
// 測り方
//   曲: ループの部分(前奏のあと)を「1周 + 2秒」書き出し、はじめの2秒(立ち上がり)を除いて測る。BGM 音量 4(最大)
//   継ぎ目: ループの終わり4拍前から書き出し、50ms ごとの RMS を見る。継ぎ目の前後 ±1 拍で、いちばん小さい窓が
//          全体の中央値より 18dB 以上小さければ「切れている」
//   効果音: 効果音の音量 4。鳴っている部分(-60dB より大きい所)の RMS
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// playwright は NODE_PATH(グローバル)から読む。ESM の import は NODE_PATH を見ないので require で
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8105;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('ページのエラー:', e.message));
await page.goto(`http://localhost:${PORT}/tools/audio/listen.html`);
await page.waitForFunction(() => window.__audio);

const result = await page.evaluate(async (only) => {
  const A = window.__audio;
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
  const stats = (buf, from = 0, gate = false) => {
    let peak = 0, sum = 0, n = 0;
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const win = Math.floor(buf.sampleRate * 0.05);
    for (let i = Math.floor(from * buf.sampleRate); i + win <= L.length; i += win) {
      let s = 0;
      for (let j = i; j < i + win; j++) { const a = L[j], b = R[j]; s += a * a + b * b; peak = Math.max(peak, Math.abs(a), Math.abs(b)); }
      if (gate && s / (2 * win) < 1e-6) continue; // -60dB より小さい窓は数えない
      sum += s; n += 2 * win;
    }
    return { peak: db(peak), rms: db(Math.sqrt(sum / Math.max(1, n))) };
  };
  const windows = (buf) => {
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const win = Math.floor(buf.sampleRate * 0.05), out = [];
    for (let i = 0; i + win <= L.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += L[j] * L[j] + R[j] * R[j]; out.push(db(Math.sqrt(s / (2 * win)))); }
    return out;
  };
  // うるささの目安: 4kHz より上(2段の1次ハイパス)のエネルギーが全体の何 dB 下か
  const hiRatio = (buf, from = 0) => {
    const d = buf.getChannelData(0), sr = buf.sampleRate;
    const a = Math.exp(-2 * Math.PI * 4000 / sr);
    let y1 = 0, x1 = 0, y2 = 0, z1 = 0, sh = 0, sa = 0;
    for (let i = Math.floor(from * sr); i < d.length; i++) {
      const x = d[i];
      y1 = a * (y1 + x - x1); x1 = x;
      y2 = a * (y2 + y1 - z1); z1 = y1;
      sh += y2 * y2; sa += x * x;
    }
    return db(Math.sqrt(sh / Math.max(1e-12, sa)));
  };
  const songs = {};
  for (const n of A.SONG_NAMES) {
    if (only && n !== only) continue;
    const info = A.songInfo(n);
    const spb = 60 / info.bpm;
    const loopSecs = (info.len - info.loopStart) * spb;
    const t0 = performance.now();
    const buf = await A.renderSong(n, { secs: loopSecs + 2, fromBeat: info.loopStart });
    const m = stats(buf, 2);
    const hiDb = hiRatio(buf, 2);
    // 継ぎ目: ループの終わり4拍前から 8拍ぶん
    const sb = await A.renderSong(n, { secs: 8 * spb + 0.1, fromBeat: info.len - 4 });
    const w = windows(sb);
    const med = [...w].sort((a, b) => a - b)[Math.floor(w.length / 2)];
    const seamAt = 0.02 + 4 * spb;
    const lo = Math.floor((seamAt - spb) / 0.05), hi = Math.ceil((seamAt + spb) / 0.05);
    const seamMin = Math.min(...w.slice(lo, hi));
    songs[n] = { label: info.label, bpm: info.bpm, loopSecs: +loopSecs.toFixed(2), peak: +m.peak.toFixed(2), rms: +m.rms.toFixed(2), hi: +hiDb.toFixed(1), seamDrop: +(med - seamMin).toFixed(1), seamOk: med - seamMin < 18, renderMs: Math.round(performance.now() - t0) };
  }
  const jingles = {};
  for (const n of A.JINGLE_NAMES) {
    if (only) continue;
    const buf = await A.renderSong(n, { secs: A.jingleLength(n) + 1.5 });
    const m = stats(buf, 0, true);
    jingles[n] = { label: A.songInfo(n).label, secs: +A.jingleLength(n).toFixed(2), peak: +m.peak.toFixed(2), rms: +m.rms.toFixed(2) };
  }
  const sfx = {};
  if (!only) {
    for (const n of A.SFX_NAMES) {
      const opts = n === 'step' ? A.STEP_GROUNDS.map((g) => ({ ground: g })) : [{}];
      for (const o of opts) {
        const buf = await A.renderSfx(n, o, { secs: 2.5 });
        const m = stats(buf, 0, true);
        sfx[n + (o.ground ? ':' + o.ground : '')] = { peak: +m.peak.toFixed(2), rms: +m.rms.toFixed(2) };
      }
    }
  }
  return { songs, jingles, sfx };
}, args.only || null);

await browser.close();
server.close();

const rows = Object.entries(result.songs);
const rmss = rows.map(([, r]) => r.rms);
const target = rmss.length ? [...rmss].sort((a, b) => a - b)[Math.floor(rmss.length / 2)] : 0;
console.log('| 曲 | BPM | 1周(秒) | ピーク dBFS | RMS dBFS | 4kHz以上 dB | 継ぎ目の落ちこみ dB |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [n, r] of rows) console.log(`| ${n} | ${r.bpm} | ${r.loopSecs} | ${r.peak} | ${r.rms} | ${r.hi} | ${r.seamDrop}${r.seamOk ? '' : ' 切れ'} |`);
if (rows.length > 1) console.log(`\nRMS の幅: ${(Math.max(...rmss) - Math.min(...rmss)).toFixed(2)} dB(中央値 ${target})`);
if (Object.keys(result.jingles).length) {
  console.log('\n| ジングル | 秒 | ピーク | RMS |\n|---|---:|---:|---:|');
  for (const [n, r] of Object.entries(result.jingles)) console.log(`| ${n} | ${r.secs} | ${r.peak} | ${r.rms} |`);
  console.log('\n| 効果音 | ピーク | RMS |\n|---|---:|---:|');
  for (const [n, r] of Object.entries(result.sfx)) console.log(`| ${n} | ${r.peak} | ${r.rms} |`);
}

if (!args.only) fs.writeFileSync(path.join(ROOT, 'tools/audio/levels.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), ...result }, null, 1) + '\n');

// --apply: 曲とジングルの RMS がそろうように補正を直す
if (args.apply) {
  const file = path.join(ROOT, 'src/audio/songs.js');
  let src = fs.readFileSync(file, 'utf8');
  const m = /export const SONG_TRIM = \{([\s\S]*?)\};/.exec(src);
  const cur = Function(`return {${m[1]}}`)();
  const SONG_T = Number(args.target ?? -20);
  const JIN_T = Number(args.jtarget ?? -18);
  for (const [n, r] of rows) cur[n] = +(cur[n] * Math.pow(10, (SONG_T - r.rms) / 20)).toFixed(3);
  for (const [n, r] of Object.entries(result.jingles)) cur[n] = +(cur[n] * Math.pow(10, (JIN_T - r.rms) / 20)).toFixed(3);
  const keys = Object.keys(cur);
  const body = '\n  ' + keys.map((k) => `${k}: ${cur[k]}`).join(', ').replace(/(, )(victory)/, ',\n  $2') + ',\n';
  src = src.replace(m[0], `export const SONG_TRIM = {${body}};`);
  fs.writeFileSync(file, src);
  console.log('\nSONG_TRIM を書きかえた:', cur);
}
