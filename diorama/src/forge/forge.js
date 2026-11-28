// 魔物の工房(実行時): parts.glb のパーツを組み立て、1体を1つの形状に焼き、ソフビの質感で塗る。
//
//   import { createForge } from './forge/forge.js';
//   const forge = await createForge({ url: 'assets/models/parts.glb', monsters });   // monsters = data/monsters.json
//   const geo = forge.build({ species: 'nejiko', shiny: false, osagari: { back: 'perari' } });
//   const mat = forge.material();                          // A+ 案(docs/ART_BIBLE.md §1-1)。全員で1つ
//   scene.add(new THREE.Mesh(geo, mat));                     // 1体 = 1描画
//   const batch = forge.batch(mat, { max: 24 });             // フィールド: 全員で1描画
//   const id = batch.add(geo, matrix4);  batch.move(id, matrix4);  batch.remove(id);
//
// くわしい関数の形は docs/INTERFACES.md の「forge」の節。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const SLOTS = { body: 0, accent: 1, eye: 2, glow: 3 };
export const MAT_IDS = { water: 0, fire: 1, paper: 2, stone: 3, tin: 4, cloth: 5 };
export const PART_KINDS = { body: 0, head: 1, back: 2, tail: 3 };
export const PLACES = ['head', 'back', 'tail'];
export const TRI_LIMIT = 4000;
// ぬし・ボスは少し大きく置く(形はそのまま。置く側が scale に使う)
export const SPECIES_SCALE = { kageboushi: 1.35, tokeimori: 1.6 };

const EYE_BASE = '#0d1424';

// art-director の判定(docs/ART_REVIEW.md 第1回)で変えた色。data/monsters.json(game-designer の持ち場)に
// 移したら、ここから消す。ここにある値が monsters.json より優先される
export const COLOR_FIX = {
  koroishi: { accent: '#d9893a', shiny: '#7fb0c8' },          // こけ → 橙の地衣(草に溶けない)/ きらりは明るさだけでなく色相も
  watabou: { shiny: '#f2b6c6' },                                // 紫は影の予約色 → 桜色
  matchbo: { color: '#efe3c8', accent: '#c8462c' },             // 肌色 → 白木のマッチ軸
  jarihebi: { color: '#a89c86', accent: '#9a5a3c' },            // 灰の連なり → 黄土 + 赤さびの玉砂利
  felton: { color: '#e0806a', accent: '#3a6ea5', shiny: '#8fc7d8' }, // 草に溶ける緑 → 珊瑚色 + 藍の糸
  rousokun: { color: '#c8462c', accent: '#f2d27a', shiny: '#5f9fd8' }, // 白いロウ → 朱の和ろうそく + 金の絵付け
  tsumiking: { color: '#d8cbb0', accent: '#d9a32a' },           // チーズに見える黄 → 石の積み木の生成り + 金の冠
  haribote: { shiny: '#a9cde8' },                               // 生成り→白は見分けられない → 空色
  hibachineko: { color: '#b8764a', accent: '#3a3330' },         // 黒猫+橙 → 素焼きの土色 + 墨
  nuihebi: { color: '#e8dcc4', accent: '#c8462c' },             // 紫+黄 → 生成りの木綿 + 赤いギンガム
  kageboushi: { accent: '#6a4fa8' },                            // マントの裏地 すみれ
};
// 光る部品(glow スロット)の色。炎は外が橙・内が黄の2段(シェーダー)
export const GLOW_COLOR = { default: '#ff6a1a', hotarubin: '#f2e36a', hibachineko: '#ff4a1a' };
// 部品の模様(aMat.w に 2×模様 を足す): 1 ギンガム / 2 紙芝居の絵 / 3 和ろうそくの絵付けの花
export const PART_PATTERN = {
  head_nuihebi: { accent: 1 }, back_nuihebi: { accent: 1 }, tail_nuihebi: { accent: 1 },
  head_kamishibai: { body: 2 },
  head_rousokun: { body: 3 },
};

// ------------------------------------------------------------------ 読みこみ
export async function loadParts(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return partsFromScene(gltf.scene);
}

// gltf.scene → { parts: {name: [{geo, slot}]}, sockets: {型: {head, back, tail: Vector3}} }
export function partsFromScene(scene) {
  scene.updateMatrixWorld(true);
  const parts = {}, sockets = {};
  for (const node of scene.children) {
    const pieces = [];
    const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
    node.traverse((o) => {
      if (o.isMesh) {
        const slot = SLOTS[o.material.name];
        if (slot === undefined) throw new Error(`forge: ${node.name} のマテリアル ${o.material.name} は規格外`);
        // パーツの原点 = つなぎ目。ノードの位置は 0 のはずだが、念のため node からの相対で焼く
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).premultiply(node.matrix);
        const g = o.geometry.clone().applyMatrix4(m);
        pieces.push({ geo: g, slot });
      } else if (o.name.startsWith('socket_')) {
        // GLTFLoader は名前の「.」を消す。socket_head_maru / socket_head004 のどちらでも前方一致で拾う
        const kind = PLACES.find((k) => o.name.startsWith('socket_' + k));
        const type = node.name.replace(/^body_/, '');
        if (kind) (sockets[type] ||= {})[kind] = o.getWorldPosition(new THREE.Vector3());
      }
    });
    if (pieces.length) parts[node.name] = pieces;
  }
  return { parts, sockets };
}

// ------------------------------------------------------------------ 色
const _c = new THREE.Color(), _hsl = {};
const col = (sp, k) => (COLOR_FIX[sp.id] && COLOR_FIX[sp.id][k]) || sp[k];
function shinyAccent(sp) {
  // きらりの差し色: 生まれつきの差し色を、色相を回して少し明るく
  _c.set(col(sp, 'accent')).getHSL(_hsl);
  return new THREE.Color().setHSL((_hsl.h + 0.42) % 1, Math.min(1, _hsl.s * 1.1 + 0.1), Math.min(0.75, _hsl.l + 0.08));
}
export function palette(sp, shiny = false) {
  return {
    body: new THREE.Color(shiny ? col(sp, 'shiny') : col(sp, 'color')),
    accent: shiny ? shinyAccent(sp) : new THREE.Color(col(sp, 'accent')),
    eye: new THREE.Color(EYE_BASE),
    glow: new THREE.Color(GLOW_COLOR[sp.id] || GLOW_COLOR.default),
  };
}

// osagari の指定を正規化: 'tsumiking' または { from:'tsumiking', star:1..3, shinyFrom:'種id' }
function normOsagari(v) {
  if (!v) return null;
  if (typeof v === 'string') return { from: v, star: 1, shinyFrom: null };
  return { from: v.from || v.species || v.id, star: Math.max(1, Math.min(3, v.star || 1)), shinyFrom: v.shinyFrom || null };
}

// ------------------------------------------------------------------ 焼く
// spec = { species, shiny?, osagari?: {head|back|tail: 種id | {from, star, shinyFrom}} }
// 返り値: 1つの BufferGeometry(index つき)。属性:
//   position / normal / color(素材の色。linear)
//   aMat  vec4 (スロット 0体/1差し色/2目/3光る, 素材 MAT_IDS, なじみ★ 0..3, きらり 0/1 + 2×模様)
//   aPart vec4 (パーツの原点からの位置 xyz, 場所 PART_KINDS)
export function buildMonster(lib, speciesById, spec) {
  const sp = speciesById[spec.species];
  if (!sp) throw new Error('forge: 種がない ' + spec.species);
  const matId = MAT_IDS[sp.mat];
  const own = palette(sp, !!spec.shiny);
  const sock = lib.sockets[sp.body];
  if (!sock) throw new Error('forge: 胴のソケットがない ' + sp.body);
  const list = [];   // [{pieces, offset, kind, colors, star, shiny}]
  list.push({ name: 'body_' + sp.body, offset: new THREE.Vector3(), kind: 0, colors: own, star: 0, shiny: !!spec.shiny });
  const used = { head: sp.id, back: sp.id, tail: sp.id };
  for (const place of PLACES) {
    const o = normOsagari(spec.osagari?.[place]);
    let colors = own, star = 0, shiny = !!spec.shiny, from = sp.id;
    if (o && speciesById[o.from]) {
      from = o.from;
      star = o.star;
      if (o.shinyFrom && speciesById[o.shinyFrom]) { colors = palette(speciesById[o.shinyFrom], true); shiny = true; }
      // それ以外は子の色(own)で塗り直す。炎・光(glow)だけは元の種の色のまま
      colors = { ...colors, glow: palette(speciesById[from]).glow };
    }
    used[place] = from;
    list.push({ name: `${place}_${from}`, offset: sock[place], kind: PART_KINDS[place], colors, star, shiny, pattern: PART_PATTERN[`${place}_${from}`] });
  }
  // 数える
  let nv = 0, ni = 0;
  for (const it of list) {
    const pieces = lib.parts[it.name];
    if (!pieces) throw new Error('forge: パーツがない ' + it.name);
    it.pieces = pieces;
    for (const p of pieces) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const amat = new Float32Array(nv * 4), apart = new Float32Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v0 = 0, i0 = 0;
  const slotName = ['body', 'accent', 'eye', 'glow'];
  for (const it of list) {
    for (const p of it.pieces) {
      const P = p.geo.attributes.position, N = p.geo.attributes.normal, n = P.count;
      const c = it.colors[slotName[p.slot]];
      const pat = (it.pattern && it.pattern[slotName[p.slot]]) || 0;
      for (let i = 0; i < n; i++) {
        const k = (v0 + i) * 3, q = (v0 + i) * 4;
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        pos[k] = x + it.offset.x; pos[k + 1] = y + it.offset.y; pos[k + 2] = z + it.offset.z;
        nor[k] = N.getX(i); nor[k + 1] = N.getY(i); nor[k + 2] = N.getZ(i);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
        amat[q] = p.slot; amat[q + 1] = matId; amat[q + 2] = p.slot >= 2 ? 0 : it.star; amat[q + 3] = (it.shiny ? 1 : 0) + 2 * pat;
        apart[q] = x; apart[q + 1] = y; apart[q + 2] = z; apart[q + 3] = it.kind;
      }
      if (p.geo.index) { const I = p.geo.index.array; for (let j = 0; j < I.length; j++) idx[i0 + j] = I[j] + v0; i0 += I.length; }
      else { for (let j = 0; j < n; j++) idx[i0 + j] = v0 + j; i0 += n; }
      v0 += n;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(amat, 4));
  g.setAttribute('aPart', new THREE.BufferAttribute(apart, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.userData = {
    species: sp.id, shiny: !!spec.shiny, parts: used, triangles: ni / 3,
    height: g.boundingBox.max.y, scale: SPECIES_SCALE[sp.id] || 1,
  };
  if (ni / 3 > TRI_LIMIT) console.warn(`forge: ${sp.id} は ${ni / 3}△ で規格(${TRI_LIMIT})を超えている`);
  return g;
}

// ------------------------------------------------------------------ 質感(1つのマテリアルを全員で共有 = BatchedMesh で1描画)
// A+ 案(docs/ART_BIBLE.md §1-1): A案のつや・透け・水色の目 + B案の素材の表面の強さ・ふちのドライブラシ
export const STYLE = { rough: 0.38, coat: 0.6, coatRough: 0.3, sss: 0.35, surf: 0.9, accentSat: 1.15, edge: 0.2, tinMetal: 0.45, sheen: 0.6, cavity: 0.35, iris: '#5fe0ff' };
// 素材ごとの上書き(ART_BIBLE §1-1 の表): [coat の倍率, rough]。並びは MAT_IDS(水・火・紙・石・ブリキ・布)
export const MAT_FINISH = { water: [1.2, 0.15], fire: [1.1, 0.3], paper: [0.5, 0.55], stone: [0.6, 0.55], tin: [1.0, 0.3], cloth: [0.5, 0.6] };

const GLSL_NOISE = /* glsl */`
float dioH31(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 dioH33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float dioNoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dioH31(i), dioH31(i + vec3(1,0,0)), f.x), mix(dioH31(i + vec3(0,1,0)), dioH31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dioH31(i + vec3(0,0,1)), dioH31(i + vec3(1,0,1)), f.x), mix(dioH31(i + vec3(0,1,1)), dioH31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dioFbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * dioNoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
// F1, F2(セルの距離)
vec2 dioVoronoi(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + dioH33(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
vec3 dioBump(vec3 surf_pos, vec3 surf_norm, float h, float fd){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 r1 = cross(sy, surf_norm), r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * fd;
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surf_norm - grad);
}
vec3 dioSat(vec3 c, float s){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return max(vec3(0.0), mix(vec3(l), c, s)); }
`;

const FRAG_SURFACE = /* glsl */`
  // ---- 魔物の表面(forge.js)
  int dSlot = int(vMat.x + 0.5);
  int dMid = int(vMat.y + 0.5);
  float dStar = vMat.z;
  float dShiny = mod(vMat.w, 2.0);
  int dPat = int(floor(vMat.w * 0.5 + 0.25));
  vec3 dP = vObj;
  vec3 dN = normalize(vObjN);
  vec3 dW = abs(dN); dW /= (dW.x + dW.y + dW.z);
  if (dSlot == 1) diffuseColor.rgb = dioSat(diffuseColor.rgb, uAccentSat);
  if (dSlot < 2) {
    float s = uSurf;
    vec2 fin = uFinish[dMid];
    dCoat = uCoat * fin.x;
    dRough = fin.y;
    // 部品の模様
    if (dPat == 1) {          // ギンガム(赤と生成りの格子)
      vec3 q = vPart.xyz * 26.0;
      float gx = step(0.5, fract(q.x + 0.25)), gy = step(0.5, fract(q.z + 0.25)), gz = step(0.5, fract(q.y + 0.25));
      float g = (gx * dW.y + gx * dW.z + gz * dW.x) * 0.5 + (gy * dW.x + gy * dW.y + gz * dW.z) * 0.5;
      diffuseColor.rgb = mix(vec3(0.93, 0.89, 0.8), diffuseColor.rgb, 0.35 + 0.65 * g);
    } else if (dPat == 2 && dN.z > 0.5) {   // 紙芝居の絵: 山と太陽(差し色の版画ふう)。three の座標で +Z が正面・+Y が上
      vec2 u = vPart.xy;
      float mount = step(u.y, 0.16 + 0.12 * (1.0 - abs(fract(u.x * 2.2 + 0.3) * 2.0 - 1.0)));
      float sun = 1.0 - step(0.06, length(u - vec2(0.18, 0.44)));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPatInk * 0.9, 0.55 * max(mount, sun));
    } else if (dPat == 3 && dN.z > 0.3) {   // 和ろうそくの絵付けの花(正面の下)
      vec2 u = vec2(vPart.x, vPart.y - 0.12);
      float r = length(u), a = atan(u.y, u.x);
      float petal = 1.0 - step(0.075 + 0.04 * cos(5.0 * a), r);
      float core = 1.0 - step(0.03, r);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.82, 0.48), petal);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.45, 0.3), core);
    }
    if (dMid == 2) {            // 紙: 繊維 + ざら紙の粒 + 折り目(面の切りかえ。法線は normal_fragment で平らに)
      float f1 = dioNoise(dP * vec3(9.0, 140.0, 9.0) + 3.1);
      float f2 = dioNoise(dP * vec3(140.0, 11.0, 13.0));
      float f3 = dioNoise(dP * vec3(12.0, 13.0, 140.0) + 7.0);
      float fib = max(max(f1 * dW.x + f1 * dW.z, f2 * dW.y + f2 * dW.z), f3 * dW.x + f3 * dW.y);
      fib = smoothstep(0.55, 0.95, fib);
      float grain = dioNoise(dP * 220.0);
      diffuseColor.rgb *= 1.0 + s * (0.12 * fib - 0.07 * grain);
      dH = s * (0.0014 * fib + 0.0007 * grain);
      dFacet = 1.0;
    } else if (dMid == 3) {     // 石: ざらつき + 粒(黒と白のごま)
      float g = dioFbm(dP * 16.0);
      float sp = dioNoise(dP * 70.0);
      diffuseColor.rgb *= 1.0 + s * (0.22 * (g - 0.5));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, s * 0.45 * smoothstep(0.8, 0.88, sp));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), s * 0.3 * smoothstep(0.1, 0.04, sp));
      dH = s * (0.006 * g - 0.002 * smoothstep(0.8, 0.88, sp));
    } else if (dMid == 4) {     // ブリキ: 金づちの打ち出し(浅いくぼみ)+ 面ごとの照り
      vec2 v = dioVoronoi(dP * 12.0);
      float dimple = 1.0 - smoothstep(0.0, 0.62, v.x);
      dH = -s * 0.0035 * dimple * dimple;
      diffuseColor.rgb *= 1.0 + s * 0.06 * (dioH31(floor(dP * 12.0)) - 0.5);
      dMetal = uTinMetal;
    } else if (dMid == 5) {     // 布: 織り目 + 縫い目(中心線のミシン目)+ けば
      vec3 q = dP * 260.0;
      float wx = sin(q.y) * sin(q.z), wy = sin(q.x) * sin(q.z), wz = sin(q.x) * sin(q.y);
      float weave = wx * dW.x + wy * dW.y + wz * dW.z;
      float fuzz = dioNoise(dP * 120.0);
      float seam = (1.0 - smoothstep(0.005, 0.01, abs(vPart.x))) * step(0.5, fract((vPart.y + vPart.z) * 30.0));
      float seamGroove = 1.0 - smoothstep(0.0, 0.018, abs(vPart.x));
      diffuseColor.rgb *= 1.0 + s * (0.06 * weave - 0.09 * fuzz);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.92, 0.85), 0.85 * seam);
      dH = s * (0.0006 * weave + 0.0005 * fuzz) - 0.003 * seamGroove;
      dSheen = uSheen;
    } else if (dMid == 1) {     // ロウ: とろみ(下へ垂れる筋)+ よく透ける
      float drip = dioNoise(vec3(dP.x * 18.0, dP.y * 2.5, dP.z * 18.0));
      float drip2 = dioNoise(vec3(dP.x * 40.0, dP.y * 5.0 + 3.0, dP.z * 40.0));
      diffuseColor.rgb *= 1.0 + s * (0.14 * drip - 0.05 + 0.06 * drip2);
      dH = s * 0.003 * smoothstep(0.3, 0.8, drip);
      dSSS = max(dSSS, 0.5);
    } else {                    // 水(インク・ガラス): にじみ(濃いしみと、ふちの濃い輪)+ ぬれたつや + よく透ける
      float b = dioFbm(dP * 5.0 + vec3(0.0, dP.x * 2.0, 0.0));
      float m = smoothstep(0.48, 0.56, b);
      float ring = smoothstep(0.03, 0.0, abs(b - 0.52));
      vec3 deep = diffuseColor.rgb * vec3(0.45, 0.5, 0.75);
      diffuseColor.rgb = mix(diffuseColor.rgb, deep, s * 0.5 * m);
      diffuseColor.rgb = mix(diffuseColor.rgb, deep * 0.6, s * 0.45 * ring);
      dH = s * 0.0008 * ring;
      dSSS = 0.6;
    }
    // くぼみの暗がり(縫い目・打ち出し・石の穴)
    diffuseColor.rgb *= 1.0 - uCavity * clamp(-dH * 180.0, 0.0, 0.6);
    // なじみ★2: 銀の線(ふちとつぎ目) / ★3: 金つぎ(ひびに金がしみて光る)
    if (dStar >= 2.0 && vPart.w > 0.5) {
      float seamR = length(vPart.xyz);
      float seamLine = 1.0 - smoothstep(0.0, 0.014, abs(seamR - 0.11));
      if (dStar >= 3.0) {
        vec2 v = dioVoronoi(vPart.xyz * 7.0 + 0.37);
        float crack = 1.0 - smoothstep(0.0, 0.075, v.y - v.x);
        float k = max(crack, seamLine);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.72, 0.22), k);
        dMetal = mix(dMetal, 1.0, k); dRough = mix(dRough, 0.18, k);
        dEmit += vec3(1.0, 0.62, 0.18) * 0.85 * k;
        dH -= 0.002 * crack;
        dFacet *= 1.0 - k;
      } else {
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.92), seamLine);
        dMetal = mix(dMetal, 1.0, seamLine); dRough = mix(dRough, 0.2, seamLine);
        dSilverRim = 1.0;
      }
    }
  } else if (dSlot == 2) {
    // 目: 全種共通のガラス玉
    dRough = 0.04; dCoat = 1.0; dCoatRough = 0.05; dSSS = 0.0; dMetal = 0.0;
    float f = dot(dN, vec3(0.0, 0.0, 1.0));          // 正面(+Z)を向く所がひとみ
    float iris = smoothstep(0.55, 0.7, f) * (1.0 - smoothstep(0.86, 0.9, f));
    float pupil = smoothstep(0.88, 0.92, f);
    diffuseColor.rgb = mix(diffuseColor.rgb, uIris * 0.6, iris);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.005), pupil);
    dEmit += uIris * (0.9 * iris + 0.12 * (1.0 - pupil) * smoothstep(0.2, 0.6, f));
    dEye = 1.0;
  } else {
    // 光る部品(炎・ホタルの光・炭): 外の色 → 内の明るい黄 の2段。視線に向いた所が内側
    dGlow = 1.0; dRough = 0.5; dCoat = 0.0; dSSS = 0.0;
  }
  if (dShiny > 0.5 && dSlot < 2) dShinyAmt = 1.0;
`;

export function createMonsterMaterial(over = {}) {
  if (typeof over === 'string') over = {};   // 古い呼び方 createMonsterMaterial('A') も A+ にする
  const S = { ...STYLE, ...over };
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: S.rough, metalness: 0,
    clearcoat: 1, clearcoatRoughness: S.coatRough, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 1, 1),
  });
  mat.name = 'monster_Aplus';
  const fin = Object.keys(MAT_IDS).sort((x, y) => MAT_IDS[x] - MAT_IDS[y]).map((k) => new THREE.Vector2(...MAT_FINISH[k]));
  const uniforms = {
    uSurf: { value: S.surf }, uAccentSat: { value: S.accentSat }, uTinMetal: { value: S.tinMetal },
    uSSS: { value: S.sss }, uCoat: { value: S.coat }, uCoatRough: { value: S.coatRough }, uRough: { value: S.rough },
    uEdge: { value: S.edge }, uSheen: { value: S.sheen }, uCavity: { value: S.cavity },
    uFinish: { value: fin },
    uIris: { value: new THREE.Color(S.iris) },
    uPatInk: { value: new THREE.Color('#8a3b2c') },
    uTime: { value: 0 },
  };
  mat.userData.uniforms = uniforms;
  mat.userData.style = 'A+';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aMat; attribute vec4 aPart;
varying vec4 vMat; varying vec4 vPart; varying vec3 vObj; varying vec3 vObjN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vMat = aMat; vPart = aPart; vObj = position; vObjN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMat; varying vec4 vPart; varying vec3 vObj; varying vec3 vObjN;
uniform float uSurf, uAccentSat, uTinMetal, uSSS, uCoat, uCoatRough, uRough, uEdge, uSheen, uCavity, uTime;
uniform vec2 uFinish[6];
uniform vec3 uIris, uPatInk;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float dH = 0.0, dRough = uRough, dMetal = 0.0, dSSS = uSSS, dCoat = uCoat, dCoatRough = uCoatRough, dSheen = 0.0;
float dSilverRim = 0.0, dEye = 0.0, dShinyAmt = 0.0, dFacet = 0.0, dGlow = 0.0;
vec3 dEmit = vec3(0.0);
${FRAG_SURFACE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = dRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = dMetal;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (dFacet > 0.5) {
  // 紙の折り目: 三角形ごとの平らな法線(なめらかな曲面にしない)
  vec3 fn = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));
  if (dot(fn, normal) < 0.0) fn = -fn;
  normal = normalize(mix(normal, fn, 0.85));
}
if (dH != 0.0) normal = dioBump(-vViewPosition, normal, dH, faceDirection);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 V = normalize(vViewPosition);
  float ndv = saturate(dot(normal, V));
  if (dGlow > 0.5) {
    float core = smoothstep(0.72, 0.98, ndv);
    vec3 outer = diffuseColor.rgb, inner = mix(vec3(1.0, 0.78, 0.18), diffuseColor.rgb, 0.2);
    vec3 fc = mix(outer, inner, core);
    diffuseColor.rgb = fc * 0.3;
    totalEmissiveRadiance += fc * (0.7 + 0.4 * core);
  } else {
    // ソフビの「少し透ける」: ふちほど光が中を回って明るく、色が濃くなる
    float rim = pow(1.0 - ndv, 2.2);
    totalEmissiveRadiance += diffuseColor.rgb * dSSS * (0.35 * rim + 0.12);
    // 塗装のドライブラシ(上を向いたふちを少し明るく)
    if (dEye < 0.5) totalEmissiveRadiance += diffuseColor.rgb * uEdge * 0.35 * smoothstep(0.55, 0.95, 1.0 - ndv) * smoothstep(-0.2, 0.6, normal.y);
  }
  if (dSilverRim > 0.5) totalEmissiveRadiance += vec3(0.75, 0.8, 0.9) * 0.6 * smoothstep(0.82, 0.92, 1.0 - ndv);
  if (dShinyAmt > 0.5) {
    vec3 hue = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + (1.0 - ndv) * 1.2 + vObj.y * 0.6));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.6 + 0.8 * hue), 0.35);
    vec3 cell = floor(vObj * 70.0);
    float r = dioH31(cell);
    vec3 dir = normalize(dioH33(cell + 1.3) - 0.5);
    float tw = pow(saturate(dot(normalize(normal + dir * 0.7), V)), 30.0);
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * step(0.96, r) * tw * 1.2;
  }
  if (dEye > 0.5) {
    // ガラス玉のハイライトは全種で同じ向き(画面の左上)+ 右下に小さな青い照り返し
    float h1 = smoothstep(0.955, 0.985, dot(normal, normalize(vec3(-0.5, 0.62, 0.6))));
    float h2 = smoothstep(0.975, 0.99, dot(normal, normalize(vec3(0.5, -0.45, 0.74))));
    totalEmissiveRadiance += vec3(1.0) * 2.2 * h1 + vec3(0.45, 0.7, 1.0) * 0.9 * h2;
  }
  totalEmissiveRadiance += dEmit;
}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat = saturate(dCoat);
  material.clearcoatRoughness = clamp(dCoatRough + geometryRoughness, 0.0525, 1.0);
#endif
#ifdef USE_SHEEN
  material.sheenColor = vec3(dSheen) * mix(vec3(1.0), diffuseColor.rgb, 0.5);
#endif`);
  };
  mat.customProgramCacheKey = () => 'dio-monster-aplus-v2';
  return mat;
}

// ------------------------------------------------------------------ まとめて描く(フィールド)
// r160 の BatchedMesh は 1形状 = 1体(同じ種を2体置くときは、形状を2回入れる)
export function createMonsterBatch(material, { max = 24, vertsPer = 5200, indicesPer = 12000 } = {}) {
  const mesh = new THREE.BatchedMesh(max, max * vertsPer, max * indicesPer, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'monsters';
  return {
    mesh,
    add(geo, matrix) { const id = mesh.addGeometry(geo); if (matrix) mesh.setMatrixAt(id, matrix); return id; },
    move(id, matrix) { mesh.setMatrixAt(id, matrix); },
    show(id, v) { mesh.setVisibleAt(id, v); },
    remove(id) { mesh.deleteGeometry(id); },
  };
}

// ------------------------------------------------------------------ まとめた入口
export async function createForge({ url, monsters, gltfScene } = {}) {
  const lib = gltfScene ? partsFromScene(gltfScene) : await loadParts(url);
  const speciesById = {};
  for (const s of monsters.species) speciesById[s.id] = s;
  const mats = {};
  return {
    lib, speciesById,
    build: (spec) => buildMonster(lib, speciesById, spec),
    material: () => (mats.main ||= createMonsterMaterial()),
    batch: (material, opts) => createMonsterBatch(material, opts),
    // パーツの三角形数(規格チェック・図鑑用)
    triangles(name) { return (lib.parts[name] || []).reduce((a, p) => a + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0); },
  };
}
