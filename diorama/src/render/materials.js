// 共有の素材とテクスチャ。すべての地形・建物・小物が、同じ「塗りムラ」テクスチャ1枚を使う。
//
// paint(opts): MeshStandardMaterial に、次の手作り模型らしさを足す
//   - 世界座標で引く塗りムラ(大きなムラ + 細かい刷毛目)。インスタンスごとに同じ模様にならない
//   - cut:true のとき、頂点属性 aCut(世界のY)より上を切り抜き、裏面を「断面」(生成りに黒インクの斜線)で塗る
//     → 壁や木を切ったとき、中身の詰まった模型の断面に見える。影(customDepthMaterial)も同じ高さで切れる
import * as THREE from 'three';

let _noise = null;
export function noiseTexture() {
  if (_noise) return _noise;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  // タイルできる値ノイズ(R: 大きなムラ, G: 細かい刷毛目, B: 点々)
  const rnd = mulberry(7);
  const grid = (n) => { const a = []; for (let i = 0; i < n * n; i++) a.push(rnd()); return a; };
  const g8 = grid(8), g32 = grid(32);
  const sample = (gr, n, x, y) => {
    const fx = (x / N) * n, fy = (y / N) * n;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (i, j) => gr[((j % n + n) % n) * n + ((i % n + n) % n)];
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const r = sample(g8, 8, x, y) * 0.7 + sample(g32, 32, x, y) * 0.3;
    // 刷毛目: 横に流れる細い筋
    const streak = sample(g32, 32, x * 0.25, y * 4) * 0.6 + rnd() * 0.4;
    img.data[i] = r * 255;
    img.data[i + 1] = streak * 255;
    img.data[i + 2] = rnd() < 0.04 ? 255 : rnd() * 90;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _noise = new THREE.CanvasTexture(c);
  _noise.wrapS = _noise.wrapT = THREE.RepeatWrapping;
  _noise.colorSpace = THREE.NoColorSpace;
  return _noise;
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERT_HEAD = /* glsl */`
varying vec3 vWPos;
uniform sampler2D tPaint;
#ifdef DIO_CUT
attribute float aCut;
varying float vCut;
#endif
`;
const VERT_BODY = /* glsl */`
{
  vec4 dioW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    dioW = instanceMatrix * dioW;
  #endif
  dioW = modelMatrix * dioW;
  vWPos = dioW.xyz;
  #ifdef DIO_CUT
    vCut = aCut;
  #endif
}
`;
const FRAG_HEAD = /* glsl */`
varying vec3 vWPos;
uniform sampler2D tPaint;
uniform float uPaintAmt;
uniform vec3 uSection;
#ifdef DIO_CUT
varying float vCut;
#endif
`;
const FRAG_CUT = /* glsl */`
#ifdef DIO_CUT
  if (vWPos.y > vCut) discard;
#endif
`;
const FRAG_PAINT = /* glsl */`
{
  vec2 pu = vWPos.xz + vec2(vWPos.y * 0.71, -vWPos.y * 0.53);
  vec4 n1 = texture2D(tPaint, pu * 0.11);
  vec4 n2 = texture2D(tPaint, pu * 0.9 + 0.37);
  float m = (n1.r - 0.5) * 0.9 + (n2.g - 0.5) * 0.55 + (n2.b > 0.99 ? -0.25 : 0.0);
  diffuseColor.rgb *= 1.0 + m * uPaintAmt;
}
`;
const FRAG_SECTION = /* glsl */`
#ifdef DIO_CUT
if (!gl_FrontFacing) {
  // 断面: 生成りに、黒インクの斜線(説明書の断面図のハッチング)
  float hz = mod(gl_FragCoord.x + gl_FragCoord.y, 9.0);
  float ink = step(hz, 1.6);
  gl_FragColor = vec4(mix(uSection, vec3(0.03, 0.025, 0.02), ink * 0.85), 1.0);
}
#endif
`;

function patch(shader, opts) {
  shader.uniforms.tPaint = { value: noiseTexture() };
  shader.uniforms.uPaintAmt = { value: opts.paintAmt ?? 0.35 };
  shader.uniforms.uSection = { value: new THREE.Color(opts.section ?? '#efe3c8') };
  shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
  let fs = FRAG_HEAD + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_CUT);
  if (fs.includes('#include <map_fragment>') && !opts.depth) fs = fs.replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_PAINT);
  if (fs.includes('#include <opaque_fragment>')) fs = fs.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + FRAG_SECTION);
  shader.fragmentShader = fs;
}

// 塗装した木・紙・粘土の素材
export function paint(opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0,
    vertexColors: !!opts.vertexColors,
    map: opts.map ?? null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.cut ? THREE.DoubleSide : (opts.side ?? THREE.FrontSide),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  if (opts.cut) m.defines = { DIO_CUT: '' };
  m.onBeforeCompile = (s) => patch(s, opts);
  m.customProgramCacheKey = () => 'paint' + (opts.cut ? 'C' : '') + (opts.section || '') + (opts.paintAmt ?? '');
  m.userData.paintOpts = opts;
  return m;
}

// 切り抜きに合わせて影も切る深度素材
export function cutDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.defines = { DIO_CUT: '' };
  m.onBeforeCompile = (s) => patch(s, { depth: true });
  m.customProgramCacheKey = () => 'cutDepth';
  return m;
}

// 頂点色つきの箱・円柱などを1つのジオメトリにまとめる道具
export function colored(geo, color, mat4) {
  const g = geo.index ? geo : geo;
  if (mat4) g.applyMatrix4(mat4);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

export function m4(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
  return m;
}

// 角を少し落とした箱(上面だけ面取り。底面なし)。原点は底面の中心、高さ1・幅1。22三角形
export function chamferTile(bevel = 0.08, inset = 0.0, sides = true) {
  const h = 0.5 - inset, b = bevel;
  const pos = [], nor = [], uv = [];
  const quad = (a, bb, c, d, n) => {
    for (const p of [a, bb, c, a, c, d]) { pos.push(...p); nor.push(...n); uv.push((p[0] + 0.5), (p[2] + 0.5)); }
  };
  const tri = (a, bb, c, n) => { for (const p of [a, bb, c]) { pos.push(...p); nor.push(...n); uv.push(p[0] + 0.5, p[2] + 0.5); } };
  const T = 1, S = 1 - b; // 上面の高さ / 面取りの下端
  const i = h - b;
  const s2 = Math.SQRT1_2;
  // 上面と面取り4辺
  quad([-i, T, -i], [-i, T, i], [i, T, i], [i, T, -i], [0, 1, 0]);
  quad([-i, T, i], [-i, S, h], [i, S, h], [i, T, i], [0, s2, s2]); // 手前(+z)
  quad([i, T, -i], [i, S, -h], [-i, S, -h], [-i, T, -i], [0, s2, -s2]); // 奥(-z)
  quad([i, T, i], [h, S, i], [h, S, -i], [i, T, -i], [s2, s2, 0]); // 右(+x)
  quad([-i, T, -i], [-h, S, -i], [-h, S, i], [-i, T, i], [-s2, s2, 0]); // 左(-x)
  // 角の三角
  const c3 = 0.577;
  tri([i, T, i], [i, S, h], [h, S, i], [c3, c3, c3]);
  tri([i, T, -i], [h, S, -i], [i, S, -h], [c3, c3, -c3]);
  tri([-i, T, -i], [-i, S, -h], [-h, S, -i], [-c3, c3, -c3]);
  tri([-i, T, i], [-h, S, i], [-i, S, h], [-c3, c3, c3]);
  // 側面(角も面取りで斜めに落ちたまま下まで)。sides=false のときは上面と面取りだけ(14三角形)
  const side = (a, bb, n) => quad([a[0], S, a[1]], [a[0], 0, a[1]], [bb[0], 0, bb[1]], [bb[0], S, bb[1]], n);
  if (sides) {
  side([-i, h], [i, h], [0, 0, 1]);
  side([i, -h], [-i, -h], [0, 0, -1]);
  side([h, i], [h, -i], [1, 0, 0]);
  side([-h, -i], [-h, i], [-1, 0, 0]);
  side([i, h], [h, i], [s2, 0, s2]);
  side([h, -i], [i, -h], [s2, 0, -s2]);
  side([-i, -h], [-h, -i], [-s2, 0, -s2]);
  side([-h, i], [-i, h], [-s2, 0, s2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// 面取りした箱(底面つき、閉じている = 断面が出る)。原点は底面の中心
export function chamferBox(bevel = 0.06) {
  const g = chamferTile(bevel);
  // 底面を足す
  const pos = Array.from(g.attributes.position.array), nor = Array.from(g.attributes.normal.array), uv = Array.from(g.attributes.uv.array);
  const h = 0.5;
  const i = h - bevel;
  const poly = [[-i, -h], [i, -h], [h, -i], [h, i], [i, h], [-i, h], [-h, i], [-h, -i]];
  for (let k = 1; k < poly.length - 1; k++) {
    for (const p of [poly[0], poly[k], poly[k + 1]]) { pos.push(p[0], 0, p[1]); nor.push(0, -1, 0); uv.push(p[0] + .5, p[1] + .5); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// キャンバスに描くテクスチャ(作業台まわり)
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
