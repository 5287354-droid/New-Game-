/* 色違い配色の型を種ごとに割り当てる。系統の中で順に3種をめぐらせ、ART_BIBLE 7章
   (主色の色相差60度以上 または 明るさ差30以上、白っぽくならない)を満たさなければ次の型にする。
   出力: OS の一時フォルダの art_shrec.js (game.html の SHREC の表と差し替える) */
const { open } = require('./art_lib');
const fs = require('fs'), path = require('path');
(async () => {
  const { pg, errs, close } = await open();
  const out = await pg.evaluate(() => {
    const lum = c => { const n = parseInt(c.slice(1), 16); return .2126 * (n >> 16 & 255) + .7152 * (n >> 8 & 255) + .0722 * (n & 255); };
    const res = {}, cnt = {}, info = {};
    SPL.forEach(s => {
      const fam = s.fam, id = s.id, keys = Object.keys(SHT[fam]), mh = mainHue(id), c = MAINC[id].c || '#808080';
      const [h0, s0] = hsl(c);
      const idx = cnt[fam] = (cnt[fam] || 0);
      let pick = null, why = [];
      for (let k = 0; k < keys.length; k++) {
        const key = keys[(idx + k) % keys.length], R = SHT[fam][key], c2 = recolor(c, R, mh), [h1, s1, l1] = hsl(c2);
        let dh = Math.abs(h1 - h0); dh = Math.min(dh, 360 - dh); if (s0 < .12 && s1 > .3) dh = 180;
        const dl = Math.abs(lum(c2) - lum(c));
        const ok = (dh >= 60 || dl >= 30) && !(l1 > .85 && s1 < .3) && l1 > .18;
        info[id] = info[id] || [];
        if (ok) { pick = key; if (k) why.push('次の型へ'); break; }
      }
      if (!pick) pick = keys[idx % keys.length];
      res[id] = pick; cnt[fam]++;
    });
    return res;
  });
  const lines = Object.entries(out).map(([k, v]) => `${k}:'${v}'`);
  let txt = '/* 色違いの配色の型(tools/art_assign.js が系統ごとに3種をめぐらせて割り当てた) */\nObject.assign(SHREC,{\n';
  for (let i = 0; i < lines.length; i += 6) txt += '  ' + lines.slice(i, i + 6).join(',') + ',\n';
  txt += '});\n';
  fs.writeFileSync(path.join(require('os').tmpdir(), 'art_shrec.js'), txt);
  console.log(txt.slice(0, 300), errs);
  await close();
})();
