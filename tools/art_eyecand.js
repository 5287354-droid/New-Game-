/* 目の候補の洗い出し: 小さい点(r 2以下 / e 半径2以下)と eye 呼び出しを一覧する */
const { open } = require('./art_lib');
const fs = require('fs');
(async () => {
  const { pg, errs, close } = await open();
  const r = await pg.evaluate(() => {
    const out = {};
    SPL.forEach(s => {
      const id = s.id, is96 = !!DRAW96[id];
      const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d');
      const g = flatPainter(x, { min: is96 ? 1.8 : 1, u: is96 ? 2 : 1, mid: is96 ? 48 : 24 });
      const log = [], MN = is96 ? 1.8 : 1;
      const wr = (k, f) => { const o = g[k]; g[k] = (...a) => { f(a); return o(...a); }; };
      wr('r', a => { if (a[2] <= 2 * MN * 1.01 && a[3] <= 2 * MN * 1.01) log.push(`r(${a[0]},${a[1]},${a[2]},${a[3]},${a[4]})`); });
      wr('e', a => { if (Math.max(a[2], a[3]) <= 2 * MN) log.push(`e(${a[0]},${a[1]},${a[2]},${a[3]},${a[4]})`); });
      wr('eye', a => log.push('EYE(' + (a[0] + MN) + ',' + (a[1] + MN) + ')'));
      try { (is96 ? DRAW96[id] : DRAW[id])(g, 0); } catch (e) { log.push('ERR ' + e.message); }
      out[id] = { fam: s.fam, is96, log };
    });
    return out;
  });
  fs.writeFileSync(require('path').join(require('os').tmpdir(), 'art_eyecand.json'), JSON.stringify(r, null, 1));
  let n = 0, withEye = 0;
  for (const id in r) { if (r[id].log.some(l => l.startsWith('EYE'))) withEye++; }
  console.log('species', Object.keys(r).length, 'withEye', withEye, errs);
  await close();
})();
