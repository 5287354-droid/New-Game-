// 魔物の撮影(A+案): 20種の8方向一覧、20種の並び、64px シルエット一覧 + IoU、フィールドのカメラ、直す前と後の比較。
//   cd diorama && python3 -m http.server 8103 &
//   node tools/forge_shots/shoot.cjs                 # 全部
//   node tools/forge_shots/shoot.cjs nejiko,field    # 名前で絞りこみ
// 直す前の版は git の a6264f1(第1回の判定に出した版)の parts.glb と forge.js を /before/ に出して撮る。
// 数字は docs/shots/forge_stats.json に残す。
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8103/tools/forge_shots/shots.html';
const OUT = path.join(__dirname, '../../docs/shots');
const BEFORE_REV = process.env.BEFORE_REV || 'a6264f1';

// 試作3体(第1回と同じ5行)
const TRIAL = {
  nejiko: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '頭 ← ツミキング「つみきの冠」(ブリキシのレシピの鍵)。ブリキの色で塗り直し', spec: { osagari: { head: 'tsumiking' } } },
    { label: 'おさがり ★2・★3', note: '背中 ← ブリキシ「たて」★3 金つぎ / しっぽ ← フェルトン ★2 銀線(つなぎネジで2か所)', spec: { osagari: { back: { from: 'burikishi', star: 3 }, tail: { from: 'felton', star: 2 } } } },
    { label: 'きらりの親から', note: '頭 ← きらりのホタルビン。きらり色のまま(光る水は光ったまま)', spec: { osagari: { head: { from: 'hotarubin', shinyFrom: 'hotarubin' } } } },
  ],
  perari: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '背中 ← ネジコ「ねじ巻き」。紙の色・繊維・折り目で塗り直し', spec: { osagari: { back: 'nejiko' } } },
    { label: 'おさがり ★2・★3', note: '頭 ← オリガラス ★3 金つぎ / しっぽ ← インキー ★2 銀線', spec: { osagari: { head: { from: 'origarasu', star: 3 }, tail: { from: 'inky', star: 2 } } } },
    { label: 'きらりの親から', note: '背中 ← きらりのワタボウシ', spec: { osagari: { back: { from: 'watabou', shinyFrom: 'watabou' } } } },
  ],
  koroishi: [
    { label: '通常', spec: {} },
    { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
    { label: 'おさがり ★1', note: '背中 ← ホタルビン「ガラスの羽」。石の色とざらつきで', spec: { osagari: { back: 'hotarubin' } } },
    { label: 'おさがり ★2・★3', note: '頭 ← ツミキング ★3 金つぎ / しっぽ ← マッチボウ ★2 銀線', spec: { osagari: { head: { from: 'tsumiking', star: 3 }, tail: { from: 'matchbo', star: 2 } } } },
    { label: 'きらりの親から', note: 'しっぽ ← きらりのジャリヘビ', spec: { osagari: { tail: { from: 'jarihebi', shinyFrom: 'jarihebi' } } } },
  ],
};
// ほかの17種: 通常 / きらり / おさがり付き(★1 と ★3 の2つ)
const OSA = {
  inky: [['back', 'felton', 'ぬい針'], ['head', 'kamishibai', 'ひょうし木']],
  watabou: [['back', 'origarasu', '折り羽'], ['tail', 'hotarubin', 'ひかり玉']],
  matchbo: [['back', 'jarihebi', 'じゃりの胴'], ['tail', 'felton', 'ぽんぽん']],
  origarasu: [['tail', 'perari', 'しおり'], ['head', 'watabou', '綿毛']],
  jarihebi: [['head', 'koroishi', '河原石'], ['back', 'matchbo', 'マッチの軸']],
  felton: [['back', 'nejiko', 'ねじ巻き'], ['head', 'hibachineko', '猫耳']],
  hotarubin: [['tail', 'rousokun', 'ろうだまり'], ['back', 'watabou', '綿のつばさ']],
  zenmainu: [['head', 'haribote', '張り子の顔'], ['back', 'hibachineko', '火鉢']],
  rousokun: [['back', 'hotarubin', 'ガラスの羽'], ['head', 'inky', 'インク壺のふた']],
  tsumiking: [['back', 'burikishi', 'たて'], ['tail', 'kageboushi', '影のすそ']],
  kamishibai: [['head', 'tsumiking', 'つみきの冠'], ['back', 'kageboushi', '影のえり']],
  haribote: [['back', 'zenmainu', '大ゼンマイ'], ['head', 'hibachineko', '猫耳']],
  hibachineko: [['tail', 'zenmainu', 'ばねのしっぽ'], ['head', 'zenmainu', 'ブリキの耳']],
  nuihebi: [['back', 'felton', 'ぬい針'], ['head', 'matchbo', 'マッチの頭']],
  burikishi: [['head', 'tsumiking', 'つみきの冠'], ['back', 'nejiko', 'ねじ巻き']],
  kageboushi: [['tail', 'burikishi', 'けん'], ['back', 'origarasu', '折り羽']],
  tokeimori: [['back', 'nejiko', 'ねじ巻き'], ['tail', 'zenmainu', 'ばねのしっぽ']],
};
const NAMES = {};

// 直す前と後(ART_REVIEW 第1回で「直す」「作り直し」の種 + きらりだけ直した種)
const COMPARE = [
  { species: 'nejiko', note: '鍵を輪2つ → 平たい8の字の板を真後ろへ(真横で一番大きい)' },
  { species: 'perari', note: '雪だるま → 1つのしずくの胴。紙は折り目の面を見せる(シェーダー)。しっぽは浮き輪 → ねじれた紙のリボン' },
  { species: 'inky', note: '首の細いびん → 横に広い四角いインク壺 + コルク。背中のかたまり → ななめに刺さったつけペン' },
  { species: 'koroishi', note: 'キノコ → 胴にめりこむ平たい楕円の河原石(目は前で埋める)。こけ → 橙の地衣' },
  { species: 'matchbo', note: '作り直し: 赤い円すい → だ円のマッチの頭 + なびく2段の炎(発光)。肌色 → 白木。かま首の胴' },
  { species: 'jarihebi', note: '作り直し: 灰の玉の連なり + とげ → 黄土と赤さびの玉砂利、こての三角の頭、しっぽの砂利の山' },
  { species: 'felton', note: '緑 → 珊瑚色。触角のぽんぽん → 頭に直接つく毛玉。ぬい針を長く + 胴に1周の糸' },
  { species: 'hotarubin', note: '太いびん → 細長いびん + 長い首。びんの下の水が光る(発光)。しっぽの玉も光る' },
  { species: 'rousokun', note: '白いロウ → 朱の和ろうそく(上が広い)+ 絵付けの花。炎は2段の発光' },
  { species: 'tsumiking', note: '黄色 → 石の生成り。頭を大小2つの積み木(上は 45°)に、冠は金' },
  { species: 'hibachineko', note: '黒猫+橙 → 素焼きの土色 + 墨のひげ。火鉢 = 口の広い鉢 + 光る炭 + 火箸' },
  { species: 'nuihebi', note: '紫+黄 → 生成りの木綿 + 赤いギンガムの当て布。かま首の胴' },
  { species: 'burikishi', note: '円すいの羽かざり → 後ろへなびく扇の板3枚' },
  { species: 'kageboushi', note: 'つば 1.0 → 0.78(肩幅の 1.3 倍)、帽子を後ろへ 15°。マントの裏地すみれ' },
  { species: 'watabou', shiny: true, note: 'きらり 薄紫 → 桜色(紫は影の予約色)' },
  { species: 'haribote', shiny: true, note: 'きらり 白 → 空色(64px で通常と見分ける)' },
];

(async () => {
  const filter = process.argv[2];
  const want = (id) => !filter || filter.split(',').some((f) => id.includes(f));
  // 直す前の版を git から出す
  const bdir = fs.mkdtempSync('/tmp/forge_before_');
  const repo = path.join(__dirname, '../..');
  fs.writeFileSync(path.join(bdir, 'parts.glb'), execSync(`git -C ${repo} show ${BEFORE_REV}:diorama/assets/models/parts.glb`));
  fs.writeFileSync(path.join(bdir, 'forge.js'), execSync(`git -C ${repo} show ${BEFORE_REV}:diorama/src/forge/forge.js`));

  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  await p.route('**/before/*', (route) => {
    const f = path.join(bdir, path.basename(new URL(route.request().url()).pathname));
    route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : 'model/gltf-binary' });
  });
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.message); console.log('[err]', e.message); });
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|favicon|404/.test(t)) { errors.push(t.slice(0, 300)); console.log('[console]', t.slice(0, 400)); } });
  await p.goto(BASE);
  await p.waitForFunction(() => window.__shots?.ready, null, { timeout: 60000 });
  const mons = await p.evaluate(() => fetch('../../data/monsters.json').then((r) => r.json()));
  for (const s of mons.species) NAMES[s.id] = s.name;
  const statsPath = path.join(OUT, 'forge_stats.json');
  const stats = {};
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name); };

  for (const s of mons.species) {
    const id = `forge_Aplus_${s.id}`;
    if (!want(id)) continue;
    let rows = TRIAL[s.id];
    if (!rows) {
      const [[p1, f1, l1], [p2, f2, l2]] = OSA[s.id];
      const pl = { head: '頭', back: '背中', tail: 'しっぽ' };
      rows = [
        { label: '通常', spec: {} },
        { label: 'きらり', note: '色違い 1/256', spec: { shiny: true } },
        { label: 'おさがり ★1', note: `${pl[p1]} ← ${NAMES[f1]}「${l1}」。子の色と素材で塗り直し`, spec: { osagari: { [p1]: f1 } } },
        { label: 'おさがり ★3', note: `${pl[p2]} ← ${NAMES[f2]}「${l2}」★3 金つぎ`, spec: { osagari: { [p2]: { from: f2, star: 3 } } } },
      ];
    }
    const r = await p.evaluate(([sp, rows]) => window.__shots.turntable({ species: sp, rows }), [s.id, rows]);
    save(id + '.png', r.url);
    stats[id] = rows.map((x, i) => ({ label: x.label, triangles: r.tris[i] }));
  }
  if (want('forge_Aplus_all20')) save('forge_Aplus_all20.png', (await p.evaluate(() => window.__shots.lineup({}))).url);
  if (want('forge_silhouette_64')) {
    const r = await p.evaluate(() => window.__shots.silhouettes({}));
    save('forge_silhouette_64.png', r.url);
    stats.iou = r.pairs.map((x) => ({ pair: `${x.an}/${x.bn}`, front: +x.iou[0].toFixed(3), side: +x.iou[1].toFixed(3), top: +x.iou[2].toFixed(3), over: x.max > 0.75 }));
  }
  for (const [kind, which] of [['grass', 'after'], ['clay', 'after'], ['grass', 'before']]) {
    const id = `forge_field_${which === 'before' ? 'before' : 'Aplus'}_${kind}`;
    if (want(id)) save(id + '.png', (await p.evaluate(([kind, which]) => window.__shots.field({ kind, which }), [kind, which])).url);
  }
  if (want('forge_compare')) {
    save('forge_compare_1.png', (await p.evaluate((rows) => window.__shots.compare({ rows, title: '直す前 → 直した後(1/2)' }), COMPARE.slice(0, 8))).url);
    save('forge_compare_2.png', (await p.evaluate((rows) => window.__shots.compare({ rows, title: '直す前 → 直した後(2/2)' }), COMPARE.slice(8))).url);
  }
  if (want('tris')) stats.triangles = await p.evaluate(() => window.__shots.triTable());
  stats.errors = errors;
  const old = filter && fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, 'utf8')) : {};
  fs.writeFileSync(statsPath, JSON.stringify({ ...old, ...stats }, null, 1));
  await b.close();
  fs.rmSync(bdir, { recursive: true, force: true });
  if (errors.length) process.exit(1);
})();
