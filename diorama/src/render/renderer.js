// レンダラー・シーン・光・画質。
//
//   const R = createRenderer(canvas);
//   R.setQuality('mid');                 // 'low' | 'mid' | 'high'
//   R.render(camera, { focusY });        // 毎フレーム
//   R.stats()                            // renderer.info の数字(影の描画も含めた1フレーム分)
//   await R.autoQuality()                // 最初の数秒の fps で画質を決める
//
// 画質
//   低: 影1枚(固い PCF, 1024)・ぼかしなし・ピクセル比1・後処理なし(直接画面へ)
//   中: やわらかい影(PCFSoft, 2048)・ティルトシフト・MSAA4・ピクセル比 ≤1.5
//   高: 中 + SSAO 近似(深度8点)・ピクセル比 ≤2
import * as THREE from 'three';
import { createTiltShift } from './tiltshift.js';

export const QUALITY = {
  low: { pr: 1, shadowType: THREE.PCFShadowMap, shadowSize: 1024, post: false, ao: false, label: '低' },
  mid: { pr: 1.5, shadowType: THREE.PCFSoftShadowMap, shadowSize: 2048, post: true, ao: false, label: '中' },
  high: { pr: 2, shadowType: THREE.PCFSoftShadowMap, shadowSize: 2048, post: true, ao: true, label: '高' },
};

// 光の向き: 左上の奥(卓上ランプのある方)から
export const LIGHT_DIR = new THREE.Vector3(-0.62, 1.0, -0.42).normalize();

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a211c');
  scene.fog = new THREE.Fog('#3a2e26', 120, 330);

  // 空の色の環境光(上: 窓から入る空の青、下: 机の木の照り返し)
  const hemi = new THREE.HemisphereLight('#d6e6ff', '#8a6648', 1.15);
  scene.add(hemi);
  // 主光: 左上からのやわらかい光(ランプの暖色)
  const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
  sun.castShadow = true;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
  scene.add(sun, sun.target);
  // 手前右からの、青みのある弱い補助光(影なし)。カメラ側を向いた壁が沈みすぎないように
  const fill = new THREE.DirectionalLight('#c4d8ff', 0.55);
  fill.position.set(0.5, 0.7, 0.9);
  scene.add(fill);

  const post = createTiltShift(renderer);
  let q = 'mid';
  let cssW = 1, cssH = 1;

  function pixelRatio() { return Math.min(window.devicePixelRatio || 1, QUALITY[q].pr); }

  function resize(w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight) {
    cssW = w; cssH = h;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    post.setSize(w, h, pixelRatio());
  }

  function setQuality(name) {
    if (!QUALITY[name]) return;
    q = name;
    const Q = QUALITY[name];
    if (renderer.shadowMap.type !== Q.shadowType) {
      renderer.shadowMap.type = Q.shadowType;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    }
    if (sun.shadow.mapSize.x !== Q.shadowSize) {
      sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    resize(cssW, cssH);
  }

  // 影の範囲を注視点のまわりに合わせる(ちらつかないよう影のテクセル単位にそろえる)
  const _t = new THREE.Vector3();
  function followLight(target) {
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    _t.set(Math.round(target.x / texel) * texel, 0, Math.round(target.z / texel) * texel);
    sun.target.position.copy(_t);
    sun.position.copy(_t).addScaledVector(LIGHT_DIR, 60);
  }

  const _f = new THREE.Vector3();
  let last = { calls: 0, triangles: 0 };
  function render(camera, o = {}) {
    renderer.info.reset();
    if (o.target) {
      followLight(o.target);
      // 補助光はカメラの少し右から(カメラを回してもついてくる)
      _f.copy(camera.position).sub(o.target).normalize();
      fill.position.set(_f.x + _f.z * 0.5, _f.y * 0.7, _f.z - _f.x * 0.5);
    }
    const Q = QUALITY[q];
    if (Q.post) post.render(scene, camera, { focusY: o.focusY, ao: Q.ao, tilt: o.tilt });
    else renderer.render(scene, camera);
    last = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0,
    };
  }

  // 最初の数秒の fps で画質を決める。中で測り、速ければ高、遅ければ低
  function autoQuality({ ms = 2500, frame } = {}) {
    return new Promise((resolve) => {
      setQuality('mid');
      let n = 0, t0 = 0;
      const step = (t) => {
        frame?.();
        if (!t0) t0 = t;
        n++;
        if (t - t0 < ms) return requestAnimationFrame(step);
        const fps = (n * 1000) / (t - t0);
        const pick = fps >= 52 && (window.devicePixelRatio || 1) > 1.2 ? 'high' : fps < 30 ? 'low' : 'mid';
        setQuality(pick);
        resolve({ fps, quality: pick });
      };
      requestAnimationFrame(step);
    });
  }

  setQuality('mid');
  return {
    renderer, scene, sun, hemi, fill, post,
    resize, setQuality, render, autoQuality,
    get quality() { return q; },
    stats: () => last,
    size: () => ({ w: cssW, h: cssH }),
  };
}
