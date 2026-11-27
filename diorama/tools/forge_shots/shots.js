// 魔物の撮影台: 8方向の一覧、20種の並び、64px のシルエット一覧を 1枚の画像にする。
// 光と色の設定はゲームと同じ src/render/renderer.js(画質「低」= 後処理なしで直接描く)。
// node tools/forge_shots/shoot.cjs が window.__shots を呼んで PNG に書き出す。
import * as THREE from 'three';
import { createRenderer, LIGHT_DIR } from '../../src/render/renderer.js';
import { createForge } from '../../src/forge/forge.js';

const PAPER = '#f4f1ea', INK = '#1a1714';
const FONT = '"Noto Sans CJK JP", "Noto Sans JP", sans-serif';
const NUM = '"Barlow Condensed", "Noto Sans CJK JP", sans-serif';

const monsters = await (await fetch('../../data/monsters.json')).json();
const forge = await createForge({ url: '../../assets/models/parts.glb', monsters });
const SP = forge.speciesById;

const gl = document.createElement('canvas');
const R = createRenderer(gl);
R.setQuality('low');
R.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
R.sun.shadow.mapSize.set(2048, 2048);
const sc = R.sun.shadow.camera;
sc.left = -1.6; sc.right = 1.6; sc.top = 1.6; sc.bottom = -1.6; sc.near = 0.5; sc.far = 20; sc.updateProjectionMatrix();
R.sun.shadow.bias = -0.0004; R.sun.shadow.normalBias = 0.01;
R.scene.fog = null;

const camera = new THREE.PerspectiveCamera(25, 1, 0.05, 100);
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

// 1体を撮る → gl キャンバスに描く
function shoot(geo, material, { yaw = 0, elev = 20, size = 220, silhouette = false, standOn = true, zoom = 1 } = {}) {
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
  const r = Math.max(bs.radius, 0.62) * (silhouette ? 0.95 : 1.12) / zoom;
  const d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const e = THREE.MathUtils.degToRad(elev);
  camera.position.set(0, target.y + Math.sin(e) * d, Math.cos(e) * d);
  camera.lookAt(target);
  R.sun.target.position.copy(target);
  R.sun.position.copy(target).addScaledVector(LIGHT_DIR, 8);
  const f = camera.position.clone().sub(target).normalize();
  R.fill.position.set(f.x + f.z * 0.5, f.y * 0.7, f.z - f.x * 0.5);
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

const DIRS = ['正面', '右前', '右', '右後', '後ろ', '左後', '左', '左前'];

// 8方向 × 行(通常 / きらり / おさがり …)
function turntable({ style, species, rows, cell = 200, title }) {
  const mat = forge.material(style);
  const LW = 230, top = 120;
  const W = LW + cell * 8 + 24, H = top + rows.length * (cell + 8) + 40;
  const [c, g] = sheetCanvas(W, H);
  const sp = SP[species];
  header(g, W, title || `${style}案  No.${String(sp.no).padStart(2, '0')} ${sp.name}`, `素材 ${monsters.materials[sp.mat].name} / 型 ${monsters.bodies[sp.body]}  ·  8方向(45°ずつ)  ·  光と色はゲームと同じ renderer.js`);
  g.font = `700 14px ${FONT}`; g.fillStyle = INK;
  DIRS.forEach((d, i) => g.fillText(d, LW + i * cell + 8, top - 10));
  const tris = [];
  rows.forEach((row, ri) => {
    const geo = forge.build({ species, ...row.spec });
    tris.push(geo.userData.triangles);
    const y = top + ri * (cell + 8);
    g.fillStyle = INK; g.font = `900 18px ${FONT}`; g.fillText(row.label, 16, y + 34);
    g.font = `600 13px ${FONT}`; g.fillStyle = '#4a443c';
    (row.note || '').split('\n').forEach((t, k) => g.fillText(t, 16, y + 58 + k * 18));
    g.font = `700 15px ${NUM}`; g.fillText(`${geo.userData.triangles}△`, 16, y + cell - 14);
    for (let i = 0; i < 8; i++) {
      shoot(geo, mat, { yaw: -i * 45, size: cell });
      g.drawImage(gl, LW + i * cell, y);
      box(g, LW + i * cell, y, cell, cell);
    }
    geo.dispose();
  });
  return { url: c.toDataURL('image/png'), tris };
}

// 20種の並び(通常ときらり)
function lineup({ style, cell = 180, cols = 5 }) {
  const mat = forge.material(style);
  const list = monsters.species;
  const top = 110, lab = 30;
  const rowsN = Math.ceil(list.length / cols);
  const W = cols * cell * 2 + 48, H = top + rowsN * (cell + lab) + 30;
  const [c, g] = sheetCanvas(W, H);
  header(g, W, `${style}案  20種の並び`, '左 = 通常 / 右 = きらり(色違い)  ·  右前 45° から');
  const tris = {};
  list.forEach((sp, i) => {
    const x = 24 + (i % cols) * cell * 2, y = top + Math.floor(i / cols) * (cell + lab);
    for (const shiny of [false, true]) {
      const geo = forge.build({ species: sp.id, shiny });
      if (!shiny) tris[sp.id] = geo.userData.triangles;
      shoot(geo, mat, { yaw: -35, size: cell });
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

// 64px のシルエット(黒)と、同じ大きさの色つき
function silhouettes({ style = 'A', cell = 64, cols = 10 }) {
  const mat = forge.material(style);
  const list = monsters.species;
  const top = 100, lab = 22, gap = 12;
  const rowsN = Math.ceil(list.length / cols);
  const block = rowsN * (cell + lab + gap);
  const W = 24 * 2 + cols * (cell + gap), H = top + block * 3 + 40;
  const [c, g] = sheetCanvas(W, H);
  header(g, W, '64px シルエット一覧(20種)', '上: 正面ななめ(右前 35°) / 中: 横(右) / 下: 色つき 64px');
  const drawSet = (oy, yaw, sil) => list.forEach((sp, i) => {
    const x = 24 + (i % cols) * (cell + gap), y = oy + Math.floor(i / cols) * (cell + lab + gap);
    const geo = forge.build({ species: sp.id });
    // シルエットは種の大きさをそろえず、ゲームと同じ倍率(ぬしは大きい)で比べる…と小さくなりすぎるので、枠いっぱいにする
    shoot(geo, mat, { yaw, size: cell, silhouette: sil, standOn: false, elev: 14 });
    g.drawImage(gl, x, y);
    g.strokeStyle = '#b9b2a4'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    g.fillStyle = INK; g.font = `700 11px ${FONT}`; g.fillText(sp.name, x, y + cell + 14);
    geo.dispose();
  });
  drawSet(top, -35, true);
  drawSet(top + block, -90, true);
  drawSet(top + block * 2, -35, false);
  return { url: c.toDataURL('image/png') };
}

// 規格の数字(組み立て後の三角形数・最悪の組み合わせ)
function triTable() {
  const out = {};
  const parts = forge.lib.parts;
  const t = (n) => forge.triangles(n);
  const maxOf = (kind) => Math.max(...monsters.species.map((s) => t(`${kind}_${s.id}`)));
  for (const s of monsters.species) out[s.id] = forge.build({ species: s.id }).userData.triangles;
  const worst = {};
  for (const b of Object.keys(monsters.bodies)) worst[b] = t('body_' + b) + maxOf('head') + maxOf('back') + maxOf('tail');
  return { perSpecies: out, worstCombo: worst, partCount: Object.keys(parts).length };
}

window.__shots = { turntable, lineup, silhouettes, triTable, ready: true };
