// ティルトシフト(画面の上下をぼかす)+ 安い SSAO 近似 + 仕上げ(トーンマップ・彩度・周辺減光)を
// 1回の全画面パスでやる。ピントの帯は主人公の画面の高さに合わせる。
//
//   const post = createTiltShift(renderer);
//   post.setSize(w, h, pixelRatio);
//   post.render(scene, camera, { focusY, ao, tilt });   // focusY: 画面の下から 0..1
import * as THREE from 'three';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS = /* glsl */`
#include <packing>
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;          // ピクセル数
uniform float uFocusY;      // 0..1
uniform float uBand;        // ピントの合う帯の半分の幅
uniform float uRange;       // ぼけが最大になるまでの距離
uniform float uMaxR;        // 最大のぼけ半径(ピクセル)
uniform float uTilt;        // 0/1
uniform float uAO;          // AO の強さ(0で切る)
uniform float uNear, uFar;
uniform float uExposure;
uniform float uSat;
uniform float uVignette;
uniform float uTime;

vec3 dioRRT(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 dioAces(vec3 color) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = O * dioRRT(I * color);
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c));
}
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float dy = vUv.y - uFocusY;
  // 奥(上)は手前(下)よりよくぼかす = 写真らしい
  float k = smoothstep(uBand, uBand + uRange, dy > 0.0 ? dy : -dy * 1.25);
  float r = uMaxR * k * uTilt;
  vec3 col;
  if (r < 0.6) {
    col = texture2D(tColor, vUv).rgb;
  } else {
    // ボーゲルの円盤(黄金角のらせん)で 18 点
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float rot = hash(gl_FragCoord.xy) * 6.2831;
    for (int i = 0; i < 18; i++) {
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / 18.0) * r;
      float a = fi * 2.39996 + rot;
      vec2 o = vec2(cos(a), sin(a)) * rr / uRes;
      vec3 s = texture2D(tColor, vUv + o).rgb;
      float w = 1.0 + dot(s, vec3(0.3, 0.5, 0.2)) * 0.6; // 明るい点を少し強く = 玉ぼけ
      acc += s * w; wsum += w;
    }
    col = acc / wsum;
  }
#ifdef USE_AO
  if (uAO > 0.0) {
    // すき間の暗がり: まわりの深度が手前にあるほど暗く(8点、距離に応じた半径)
    float z0 = viewZ(vUv);
    float rad = clamp(140.0 / z0, 3.0, 26.0) * (uRes.y / 900.0);
    float occ = 0.0;
    float rot = hash(gl_FragCoord.yx + 3.1) * 6.2831;
    for (int i = 0; i < 8; i++) {
      float fi = float(i) + 0.5;
      float a = fi * 2.39996 + rot;
      vec2 o = vec2(cos(a), sin(a)) * rad * sqrt(fi / 8.0) / uRes;
      float zn = viewZ(vUv + o);
      float dz = z0 - zn;                      // 正 = となりが手前に出ている
      occ += smoothstep(0.03, 0.25, dz) * (1.0 - smoothstep(0.9, 2.2, dz));
    }
    float ao = 1.0 - occ / 8.0 * uAO;
    col *= mix(ao, 1.0, k * 0.85);
  }
#endif
  col = dioAces(col);
  // ミニチュア写真らしく、少し彩度とコントラストを上げる
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
  vec2 v = vUv - 0.5;
  col *= 1.0 - uVignette * dot(v, v) * 1.6;
  col = toSRGB(clamp(col, 0.0, 1.0));
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createTiltShift(renderer) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = {
    tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uFocusY: { value: 0.45 }, uBand: { value: 0.07 }, uRange: { value: 0.32 }, uMaxR: { value: 9 },
    uTilt: { value: 1 }, uAO: { value: 0 }, uNear: { value: 1 }, uFar: { value: 400 },
    uExposure: { value: 1 }, uSat: { value: 1.08 }, uVignette: { value: 0.35 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms, depthTest: false, depthWrite: false });
  const matAO = mat.clone();
  matAO.uniforms = uniforms;
  matAO.defines = { USE_AO: '' };
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let rt = null, rtKey = '';
  function ensureRT(w, h, ao) {
    const key = w + 'x' + h + (ao ? 'd' : 'm');
    if (key === rtKey) return;
    rt?.dispose();
    rt?.depthTexture?.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: ao ? 0 : 4,              // 高: 深度テクスチャを読むので MSAA なし(ピクセル比2で補う)
      depthTexture: ao ? new THREE.DepthTexture(w, h, THREE.UnsignedIntType) : null,
    });
    rtKey = key;
  }

  let W = 1, H = 1;
  return {
    uniforms,
    setSize(w, h, pr) { W = Math.max(1, Math.floor(w * pr)); H = Math.max(1, Math.floor(h * pr)); uniforms.uRes.value.set(W, H); uniforms.uMaxR.value = 9 * pr * (h / 800 + 0.4); },
    render(scene, camera, o = {}) {
      const ao = !!o.ao;
      ensureRT(W, H, ao);
      uniforms.uFocusY.value = o.focusY ?? 0.45;
      uniforms.uTilt.value = o.tilt === false ? 0 : 1;
      uniforms.uAO.value = ao ? (o.aoStrength ?? 0.75) : 0;
      uniforms.uNear.value = camera.near; uniforms.uFar.value = camera.far;
      uniforms.uExposure.value = renderer.toneMappingExposure;
      uniforms.uTime.value = (uniforms.uTime.value + 1.618) % 100;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      uniforms.tColor.value = rt.texture;
      uniforms.tDepth.value = rt.depthTexture;
      quad.material = ao ? matAO : mat;
      renderer.render(qScene, qCam);
    },
    dispose() { rt?.dispose(); geo.dispose(); mat.dispose(); matAO.dispose(); },
  };
}
