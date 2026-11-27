// 魔物の撮影: A案・B案の8方向一覧、20種の並び、64px シルエット一覧を docs/shots/ に書き出す。
//   cd diorama && python3 -m http.server 8103 &
//   node tools/forge_shots/shoot.cjs            # 全部
//   node tools/forge_shots/shoot.cjs A_nejiko   # 名前で絞りこみ
// 三角形数などの数字は docs/shots/forge_stats.json に残す。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8103/tools/forge_shots/shots.html';
const OUT = path.join(__dirname, '../../docs/shots');

// 試作3体の行(通常 / きらり / おさがり★1 / おさがり2か所 ★2銀線・★3金つぎ / きらりの親から)
const TRIAL = {
  nejiko: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '頭 ← ツミキング\n「つみきの冠」\nブリキの色で塗り直し', spec: { osagari: { head: 'tsumiking' } } },
    { label: 'おさがり ★2・★3', note: '背中 ← ブリキシ「たて」★3 金つぎ\nしっぽ ← フェルトン ★2 銀線\n(つなぎネジで2か所)', spec: { osagari: { back: { from: 'burikishi', star: 3 }, tail: { from: 'felton', star: 2 } } } },
    { label: 'きらりの親から', note: '頭 ← きらりのホタルビン\nきらり色のまま', spec: { osagari: { head: { from: 'hotarubin', shinyFrom: 'hotarubin' } } } },
  ],
  perari: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '背中 ← ネジコ\n「ねじ巻き」\n紙の色と繊維で塗り直し', spec: { osagari: { back: 'nejiko' } } },
    { label: 'おさがり ★2・★3', note: '頭 ← オリガラス ★3 金つぎ\nしっぽ ← インキー ★2 銀線', spec: { osagari: { head: { from: 'origarasu', star: 3 }, tail: { from: 'inky', star: 2 } } } },
    { label: 'きらりの親から', note: '背中 ← きらりのワタボウシ', spec: { osagari: { back: { from: 'watabou', shinyFrom: 'watabou' } } } },
  ],
  koroishi: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '背中 ← ホタルビン\n「ガラスの羽」\n石の色とざらつきで', spec: { osagari: { back: 'hotarubin' } } },
    { label: 'おさがり ★2・★3', note: '頭 ← ツミキング ★3 金つぎ\nしっぽ ← マッチボウ ★2 銀線', spec: { osagari: { head: { from: 'tsumiking', star: 3 }, tail: { from: 'matchbo', star: 2 } } } },
    { label: 'きらりの親から', note: 'しっぽ ← きらりのジャリヘビ', spec: { osagari: { tail: { from: 'jarihebi', shinyFrom: 'jarihebi' } } } },
  ],
};

(async () => {
  const filter = process.argv[2];
  const want = (id) => !filter || filter.split(',').some((f) => id.includes(f));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.message); console.log('[err]', e.message); });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 400)); });
  await p.goto(BASE);
  await p.waitForFunction(() => window.__shots?.ready, null, { timeout: 60000 });
  const statsPath = path.join(OUT, 'forge_stats.json');
  const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, 'utf8')) : {};
  const save = (name, url) => {
    fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', name);
  };
  for (const style of ['A', 'B']) {
    for (const [sp, rows] of Object.entries(TRIAL)) {
      const id = `forge_${style}_${sp}`;
      if (!want(id)) continue;
      const r = await p.evaluate(([style, sp, rows]) => window.__shots.turntable({ style, species: sp, rows }), [style, sp, rows]);
      save(id + '.png', r.url);
      stats[id] = { rows: rows.map((x, i) => ({ label: x.label, triangles: r.tris[i] })) };
    }
    const id = `forge_${style}_all20`;
    if (want(id)) {
      const r = await p.evaluate((style) => window.__shots.lineup({ style }), style);
      save(id + '.png', r.url);
    }
  }
  if (want('forge_silhouette_64')) {
    const r = await p.evaluate(() => window.__shots.silhouettes({}));
    save('forge_silhouette_64.png', r.url);
  }
  if (want('tris')) stats.triangles = await p.evaluate(() => window.__shots.triTable());
  stats.errors = errors;
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 1));
  await b.close();
  if (errors.length) process.exit(1);
})();
