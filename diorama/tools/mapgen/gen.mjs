// エリアのデータを作って data/areas/*.json に書き出す。
// 使い方: node tools/mapgen/gen.mjs
// 出てきた JSON はエディタで手直ししてもよい(手直ししたら、このスクリプトをもう一度流さないこと。または同じ直しをここにも入れる)。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

class B {
  constructor(id, name, w, d, nLevels = 1, opts = {}) {
    Object.assign(this, { id, name, objects: [], discs: [], rings: [], buildings: [], spawns: [], rares: [], ...opts });
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
    const ob = { id: extra.id || `${this.id}_${type}_${this.n++}`, type, l, x, z, ...extra };
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

// ---------------------------------------------------------------- 建物
function building(b, l, def) {
  const { x0, z0, x1, z1, door } = def;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    b.set(l, x, z, edge ? 'W' : 'f', 1);
  }
  b.set(l, door.x, door.z, 'f', 1);
  b.buildings.push({ l, ...def });
}

// ================================================================= ネジマキ村
function village() {
  const b = new B('village', 'ネジマキ村', 40, 32, 2, { kind: 'town', accent: '#e0a526', bgm: 'village', box: 'village' });
  const r = rng(7);
  b.rect(0, 0, 0, 39, 31, 'g', 1);
  // 小川(東)と橋
  for (let z = 0; z < 32; z++) { b.set(0, 26, z, 'w', 0); b.set(0, 27, z, 'w', 0); }
  b.rect(0, 26, 14, 27, 15, 'B', 1);
  b.rect(0, 26, 29, 27, 29, 'B', 1);
  // 道: 南の入口から広場、各家へ
  b.rect(0, 19, 12, 20, 31, 'p', 1);
  b.rect(0, 13, 13, 25, 19, 'p', 1); // 広場
  b.rect(0, 4, 15, 36, 15, 'p', 1);
  b.rect(0, 5, 10, 5, 15, 'p', 1);
  b.rect(0, 32, 11, 32, 15, 'p', 1);
  b.rect(0, 5, 15, 5, 19, 'p', 1);
  b.rect(0, 33, 15, 33, 20, 'p', 1);
  b.rect(0, 15, 19, 15, 23, 'p', 1);
  b.rect(0, 24, 19, 24, 23, 'p', 1);

  building(b, 0, { id: 'home', name: '自宅', x0: 2, z0: 3, x1: 9, z1: 9, door: { x: 5, z: 9 }, roof: '#b5523b' });
  building(b, 0, { id: 'workshop', name: '工房', x0: 29, z0: 2, x1: 37, z1: 10, door: { x: 32, z: 10 }, roof: '#4f6d8f' });
  building(b, 0, { id: 'shop', name: 'よろず屋', x0: 2, z0: 20, x1: 9, z1: 26, door: { x: 5, z: 20 }, roof: '#6c8f4f' });
  building(b, 0, { id: 'chief', name: '村長の家', x0: 29, z0: 21, x1: 37, z1: 28, door: { x: 33, z: 21 }, roof: '#8f4f6d', upper: 1 });
  building(b, 0, { id: 'inn', name: '宿屋', x0: 11, z0: 24, x1: 18, z1: 30, door: { x: 15, z: 24 }, roof: '#c98a2b' });
  building(b, 0, { id: 'library', name: '図書小屋', x0: 21, z0: 24, x1: 25, z1: 30, door: { x: 24, z: 24 }, roof: '#5f4f8f' });
  building(b, 0, { id: 'tower', name: '時計塔', x0: 16, z0: 3, x1: 23, z1: 10, door: { x: 19, z: 10 }, roof: '#c0452f', tall: true });
  b.rect(0, 19, 11, 20, 11, 'p', 1);
  b.rect(0, 15, 10, 15, 12, 'g', 1);

  // 村長の家の2階(レベル1)
  b.levels[1].y = 3;
  for (let z = 21; z <= 28; z++) for (let x = 29; x <= 37; x++) {
    const edge = x === 29 || x === 37 || z === 21 || z === 28;
    b.set(1, x, z, edge ? 'W' : 'f', 1);
  }
  b.o('stairs', 0, 36, 27, { to: { l: 1, x: 35, z: 27 }, label: '2階へ' });
  b.o('stairs', 1, 36, 27, { to: { l: 0, x: 35, z: 27 }, label: '1階へ' });

  // 家具と調べられる物
  b.o('bed', 0, 3, 4, { text: 'ふかふかのベッド。ネジを巻いてもらうと、よく眠れる。' });
  b.o('shelf', 0, 8, 4, { item: 'patch', qty: 2, flag: 'v_home_shelf', text: 'タンスの引き出し。' });
  b.o('shelf', 0, 3, 8, { text: '模型師の作業ノート。「ジオラマは、つなぎ目がいちばん大事」と書いてある。' });
  b.o('counter', 0, 33, 5, { role: 'breed', text: '配合台。' });
  b.o('counter', 0, 30, 5, { role: 'storage', text: '預かり棚。' });
  b.o('shelf', 0, 36, 3, { item: 'varnish', qty: 2, flag: 'v_ws_shelf', text: '工房の部品箱。' });
  b.o('counter', 0, 5, 23, { role: 'shop', text: 'よろず屋のカウンター。' });
  b.o('shelf', 0, 8, 25, { item: 'paint', qty: 1, flag: 'v_shop_shelf', text: '売り物の箱…の裏。' });
  b.o('counter', 0, 13, 27, { role: 'inn', text: '宿屋の受付。' });
  b.o('bed', 0, 16, 28, { text: '宿屋のベッド。' });
  b.o('bed', 0, 17, 28, { text: '宿屋のベッド。' });
  b.o('shelf', 0, 22, 29, { book: 'b_turn', text: '本「回転台のまわし方」' });
  b.o('shelf', 0, 23, 29, { book: 'b_shadow', text: '本「影はどこに落ちる?」' });
  b.o('shelf', 0, 24, 29, { book: 'b_breed', text: '本「配合と、おさがりパーツ」' });
  b.o('shelf', 0, 22, 26, { book: 'b_elem', text: '本「素材の輪」' });
  b.o('shelf', 0, 30, 27, { item: 'oil', qty: 1, flag: 'v_chief_shelf', text: '村長の物入れ。' });
  b.o('shelf', 1, 30, 22, { item: 'gearpin', qty: 1, flag: 'v_chief2_shelf', text: '2階の宝石箱。' });
  b.o('bed', 1, 35, 22, { text: '村長のベッド。' });
  b.o('shelf', 1, 32, 27, { book: 'b_maker', text: '日記「模型師どのが消えた夜、時計塔が止まった」' });

  // 住人
  b.o('npc', 0, 33, 7, { id: 'master', name: '親方', role: 'master', model: 'tsumiking', talk: ['よう、起きたか。'] });
  b.o('npc', 0, 6, 22, { id: 'shopkeep', name: 'よろず屋', role: 'shop', model: 'koroishi', talk: ['いらっしゃい!'] });
  b.o('npc', 0, 13, 26, { id: 'innkeep', name: '宿屋のおかみ', role: 'inn', model: 'felton', talk: ['ひと休みしていくかい?'] });
  b.o('npc', 0, 33, 24, { id: 'chief', name: '村長', role: 'chief', model: 'kamishibai', talk: ['時計塔が止まってから、村の時間もおかしくてのう。'] });
  b.o('npc', 0, 23, 27, { id: 'librarian', name: '本の虫', role: 'talk', model: 'perari', talk: ['棚の本は、どれでも読んでいいよ。'] });
  b.o('npc', 0, 17, 15, { id: 'kid', name: '村の子', role: 'talk', model: 'watabou', night: { x: 14, z: 27 },
    talk: ['広場から時計塔が見えるでしょ。前はちゃんとチクタク鳴ってたんだ。', '夜は宿屋にいるよ。'] });
  b.o('npc', 0, 22, 17, { id: 'oldman', name: 'ご隠居', role: 'talk', model: 'nejiko', night: { x: 31, z: 25 },
    talk: ['カメラを回すと、積み木の裏が見えるぞい。Q と E、それか ⟲ ⟳ じゃ。'] });
  b.o('npc', 0, 10, 15, { id: 'girl', name: '花売り', role: 'talk', model: 'hotarubin', night: { x: 4, z: 6 },
    talk: ['つみき野の回転台は、ハンドルで90°ずつ回るのよ。乗ったまま回すと、あなたもいっしょ。'] });
  b.o('npc', 0, 19, 12, { id: 'guard', name: '塔の番人', role: 'towerGuard', model: 'zenmainu',
    talk: ['塔の歯車がはずれてる。ピンセットがないと、上へは行けないよ。'] });
  b.o('sign', 0, 21, 21, { text: 'ネジマキ村 ↓作業台へ ↑時計塔' });
  b.o('statue', 0, 18, 17, { text: '模型師の像。「つなぎ目を大事に」' });
  b.o('exit', 0, 19, 31, { to: 'workbench', label: '作業台へ' });
  b.o('exit', 0, 20, 31, { to: 'workbench', label: '作業台へ' });
  b.o('exit', 0, 19, 4, { to: 'tower', entry: 'bottom', label: '時計塔の中へ', needFlag: 'gotTweezers' });
  b.o('exit', 0, 20, 4, { to: 'tower', entry: 'bottom', label: '時計塔の中へ', needFlag: 'gotTweezers' });
  b.o('post', 0, 18, 4, { text: '時計塔のゼンマイ。止まっている。' });
  b.o('post', 0, 21, 4, { text: '時計塔のゼンマイ。止まっている。' });
  // 木と花壇
  const trees = [[12, 2], [13, 6], [11, 10], [24, 3], [25, 8], [38, 13], [38, 18], [1, 13], [1, 28], [10, 30], [28, 30], [38, 30], [24, 12], [14, 21], [9, 13], [36, 12]];
  for (const [x, z] of trees) b.o('tree', 0, x, z, { kind: r() < 0.5 ? 'round' : 'cone' });
  b.entries = { home: { l: 0, x: 5, z: 6 }, south: { l: 0, x: 19, z: 30 }, tower: { l: 0, x: 19, z: 6 } };
  b.entry = 'home';
  return b.out();
}

// ================================================================= つみき野(回転台)
// 回転台の腕: N E S W のうち、どれに道が出ているか(向き0のとき)
function disc(b, id, cx, cz, arms, opts = {}) {
  const R = 4;
  const D = { id, l: 0, cx, cz, r: R, start: opts.start || 0, arms };
  b.discs.push(D);
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
    const q = dx * dx + dz * dz;
    const x = cx + dx, z = cz + dz;
    if (q <= 20.25) b.set(0, x, z, 'X', 2); // 台の上は、はじめは柵(歩けない)
    else if (q <= 30.25) b.set(0, x, z, 'w', 0); // まわりの堀
  }
  // 中心のまわり1周と腕
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) b.set(0, cx + dx, cz + dz, 'k', 1);
  const dirs = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const a of arms) {
    const [dx, dz] = dirs[a];
    for (let i = 2; i <= 4; i++) b.set(0, cx + dx * i, cz + dz * i, 'k', 1);
  }
  b.set(0, cx, cz, 'k', 1);
  // 4方向の橋(堀の上)
  for (const [dx, dz] of Object.values(dirs)) b.set(0, cx + dx * 5, cz + dz * 5, 'B', 1);
  b.o('post', 0, cx, cz, { id: id + '_axle', text: '回転台の軸。', axle: id });
  if (opts.center) {
    // 中心の軸がハンドルを兼ねる
    b.objects.pop();
    b.o('handle', 0, cx, cz, { id: id + '_hc', disc: id, onDisc: true });
  }
  for (const [hx, hz] of opts.handles || []) b.o('handle', 0, hx, hz, { id: `${id}_h${hx}_${hz}`, disc: id });
  return D;
}

function tsumiki() {
  const b = new B('tsumiki', 'つみき野', 60, 48, 1, { kind: 'field', accent: '#8cc63f', bgm: 'tsumiki', box: 'tsumiki' });
  const r = rng(11);
  b.rect(0, 0, 0, 59, 47, 'w', 0);
  const land = (x0, z0, x1, z1, h = 1, t = 'g') => b.rect(0, x0, z0, x1, z1, t, h);
  land(14, 43, 46, 47); // R0 入口
  land(2, 30, 24, 41); // R1 西
  land(36, 30, 58, 41); // R2 東
  land(26, 30, 34, 31); // R3 中央の小道
  land(20, 20, 24, 28); // R4 BとDのあいだ
  land(36, 20, 40, 28); // R5 DとCのあいだ
  land(26, 17, 34, 18); // R6 北の小道
  land(2, 2, 24, 18); // R7 北西
  land(36, 2, 58, 18); // R8 北東
  land(26, 1, 34, 5); // R9 ゴール
  land(2, 20, 8, 28); // R10 西のすみ
  land(52, 20, 58, 28); // R11 東のすみ
  // 道
  b.rect(0, 30, 43, 30, 47, 'p', 1);
  b.rect(0, 26, 2, 34, 3, 'p', 1);
  // 地形の起伏(段差1までは登れる)
  land(5, 33, 8, 35, 3); // R1 の丘(まわりより2高い崖。はしごがないと登れない)
  land(14, 4, 20, 9, 2); // R7 の丘
  land(44, 34, 52, 39, 2);
  land(48, 4, 54, 8, 2);
  // 池と小島(R8、ピンセットで橋板)
  b.rect(0, 42, 8, 47, 15, 'w', 0);
  b.rect(0, 43, 10, 45, 13, 'g', 1);
  b.set(0, 42, 11, 'w', 0);

  // 回転台5枚: A は中心にハンドル(乗ったまま回せる)
  disc(b, 'A', 30, 37, ['S', 'E'], { center: true });
  disc(b, 'B', 14, 24, ['E', 'S'], { start: 2, handles: [[21, 27]] }); // ハンドルは R4
  disc(b, 'C', 46, 24, ['N', 'S'], { start: 1, handles: [[39, 21]] }); // ハンドルは R5
  disc(b, 'D', 30, 24, ['W', 'N', 'E'], { start: 2, handles: [[33, 30]] }); // ハンドルは R3
  disc(b, 'E', 30, 11, ['N', 'S'], { start: 1, handles: [[23, 14], [37, 13]] }); // R7 と R8

  // 積み木の山(カメラを回すと裏が見える)
  const blocks = [[11, 38, 2, 3], [19, 33, 3, 2], [40, 32, 2, 2], [55, 36, 2, 3], [6, 12, 3, 2], [10, 15, 2, 3], [44, 4, 3, 2], [56, 12, 2, 2], [17, 45, 2, 2], [42, 45, 2, 2], [22, 2, 2, 3]];
  for (const [x, z, w, d] of blocks) b.rect(0, x, z, x + w - 1, z + d - 1, 'X', 2 + Math.floor(r() * 3));
  // 木
  for (let i = 0; i < 60; i++) {
    const x = 1 + Math.floor(r() * 58), z = 1 + Math.floor(r() * 46);
    const c = b.get(0, x, z);
    let open = c.t === 'g';
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (b.get(0, Math.min(59, Math.max(0, x + dx)), Math.min(47, Math.max(0, z + dz))).t !== 'g') open = false;
    if (open && !b.objects.some((o) => Math.abs(o.x - x) + Math.abs(o.z - z) < 3)) b.o('tree', 0, x, z, { kind: r() < 0.5 ? 'block' : 'round' });
  }
  // 宝箱
  b.o('chest', 0, 7, 34, { id: 'ts_chest_hill', item: 'bigpatch', qty: 2, needs: ['tweezers'], note: 'はしごの崖の上' });
  b.set(0, 7, 34, 'g', 3);
  b.o('chest', 0, 12, 37, { id: 'ts_chest_block', item: 'varnish', qty: 2, note: '積み木の裏(カメラを回す)' });
  b.o('chest', 0, 4, 22, { id: 'ts_chest_w', item: 'oil', qty: 1 });
  b.o('chest', 0, 56, 26, { id: 'ts_chest_e', item: 'paint', qty: 2 });
  b.o('chest', 0, 33, 17, { id: 'ts_chest_n', item: 'patch', qty: 3 });
  b.o('chest', 0, 3, 3, { id: 'ts_chest_nw', item: 'smoke', qty: 2 });
  b.o('chest', 0, 57, 3, { id: 'ts_chest_ne', item: 'gearpin', qty: 1 });
  b.o('chest', 0, 56, 35, { id: 'ts_chest_se', item: 'patch', qty: 2, note: '積み木の裏' });
  b.o('chest', 0, 15, 46, { id: 'ts_chest_start', item: 'patch', qty: 2 });
  // ピンセットの寄り道①: はしごの部品(R2) → 丘のふもとのソケット(R1)
  b.o('item', 0, 50, 40, { item: 'ts_ladder', kind: 'ladder', name: 'はしごの部品' });
  b.o('socket', 0, 9, 34, { id: 'ts_sock_ladder', kind: 'ladder', name: '崖のくぼみ' });
  b.set(0, 9, 34, 'g', 1); // はしごをかけると、ここから崖の上(高さ3)へ登れる
  // ピンセットの寄り道②: 橋板(R6) → 池のソケット(R8)
  b.o('item', 0, 27, 18, { item: 'ts_plank', kind: 'plank', name: '橋板' });
  b.o('socket', 0, 42, 11, { id: 'ts_sock_plank', kind: 'plank', name: '池の橋げた', h: 1 });
  b.rares.push({ id: 'ts_rare_haribote', species: 'haribote', l: 0, x: 44, z: 11, lv: 9, needs: ['tweezers'], note: 'ハリボテの巣' });

  // ゴール: ジオラマのつなぎ目
  b.o('goal', 0, 30, 1, { id: 'ts_goal', flag: 'clearTsumiki', text: 'ジオラマのつなぎ目が、ほどけかけている…。' });
  b.o('sign', 0, 31, 44, { text: 'つみき野 — 回転台のハンドルを調べると、90°回るよ' });
  b.o('exit', 0, 30, 47, { to: 'workbench', label: '作業台へ' });
  b.o('exit', 0, 29, 47, { to: 'workbench', label: '作業台へ' });

  b.spawns.push(
    { l: 0, x0: 14, z0: 43, x1: 46, z1: 47, species: [['nejiko', 3], ['koroishi', 3], ['perari', 2]], lv: [2, 4], n: 3 },
    { l: 0, x0: 2, z0: 30, x1: 24, z1: 41, species: [['koroishi', 3], ['watabou', 3], ['perari', 2]], lv: [3, 6], n: 4 },
    { l: 0, x0: 36, z0: 30, x1: 58, z1: 41, species: [['nejiko', 3], ['watabou', 2], ['matchbo', 1]], lv: [4, 7], n: 4 },
    { l: 0, x0: 2, z0: 2, x1: 24, z1: 18, species: [['watabou', 2], ['koroishi', 2], ['matchbo', 2]], lv: [6, 9], n: 4 },
    { l: 0, x0: 36, z0: 2, x1: 58, z1: 18, species: [['nejiko', 2], ['perari', 2], ['matchbo', 2]], lv: [6, 9], n: 4 },
    { l: 0, x0: 20, z0: 18, x1: 24, z1: 28, species: [['perari', 1], ['koroishi', 1]], lv: [5, 7], n: 1 },
    { l: 0, x0: 2, z0: 30, x1: 58, z1: 41, species: [['matchbo', 1]], lv: [6, 8], n: 2, cond: 'evening' }
  );
  b.entries = { south: { l: 0, x: 30, z: 45 } };
  b.entry = 'south';
  return b.out();
}

// ================================================================= ランプの森(光と影)
function forest() {
  const b = new B('forest', 'ランプの森', 56, 48, 1, { kind: 'field', accent: '#2e4a8b', bgm: 'forest', box: 'forest', lampStart: 1 });
  const r = rng(23);
  b.rect(0, 0, 0, 55, 47, 'g', 2);
  // 谷(南北に3本、東西に1本)。谷は h=0、影の上だけ歩ける
  const chasm = (x0, z0, x1, z1) => b.rect(0, x0, z0, x1, z1, 'c', 2); // 歩く高さは岸と同じ。見た目だけ深い谷
  chasm(14, 0, 17, 47); // 谷1
  chasm(27, 0, 33, 47); // 谷2(真ん中に柱)
  chasm(42, 0, 45, 47); // 谷3
  chasm(18, 22, 26, 24); // 東西の谷(F1 を南北に分ける)
  b.rect(0, 29, 19, 31, 23, 'g', 2); // 谷2の柱(ランプ台つき)
  b.rect(0, 29, 36, 31, 39, 'g', 2); // 谷2の南の柱(宝箱)
  // 木の台の縁(外周)は少し低く
  b.rect(0, 0, 46, 13, 47, 'd', 2);
  // 影を落とす物(切り絵の木・岩)。角度 0=東から光(影は西へ) / 1=真上 / 2=西から光(影は東へ)
  const casters = [];
  const caster = (x, z, kind, len, wide = 1) => { casters.push({ x, z, kind, len, wide }); b.o(kind === 'rock' ? 'statue' : 'tree', 0, x, z, { kind: kind === 'rock' ? 'rock' : 'cutout', caster: true, len, wide }); };
  // 谷1: 東岸の木で東の光のとき橋(F0→F1)
  caster(18, 30, 'tree', 4, 2);
  caster(18, 9, 'tree', 4, 1);
  // 谷1: 西岸の木で西の光のとき橋(北の宝)
  caster(13, 40, 'tree', 4, 1);
  // 谷2 西半分(x27-28): F1 東岸の木、西の光で影が東へ
  caster(26, 21, 'tree', 2, 2);
  caster(26, 37, 'rock', 2, 1);
  // 谷2 東半分(x32-33): F2 西岸の木、東の光で影が西へ
  caster(34, 21, 'tree', 2, 2);
  // 東西の谷: 北岸の大岩(真上のときは足もと、東西の光で斜めに)
  caster(22, 21, 'rock', 0, 1);
  // 谷3: 真上の光のとき、大きな枝のアーチの影
  const canopies = [{ x0: 42, z0: 12, x1: 45, z1: 13 }, { x0: 18, z0: 22, x1: 19, z1: 24 }];
  for (const c of canopies) b.o('arch', 0, c.x0, c.z0, { x1: c.x1, z1: c.z1 });
  // 影を計算する(地面の上の影も入れる。影の魔物の出現にも使う)
  const W = 56;
  const shadow = { 0: new Set(), 1: new Set(), 2: new Set() };
  for (const c of casters) {
    for (let k = 0; k < c.wide; k++) {
      const z = c.z + k;
      for (const a of [0, 1, 2]) {
        shadow[a].add(z * W + c.x);
        if (a === 0) for (let i = 1; i <= c.len; i++) shadow[0].add(z * W + c.x - i);
        if (a === 2) for (let i = 1; i <= c.len; i++) shadow[2].add(z * W + c.x + i);
      }
    }
  }
  for (const c of canopies) for (let z = c.z0; z <= c.z1; z++) for (let x = c.x0; x <= c.x1; x++) shadow[1].add(z * W + x);
  // 森の木陰(地面の影。歩くのには関係ない)
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * 56), z = Math.floor(r() * 46);
    let open = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const q = b.get(0, Math.min(55, Math.max(0, x + dx)), Math.min(47, Math.max(0, z + dz))); if (q.t !== 'g') open = false; }
    if (!open) continue;
    if (b.objects.some((o) => Math.abs(o.x - x) + Math.abs(o.z - z) < 3)) continue;
    b.o('tree', 0, x, z, { kind: 'cutout', len: 1 });
    for (const a of [0, 1, 2]) shadow[a].add(z * W + x + (a === 0 ? -1 : a === 2 ? 1 : 0));
  }
  b.shadow = { 0: [...shadow[0]].sort((a, c) => a - c), 1: [...shadow[1]].sort((a, c) => a - c), 2: [...shadow[2]].sort((a, c) => a - c) };
  b.casters = casters;
  b.canopies = canopies;

  // ランプ台(乗って調べる)
  b.o('lampStation', 0, 8, 34, { id: 'lamp_s1' });
  b.o('lampStation', 0, 22, 33, { id: 'lamp_s2' });
  b.o('lampStation', 0, 30, 21, { id: 'lamp_s3' });
  b.o('lampStation', 0, 38, 26, { id: 'lamp_s4' });
  b.o('lampStation', 0, 22, 12, { id: 'lamp_s5' });
  // 宝箱
  b.o('chest', 0, 30, 37, { id: 'fo_chest_pillar', item: 'oil', qty: 1, note: '南の柱の上' });
  b.o('chest', 0, 3, 3, { id: 'fo_chest_nw', item: 'bigpatch', qty: 2 });
  b.o('chest', 0, 20, 4, { id: 'fo_chest_n1', item: 'paint', qty: 2 });
  b.o('chest', 0, 38, 40, { id: 'fo_chest_f2', item: 'varnish', qty: 2 });
  b.o('chest', 0, 52, 44, { id: 'fo_chest_se', item: 'spray', qty: 1 });
  b.o('chest', 0, 24, 44, { id: 'fo_chest_f1s', item: 'patch', qty: 3 });
  b.o('chest', 0, 2, 22, { id: 'fo_chest_w', item: 'smoke', qty: 2 });
  // ぬし
  b.o('boss', 0, 50, 12, { id: 'fo_boss', species: 'kageboushi', lv: 14, flag: 'beatKageboushi', name: 'カゲボウシ' });
  b.o('sign', 0, 6, 42, { text: 'ランプの森 — 影の上だけ歩ける。ランプ台に乗って調べると、光の向きが変わる' });
  b.o('exit', 0, 6, 47, { to: 'workbench', label: '作業台へ' });
  b.o('exit', 0, 7, 47, { to: 'workbench', label: '作業台へ' });
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

// ================================================================= ゼンマイ時計塔(針で外周の床を回す + ピンセット)
const C = 12; // 塔の中心
const rim = (deg, rad = 10) => [C + Math.round(rad * Math.sin(deg * Math.PI / 180)), C - Math.round(rad * Math.cos(deg * Math.PI / 180))];

function towerFloor(b, l, def) {
  const R1 = 3, R2 = 8;
  b.levels[l].y = l * 4;
  b.each(l, (x, z) => {
    const dx = x - C, dz = z - C, q = Math.sqrt(dx * dx + dz * dz);
    if (q <= R1 + 0.5) b.set(l, x, z, 'm', 1); // 中央(文字盤)
    else if (q <= R2 + 0.5) b.set(l, x, z, 'W', 2); // 回る外周の床: はじめは壁
    else if (q <= 11.5) b.set(l, x, z, 'm', 1); // 外側の回廊
    else if (q <= 12.5) b.set(l, x, z, 'W', 3); // 外壁
  });
  if (def.ring !== false) b.rings.push({ id: 'r' + l, l, cx: C, cz: C, r1: R1, r2: R2, start: def.start || 0 });
  // 外周の床の通路(向き0のとき)
  const dirs = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const a of def.spokes || []) {
    const [dx, dz] = dirs[a];
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
      if (prev && prev[0] !== x && prev[1] !== z) b.set(l, x, prev[1], 'm', 1); // ななめのすき間をうめて4方向でつなぐ
      b.set(l, x, z, 'm', 1);
      prev = [x, z];
    }
    for (const a of [a1, a2]) {
      const [dx, dz] = dirs[a];
      for (let i = 6; i <= R2; i++) b.set(l, C + dx * i, C + dz * i, 'm', 1);
    }
  }
  // 外側の回廊を区切る壁(角度)
  for (const deg of def.rimWalls || [45, 135, 225, 315]) {
    for (let rad = 8.6; rad <= 11.6; rad += 0.35) {
      const [x, z] = rim(deg, rad);
      b.set(l, x, z, 'W', 3);
    }
  }
  if (def.dial !== false) b.o('dial', l, C, C, { id: 'dial' + l, ring: 'r' + l, label: `${l + 1}階の文字盤` });
  else b.o('post', l, C, C, { text: def.dialText || 'この階の文字盤は、針が折れている。' });
}

function stairsUp(b, l, deg, arrivalDeg) {
  // l 階の外回廊 deg の位置に上り階段、l+1 階の同じ場所に下り階段
  const [x, z] = rim(deg, 11);
  const [ax, az] = rim(arrivalDeg ?? deg, 10);
  b.o('stairs', l, x, z, { to: { l: l + 1, x: ax, z: az }, label: `${l + 2}階へ`, up: true });
  b.o('stairs', l + 1, x, z, { to: { l, x: ax, z: az }, label: `${l + 1}階へ`, up: false });
}

function tower() {
  const b = new B('tower', 'ゼンマイ時計塔', 25, 25, 6, { kind: 'dungeon', accent: '#d2462d', bgm: 'tower', box: 'village' });
  // 1階: 練習。通路1本、入口は南、上り階段は北
  towerFloor(b, 0, { spokes: ['S'], start: 0 });
  // 2階: 通路2本(L字)。小さい歯車を拾って軸にはめると、3階の床もいっしょに回る
  towerFloor(b, 1, { spokes: ['N', 'E'], start: 0 });
  // 3階: 文字盤が折れている。半円の通路(南→西→北)は2階から回す
  towerFloor(b, 2, { arcs: [['S', 'W'], ['W', 'N']], dial: false, start: 1, dialText: '3階の文字盤は針が折れている。下の階から歯車で回せないかな?' });
  // 4階: 振り子の回廊。大きい歯車(半分だけ回す)を5階の軸へ
  towerFloor(b, 3, { spokes: ['W', 'S'], arcs: [['N', 'E']], start: 2 });
  // 5階: 文字盤なし(4階から大きい歯車で回す)。宝の部屋はピンセットで積み木を置いて登る
  towerFloor(b, 4, { spokes: ['E'], arcs: [['S', 'W']], dial: false, start: 1, dialText: '5階の文字盤は空っぽの穴だけ。4階の軸に歯車をはめれば…' });
  // 6階: ボスの部屋(回らない)
  b.levels[5].y = 20;
  b.each(5, (x, z) => {
    const q = Math.hypot(x - C, z - C);
    if (q <= 11.5) b.set(5, x, z, 'm', 1);
    else if (q <= 12.5) b.set(5, x, z, 'W', 3);
  });

  // 入口と出口
  const [ex, ez] = rim(180, 11);
  b.o('exit', 0, ex, ez, { to: 'village', entry: 'tower', label: '村へもどる' });
  b.entries = { bottom: { l: 0, x: ex, z: ez - 1 } };
  b.entry = 'bottom';
  // 階段: 1→2 北、2→3 南、3→4 北、4→5 東、5→6 北
  stairsUp(b, 0, 0);
  stairsUp(b, 1, 180);
  stairsUp(b, 2, 0);
  stairsUp(b, 3, 90);
  stairsUp(b, 4, 0);

  // 歯車と軸
  const [gx, gz] = rim(90, 10);
  b.o('item', 1, gx, gz + 1, { item: 'tw_gear_small', kind: 'gear', size: 'small', name: '小さい歯車' });
  b.o('socket', 1, C + 1, C + 1, { id: 'tw_axle2', kind: 'gear', link: { from: 'r1', to: 'r2' }, name: '2階の歯車の軸(→3階)' });
  const [g4x, g4z] = rim(270, 10);
  b.o('item', 3, g4x, g4z, { item: 'tw_gear_large', kind: 'gear', size: 'large', name: '大きい歯車' });
  b.o('socket', 3, C - 1, C + 1, { id: 'tw_axle4', kind: 'gear', link: { from: 'r3', to: 'r4' }, name: '4階の歯車の軸(→5階・半分回す)' });
  // 振り子(4階の外回廊)。リズムは BGM の拍と同じ
  for (const [deg, ph] of [[20, 0], [70, 2], [200, 1], [250, 3]]) {
    const [px, pz] = rim(deg, 10);
    const cells = [9, 10, 11].map((rad) => rim(deg, rad));
    b.o('pendulum', 3, px, pz, { period: 4, phase: ph, cells });
  }
  // 5階の宝の部屋: 着いた東の回廊の一角が高い段(高さ3)。北の回廊にある積み木をピンセットで運んで、くぼみに置くと登れる
  for (const deg of [102, 108, 114, 120]) for (const rad of [9, 10, 11]) { const [x, z] = rim(deg, rad); b.set(4, x, z, 'm', 3); }
  const [bsx, bsz] = rim(96, 10);
  b.o('socket', 4, bsx, bsz, { id: 'tw_sock_block', kind: 'block', name: '段のくぼみ', h: 2 });
  const [bix, biz] = rim(25, 10);
  b.o('item', 4, bix, biz, { item: 'tw_block', kind: 'block', name: '積み木' });
  const [tcx, tcz] = rim(114, 10);
  b.o('chest', 4, tcx, tcz, { id: 'tw_chest_treasure', item: 'gearpin', qty: 3, needs: ['tweezers'], note: '5階・宝の部屋' });
  // ほかの宝箱
  const chests = [[0, 90, 'patch', 3], [0, 270, 'paint', 1], [1, 270, 'bigpatch', 1], [2, 135 - 20, 'oil', 1], [3, 180, 'spray', 1], [4, 340, 'bigpatch', 2]];
  for (const [l, deg, item, qty] of chests) {
    const [x, z] = rim(deg, 10);
    b.o('chest', l, x, z, { id: `tw_chest_${l}_${deg}`, item, qty });
  }
  // ボス
  b.o('boss', 5, C, C - 3, { id: 'tw_boss', species: 'tokeimori', lv: 20, flag: 'beatTokeimori', name: 'トケイモリ' });
  b.o('sign', 0, C + 2, 20, { text: '文字盤を調べると針が進み、外周の床が90°回る' });
  b.spawns.push(
    { l: 0, x0: 0, z0: 0, x1: 24, z1: 24, species: [['zenmainu', 2], ['rousokun', 2]], lv: [11, 13], n: 2 },
    { l: 1, x0: 0, z0: 0, x1: 24, z1: 24, species: [['zenmainu', 2], ['rousokun', 2], ['kamishibai', 1]], lv: [12, 14], n: 3 },
    { l: 2, x0: 0, z0: 0, x1: 24, z1: 24, species: [['kamishibai', 2], ['tsumiking', 1]], lv: [13, 15], n: 3 },
    { l: 3, x0: 0, z0: 0, x1: 24, z1: 24, species: [['tsumiking', 2], ['zenmainu', 2]], lv: [14, 16], n: 3 },
    { l: 4, x0: 0, z0: 0, x1: 24, z1: 24, species: [['tsumiking', 2], ['kamishibai', 2], ['rousokun', 1]], lv: [15, 17], n: 3 }
  );
  return b.out();
}

mkdirSync(join(ROOT, 'data', 'areas'), { recursive: true });
for (const a of [village(), tsumiki(), forest(), tower()]) {
  writeFileSync(join(ROOT, 'data', 'areas', a.id + '.json'), JSON.stringify(a));
  console.log(a.id, a.levels.map((L) => `${L.w}x${L.d}`).join(','), a.objects.length, 'objects');
}
