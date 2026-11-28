// 魔物の撮影台: 8方向の一覧、20種の並び、64px のシルエット一覧(+ 同じ型どうしの IoU)、
// フィールドのカメラでの並び、直す前と後の比較を 1枚の画像にする。
// 光と色の設定はゲームと同じ src/render/renderer.js(画質「低」= 後処理なしで直接描く)。
// node tools/forge_shots/shoot.cjs が window.__shots を呼んで PNG に書き出す。
import * as THREE from 'three';
import { createRenderer, LIGHT_DIR } from '../../src/render/renderer.js';
import { createForge } from '../../src/forge/forge.js';

const PAPER = '#f4f1ea', INK = '#1a1714', RED = '#c8462c';
const FONT = '"Noto Sans CJK JP", "Noto Sans JP", sans-serif';
const NUM = '"Barlow Condensed", "Noto Sans CJK JP", sans-serif';

const monsters = await (await fetch('../../data/monsters.json')).json();
const forge = await createForge({ url: '../../assets/models/parts.glb', monsters });
const SP = forge.speciesById;
const MAT = forge.material();

// 直す前(第1回の判定に出した版)。shoot.cjs が /before/ に古い parts.glb と forge.js を出す
let before = null;
async function loadBefore() {
  if (before) return before;
  const mod = await import('/before/forge.js');
  const f = await mod.createForge({ url: '/before/parts.glb', monsters });
  before = { forge: f, mat: f.material('A') };
  return before;
}

const gl = document.createElement('canvas');
const R = createRenderer(gl);
R.setQuality('low');
R.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
R.sun.shadow.mapSize.set(2048, 2048);
const sc = R.sun.shadow.camera;
function shadowBox(h) { sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.near = 0.5; sc.far = 40; sc.updateProjectionMatrix(); }
shadowBox(1.6);
R.sun.shadow.bias = -0.0004; R.sun.shadow.normalBias = 0.01;
R.scene.fog = null;

const camera = new THREE.PerspectiveCamera(25, 1, 0.05, 200);
// 台(丸い対戦台の小さい版): 木の台の上に生成りの紙
const stand = new THREE.Group();
const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 48), new THREE.MeshStandardMaterial({ color: '#e9e2d2', roughness: 0.9 }));
top.position.y = -0.025; top.receiveShadow = true;
const side = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#8a6440', roughness: 0.7 }));
side.position.y = -0.11; side.receiveShadow = true;
stand.add(top, side);
R.scene.add(stand);
const holder = new THREE.Group();
R.scene.add(holder);
const black = new THREE.MeshBasicMaterial({ color: '#000' });

function setSize(w, h) { R.renderer.setPixelRatio(1); R.renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function lights(target) {
  R.sun.target.position.copy(target);
  R.sun.position.copy(target).addScaledVector(LIGHT_DIR, 16);
  const f = camera.position.clone().sub(target).normalize();
  R.fill.position.set(f.x + f.z * 0.5, f.y * 0.7, f.z - f.x * 0.5);
}

// 1体を撮る → gl キャンバスに描く
function shoot(geo, material, { yaw = 0, elev = 20, size = 220, silhouette = false, standOn = true } = {}) {
  setSize(size, size);
  holder.clear();
  const mesh = new THREE.Mesh(geo, silhouette ? black : material);
  mesh.castShadow = mesh.receiveShadow = !silhouette;
  mesh.rotation.y = THREE.MathUtils.degToRad(yaw);
  holder.add(mesh);
  stand.visible = standOn && !silhouette;
  R.scene.background = new THREE.Color(silhouette ? '#ffffff' : PAPER);
  R.hemi.visible = R.sun.visible = R.fill.visible = !silhouette;
  const bs = geo.boundingSphere;
  const target = new THREE.Vector3(0, bs.center.y * 0.92, 0);
  const r = Math.max(bs.radius, 0.62) * (silhouette ? 0.95 : 1.12);
  const d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const e = THREE.MathUtils.degToRad(elev);
  camera.position.set(0, target.y + Math.sin(e) * d, Math.cos(e) * d);
  camera.lookAt(target);
  shadowBox(1.6);
  lights(target);
  R.renderer.render(R.scene, camera);
  return gl;
}

function sheetCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
  return [c, g];
}
function header(g, w, title, sub) {
  g.fillStyle = INK; g.fillRect(0, 0, w, 6);
  g.font = `900 30px ${FONT}`; g.fillText(title, 24, 46);
  g.font = `700 16px ${FONT}`; g.fillStyle = '#4a443c'; g.fillText(sub, 24, 72);
  g.fillStyle = INK; g.fillRect(24, 84, w - 48, 2);
}
function box(g, x, y, w, h) { g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); }
function wrap(g, text, x, y, maxW, lh) {
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y); y += lh; line = ch; } else line += ch;
    }
    if (line) { g.fillText(line, x, y); y += lh; }
  }
  return y;
}

const DIRS = ['正面', '右前', '右', '右後', '後ろ', '左後', '左', '左前'];

// 8方向 × 行(通常 / きらり / おさがり …)
function turntable({ species, rows, cell = 200, title }) {
  const LW = 230, top = 120;
  const W = LW + cell * 8 + 24, H = top + rows.length * (cell + 8) + 40;
  const [c, g] = sheetCanvas(W, H);
  const sp = SP[species];
  header(g, W, title || `A+案  No.${String(sp.no).padStart(2, '0')} ${sp.name}`, `素材 ${monsters.materials[sp.mat].name} / 型 ${monsters.bodies[sp.body]}  ·  8方向(45°ずつ)  ·  光と色はゲームと同じ renderer.js`);
  g.font = `700 14px ${FONT}`; g.fillStyle = INK;
  DIRS.forEach((d, i) => g.fillText(d, LW + i * cell + 8, top - 10));
  const tris = [];
  rows.forEach((row, ri) => {
    const geo = forge.build({ species, ...row.spec });
    tris.push(geo.userData.triangles);
    const y = top + ri * (cell + 8);
    g.fillStyle = INK; g.font = `900 18px ${FONT}`; g.fillText(row.label, 16, y + 34);
    g.font = `600 13px ${FONT}`; g.fillStyle = '#4a443c';
    wrap(g, row.note || '', 16, y + 58, LW - 24, 18);
    g.font = `700 15px ${NUM}`; g.fillText(`${geo.userData.triangles}△`, 16, y + cell - 14);
    for (let i = 0; i < 8; i++) {
      shoot(geo, MAT, { yaw: -i * 45, size: cell });
      g.drawImage(gl, LW + i * cell, y);
      box(g, LW + i * cell, y, cell, cell);
    }
    geo.dispose();
  });
  return { url: c.toDataURL('image/png'), tris };
}

// 20種の並び(通常ときらり)
function lineup({ cell = 180, cols = 5 }) {
  const list = monsters.species;
  const top = 110, lab = 30;
  const rowsN = Math.ceil(list.length / cols);
  const W = cols * cell * 2 + 48, H = top + rowsN * (cell + lab) + 30;
  const [c, g] = sheetCanvas(W, H);
  header(g, W, 'A+案  20種の並び', '左 = 通常 / 右 = きらり(色違い)  ·  右前 35° から  ·  docs/ART_BIBLE.md §1-1 の値');
  const tris = {};
  list.forEach((sp, i) => {
    const x = 24 + (i % cols) * cell * 2, y = top + Math.floor(i / cols) * (cell + lab);
    for (const shiny of [false, true]) {
      const geo = forge.build({ species: sp.id, shiny });
      if (!shiny) tris[sp.id] = geo.userData.triangles;
      shoot(geo, MAT, { yaw: -35, size: cell });
      g.drawImage(gl, x + (shiny ? cell : 0), y);
      box(g, x + (shiny ? cell : 0), y, cell, cell);
      geo.dispose();
    }
    g.fillStyle = INK; g.font = `900 16px ${FONT}`;
    g.fillText(`${String(sp.no).padStart(2, '0')} ${sp.name}`, x + 4, y + cell + 20);
    g.font = `600 14px ${NUM}`; g.fillStyle = '#4a443c';
    g.fillText(`${tris[sp.id]}△`, x + cell * 2 - 60, y + cell + 20);
  });
  return { url: c.toDataURL('image/png'), tris };
}

// ---------------------------------------------------------------- 64px シルエットと IoU
const VIEWS = [['正面ななめ(右前 35°)', -35, 14], ['真横(右)', -90, 8], ['フィールド(見下ろし 52°)', -35, 52]];
const _mc = document.createElement('canvas'); _mc.width = _mc.height = 64;
const _mg = _mc.getContext('2d', { willReadFrequently: true });
function mask(geo, yaw, elev) {
  shoot(geo, MAT, { yaw, size: 64, silhouette: true, standOn: false, elev });
  _mg.drawImage(gl, 0, 0);
  const d = _mg.getImageData(0, 0, 64, 64).data, m = new Uint8Array(64 * 64);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0;
  return m;
}
function iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k]; } return u ? i / u : 0; }

function silhouettes({ cell = 64, cols = 10 }) {
  const list = monsters.species;
  const top = 100, lab = 22, gap = 12;
  const rowsN = Math.ceil(list.length / cols);
  const block = rowsN * (cell + lab + gap) + 26;
  const masks = {};
  for (const sp of list) { const geo = forge.build({ species: sp.id }); masks[sp.id] = VIEWS.map(([, y, e]) => mask(geo, y, e)); geo.dispose(); }
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (list[i].body !== list[j].body) continue;
    const v = VIEWS.map((_, k) => iou(masks[list[i].id][k], masks[list[j].id][k]));
    pairs.push({ a: list[i].id, b: list[j].id, an: list[i].name, bn: list[j].name, body: list[i].body, iou: v, max: Math.max(...v) });
  }
  const tableH = 70 + pairs.length * 20;
  const W = Math.max(24 * 2 + cols * (cell + gap), 820), H = top + block * 4 + tableH + 30;
  const [c, g] = sheetCanvas(W, H);
  header(g, W, '64px シルエット一覧(20種)+ 同じ型どうしの IoU', '1〜3段: シルエット(正面ななめ・真横・見下ろし 52°) / 4段: 色つき / 表: IoU > 0.75 は赤');
  const drawSet = (oy, title, yaw, elev, sil) => {
    g.fillStyle = INK; g.font = `900 14px ${FONT}`; g.fillText(title, 24, oy + 14);
    list.forEach((sp, i) => {
      const x = 24 + (i % cols) * (cell + gap), y = oy + 22 + Math.floor(i / cols) * (cell + lab + gap);
      const geo = forge.build({ species: sp.id });
      shoot(geo, MAT, { yaw, size: cell, silhouette: sil, standOn: false, elev });
      g.drawImage(gl, x, y);
      g.strokeStyle = '#b9b2a4'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      g.fillStyle = INK; g.font = `700 11px ${FONT}`; g.fillText(sp.name, x, y + cell + 14);
      geo.dispose();
    });
  };
  VIEWS.forEach(([t, yaw, e], k) => drawSet(top + block * k, t, yaw, e, true));
  drawSet(top + block * 3, '色つき(正面ななめ)', -35, 14, false);
  let y = top + block * 4 + 10;
  g.fillStyle = INK; g.font = `900 16px ${FONT}`; g.fillText('同じ型どうしの IoU(シルエットの重なり。1 = 同じ形)', 24, y + 14);
  g.font = `700 13px ${FONT}`; y += 40;
  g.fillText('型', 24, y); g.fillText('組', 100, y); ['正面ななめ', '真横', '見下ろし'].forEach((t, k) => g.fillText(t, 340 + k * 120, y)); g.fillText('判定', 720, y);
  y += 6;
  for (const p of pairs.sort((x, z) => z.max - x.max)) {
    y += 20;
    const bad = p.max > 0.75;
    g.fillStyle = bad ? RED : INK;
    g.font = `700 13px ${FONT}`; g.fillText(monsters.bodies[p.body], 24, y); g.fillText(`${p.an} / ${p.bn}`, 100, y);
    g.font = `700 14px ${NUM}`; p.iou.forEach((v, k) => g.fillText(v.toFixed(2), 340 + k * 120, y));
    g.font = `900 13px ${FONT}`; g.fillText(bad ? '× 0.75 超え' : '○', 720, y);
  }
  return { url: c.toDataURL('image/png'), pairs };
}

// ---------------------------------------------------------------- フィールドのカメラ(ART_REVIEW の付録と同じ)
function ground(kind) {
  const g = new THREE.Group();
  const bx = new THREE.BoxGeometry(0.98, 0.5, 0.98);
  const cols = kind === 'clay' ? ['#b8875a', '#a47a50'] : ['#7c9f4b', '#d9c294', '#9c9a92'];
  const mats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  for (let z = -6; z <= 6; z++) for (let x = -7; x <= 7; x++) {
    let t;
    if (kind === 'clay') t = (x + z) & 1;
    else t = ((x * 7 + z * 13) % 11 === 0) ? 1 : ((x * 5 + z * 3) % 17 === 0 ? 2 : 0);
    const m = new THREE.Mesh(bx, mats[t]);
    m.position.set(x, -0.25, z); m.receiveShadow = true;
    g.add(m);
  }
  return g;
}
async function field({ kind = 'grass', w = 780, h = 900, which = 'after' } = {}) {
  const f = which === 'before' ? await loadBefore() : { forge, mat: MAT };
  setSize(w, h);
  holder.clear(); stand.visible = false;
  R.scene.background = new THREE.Color(PAPER);
  R.hemi.visible = R.sun.visible = R.fill.visible = true;
  const gr = ground(kind);
  R.scene.add(gr);
  monsters.species.forEach((sp, i) => {
    const geo = f.forge.build({ species: sp.id });
    const m = new THREE.Mesh(geo, f.mat);
    m.castShadow = m.receiveShadow = true;
    m.position.set(-4 + (i % 5) * 2, 0, -3 + Math.floor(i / 5) * 2);
    m.rotation.y = -0.6;
    m.scale.setScalar(geo.userData.scale || 1);
    holder.add(m);
  });
  const target = new THREE.Vector3(0, 0, 0.3);
  const e = THREE.MathUtils.degToRad(52);
  const halfW = 6.2, d = halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  camera.position.set(0, Math.sin(e) * d, target.z + Math.cos(e) * d);
  camera.lookAt(target);
  shadowBox(9);
  lights(target);
  R.renderer.render(R.scene, camera);
  R.scene.remove(gr);
  const [c, g] = sheetCanvas(w, h + 60);
  g.drawImage(gl, 0, 60);
  g.fillStyle = INK; g.fillRect(0, 0, w, 4);
  g.font = `900 18px ${FONT}`; g.fillText(`フィールドのカメラ(見下ろし 52°)  ${which === 'before' ? '直す前(A案)' : 'A+案'}  ·  ${kind === 'clay' ? '粘土' : '草+石畳'}`, 16, 34);
  g.font = `600 11px ${FONT}`; g.fillStyle = '#4a443c';
  g.fillText('奥から 1列目: ' + monsters.species.map((s) => s.name).join(' · '), 16, 54);
  holder.clear();
  return { url: c.toDataURL('image/png') };
}

// ---------------------------------------------------------------- 直す前と後
async function compare({ rows, cell = 150, title }) {
  await loadBefore();
  const LW = 270, top = 130;
  const W = LW + cell * 6 + 40, H = top + rows.length * (cell + 10) + 30;
  const [c, g] = sheetCanvas(W, H);
  header(g, W, title || '直す前(第1回の A案)→ 直した後(A+案)', '左3枚 = 直す前 / 右3枚 = 直した後  ·  各3枚は 正面ななめ・真横・見下ろし 52°');
  g.font = `900 15px ${FONT}`; g.fillStyle = INK;
  g.fillText('直す前', LW + 8, top - 12); g.fillText('直した後', LW + cell * 3 + 24, top - 12);
  const views = [[-35, 20], [-90, 12], [-35, 52]];
  rows.forEach((row, ri) => {
    const y = top + ri * (cell + 10);
    const sp = SP[row.species];
    g.fillStyle = INK; g.font = `900 17px ${FONT}`;
    g.fillText(`${String(sp.no).padStart(2, '0')} ${sp.name}${row.shiny ? '(きらり)' : ''}`, 14, y + 22);
    g.font = `600 12px ${FONT}`; g.fillStyle = '#4a443c';
    wrap(g, row.note || '', 14, y + 42, LW - 24, 16);
    const gb = before.forge.build({ species: row.species, shiny: !!row.shiny });
    const ga = forge.build({ species: row.species, shiny: !!row.shiny });
    views.forEach(([yaw, elev], k) => {
      shoot(gb, before.mat, { yaw, elev, size: cell }); g.drawImage(gl, LW + k * cell, y); box(g, LW + k * cell, y, cell, cell);
      shoot(ga, MAT, { yaw, elev, size: cell }); g.drawImage(gl, LW + cell * 3 + 16 + k * cell, y); box(g, LW + cell * 3 + 16 + k * cell, y, cell, cell);
    });
    g.fillStyle = RED; g.fillRect(LW + cell * 3 + 3, y + cell / 2 - 10, 10, 20);
    gb.dispose(); ga.dispose();
  });
  return { url: c.toDataURL('image/png') };
}

// 規格の数字(組み立て後の三角形数・最悪の組み合わせ)
function triTable() {
  const out = {};
  const t = (n) => forge.triangles(n);
  const maxOf = (kind) => Math.max(...monsters.species.map((s) => t(`${kind}_${s.id}`)));
  for (const s of monsters.species) out[s.id] = forge.build({ species: s.id }).userData.triangles;
  const worst = {};
  for (const b of Object.keys(monsters.bodies)) worst[b] = t('body_' + b) + maxOf('head') + maxOf('back') + maxOf('tail');
  return { perSpecies: out, worstCombo: worst, partCount: Object.keys(forge.lib.parts).length };
}

window.__shots = { turntable, lineup, silhouettes, field, compare, loadBefore, triTable, ready: true };
