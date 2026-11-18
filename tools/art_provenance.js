/* 魔生物の絵の出どころ一覧 assets/monsters/_provenance.csv を作る(全種、手続き描画)
   使い方: node tools/art_provenance.js */
const { open, ROOT } = require('./art_lib');
const fs = require('fs'), path = require('path');
(async () => {
  const { pg, close } = await open();
  const rows = await pg.evaluate(() => SPL.map(s => [s.id, s.name, DRAW96[s.id] ? 'DRAW96' : 'DRAW']));
  await close();
  const date = new Date().toISOString().slice(0, 10);
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  let csv = 'id,name,method,model,prompt,seed,date,commercial_ok\n';
  rows.forEach(([id, name, fn]) => { csv += [id, name, 'procedural-canvas', 'none', `src/game.html ${fn}.${id} + flatPainter/sprite()`, '', date, 'yes'].map(q).join(',') + '\n'; });
  const out = path.join(ROOT, 'assets/monsters/_provenance.csv');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, csv);
  console.log(out, rows.length);
})();
