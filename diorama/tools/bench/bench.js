// ジオラマ魔物記 Phase 0 計測ページ
//   ?monsters=naive|merged|batched   魔物のまとめ方(既定 naive = パーツをそのままつなぐ)
//   ?terrain=inst|merged             地面のまとめ方(既定 inst = 種類ごとの InstancedMesh)
//   ?shadow=0                        影を切る
//   ?n=20                            魔物の数
// 結果は画面左上・console・window.__bench に出す。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const T0 = performance.now();
const Q = new URLSearchParams(location.search);
const MODE = Q.get('monsters') || 'naive';
const TERRAIN = Q.get('terrain') || 'inst';
const SHADOW = Q.get('shadow') !== '0';
const N = +(Q.get('n') || 20);
const CAM = Q.get('cam') || 'fit';   // fit = マップ全体 / near = 魔物の列に寄る
const STEP = 0.5;          // 高さ1段 = 0.5
const BASE = -1.0;         // 柱の底
const hud = document.getElementById('hud');

const TILE_COL = { g: '#8cc63f', p: '#d9c08a', k: '#c98b4a', B: '#a8743f', X: '#e3d27a', w: '#5a9bd4', d: '#a57b52', s: '#e6d7a3', f: '#cdb89a', c: '#6b5b4b', m: '#9a9a9a', r: '#b5545c', L: '#8a6a3a' };

// ------------------------------------------------------------ 読みこみ
const [area, monsters, gltf] = await Promise.all([
  fetch('../../data/areas/tsumiki.json').then(r => r.json()),
  fetch('../../data/monsters.json').then(r => r.json()),
  new GLTFLoader().loadAsync('../../assets/models/parts.glb'),
]);
const T_LOAD = performance.now();

// ------------------------------------------------------------ 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = SHADOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#3a332d');
const L = area.levels[0];
const W = L.w, D = L.d;
const cx = W / 2 - 0.5, cz = D / 2 - 0.5;

const camera = new THREE.PerspectiveCamera(25, innerWidth / innerHeight, 1, 500);
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  // マップ全体(最悪の場合 = 全部が画面に入る)が収まる距離
  const vfov = THREE.MathUtils.degToRad(25);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const r = Math.hypot(W, D) / 2;
  const dist = Math.max(r / Math.sin(vfov / 2), r / Math.sin(hfov / 2)) * 0.92;
  const dir = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(55)), Math.cos(THREE.MathUtils.degToRad(55)));
  if (CAM === 'near') {
    // 魔物の列(x 16〜45, z 43〜46)に寄る。遊ぶときの距離の目安
    const tx = 30.5, tz = 44.5, nd = 16 / Math.tan(hfov / 2) / 2 + 4;
    camera.position.set(tx, 0.5, tz).addScaledVector(dir, Math.max(nd, 22));
    camera.lookAt(tx, 0.5, tz);
  } else {
    camera.position.set(cx, 0, cz).addScaledVector(dir, dist);
    camera.lookAt(cx, 0, cz);
  }
  camera.far = dist * 2 + 50;
  camera.updateProjectionMatrix();
}
fitCamera();

scene.add(new THREE.HemisphereLight('#dfeaff', '#6b5a48', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.position.set(cx - 30, 45, cz - 20);   // 左上(奥)から
sun.target.position.set(cx, 0, cz);
scene.add(sun, sun.target);
if (SHADOW) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -40; s.right = 40; s.top = 40; s.bottom = -40; s.near = 1; s.far = 140;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
}

// ------------------------------------------------------------ 地面
// 角を少し丸めた箱: 上面 + 上の4辺の面取り + 4隅 + 側面(底面なし)。上面 y=0、底 y=-1。
function chamferBox(b = 0.06) {
  const h = 0.5 - b, pos = [];
  const quad = (a, b2, c, d) => pos.push(...a, ...b2, ...c, ...a, ...c, ...d);
  const tri = (a, b2, c) => pos.push(...a, ...b2, ...c);
  quad([-h, 0, -h], [-h, 0, h], [h, 0, h], [h, 0, -h]); // 上
  const yb = -b;
  // 面取りの帯(4辺)と側面
  const edges = [
    [[h, 0, h], [-h, 0, h], [-h, yb, 0.5], [h, yb, 0.5], [0, 0, 1]],
    [[-h, 0, -h], [h, 0, -h], [h, yb, -0.5], [-h, yb, -0.5], [0, 0, -1]],
    [[h, 0, -h], [h, 0, h], [0.5, yb, h], [0.5, yb, -h], [1, 0, 0]],
    [[-h, 0, h], [-h, 0, -h], [-0.5, yb, -h], [-0.5, yb, h], [-1, 0, 0]],
  ];
  for (const [a, b2, c, d] of edges) quad(a, b2, c, d);
  // 隅の三角
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = [sx * h, 0, sz * h], e1 = [sx * 0.5, yb, sz * h], e2 = [sx * h, yb, sz * 0.5];
    if (sx * sz > 0) tri(t, e1, e2); else tri(t, e2, e1);
  }
  // 側面(角は面取りぶん内側)
  const sides = [
    [[h, yb, 0.5], [-h, yb, 0.5], [-h, -1, 0.5], [h, -1, 0.5]],
    [[-h, yb, -0.5], [h, yb, -0.5], [h, -1, -0.5], [-h, -1, -0.5]],
    [[0.5, yb, -h], [0.5, yb, h], [0.5, -1, h], [0.5, -1, -h]],
    [[-0.5, yb, h], [-0.5, yb, -h], [-0.5, -1, -h], [-0.5, -1, h]],
  ];
  for (const s of sides) quad(...s);
  // 側面どうしの隙間(縦の角)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = [sx * 0.5, yb, sz * h], c = [sx * h, yb, sz * 0.5], a2 = [sx * 0.5, -1, sz * h], c2 = [sx * h, -1, sz * 0.5];
    if (sx * sz > 0) quad(c, a, a2, c2); else quad(a, c, c2, a2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const tileH = (x, z) => L.h[z * W + x];
const tileT = (x, z) => L.t[z * W + x];
const topY = (x, z) => (tileT(x, z) === 'w' ? -0.25 : tileH(x, z) * STEP);

const groundGroup = new THREE.Group();
scene.add(groundGroup);
let terrainTris = 0;
if (TERRAIN === 'inst') {
  const geo = chamferBox();
  const byType = {};
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) (byType[tileT(x, z)] ||= []).push([x, z]);
  const m4 = new THREE.Matrix4();
  for (const [t, cells] of Object.entries(byType)) {
    const mat = new THREE.MeshStandardMaterial({ color: TILE_COL[t] || '#ff00ff', roughness: 0.85 });
    const im = new THREE.InstancedMesh(geo, mat, cells.length);
    cells.forEach(([x, z], i) => {
      const y = topY(x, z);
      m4.makeScale(1, y - BASE, 1).setPosition(x, y, z);  // 上面を y に、底を BASE に
      im.setMatrixAt(i, m4);
    });
    im.castShadow = t !== 'w';
    im.receiveShadow = true;
    im.name = 'tile_' + t;
    groundGroup.add(im);
  }
  terrainTris = geo.attributes.position.count / 3 * W * D;
} else {
  // 1つにまとめ、隣に隠れる側面は作らない(面取りなし・頂点色)
  const pos = [], col = [], c = new THREE.Color();
  const push = (pts, color) => { for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...pts[i]); col.push(color.r, color.g, color.b); } };
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const y = topY(x, z); c.set(TILE_COL[tileT(x, z)] || '#ff00ff');
    const x0 = x - 0.5, x1 = x + 0.5, z0 = z - 0.5, z1 = z + 0.5;
    push([[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], c);
    const dark = c.clone().multiplyScalar(0.8);
    const nb = (nx, nz) => (nx < 0 || nz < 0 || nx >= W || nz >= D) ? BASE : topY(nx, nz);
    let ny;
    if ((ny = nb(x, z + 1)) < y) push([[x1, y, z1], [x0, y, z1], [x0, ny, z1], [x1, ny, z1]], dark);
    if ((ny = nb(x, z - 1)) < y) push([[x0, y, z0], [x1, y, z0], [x1, ny, z0], [x0, ny, z0]], dark);
    if ((ny = nb(x + 1, z)) < y) push([[x1, y, z0], [x1, y, z1], [x1, ny, z1], [x1, ny, z0]], dark);
    if ((ny = nb(x - 1, z)) < y) push([[x0, y, z1], [x0, y, z0], [x0, ny, z0], [x0, ny, z1]], dark);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  groundGroup.add(m);
  terrainTris = pos.length / 9;
}

// ジオラマの台(木の板)
{
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 1, D + 2), new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 0.7 }));
  board.position.set(cx, BASE - 0.5, cz);
  board.receiveShadow = true;
  scene.add(board);
}

// ------------------------------------------------------------ 上に乗る物(種類ごとに InstancedMesh)
function coloredMerge(parts) {
  // parts: [[geometry, color]] → 頂点色つきの1ジオメトリ
  const gs = parts.map(([g, color]) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  });
  return mergeGeometries(gs);
}
const PROP_GEO = {
  tree: () => coloredMerge([[new THREE.CylinderGeometry(0.1, 0.14, 0.6, 8).translate(0, 0.3, 0), '#7a5634'], [new THREE.ConeGeometry(0.45, 1.1, 10).translate(0, 1.1, 0), '#3f8a3a']]),
  chest: () => coloredMerge([[new THREE.BoxGeometry(0.6, 0.4, 0.45).translate(0, 0.2, 0), '#b5652a'], [new THREE.BoxGeometry(0.64, 0.08, 0.49).translate(0, 0.42, 0), '#e0b23a']]),
  handle: () => coloredMerge([[new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).translate(0, 0.3, 0), '#666'], [new THREE.TorusGeometry(0.22, 0.05, 6, 16).rotateX(Math.PI / 2).translate(0, 0.62, 0), '#d33a24']]),
  post: () => coloredMerge([[new THREE.CylinderGeometry(0.15, 0.15, 0.8, 10).translate(0, 0.4, 0), '#c9a227']]),
  sign: () => coloredMerge([[new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(0, 0.3, 0), '#7a5634'], [new THREE.BoxGeometry(0.6, 0.35, 0.05).translate(0, 0.65, 0), '#f4f1ea']]),
  item: () => coloredMerge([[new THREE.OctahedronGeometry(0.2).translate(0, 0.35, 0), '#5bbf9a']]),
  socket: () => coloredMerge([[new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12).translate(0, 0.05, 0), '#888']]),
  exit: () => coloredMerge([[new THREE.TorusGeometry(0.4, 0.06, 6, 20, Math.PI).translate(0, 0, 0), '#f4f1ea']]),
  goal: () => coloredMerge([[new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6).translate(0, 0.6, 0), '#eee'], [new THREE.BoxGeometry(0.4, 0.25, 0.02).translate(0.2, 1.05, 0), '#d33a24']]),
};
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
let propTris = 0;
{
  const byType = {};
  for (const o of area.objects) (byType[o.type] ||= []).push(o);
  const m4 = new THREE.Matrix4();
  for (const [t, list] of Object.entries(byType)) {
    const geo = (PROP_GEO[t] || PROP_GEO.post)();
    const im = new THREE.InstancedMesh(geo, propMat, list.length);
    list.forEach((o, i) => { m4.makeTranslation(o.x, topY(o.x, o.z), o.z); im.setMatrixAt(i, m4); });
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
    propTris += geo.attributes.position.count / 3 * list.length;
  }
}

// ------------------------------------------------------------ 魔物
const lib = {};
for (const o of gltf.scene.children) lib[o.name] = o;  // 複数マテリアルのパーツは Group(子 Mesh が _1, _2 …)
// GLTFLoader は名前の "." を消す(socket_back.004 → socket_back004)。前方一致で探す
const findSocket = (body, kind) => body.children.find(c => c.name.startsWith('socket_' + kind));

const matColor = (sp, role) => role === 'body' ? sp.color : role === 'accent' ? sp.accent : '#0b0b10';
const ROUGH = { body: 0.35, accent: 0.45, eye: 0.05 };

function assemble(sp) {
  // ソケットでつないだ Object3D(マテリアルは種ごとに3つ)を返す
  const root = new THREE.Group();
  const body = lib['body_' + sp.body].clone(false);
  body.position.copy(lib['body_' + sp.body].position);
  root.add(body);
  const mats = {};
  for (const role of ['body', 'accent', 'eye']) mats[role] = new THREE.MeshStandardMaterial({ color: matColor(sp, role), roughness: ROUGH[role], metalness: 0 });
  const paint = m => { m.material = Array.isArray(m.material) ? m.material.map(x => mats[x.name]) : mats[m.material.name]; };
  const addMesh = (src, parent) => {
    // GLTFLoader は複数プリミティブのメッシュを Group + 子 Mesh にする
    const c = src.clone(true);
    c.traverse(o => { if (o.isMesh) { paint(o); o.castShadow = true; o.receiveShadow = true; } });
    return c;
  };
  // 胴そのもの(Group の場合は子メッシュ。ソケットは除く)
  for (const ch of lib['body_' + sp.body].children) if (!ch.name.startsWith('socket_')) body.add(addMesh(ch));
  if (lib['body_' + sp.body].isMesh) { body.geometry = lib['body_' + sp.body].geometry; paint(body); body.castShadow = true; }
  for (const kind of ['head', 'back', 'tail']) {
    const s = findSocket(lib['body_' + sp.body], kind);
    const part = lib[kind + '_' + sp.id];
    if (!s || !part) { console.warn('missing', kind, sp.id, !!s, !!part); continue; }
    const sock = new THREE.Object3D(); sock.position.copy(s.position); sock.quaternion.copy(s.quaternion);
    body.add(sock);
    const p = addMesh(part); p.position.set(0, 0, 0); p.quaternion.identity();
    sock.add(p);
  }
  return root;
}

// 1体を頂点色つきの1ジオメトリに焼く
function bake(sp) {
  const obj = assemble(sp);
  obj.updateMatrixWorld(true);
  const parts = [];
  obj.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : null;
    const g0 = o.geometry;
    const groups = mats ? g0.groups : [{ start: 0, count: g0.index ? g0.index.count : g0.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats ? mats[gr.materialIndex] : o.material;
      let g = g0.clone(); g.clearGroups();
      if (g.index) { g.setIndex(Array.from(g.index.array.slice(gr.start, gr.start + gr.count))); g = g.toNonIndexed(); }
      g.applyMatrix4(o.matrixWorld);
      parts.push([g, m.color.clone()]);
    }
  });
  const merged = coloredMerge(parts.map(([g, c]) => [g, c.getHex()]));
  return merged;
}

const spList = monsters.species;
const perSpecies = [];
const monsterGroup = new THREE.Group();
scene.add(monsterGroup);
// 南の草地(z=44〜46)に並べる
const spots = [];
for (let z = 43; z <= 46 && spots.length < N; z++) for (let x = 16; x <= 44 && spots.length < N; x += 2) if (tileT(x, z) === 'g') spots.push([x + (z % 2), z]);
for (let z = 26; spots.length < N; z++) for (let x = 2; x < 24 && spots.length < N; x += 2) if (tileT(x, z) === 'g') spots.push([x, z]);

const monMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 });
let batched = null, multiDraw = null;
if (MODE === 'batched') {
  const geos = []; for (let i = 0; i < N; i++) geos.push(bake(spList[i % spList.length]));
  const nv = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  batched = new THREE.BatchedMesh(N, nv, nv * 2, monMat);
  batched.castShadow = batched.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  geos.forEach((g, i) => {
    const id = batched.addGeometry(g);
    const [x, z] = spots[i];
    m4.compose(new THREE.Vector3(x, topY(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4), new THREE.Vector3(0.9, 0.9, 0.9));
    batched.setMatrixAt(id, m4);
  });
  monsterGroup.add(batched);
}
for (let i = 0; i < N; i++) {
  const sp = spList[i % spList.length];
  const [x, z] = spots[i];
  let obj = null;
  if (MODE === 'naive') obj = assemble(sp);
  else if (MODE === 'merged') { obj = new THREE.Mesh(bake(sp), monMat); obj.castShadow = obj.receiveShadow = true; }
  if (obj) {
    obj.position.set(x, topY(x, z), z); obj.rotation.y = 0.4; obj.scale.setScalar(0.9);
    monsterGroup.add(obj);
  }
  // 1体ぶんの三角形と描画単位(プリミティブ)を数える
  const a = assemble(sp); let tris = 0, prims = 0;
  a.traverse(o => { if (o.isMesh) { const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n; prims += Array.isArray(o.material) ? g.groups.length : 1; } });
  perSpecies.push({ id: sp.id, body: sp.body, tris, prims });
}

// ------------------------------------------------------------ 計測
const T_BUILD = performance.now();
renderer.render(scene, camera);           // 1回目(シェーダーのコンパイル込み)
const gl = renderer.getContext();
gl.finish();
const T_FIRST = performance.now();

function measure() {
  // 注意: r160 の WebGLRenderer は shadowMap.render() のあとで info.reset() する。
  // そのため autoReset のままでは影の描画が renderer.info に入らない。
  // 合計(影こみ)は autoReset を止めて自分で reset してから測る。
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  const total = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  renderer.info.autoReset = true;
  renderer.render(scene, camera);
  const main = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  return { total, main, shadow: { calls: total.calls - main.calls, tris: total.tris - main.tris } };
}
const r = measure();

// 読みこんだファイルの合計
const res = performance.getEntriesByType('resource');
const nav = performance.getEntriesByType('navigation')[0];
const files = res.map(e => ({ name: e.name.replace(location.origin, ''), bytes: e.encodedBodySize || e.transferSize || 0 }));
if (nav) files.push({ name: location.pathname, bytes: nav.encodedBodySize || nav.transferSize || 0 });
const bytes = files.reduce((a, f) => a + f.bytes, 0);

const avgTris = perSpecies.reduce((a, s) => a + s.tris, 0) / perSpecies.length;
const out = {
  mode: MODE, terrain: TERRAIN, shadow: SHADOW, n: N,
  viewport: [innerWidth, innerHeight], dpr: renderer.getPixelRatio(),
  calls: r.total.calls, tris: r.total.tris,
  mainCalls: r.main.calls, mainTris: r.main.tris, shadowCalls: r.shadow.calls, shadowTris: r.shadow.tris,
  geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length,
  terrainTris, propTris, monsterTrisAvg: Math.round(avgTris), monsterTrisMax: Math.max(...perSpecies.map(s => s.tris)),
  monsterTrisSum: perSpecies.reduce((a, s) => a + s.tris, 0), monsterPrimsSum: perSpecies.reduce((a, s) => a + s.prims, 0),
  perSpecies, bytes, files,
  ms: { load: Math.round(T_LOAD - T0), build: Math.round(T_BUILD - T_LOAD), firstRender: Math.round(T_FIRST - T_BUILD), init: Math.round(T_FIRST - T0), sinceNav: Math.round(T_FIRST) },
  multiDraw: !!renderer.extensions.get('WEBGL_multi_draw'),
  gpu: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })(),
};
window.__bench = out;
console.log('BENCH', JSON.stringify(out));

const k = n => (n / 1000).toFixed(1) + 'k';
const ok = (v, lim) => (v <= lim ? '○' : '×');
hud.textContent =
`Phase0 計測  魔物=${MODE}  地面=${TERRAIN}  影=${SHADOW ? 'あり' : 'なし'}
${innerWidth}×${innerHeight} @${out.dpr}x
三角形  合計 ${k(out.tris)} ${ok(out.tris, 150000)} (本 ${k(out.mainTris)} / 影 ${k(out.shadowTris)})
描画    合計 ${out.calls} ${ok(out.calls, 150)} (本 ${out.mainCalls} / 影 ${out.shadowCalls})
魔物    ${N}体 平均 ${out.monsterTrisAvg} △ 最大 ${out.monsterTrisMax}
読みこみ ${(bytes / 1048576).toFixed(2)}MB ${ok(bytes, 15 * 1048576)}  ${files.length}件
時間    読込 ${out.ms.load}ms 組立 ${out.ms.build}ms 初描画 ${out.ms.firstRender}ms
        初期化 計 ${out.ms.init}ms`;

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fitCamera(); renderer.render(scene, camera); });
renderer.setAnimationLoop(() => renderer.render(scene, camera));
