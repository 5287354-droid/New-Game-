// エリアのデータを作って data/areas/*.json に書き出す。
// 使い方: node tools/mapgen/gen.mjs
//
// 設計図(docs/maps/*.md)が正。村・つみき野・ランプの森は、設計図の最初の図(```の中)をそのまま読んで地面を作り、
// 表に書かれた物(建物・回転台・影を落とす木・宝箱・人)をここで置く。時計塔は図ではなく、角度 rim(度, 半径) で組み立てる。
// 出てきた JSON を手で直したら、同じ直しをここにも入れること(このスクリプトを流すと上書きされる)。
// 作ったら必ず `node tools/solver/solver.mjs` を流す(全部届く・詰みなし)。
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

class B {
  constructor(id, name, w, d, nLevels = 1, opts = {}) {
    Object.assign(this, { id, name, objects: [], discs: [], rings: [], casters: [], buildings: [], spawns: [], rares: [], decor: [], ...opts });
    this.levels = [];
    for (let i = 0; i < nLevels; i++) this.levels.push({ w, d, y: 0, h: new Array(w * d).fill(0), t: new Array(w * d).fill('x') });
    this.n = 0;
  }
  set(l, x, z, t, h) {
    const L = this.levels[l];
    if (x < 0 || z < 0 || x >= L.w || z >= L.d) return;
    const i = z * L.w + x;
    if (t != null) L.t[i] = t;
    if (h != null) L.h[i] = h;
  }
  get(l, x, z) { const L = this.levels[l]; return { t: L.t[z * L.w + x], h: L.h[z * L.w + x] }; }
  rect(l, x0, z0, x1, z1, t, h) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(l, x, z, t, h); }
  each(l, fn) { const L = this.levels[l]; for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) fn(x, z); }
  o(type, l, x, z, extra = {}) {
    const ob = { id: extra.id || (type === 'item' ? extra.item : `${this.id}_${type}_${this.n++}`), type, l, x, z, ...extra };
    this.objects.push(ob);
    return ob;
  }
  out() {
    const data = { ...this };
    delete data.n;
    data.levels = this.levels.map((L) => ({ w: L.w, d: L.d, y: L.y, h: L.h, t: L.t.join('') }));
    return data;
  }
}

// 乱数(毎回同じになるように種を固定)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// 設計図の最初の図を読む → 行の配列(各行は w 文字)
function readMap(name, w, d) {
  const md = readFileSync(join(ROOT, 'docs', 'maps', name + '.md'), 'utf8');
  const block = md.split('```')[1].split('\n').filter((s) => /^ {0,2}\d+ /.test(s));
  const rows = block.map((s) => s.slice(4));
  if (rows.length !== d || rows.some((r) => r.length < w)) throw new Error(`${name}: 図の大きさが ${w}x${d} でない (${rows.length}行)`);
  return rows.map((r) => r.slice(0, w));
}

const DIR4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// ================================================================= ネジマキ村(めくる)
const BUILDINGS = [
  { id: 'home', name: '自宅', x0: 2, z0: 2, x1: 11, z1: 8, door: { x: 6, z: 8 }, roof: '#b5523b', upper: 1, attic: true },
  { id: 'tower', name: '時計塔のホール', x0: 19, z0: 11, x1: 28, z1: 19, door: { x: 23, z: 19 }, doors: [{ x: 23, z: 19 }, { x: 24, z: 19 }], roof: '#c0452f', tall: true },
  { id: 'workshop', name: '工房', x0: 35, z0: 10, x1: 44, z1: 18, door: { x: 35, z: 14 }, roof: '#4f6d8f' },
  { id: 'shop', name: 'よろず屋', x0: 3, z0: 12, x1: 12, z1: 19, door: { x: 12, z: 15 }, roof: '#6c8f4f' },
  { id: 'chief', name: '村長の家', x0: 35, z0: 2, x1: 44, z1: 8, door: { x: 39, z: 8 }, roof: '#8f4f6d', upper: 1 },
  { id: 'inn', name: '宿屋', x0: 3, z0: 25, x1: 13, z1: 33, door: { x: 9, z: 25 }, roof: '#c98a2b', upper: 1 },
  { id: 'library', name: '図書小屋', x0: 36, z0: 24, x1: 44, z1: 28, door: { x: 40, z: 28 }, roof: '#5f4f8f' },
  { id: 'shed', name: '物置', x0: 15, z0: 30, x1: 20, z1: 34, door: { x: 17, z: 30 }, roof: '#7a6a55', upper: 2, attic: true },
];

function village() {
  const W = 48, D = 40;
  const b = new B('village', 'ネジマキ村', W, D, 3, { kind: 'town', accent: '#e0a526', bgm: 'village', box: 'village' });
  const rows = readMap('village', W, D);
  const inside = (x, z) => BUILDINGS.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
  const marks = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = rows[z][x];
    const bl = inside(x, z);
    const base = bl ? 'f' : 'g';
    switch (c) {
      case '#': b.set(0, x, z, bl ? 'f' : 'e', 1); if (bl) marks.push([c, x, z]); break; // 外周の柵 / 図書小屋の本棚
      case '.': case '%': case 'g': case 'T': b.set(0, x, z, 'g', 1); if (c === 'T') marks.push([c, x, z]); break;
      case ':': case 'S': case '?': case 'E': b.set(0, x, z, 'p', 1); if (c !== ':') marks.push([c, x, z]); break;
      case '~': b.set(0, x, z, 'w', 0); break;
      case '=': b.set(0, x, z, bl ? 'f' : 'B', 1); if (bl) marks.push([c, x, z]); break;
      case 'W': b.set(0, x, z, 'W', 1); break;
      case 'D': case 'f': b.set(0, x, z, 'f', 1); break;
      default: b.set(0, x, z, base, 1); marks.push([c, x, z]);
    }
  }
  // 花畑は描画用の飾り
  b.decor.push({ type: 'flowers', l: 0, x0: 34, z0: 20, x1: 40, z1: 22 }, { type: 'backyard', l: 0, x0: 43, z0: 20, x1: 46, z1: 23 });
  // 2階・屋根裏(レベル1: 自宅の屋根裏・村長の家・宿屋 / レベル2: 物置の屋根裏)
  b.levels[1].y = 3;
  b.levels[2].y = 3;
  for (const q of BUILDINGS) {
    b.buildings.push({ l: 0, ...q });
    if (!q.upper) continue;
    for (let z = q.z0; z <= q.z1; z++) for (let x = q.x0; x <= q.x1; x++) {
      const edge = x === q.x0 || x === q.x1 || z === q.z0 || z === q.z1;
      b.set(q.upper, x, z, edge ? 'W' : 'f', 1);
    }
  }
  // 宿屋の2階は、客室を2つに仕切る(真ん中の壁に戸口)
  for (let z = 26; z <= 32; z++) if (z !== 29) b.set(1, 8, z, 'W', 1);

  const shelf = (l, x, z, extra) => b.o('shelf', l, x, z, extra);
  const stairs = (l, x, z, l2, ax, az, label) => {
    b.o('stairs', l, x, z, { to: { l: l2, x: ax, z: az }, label });
    b.o('stairs', l2, x, z, { to: { l, x: ax, z: az }, label: l === 0 ? '1階へ' : '下へ' });
  };
  // ---- 自宅
  b.o('bed', 0, 3, 3, { text: 'ふかふかのベッド。ネジを巻いてもらうと、よく眠れる。' });
  b.o('bed', 0, 4, 3, { text: 'ふかふかのベッド。' });
  shelf(0, 10, 3, { id: 'v_home_shelf', item: 'patch', qty: 2, flag: 'v_home_shelf', text: 'タンスの引き出し。' });
  shelf(0, 3, 7, { id: 'v_home_note', text: '模型師の作業ノート。「ジオラマは、つなぎ目がいちばん大事。 — カナメ」' });
  stairs(0, 10, 7, 1, 9, 7, '屋根裏へ');
  shelf(1, 3, 3, { id: 'v_home_attic', item: 'gearpin', qty: 1, flag: 'v_home_attic', cond: 'camNorth', text: '梁の上の隠し棚。北から見ると屋根の板がめくれる。' });
  // ---- 時計塔のホール
  b.o('post', 0, 22, 12, { id: 'v_spring_w', text: '塔のゼンマイ。止まっている。' });
  b.o('post', 0, 25, 12, { id: 'v_spring_e', text: '塔のゼンマイ。止まっている。' });
  b.o('socket', 0, 24, 15, { id: 'v_tower_axle', kind: 'gear', size: 'small', flag: 'openTower', name: '扉の軸のくぼみ' });
  for (const x of [23, 24]) b.o('exit', 0, x, 12, { id: `v_exit_tower_${x}`, to: 'tower', entry: 'bottom', label: '時計塔の中へ', needFlag: 'openTower', needs: ['tweezers'] });
  // ---- 工房
  b.o('counter', 0, 39, 12, { id: 'v_breed', role: 'breed', text: '配合台。' });
  b.o('counter', 0, 42, 12, { id: 'v_storage', role: 'storage', text: '預かり棚。' });
  shelf(0, 43, 11, { id: 'v_ws_shelf', item: 'varnish', qty: 2, flag: 'v_ws_shelf', text: '工房の部品箱。' });
  b.o('item', 0, 37, 16, { item: 'v_gear', kind: 'gear', size: 'small', name: '工房の歯車' });
  b.o('socket', 0, 40, 16, { id: 'v_ws_stand', kind: 'gear', size: 'small', name: '練習の台' });
  // ---- よろず屋
  b.o('counter', 0, 8, 14, { id: 'v_shop_counter', role: 'shop', text: 'よろず屋のカウンター。' });
  shelf(0, 4, 18, { id: 'v_shop_shelf', item: 'paint', qty: 1, flag: 'v_shop_shelf', text: '売り物の箱…の裏。' });
  // ---- 村長の家
  shelf(0, 36, 3, { id: 'v_chief_shelf', item: 'oil', qty: 1, flag: 'v_chief_shelf', text: '村長の物入れ。' });
  stairs(0, 42, 3, 1, 42, 4, '2階へ');
  shelf(1, 36, 3, { id: 'v_chief2_shelf', item: 'gearpin', qty: 1, flag: 'v_chief2_shelf', text: '2階の宝石箱。' });
  shelf(1, 37, 7, { id: 'v_chief_diary', book: 'b_diary', text: '日記「模型師どのが消えた夜、時計塔が止まった」' });
  b.o('bed', 1, 40, 3, { text: '村長のベッド。' });
  // ---- 宿屋
  b.o('counter', 0, 5, 27, { id: 'v_inn_counter', role: 'inn', text: '宿屋の受付。' });
  b.o('bed', 0, 10, 31, { text: '宿屋のベッド。' });
  b.o('bed', 0, 11, 31, { text: '宿屋のベッド。' });
  stairs(0, 12, 32, 1, 11, 32, '2階へ');
  shelf(1, 4, 26, { id: 'v_inn2_shelf', item: 'screw', qty: 1, flag: 'v_inn2_shelf', text: '窓辺の棚。' });
  for (const [x, z] of [[4, 31], [6, 31], [10, 27], [12, 27]]) b.o('bed', 1, x, z, { text: '客室のベッド。' });
  // ---- 図書小屋(本10冊)
  const books = [['b_turn', '回転台のまわし方'], ['b_shadow', '影はどこに落ちる?'], ['b_breed', '配合とおさがりパーツ'], ['b_elem', '素材の輪'], ['b_shape', '型のなじみ方'],
    ['b_special', '特別な組み合わせ'], ['b_kintsugi', 'なじみと金つぎ'], ['b_tweezers', 'ピンセットの心得'], ['b_gears', '歯車の数え方'], ['b_maker', '模型師の日記']];
  const bookCells = [[37, 25], [38, 25], [39, 25], [41, 25], [42, 25], [43, 25], [37, 27], [38, 27], [42, 27], [43, 27]];
  books.forEach(([id, title], i) => shelf(0, bookCells[i][0], bookCells[i][1], { id: 'v_' + id, book: id, text: `本「${title}」` }));
  // ---- 物置
  shelf(0, 19, 31, { id: 'v_shed_box', item: 'smoke', qty: 2, flag: 'v_shed_box', text: '道具箱。' });
  shelf(0, 16, 33, { id: 'v_shed_floor', item: 'thread', qty: 2, flag: 'v_shed_floor', text: '床板が1枚ずれている。床下に何かある。' });
  stairs(0, 19, 33, 2, 18, 33, '屋根裏へ');
  shelf(2, 16, 31, { id: 'v_shed_attic', item: 'screw', qty: 1, flag: 'v_shed_attic', cond: 'camNorth', text: '梁の上の隠し棚。北から見ると屋根の板がめくれる。' });
  // ---- 外
  b.o('chest', 0, 45, 21, { id: 'v_garden', item: 'bigpatch', qty: 1, note: '裏庭' });
  b.o('statue', 0, 17, 21, { id: 'v_statue', text: '模型師の像。「つなぎ目を大事に」' });
  b.o('sign', 0, 21, 21, { id: 'v_sign', text: 'ネジマキ村 ↓作業台へ ↑時計塔' });
  for (let x = 22; x <= 25; x++) b.o('exit', 0, x, 38, { id: `v_exit_s${x}`, to: 'workbench', label: '作業台へ' });
  const r = rng(7);
  for (const [c, x, z] of marks) if (c === 'T') b.o('tree', 0, x, z, { kind: r() < 0.5 ? 'round' : 'cone' });
  // ---- 人(昼の位置。夜の位置は night)
  const npc = (id, name, role, model, x, z, extra = {}) => b.o('npc', extra.l ?? 0, x, z, { id, name, role, model, ...extra });
  npc('master', 'ボルト親方', 'master', 'tsumiking', 40, 13, { talk: ['よう、起きたか。'] });
  npc('chief', 'ヨミ村長', 'chief', 'kamishibai', 40, 5, { night: { l: 1, x: 41, z: 4 }, talk: ['時計塔が止まってから、村の時間もおかしくてのう。'] });
  npc('zen', 'ゼンさん', 'towerGuard', 'zenmainu', 26, 21, { night: { x: 26, z: 17 }, talk: ['塔の歯車がひとつ抜けてて、扉が回らないんだ。工房の歯車なら合うかも。'] });
  npc('koro', 'コロ', 'shop', 'koroishi', 7, 13, { talk: ['いらっしゃい!'] });
  npc('wata', 'ワタおかみ', 'inn', 'felton', 5, 28, { talk: ['ひと休みしていくかい?'] });
  npc('shiori', 'シオリ', 'talk', 'perari', 40, 26, { night: { x: 7, z: 5 }, talk: ['棚の本は、どれでも読んでいいよ。'] });
  npc('fuwa', 'フワ', 'talk', 'watabou', 17, 23, { night: { l: 1, x: 10, z: 30 }, talk: ['広場から時計塔が見えるでしょ。前はちゃんとチクタク鳴ってたんだ。'] });
  npc('inkyo', 'ご隠居', 'talk', 'nejiko', 20, 10, { night: { x: 38, z: 5 }, talk: ['カメラを回すと、積み木の裏が見えるぞい。', '屋根裏は北から見るもんじゃ。'] });
  npc('hanauri', '花売り', 'talk', 'hotarubin', 36, 21, { night: { x: 8, z: 5 }, talk: ['つみき野の回転台は、ハンドルで90°ずつ回るのよ。乗ったまま回すと、あなたもいっしょ。'] });
  b.entries = { home: { l: 0, x: 6, z: 5 }, south: { l: 0, x: 23, z: 36 }, tower: { l: 0, x: 23, z: 17 } };
  b.entry = 'home';
  return b.out();
}

// ================================================================= つみき野(まわす)
// 回転台: 半径4。中心の1マスは軸(通れない)。腕は中心の上下左右から長さ4(向き0のときの向きで書く)。ななめは柵
const DV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
function disc(b, id, cx, cz, arms, opts = {}) {
  const D = { id, l: 0, cx, cz, r: 4, start: opts.start || 0, arms, stage: opts.stage };
  b.discs.push(D);
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
    const q = dx * dx + dz * dz;
    if (q <= 20.25) b.set(0, cx + dx, cz + dz, 'X', 2);
    else if (q <= 30.25) b.set(0, cx + dx, cz + dz, 'w', 0);
  }
  for (const a of arms) { const [dx, dz] = DV[a]; for (let i = 1; i <= 4; i++) b.set(0, cx + dx * i, cz + dz * i, 'k', 1); }
  // 中心の軸のまわり1周(8マス)は台の板。腕どうしはここでつながる(4方向にしか歩けないので、軸をよけて回りこむ)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) b.set(0, cx + dx, cz + dz, 'k', 1);
  for (const [dx, dz] of Object.values(DV)) b.set(0, cx + dx * 5, cz + dz * 5, 'B', 1);
  if (opts.center) b.o('handle', 0, cx, cz, { id: id + '_hc', disc: id, onDisc: true, name: `台${id}の軸のハンドル` });
  else b.o('post', 0, cx, cz, { id: id + '_axle', text: '回転台の軸。', axle: id });
  for (const [hx, hz] of opts.handles || []) b.o('handle', 0, hx, hz, { id: `${id}_h${hx}_${hz}`, disc: id, name: `台${id}のハンドル` });
  return D;
}

function tsumiki() {
  const W = 60, D = 48;
  const b = new B('tsumiki', 'つみき野', W, D, 1, { kind: 'field', accent: '#8cc63f', bgm: 'tsumiki', box: 'tsumiki' });
  const rows = readMap('tsumiki', W, D);
  const hOf = (c) => (c === '2' ? 2 : c === '3' ? 3 : c === '~' ? 0 : 1);
  const marks = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = rows[z][x];
    if (c === '~') b.set(0, x, z, 'w', 0);
    else if (c === ':' || c === 'E' || c === 'G') b.set(0, x, z, 'p', 1);
    else if (c === '=') b.set(0, x, z, 'B', 1);
    else if (c === 'X') b.set(0, x, z, 'X', 2);
    else if (c === '2' || c === '3') b.set(0, x, z, 'g', hOf(c));
    else b.set(0, x, z, 'g', 1);
    if ('$hioRGE?X'.includes(c)) marks.push([c, x, z]);
  }
  // 宝箱の高さ = まわりの地面の高さ(崖の上・段の上)
  for (const [c, x, z] of marks) if (c === '$') {
    const hs = DIR4.map(([dx, dz]) => rows[z + dz]?.[x + dx]).filter((q) => q && '.23'.includes(q)).map(hOf);
    b.set(0, x, z, 'g', Math.max(1, ...hs.filter((h) => h === Math.max(...hs))));
  }
  // 積み木の山: カメラの練習の宝箱をかくす山は高さ4、ほかは 2・3
  const camPiles = new Set(['11,38', '12,38', '11,39', '12,39', '11,40', '12,40', '55,36', '56,36', '55,37', '56,37', '55,38', '56,38']);
  let alt = 0;
  for (const [c, x, z] of marks) if (c === 'X') b.set(0, x, z, 'X', camPiles.has(x + ',' + z) ? 4 : 2 + ((alt++ >> 2) % 2));
  // 回転台5枚(設計図 §2 の表)
  disc(b, 'A', 30, 37, ['S'], { center: true, stage: '習う' });
  disc(b, 'B', 14, 24, ['N', 'S'], { start: 1, handles: [[16, 31]], stage: '試す' });
  disc(b, 'C', 46, 24, ['N', 'E'], { start: 1, handles: [[44, 31], [39, 22]], stage: '試す→組む' });
  disc(b, 'D', 30, 24, ['W', 'N', 'E'], { start: 2, handles: [[21, 21]], stage: '組む' });
  disc(b, 'E', 30, 11, ['N', 'S'], { start: 1, handles: [[38, 9]], stage: '組む' });
  // 台Dの上の積み木(北の腕の根もと横の台座。向き0で (31,21))
  b.set(0, 31, 21, 'k', 1);
  b.o('item', 0, 31, 21, { item: 'ts_block', kind: 'block', name: '積み木', note: '回転台Dの上。台といっしょに回る' });
  // 宝箱(11個)
  const chest = (id, x, z, item, qty, extra = {}) => b.o('chest', 0, x, z, { id, item, qty, ...extra });
  chest('ts_chest_start', 15, 46, 'patch', 2);
  chest('ts_chest_block', 12, 37, 'varnish', 2, { cond: 'camera', note: '積み木の裏(カメラを回す)' });
  chest('ts_chest_hill', 7, 34, 'screw', 1, { needs: ['tweezers'], note: 'はしごの崖の上' });
  chest('ts_chest_se', 56, 35, 'patch', 2, { cond: 'camera', note: '積み木の裏(カメラを回す)' });
  chest('ts_chest_r4', 21, 26, 'thread', 2);
  chest('ts_chest_n', 33, 17, 'patch', 3);
  chest('ts_chest_nw', 3, 3, 'smoke', 2);
  chest('ts_chest_ne', 57, 3, 'gearpin', 1);
  chest('ts_chest_w', 4, 26, 'oil', 1);
  chest('ts_chest_e', 56, 26, 'paint', 2);
  chest('ts_chest_ledge', 56, 21, 'goldscrew', 1, { needs: ['tweezers'], note: '東のすみの高い段' });
  // ピンセットの寄り道
  b.o('item', 0, 50, 40, { item: 'ts_ladder', kind: 'ladder', name: 'はしごの部品' });
  b.o('socket', 0, 9, 34, { id: 'ts_sock_ladder', kind: 'ladder', name: '崖のくぼみ', flag: 'ts_ladder' });
  b.o('item', 0, 27, 18, { item: 'ts_plank', kind: 'plank', name: '橋板' });
  b.set(0, 42, 11, 'w', 0); // 橋げたのくぼみは水の上。橋板を置くと渡れる
  b.o('socket', 0, 42, 11, { id: 'ts_sock_plank', kind: 'plank', name: '池の橋げた', h: 1, flag: 'ts_plank' });
  b.o('socket', 0, 54, 24, { id: 'ts_sock_block', kind: 'block', name: '段のくぼみ', h: 2, flag: 'ts_block' });
  b.rares.push({ id: 'ts_rare_haribote', species: 'haribote', l: 0, x: 44, z: 11, lv: 9, needs: ['tweezers'], note: 'ハリボテの巣(光る台座)' });
  b.o('goal', 0, 30, 1, { id: 'ts_goal', flag: 'clearTsumiki', text: 'つなぎ目が、ほどけかけている……' });
  b.o('sign', 0, 31, 44, { id: 'ts_sign', text: 'つみき野 — ハンドルを調べると、台が90°回るよ' });
  for (const x of [29, 30]) b.o('exit', 0, x, 47, { id: `ts_exit_${x}`, to: 'workbench', label: '作業台へ' });
  // 木: 草で、まわり8マスが同じ高さの草。橋・ハンドル・くぼみ・物のまわり2マスには置かない
  const r = rng(11);
  const keep = b.objects.map((o) => [o.x, o.z]);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (b.get(0, x, z).t === 'B') keep.push([x, z]);
  let placed = 0;
  for (let i = 0; i < 400 && placed < 46; i++) {
    const x = 2 + Math.floor(r() * 56), z = 1 + Math.floor(r() * 46);
    const c = b.get(0, x, z);
    if (c.t !== 'g') continue;
    let open = true;
    for (let dz = -2; dz <= 2 && open; dz++) for (let dx = -2; dx <= 2; dx++) {
      const q = b.levels[0];
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= W || zz >= D) { open = false; break; }
      const t = q.t[zz * W + xx], h = q.h[zz * W + xx];
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && (t !== 'g' || h !== c.h)) { open = false; break; }
      if (t === 'p' || t === 'B') { open = false; break; }
    }
    if (!open || keep.some(([kx, kz]) => Math.abs(kx - x) + Math.abs(kz - z) < 3)) continue;
    b.o('tree', 0, x, z, { kind: r() < 0.5 ? 'block' : 'round' });
    keep.push([x, z]);
    placed++;
  }
  b.spawns.push(
    { l: 0, x0: 14, z0: 43, x1: 46, z1: 47, species: [['nejiko', 3], ['koroishi', 3], ['perari', 2]], lv: [2, 4], n: 3 },
    { l: 0, x0: 2, z0: 30, x1: 24, z1: 41, species: [['koroishi', 3], ['watabou', 3], ['perari', 2]], lv: [3, 6], n: 4 },
    { l: 0, x0: 36, z0: 30, x1: 58, z1: 41, species: [['nejiko', 3], ['watabou', 2], ['matchbo', 1]], lv: [4, 7], n: 4 },
    { l: 0, x0: 2, z0: 2, x1: 24, z1: 18, species: [['watabou', 2], ['koroishi', 2], ['matchbo', 2]], lv: [6, 9], n: 4 },
    { l: 0, x0: 36, z0: 2, x1: 58, z1: 18, species: [['nejiko', 2], ['perari', 2], ['matchbo', 2]], lv: [6, 9], n: 4 },
    { l: 0, x0: 20, z0: 20, x1: 24, z1: 28, species: [['perari', 1], ['koroishi', 1]], lv: [5, 7], n: 1 },
    { l: 0, disc: 'D', species: [['koroishi', 1]], lv: [5, 7], n: 1, note: '回転台の上。台といっしょに回る' },
    { l: 0, disc: 'C', species: [['nejiko', 1]], lv: [5, 7], n: 1, note: '回転台の上。台といっしょに回る' },
    { l: 0, x0: 2, z0: 30, x1: 58, z1: 41, species: [['matchbo', 1]], lv: [6, 8], n: 2, cond: 'evening' }
  );
  b.entries = { south: { l: 0, x: 30, z: 45 } };
  b.entry = 'south';
  return b.out();
}

// ================================================================= ランプの森(てらす)
function forest() {
  const W = 56, D = 48;
  const b = new B('forest', 'ランプの森', W, D, 1, { kind: 'field', accent: '#2e4a8b', bgm: 'forest', box: 'forest', lampStart: 2 });
  const rows = readMap('forest', W, D);
  const marks = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = rows[z][x];
    if (c === 'c') b.set(0, x, z, 'c', 2);
    else if (c === 'd' || c === 'E') b.set(0, x, z, 'd', 2);
    else if (c === 'X') b.set(0, x, z, 'X', 3);
    else if (c === 'A' && x === 44) b.set(0, x, z, 'c', 2);
    else b.set(0, x, z, 'g', 2);
    if (c !== '.' && c !== 'c' && c !== 'd' && c !== 'X') marks.push([c, x, z]);
  }
  // 影を落とす物(設計図 §4)。angle 0=東の光(影は西へ) 1=真上 2=西の光(影は東へ)
  const tree = (id, x, z, angle, len, wide, role) => {
    b.casters.push({ id, l: 0, x, z, angle, len, wide, role });
    b.o('tree', 0, x, z, { id, kind: 'cutout', caster: id });
  };
  tree('fo_t_entry', 13, 39, 2, 4, 1, '習う①');
  tree('fo_t_valley1', 18, 29, 0, 4, 2, '習う②');
  tree('fo_t_pillar_w', 29, 19, 0, 2, 2, '試す②');
  tree('fo_t_pillar_e', 31, 22, 2, 2, 2, '試す③');
  tree('fo_t_f2', 41, 26, 2, 2, 2, '組む①');
  tree('fo_t_i1', 44, 29, 0, 1, 1, '組む③(ひっかけ)');
  b.casters.push({ id: 'fo_arch_ew', l: 0, kind: 'arch', x: 20, z: 21, angle: 1, rects: [[20, 22, 22, 24]], role: '試す①' });
  b.casters.push({ id: 'fo_arch_v3', l: 0, kind: 'arch', x: 44, z: 14, angle: 1, rects: [[43, 18, 44, 26], [43, 15, 45, 18]], role: '組む②' });
  b.o('arch', 0, 20, 21, { id: 'fo_arch_ew_obj', caster: 'fo_arch_ew', x1: 22, z1: 24 });
  b.o('arch', 0, 44, 14, { id: 'fo_arch_v3_obj', caster: 'fo_arch_v3', x1: 44, z1: 26 });
  // ランプ台(影の橋でしか出入りできない陸には必ず1つ)
  const lamps = [['fo_lamp_f0', 8, 34], ['fo_lamp_f1s', 22, 27], ['fo_lamp_f1n', 24, 12], ['fo_lamp_pillar', 30, 21], ['fo_lamp_f2', 38, 30], ['fo_lamp_i1', 43, 28], ['fo_lamp_f3', 50, 20]];
  for (const [id, x, z] of lamps) b.o('lampStation', 0, x, z, { id });
  const chest = (id, x, z, item, qty, extra = {}) => b.o('chest', 0, x, z, { id, item, qty, ...extra });
  chest('fo_chest_nw', 3, 3, 'bigpatch', 2);
  chest('fo_chest_w', 2, 22, 'smoke', 2);
  chest('fo_chest_hollow', 22, 44, 'thread', 2, { note: '習う①(操作0)' });
  chest('fo_chest_n1', 20, 4, 'paint', 2);
  chest('fo_chest_pillar', 30, 23, 'oil', 1);
  chest('fo_chest_f2', 38, 40, 'varnish', 2);
  chest('fo_chest_i3', 43, 32, 'screw', 1, { note: 'ひっかけの行き止まり' });
  chest('fo_chest_se', 52, 44, 'spray', 1);
  chest('fo_chest_f3', 50, 40, 'gearpin', 1);
  chest('fo_chest_nest', 52, 2, 'goldscrew', 1, { needs: ['tweezers'], note: '影の巣' });
  b.o('item', 0, 5, 6, { item: 'fo_cutout', kind: 'cutout', name: '切り絵の木' });
  b.o('socket', 0, 41, 2, { id: 'fo_sock_cutout', kind: 'cutout', name: '切り絵の木の台座', flag: 'fo_cutout', caster: { angle: 2, len: 4, wide: 1 } });
  b.rares.push({ id: 'fo_rare_nest', species: ['origarasu', 'hotarubin'], l: 0, x: 50, z: 2, lv: 12, shinyRate: 1 / 64, needs: ['tweezers'], note: '影の巣(きらり 1/64)' });
  b.o('boss', 0, 50, 12, { id: 'fo_boss', species: 'kageboushi', lv: 14, flag: 'beatKageboushi', name: 'カゲボウシ' });
  b.o('sign', 0, 6, 42, { id: 'fo_sign', text: '影の上だけ歩ける。ランプ台に乗って調べると、光の向きが変わる(東 → 真上 → 西 → 東 …)' });
  for (const x of [6, 7]) b.o('exit', 0, x, 47, { id: `fo_exit_${x}`, to: 'workbench', label: '作業台へ' });
  // 地面の木陰の木(飾り。歩く影とは関係ない。影の魔物の出る場所に使う)
  const r = rng(23);
  const keep = b.objects.map((o) => [o.x, o.z]);
  b.groundShade = [];
  for (let i = 0; i < 600 && b.groundShade.length < 44; i++) {
    const x = Math.floor(r() * W), z = 1 + Math.floor(r() * 44);
    let open = true;
    for (let dz = -2; dz <= 2 && open; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= W || zz >= D) continue;
      if (b.get(0, xx, zz).t !== 'g') { open = false; break; }
    }
    if (!open || keep.some(([kx, kz]) => Math.abs(kx - x) + Math.abs(kz - z) < 4)) continue;
    b.o('tree', 0, x, z, { kind: 'round', shade: true });
    b.groundShade.push([x, z]);
    keep.push([x, z]);
  }
  b.spawns.push(
    { l: 0, x0: 0, z0: 0, x1: 13, z1: 45, species: [['inky', 3], ['felton', 2], ['watabou', 1]], lv: [7, 10], n: 4 },
    { l: 0, x0: 18, z0: 0, x1: 26, z1: 47, species: [['jarihebi', 3], ['inky', 2], ['felton', 2]], lv: [8, 11], n: 4 },
    { l: 0, x0: 34, z0: 0, x1: 41, z1: 47, species: [['jarihebi', 2], ['felton', 2], ['inky', 1]], lv: [9, 12], n: 3 },
    { l: 0, x0: 0, z0: 0, x1: 55, z1: 47, species: [['origarasu', 2], ['hotarubin', 2]], lv: [9, 12], n: 4, cond: 'shadow' },
    { l: 0, x0: 0, z0: 0, x1: 41, z1: 47, species: [['felton', 2]], lv: [8, 11], n: 2, cond: 'light' }
  );
  b.entries = { south: { l: 0, x: 6, z: 45 } };
  b.entry = 'south';
  return b.out();
}

// ================================================================= ゼンマイ時計塔(つなぐ)
const C = 12; // 塔の中心
const R1 = 3, R2 = 8;
export const rim = (deg, rad = 10) => [C + Math.round(rad * Math.sin(deg * Math.PI / 180)), C - Math.round(rad * Math.cos(deg * Math.PI / 180))];
const dist = (x, z) => Math.hypot(x - C, z - C);
const angOf = (x, z) => (Math.atan2(x - C, -(z - C)) * 180 / Math.PI + 360) % 360;
const inCorridor = (x, z) => { const q = dist(x, z); return q > R2 + 0.5 && q <= 11.5; };

// 外の回廊を、角度 deg の線で横切るマス(半径9〜11)
function lineCells(deg) {
  const s = new Map();
  for (let rad = 8.6; rad <= 11.6; rad += 0.2) { const [x, z] = rim(deg, rad); if (inCorridor(x, z)) s.set(x + ',' + z, [x, z]); }
  return [...s.values()];
}
// 回廊のうち、角度が a0..a1 のマス
function arcCells(a0, a1) {
  const out = [];
  for (let z = 0; z < 25; z++) for (let x = 0; x < 25; x++) if (inCorridor(x, z)) { const a = angOf(x, z); if (a >= a0 && a <= a1) out.push([x, z]); }
  return out;
}

function towerFloor(b, l, def) {
  b.levels[l].y = l * 4;
  b.each(l, (x, z) => {
    const q = dist(x, z);
    if (q <= R1 + 0.5) b.set(l, x, z, 'm', 1); // 中央(文字盤の床、回らない)
    else if (q <= R2 + 0.5) b.set(l, x, z, 'W', 2); // 回る外周の床: はじめは壁
    else if (q <= 11.5) b.set(l, x, z, 'm', 1); // 外の回廊
    else if (q <= 12.5) b.set(l, x, z, 'W', 3); // 外壁
  });
  if (def.ring !== false) b.rings.push({ id: 'r' + l, l, cx: C, cz: C, r1: R1, r2: R2, start: def.start || 0, spokes: def.spokes || [], arcs: def.arcs || [], stage: def.stage });
  for (const a of def.spokes || []) {
    const [dx, dz] = DV[a];
    for (let i = R1 + 1; i <= R2; i++) b.set(l, C + dx * i, C + dz * i, 'm', 1);
  }
  // U字の通路: 2つの向きを、中央を通らずにつなぐ(半径6の弧)
  for (const [a1, a2] of def.arcs || []) {
    const ang = { N: 0, E: 90, S: 180, W: 270 };
    let s = ang[a1], e = ang[a2];
    if ((e - s + 360) % 360 > 180) [s, e] = [e, s];
    const span = (e - s + 360) % 360;
    let prev = null;
    for (let t = 0; t <= span; t += 1) {
      const [x, z] = rim(s + t, 6);
      if (prev && prev[0] !== x && prev[1] !== z) b.set(l, x, prev[1], 'm', 1);
      b.set(l, x, z, 'm', 1);
      prev = [x, z];
    }
    for (const a of [a1, a2]) { const [dx, dz] = DV[a]; for (let i = 6; i <= R2; i++) b.set(l, C + dx * i, C + dz * i, 'm', 1); }
  }
  // 外の回廊を区切る仕切り壁(階ごとに変える)
  for (const deg of def.rimWalls) for (const [x, z] of lineCells(deg)) b.set(l, x, z, 'W', 3);
  if (def.dial !== false) b.o('dial', l, C, C, { id: 'dial' + l, ring: 'r' + l, label: `${l + 1}階の文字盤` });
  else b.o('post', l, C, C, { id: 'dial' + l, text: def.dialText });
}

function stairsUp(b, l, deg) {
  // l 階の外回廊 deg の位置に上り階段、l+1 階の同じ場所に下り階段(着くのは半径10)
  const [x, z] = rim(deg, 11);
  const [ax, az] = rim(deg, 10);
  b.o('stairs', l, x, z, { id: `tw_up${l}`, to: { l: l + 1, x: ax, z: az }, label: `${l + 2}階へ`, up: true });
  b.o('stairs', l + 1, x, z, { id: `tw_down${l + 1}`, to: { l, x: ax, z: az }, label: `${l + 1}階へ`, up: false });
}

// 段・棚(高さ h の区画)と、その段のとなりのくぼみの場所をさがす
function raise(b, l, cells, h) { for (const [x, z] of cells) b.set(l, x, z, 'm', h); }
function besideOf(b, l, cells, prefer) {
  const s = new Set(cells.map(([x, z]) => x + ',' + z));
  const cand = [];
  for (const [x, z] of cells) for (const [dx, dz] of DIR4) {
    const xx = x + dx, zz = z + dz;
    if (s.has(xx + ',' + zz) || !inCorridor(xx, zz) || b.get(l, xx, zz).t !== 'm' || b.get(l, xx, zz).h !== 1) continue;
    cand.push([xx, zz]);
  }
  cand.sort((p, q) => Math.abs(angOf(...p) - prefer) - Math.abs(angOf(...q) - prefer) || Math.abs(dist(...p) - 10) - Math.abs(dist(...q) - 10));
  return cand[0];
}

function tower() {
  const b = new B('tower', 'ゼンマイ時計塔', 25, 25, 6, { kind: 'dungeon', accent: '#d2462d', bgm: 'tower', box: 'village' });
  // 1階 復習(まわす): スポーク南。4区画
  towerFloor(b, 0, { spokes: ['S'], start: 0, rimWalls: [45, 135, 225, 315], stage: '復習' });
  // 2階 習う(つなぐ 1:1): スポーク北・東。北と東が1つの大区画
  towerFloor(b, 1, { spokes: ['N', 'E'], start: 0, rimWalls: [135, 225, 315], stage: '習う' });
  // 3階 習う(下の階から回す): 弧 南→西→北。文字盤が折れている
  towerFloor(b, 2, { arcs: [['S', 'W'], ['W', 'N']], dial: false, start: 1, rimWalls: [45, 135, 225, 315], stage: '習う', dialText: '3階の文字盤は針が折れている。下の階から歯車で回せないかな?' });
  // 4階 試す(2:1・振り子): スポーク西 + 弧 北→東
  towerFloor(b, 3, { spokes: ['W'], arcs: [['N', 'E']], start: 1, rimWalls: [45, 135, 225, 315], stage: '試す' });
  // 5階 組む(付けかえ): スポーク東 + 弧 南→西。文字盤は空っぽの穴。西と南が1つの区画
  towerFloor(b, 4, { spokes: ['E'], arcs: [['S', 'W']], dial: false, start: 0, rimWalls: [45, 135, 315], stage: '組む', dialText: '5階の文字盤は空っぽの穴だけ。4階の歯車でしか回せない。' });
  // 6階 ボス: 輪なし。中心に回転台の対戦台
  b.levels[5].y = 20;
  b.each(5, (x, z) => {
    const q = dist(x, z);
    if (q <= 4.5) b.set(5, x, z, 'k', 1);
    else if (q <= 11.5) b.set(5, x, z, 'm', 1);
    else if (q <= 12.5) b.set(5, x, z, 'W', 3);
  });

  // 入口と出口・階段: 1→2 北、2→3 南、3→4 北、4→5 東、5→6 北
  const [ex, ez] = rim(180, 11);
  b.o('exit', 0, ex, ez, { id: 'tw_exit', to: 'village', entry: 'tower', label: '村へもどる' });
  b.entries = { bottom: { l: 0, x: ex, z: ez - 1 } };
  b.entry = 'bottom';
  stairsUp(b, 0, 0);
  stairsUp(b, 1, 180);
  stairsUp(b, 2, 0);
  stairsUp(b, 3, 90);
  stairsUp(b, 4, 0);

  const chest = (l, deg, rad, id, item, qty, extra = {}) => { const [x, z] = rim(deg, rad); return b.o('chest', l, x, z, { id, item, qty, ...extra }); };
  const put = (type, l, [x, z], extra) => b.o(type, l, x, z, extra);

  // ---- 1階: 宝の部屋 = 西の高い段(積み木)
  const led1 = arcCells(236, 258);
  raise(b, 0, led1, 3);
  chest(0, 247, 10, 'tw_room1', 'bigpatch', 2, { needs: ['tweezers'], note: '1階 西の高い段' });
  put('socket', 0, besideOf(b, 0, led1, 262), { id: 'tw_sock1', kind: 'block', h: 2, name: '段のくぼみ', flag: 'tw_room1' });
  put('item', 0, rim(100, 10), { item: 'tw_block1', kind: 'block', name: '積み木' });
  chest(0, 80, 10, 'tw_chest_0_90', 'patch', 3);
  chest(0, 270, 10, 'tw_chest_0_270', 'paint', 1);
  b.o('sign', 0, 14, 21, { id: 'tw_sign1', text: '文字盤を調べると、針が進んで外周の床が90°回る' });

  // ---- 2階: 小さい歯車 → 中心の軸(r1 を回すと r2 も回る 1:1)。宝の部屋 = 西の回廊の穴(橋板)
  put('item', 1, [22, 13], { item: 'tw_gear_small', kind: 'gear', size: 'small', name: '小さい歯車' });
  b.o('socket', 1, C + 1, C + 1, { id: 'tw_axle2', kind: 'gear', size: 'small', link: { from: 'r1', to: 'r2' }, name: '2階の歯車の軸(→3階)' });
  for (const [x, z] of lineCells(260)) b.set(1, x, z, 'v', 0);
  put('socket', 1, rim(260, 10), { id: 'tw_sock2', kind: 'plank', h: 1, name: '回廊の穴', flag: 'tw_room2' });
  put('item', 1, rim(30, 10), { item: 'tw_plank', kind: 'plank', name: '橋板' });
  chest(1, 243, 10, 'tw_room2', 'screw', 1, { needs: ['tweezers'], note: '2階 西の小部屋' });
  chest(1, 280, 10, 'tw_chest_1_270', 'bigpatch', 1);
  b.o('sign', 1, 10, 3, { id: 'tw_sign2', text: '歯車でつながった階は、いっしょに回ります' });

  // ---- 3階: 宝の部屋 = 東の高い棚(はしご)
  const shelf3 = arcCells(52, 80);
  raise(b, 2, shelf3, 4);
  chest(2, 66, 10, 'tw_room3', 'gearpin', 2, { needs: ['tweezers'], note: '3階 東の高い棚' });
  put('socket', 2, besideOf(b, 2, shelf3, 86), { id: 'tw_sock3', kind: 'ladder', name: '棚の下のくぼみ', flag: 'tw_room3' });
  put('item', 2, rim(160, 10), { item: 'tw_ladder', kind: 'ladder', name: 'はしごの部品' });
  chest(2, 115, 10, 'tw_chest_2_115', 'oil', 1);

  // ---- 4階: 大きい歯車 → 西の回廊の軸(輪の外側の歯にかみ合う。r3 を2回で r4 が1回)。振り子。宝の部屋 = 南の奥(くさびで振り子を止める)
  put('item', 3, rim(282, 10), { item: 'tw_gear_large', kind: 'gear', size: 'large', name: '大きい歯車' });
  put('socket', 3, rim(300, 9), { id: 'tw_axle4', kind: 'gear', size: 'large', link: { from: 'r3', to: 'r4' }, name: '4階の歯車の軸(→5階・半分回す)' });
  for (const [deg, ph] of [[20, 0], [70, 2], [250, 3]]) put('pendulum', 3, rim(deg, 10), { id: `tw_pend_${deg}`, period: 4, phase: ph, cells: lineCells(deg) });
  put('pendulum', 3, rim(200, 10), { id: 'tw_pend_200', period: 4, phase: 1, cells: lineCells(200), jamSocket: 'tw_sock4' });
  put('socket', 3, rim(190, 10), { id: 'tw_sock4', kind: 'wedge', h: 2, name: '振り子の下のくぼみ', flag: 'tw_room4' });
  put('item', 3, rim(335, 10), { item: 'tw_wedge', kind: 'wedge', name: 'くさびの積み木' });
  chest(3, 214, 10, 'tw_room4', 'goldscrew', 1, { needs: ['tweezers'], note: '4階 南の奥' });
  chest(3, 165, 10, 'tw_chest_3_180', 'spray', 1);
  b.o('sign', 3, 14, 3, { id: 'tw_sign4', text: '大きい歯車は、小さい歯車の半分しか回らない' });

  // ---- 5階: 宝の部屋 = 東の高い段(積み木)
  const led5 = arcCells(102, 122);
  raise(b, 4, led5, 3);
  chest(4, 112, 10, 'tw_chest_treasure', 'gearpin', 3, { needs: ['tweezers'], book: 'b_notebook', note: '5階 東の高い段(本「模型師の手帳」)' });
  put('socket', 4, besideOf(b, 4, led5, 98), { id: 'tw_sock5', kind: 'block', h: 2, name: '段のくぼみ', flag: 'tw_room5' });
  put('item', 4, rim(25, 10), { item: 'tw_block5', kind: 'block', name: '積み木' });
  chest(4, 340, 10, 'tw_chest_4_340', 'bigpatch', 2);
  b.o('sign', 4, 20, 8, { id: 'tw_sign5', text: '歯車を外せば、下の階だけ回せる' });

  // ---- 6階: ボス
  b.o('boss', 5, C, C - 3, { id: 'tw_boss', species: 'tokeimori', lv: 20, flag: 'beatTokeimori', name: 'トケイモリ' });
  b.o('clockface', 5, C, C, { id: 'tw_clock', needFlag: 'beatTokeimori', flag: 'ending', text: '塔の文字盤。針を動かすと……' });

  b.spawns.push(
    { l: 0, x0: 0, z0: 0, x1: 24, z1: 24, species: [['zenmainu', 2], ['rousokun', 2]], lv: [11, 13], n: 2 },
    { l: 1, x0: 0, z0: 0, x1: 24, z1: 24, species: [['zenmainu', 2], ['rousokun', 2], ['kamishibai', 1]], lv: [12, 14], n: 3 },
    { l: 2, x0: 0, z0: 0, x1: 24, z1: 24, species: [['kamishibai', 2], ['tsumiking', 1]], lv: [13, 15], n: 3 },
    { l: 3, x0: 0, z0: 0, x1: 24, z1: 24, species: [['tsumiking', 2], ['zenmainu', 2]], lv: [14, 16], n: 3, cond: 'beat' },
    { l: 4, x0: 0, z0: 0, x1: 24, z1: 24, species: [['tsumiking', 2], ['kamishibai', 2], ['rousokun', 1]], lv: [15, 17], n: 3 }
  );
  return b.out();
}

export function buildAll() { return [village(), tsumiki(), forest(), tower()]; }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(join(ROOT, 'data', 'areas'), { recursive: true });
  for (const a of buildAll()) {
    writeFileSync(join(ROOT, 'data', 'areas', a.id + '.json'), JSON.stringify(a));
    console.log(a.id, a.levels.map((L) => `${L.w}x${L.d}`).join(','), a.objects.length, 'objects');
  }
}
