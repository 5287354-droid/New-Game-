/* 座標つきの見取り図: 描画の生の座標(48/96単位)に格子を重ねて並べる。目の位置決め用。
   使い方: node tools/art_grid.js 出力ディレクトリ [id,id,...|noeye|all] */
const { open } = require('./art_lib');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || require('path').join(require('os').tmpdir(), 'art_grid'); fs.mkdirSync(out, { recursive: true });
  const sel = process.argv[3] || 'noeye';
  const { pg, errs, close } = await open();
  const ids = await pg.evaluate(sel => {
    const has = id => { const c = document.createElement('canvas'); const g = flatPainter(c.getContext('2d'), {}); let n = 0; const o = g.eye; try { (DRAW96[id] || DRAW[id])({ ...g, eye: () => { n++; } , get eyes() { return 0; } }, 0); } catch (e) {} return n > 0; };
    if (sel === 'all') return SPL.map(s => s.id);
    if (sel === 'noeye') return SPL.filter(s => { const id = s.id; const c = document.createElement('canvas'); c.width = c.height = 8; const g = flatPainter(c.getContext('2d'), {}); try { (DRAW96[id] || DRAW[id])(g, 0); } catch (e) {} return g.eyes === 0; }).map(s => s.id);
    return sel.split(',');
  }, sel);
  const PER = 12; let page = 0;
  for (let i = 0; i < ids.length; i += PER) {
    const chunk = ids.slice(i, i + PER);
    const url = await pg.evaluate(chunk => {
      const C = 288, cols = 4, rows = Math.ceil(chunk.length / cols);
      const cv = document.createElement('canvas'); cv.width = C * cols; cv.height = (C + 18) * rows; const x = cv.getContext('2d');
      x.fillStyle = '#2a2f3a'; x.fillRect(0, 0, cv.width, cv.height);
      chunk.forEach((id, n) => {
        const ox = (n % cols) * C, oy = (n / cols | 0) * (C + 18), is96 = !!DRAW96[id], U = is96 ? 96 : 48, sc = C / U;
        x.save(); x.translate(ox, oy + 18); x.beginPath(); x.rect(0, 0, C, C); x.clip();
        x.fillStyle = '#8a8f9c'; x.fillRect(0, 0, C, C);
        x.save(); x.scale(sc, sc);
        const g = flatPainter(x, { min: is96 ? 1.8 : 1, u: is96 ? 2 : 1, mid: U / 2, iris: IRIS[SP[id].fam] });
        try { (is96 ? DRAW96[id] : DRAW[id])(g, 0); } catch (e) {}
        x.restore();
        x.lineWidth = 1; x.font = '10px monospace';
        const step = is96 ? 8 : 4;
        for (let u = 0; u <= U; u += step) { const major = u % (is96 ? 16 : 8) === 0; x.strokeStyle = major ? 'rgba(255,255,0,.55)' : 'rgba(255,255,255,.22)';
          x.beginPath(); x.moveTo(u * sc, 0); x.lineTo(u * sc, C); x.moveTo(0, u * sc); x.lineTo(C, u * sc); x.stroke();
          if (major) { x.fillStyle = '#ff0'; x.fillText(u, u * sc + 2, 10); x.fillText(u, 2, u * sc + 10); } }
        x.restore();
        x.fillStyle = '#fff'; x.font = '13px sans-serif'; x.fillText(id + ' ' + SP[id].fam + (is96 ? ' (96)' : ''), ox + 4, oy + 13);
      });
      return cv.toDataURL();
    }, chunk);
    const f = path.join(out, `grid_${String(page++).padStart(2, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f, chunk.join(','));
  }
  console.log(errs); await close();
})();
