/* 魔生物の一覧画像を作る。
   node tools/art_sheet.js 出力プレフィクス 倍率(192|48) normal|shiny|both [id,id|all] [列数] */
const { open } = require('./art_lib');
const fs = require('fs'), path = require('path');
(async () => {
  const prefix = process.argv[2], size = +process.argv[3] || 192, mode = process.argv[4] || 'normal', sel = process.argv[5] || 'all', cols = +process.argv[6] || (size >= 96 ? 6 : 20);
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  const { pg, errs, close } = await open();
  const ids = await pg.evaluate(sel => sel === 'all' ? SPL.map(s => s.id) : sel.split(','), sel);
  const perPage = size >= 96 ? 36 : 160;
  const chunks = []; for (let i = 0; i < ids.length; i += perPage) chunks.push(ids.slice(i, i + perPage));
  let pgn = 0;
  for (const chunk of chunks) {
    const url = await pg.evaluate(async ({ chunk, size, mode, cols }) => {
      const pad = size >= 96 ? 6 : 3, lab = size >= 96 ? 14 : 0, items = [];
      chunk.forEach(id => { if (mode !== 'shiny') items.push([id, false]); if (mode !== 'normal') items.push([id, true]); });
      const rows = Math.ceil(items.length / cols), W = cols * (size + pad * 2), H = rows * (size + pad * 2 + lab);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
      x.fillStyle = '#14171c'; x.fillRect(0, 0, W, H);
      for (let n = 0; n < items.length; n++) {
        const [id, sh] = items[n], cx = (n % cols) * (size + pad * 2), cy = (n / cols | 0) * (size + pad * 2 + lab);
        const g = x.createRadialGradient(cx + pad + size * .35, cy + lab + pad + size * .3, 0, cx + pad + size * .5, cy + lab + pad + size * .5, size * .8);
        g.addColorStop(0, '#2a313c'); g.addColorStop(1, '#14171c'); x.fillStyle = g; x.fillRect(cx + 1, cy + lab + 1, size + pad * 2 - 2, size + pad * 2 - 2);
        const im = new Image(); im.src = sprite(id, false, sh); await im.decode();
        x.imageSmoothingQuality = 'high'; x.drawImage(im, cx + pad, cy + lab + pad, size, size);
        if (lab) { x.fillStyle = '#9aa3b2'; x.font = '11px sans-serif'; x.fillText(id + (sh ? ' *' : ''), cx + 4, cy + 11); }
      }
      return cv.toDataURL();
    }, { chunk, size, mode, cols });
    const f = `${prefix}_${String(pgn++).padStart(2, '0')}.png`;
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f);
  }
  console.log('errors', errs); await close();
})();
