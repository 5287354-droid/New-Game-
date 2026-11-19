/* 指定した魔生物を「通常192・色違い192・通常48・色違い48」の行で並べた画像を作る。
   使い方: node tools/art_strip.js 出力.png id,id,... [html(省略時 src/game.html)] */
const { open } = require('./art_lib');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], ids = process.argv[3].split(','), page = process.argv[4] || 'src/game.html';
  const { pg, errs, close } = await open(page);
  const url = await pg.evaluate(async ids => {
    const R = 204, W = 192 * 2 + 48 * 2 + 5 * 8 + 70, H = R * ids.length, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'); x.fillStyle = '#14171c'; x.fillRect(0, 0, W, H);
    for (let n = 0; n < ids.length; n++) {
      const id = ids[n], y = n * R;
      const cell = async (sh, size, cx) => {
        const g = x.createRadialGradient(cx + size * .35, y + 6 + size * .3, 0, cx + size * .5, y + 6 + size * .5, size * .8);
        g.addColorStop(0, '#2a313c'); g.addColorStop(1, '#14171c'); x.fillStyle = g; x.fillRect(cx, y + 6, size, size);
        const im = new Image(); im.src = sprite(id, false, sh); await im.decode(); x.imageSmoothingQuality = 'high'; x.drawImage(im, cx, y + 6, size, size);
      };
      await cell(false, 192, 70); await cell(true, 192, 70 + 200); await cell(false, 48, 70 + 400); await cell(true, 48, 70 + 456);
      x.fillStyle = '#9aa3b2'; x.font = '12px sans-serif'; x.fillText(id, 4, y + 20); x.fillText(SP[id].name, 4, y + 36);
    }
    return cv.toDataURL();
  }, ids);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  if (errs.length) console.log('errors', errs);
  await close();
})();
