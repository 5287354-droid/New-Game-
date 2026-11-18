#!/usr/bin/env node
/* BGM の音量を、オフラインで測る。
   使い方: node tools/audio_levels.js [html=src/game.html] [--secs=12] [--notrim] [--json=out.json]
   各曲を OfflineAudioContext で先頭から secs 秒ぶん描き、RMS(dBFS)とピーク(dBFS)を出す。
   --notrim は曲ごとの補正(SONG_TRIM)を外して測る(補正値を決めるとき用)。
   あわせて次を点検する:
   - ループの継ぎ目: 鳴らす音のエンベロープ(音量の山)が 0 から始まり 0 で終わるか(クリックノイズの元)
   - パートごとのループ長が、いちばん長いパートの約数か(短いパートが何周かして揃う。割り切れないと位相がずれながら回る)
   html が「補正・マスター処理」の入る新しい版でなくても(古い版でも)測れる。 */
const { chromium } = require('playwright');
const path = require('path');

const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const file = args.find(x => !x.startsWith('--')) || 'src/game.html';
const SECS = +(opt('secs') || 12);
const NOTRIM = args.includes('--notrim');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    const rec = new WeakMap(); window.__rec = rec; window.__on = false; window.__gains = [];
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) {
      const o = AudioParam.prototype[m];
      AudioParam.prototype[m] = function (v, t) {
        if (window.__on) { let r = rec.get(this); if (!r) { r = { first: v, last: v }; rec.set(this, r); } r.last = v; }
        return o.call(this, v, t);
      };
    }
    const cg = BaseAudioContext.prototype.createGain;
    BaseAudioContext.prototype.createGain = function () { const g = cg.call(this); if (window.__on) window.__gains.push(g); return g; };
    const oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d, ...a) { if (d instanceof AudioParam) this.__mod = true; return oc.call(this, d, ...a); };
  });
  await page.goto('file://' + path.resolve(file));
  await page.waitForFunction(() => typeof SONGS !== 'undefined' && typeof parseMML === 'function');

  const rows = await page.evaluate(async ({ SECS, NOTRIM }) => {
    const db = x => 20 * Math.log10(Math.max(x, 1e-9));
    const out = [];
    const hasNew = typeof audioOfflineSong === 'function';
    /* 古い版(補正もバスも無い)の再現: 曲ごとの gain .8 → コンプレッサー(-16dB, 3:1) */
    async function legacy(id) {
      const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * SECS), sr), S = SONGS[id], spb = 60 / S.bpm;
      BGM.gain = ctx.createGain(); BGM.gain.gain.value = .8; BGM.waves = {}; BGM.noise = null;
      const cmp = ctx.createDynamicsCompressor(); cmp.threshold.value = -16; cmp.ratio.value = 3; cmp.attack.value = .004; cmp.release.value = .2;
      BGM.gain.connect(cmp); cmp.connect(ctx.destination);
      const dl = ctx.createDelay(1.2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
      dl.delayTime.value = Math.min(1.1, spb * .75); fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = .3;
      BGM.send = ctx.createGain(); BGM.send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(BGM.gain);
      const start = .05;
      const chs = S.chords ? arrange(S).map(c => Object.assign(c, { i: 0, base: start })) : thicken(S.ch.map(def => { const p = parseMML(def.m, def.o); return { def, ev: p.ev, len: p.len, i: 0, base: start }; }));
      for (const c of chs) { if (!c.ev.length) continue; while (true) { const e = c.ev[c.i], at = c.base + e.t * spb; if (at > SECS) break; bgmNote(ctx, c.def, e, at, spb); c.i++; if (c.i >= c.ev.length) { c.i = 0; c.base += c.len * spb; } } }
      return ctx.startRendering();
    }
    for (const id of Object.keys(SONGS)) {
      window.__on = true; window.__gains = [];
      const buf = hasNew ? await audioOfflineSong(id, SECS, NOTRIM ? { trim: 1 } : {}) : await legacy(id);
      window.__on = false;
      let sum = 0, n = 0, pk = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) { const v = d[i]; sum += v * v; n++; const a = Math.abs(v); if (a > pk) pk = a; }
      }
      /* エンベロープの点検: 音量(GainNode)の最初と最後の値が 0 に近いか。ビブラートの深さ(周波数へつなぐ gain)は除く */
      let gains = 0, bad = 0;
      for (const g of window.__gains) {
        if (g.__mod) continue; const r = window.__rec.get(g.gain); if (!r) continue;
        gains++; if (r.first > .001 || r.last > .001) bad++;
      }
      /* パートごとのループ長(拍) */
      const S = SONGS[id], lens = hasNew
        ? bgmChannels(S, 0).filter(c => c.role !== 'drumx').map(c => +c.len.toFixed(2))
        : (S.chords ? arrange(S) : thicken(S.ch.map(def => { const p = parseMML(def.m, def.o); return { def, ev: p.ev, len: p.len, i: 0, base: 0 }; }))).map(c => +c.len.toFixed(2));
      const uniq = [...new Set(lens)];
      out.push({ id, rms: +db(Math.sqrt(sum / n)).toFixed(2), peak: +db(pk).toFixed(2), env: gains, envBad: bad, lens: uniq, lenMismatch: uniq.some(l => Math.max(...uniq) % l > 1e-6), trim: (typeof SONG_TRIM !== 'undefined' && SONG_TRIM[id]) || 1 });
    }
    return out;
  }, { SECS, NOTRIM });

  await browser.close();
  if (errs.length) console.error('pageerror:', errs);
  const mean = rows.reduce((a, r) => a + r.rms, 0) / rows.length;
  const sd = Math.sqrt(rows.reduce((a, r) => a + (r.rms - mean) ** 2, 0) / rows.length);
  const TARGET = +(opt('target') || -24);
  console.log('| 曲 | RMS dBFS | ピーク dBFS | 補正 | 音量が0でない/0に近くない包絡 | パート長(拍) |');
  console.log('|---|---:|---:|---:|---:|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.rms} | ${r.peak} | ${r.trim} | ${r.envBad}/${r.env} | ${r.lens.join(',')}${r.lenMismatch ? ' (割り切れない)' : ''} |`);
  const rs = rows.map(r => r.rms), pks = rows.map(r => r.peak);
  console.log(`\n曲数 ${rows.length} / RMS 平均 ${mean.toFixed(2)} 標準偏差 ${sd.toFixed(2)} 最小 ${Math.min(...rs)} 最大 ${Math.max(...rs)} 幅 ${(Math.max(...rs) - Math.min(...rs)).toFixed(2)} dB / ピーク最大 ${Math.max(...pks)}`);
  console.log(`エンベロープ不良 ${rows.reduce((a, r) => a + r.envBad, 0)} / ${rows.reduce((a, r) => a + r.env, 0)} ・ パート長が割り切れない曲(位相がずれながら回る) ${rows.filter(r => r.lenMismatch).map(r => r.id).join(' ') || 'なし'}`);
  if (NOTRIM) {
    const t = {};
    for (const r of rows) t[r.id] = +Math.min(2.2, Math.max(.45, Math.pow(10, (TARGET - r.rms) / 20))).toFixed(2);
    console.log(`\n補正値の案(目標 RMS ${TARGET} dBFS):\nconst SONG_TRIM=${JSON.stringify(t)};`);
  }
  const j = opt('json'); if (j) require('fs').writeFileSync(j, JSON.stringify(rows, null, 1));
})();
