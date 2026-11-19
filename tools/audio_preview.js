#!/usr/bin/env node
/* 試聴用の音声を書き出す(耳での確認用)。
   使い方: node tools/audio_preview.js [出力先=docs/update/audio_preview] [秒=40] [曲id ...]
   各曲を OfflineAudioContext で描いて WAV にし、ffmpeg があれば mp3(128kbps) にする。 */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const a = process.argv.slice(2), out = a[0] || 'docs/update/audio_preview', secs = +(a[1] || 40);
const ids = a.slice(2).length ? a.slice(2) : ['komorebi', 'battle', 'boss', 'victory', 'mabo', 'hinoshima', 'sango', 'kagutsuchi'];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('src/game.html'));
  await p.waitForFunction(() => typeof audioOfflineSong === 'function');
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
