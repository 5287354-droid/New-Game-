#!/usr/bin/env node
/* 試聴用の音声を書き出す(耳での確認用)。
   使い方: node tools/audio_preview.js [出力先=docs/update/audio_preview] [秒=40] [曲id ...]
   --sfxmix=名前 [--html=src/game.html] を付けると、BGM(komorebi→battle)の上に SE を順に鳴らしたミックスを 名前.mp3 で書く(調整前後の聞き比べ用)。
   各曲を OfflineAudioContext で描いて WAV にし、ffmpeg があれば mp3(128kbps) にする。 */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const mixName = (process.argv.find(x => x.startsWith('--sfxmix=')) || '').slice(9), htmlArg = (process.argv.find(x => x.startsWith('--html=')) || '').slice(7) || 'src/game.html';
const a = process.argv.slice(2).filter(x => !x.startsWith('--')), out = a[0] || 'docs/update/audio_preview', secs = +(a[1] || 40);
const ids = a.slice(2).length ? a.slice(2) : ['komorebi', 'battle', 'boss', 'victory', 'mabo', 'hinoshima', 'sango', 'kagutsuchi'];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(htmlArg));
  await p.waitForFunction(() => typeof audioOfflineSong === 'function');
  const toMp3 = (b64, name) => {
    const wav = path.join(out, name + '.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    try { cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '128k', path.join(out, name + '.mp3')]); fs.unlinkSync(wav); console.log(name + '.mp3'); } catch (e) { console.log(name + '.wav (ffmpeg なし)'); }
  };
  if (mixName) {
    const b64 = await p.evaluate(async () => {
      const sr = 44100, names = ['sel', 'ui_ok', 'ui_back', 'countup', 'hit', 'crit', 'heal', 'ko', 'lvup', 'newdex', 'kirari', 'shiny', 'rare', 'stamp', 'scout', 'win', 'lose'];
      const tot = 2 * 20 + 4, ctx = new OfflineAudioContext(2, sr * tot, sr), g = audioGraph(ctx);
      g.bgmIn.gain.value = volGain(.75); g.se.gain.value = volGain(.75);
      let t0 = 0;
      for (const id of ['komorebi', 'battle']) {
        const S = SONGS[id], spb = 60 / S.bpm, R = { gain: ctx.createGain(), send: null, noise: null, waves: {} };
        R.gain.gain.value = SONG_TRIM[id] || 1; R.gain.connect(g.bgmIn); bgmEcho(ctx, R, spb, R.gain);
        const chs = bgmChannels(S, t0 + .05); bgmSchedule(ctx, chs, S, t0 + 20, R, r => r !== 'drumx');
        /* 1曲20秒のあいだに、SE を 1.1 秒おきに順に鳴らす(複数回まわす) */
        const list = id === 'komorebi' ? ['sel', 'ui_ok', 'ui_back', 'countup', 'countup', 'heal', 'stamp', 'kirari', 'shiny', 'newdex', 'rare', 'scout', 'lvup', 'sel'] : ['hit', 'crit', 'hit', 'ko', 'crit', 'lvup', 'sel', 'ui_ok', 'win', 'lose', 'newdex', 'hit', 'shiny', 'sel'];
        list.forEach((n, i) => { const t = t0 + 1 + i * 1.3; if (typeof sfxPlay === 'function') sfxPlay(ctx, g, t, n, 1); else playSpec(ctx, g.se, t, SFX[n], 1); });
        t0 += 20;
      }
      const buf = await ctx.startRendering(), n = buf.length, L = buf.getChannelData(0), R2 = buf.getChannelData(1);
      const dv = new DataView(new ArrayBuffer(44 + n * 4)); const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
      dv.setUint32(24, 44100, true); dv.setUint32(28, 44100 * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R2[i])) * 32767, true); }
      const u = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
    });
    toMp3(b64, mixName); await b.close(); return;
  }
  for (const id of ids) {
    const b64 = await p.evaluate(async ({ id, secs }) => {
      const buf = await audioOfflineSong(id, secs), n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
      const dv = new DataView(new ArrayBuffer(44 + n * 4)); const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
      dv.setUint32(24, 44100, true); dv.setUint32(28, 44100 * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      const u = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
    }, { id, secs });
    const wav = path.join(out, id + '.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    try { cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '128k', path.join(out, id + '.mp3')]); fs.unlinkSync(wav); console.log(id + '.mp3'); }
    catch (e) { console.log(id + '.wav (ffmpeg なし)'); }
  }
  await b.close();
})();
