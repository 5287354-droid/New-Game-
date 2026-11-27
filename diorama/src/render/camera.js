// 模型をのぞきこむカメラ。狭い画角(25°)の透視投影で、斜め上から見下ろす。
//   - 向きは 90° ずつ4方向(rotate(±1))。なめらかに補間する
//   - ドラッグで ±15° だけ傾く(左右 = 向き、上下 = 見下ろす角度)。ダブルクリックで戻る
//   - 注視点は主人公を追う。建物の中では少し寄る(setZoom)
//   - 画面の縦横に合わせて距離を変え、縦でも横でも同じくらいのマス数が見えるようにする
import * as THREE from 'three';

const D2R = Math.PI / 180;

export function createDioramaCamera({ fov = 25, pitch = 52 } = {}) {
  const camera = new THREE.PerspectiveCamera(fov, 1, 1, 400);
  const s = {
    k: 0,                 // 向きの番号(0..3 を超えてもよい。表示は k*90°)
    yaw: 0,               // 今の向き(度)
    pitch,                // 基本の見下ろし角
    dragYaw: 0, dragPitch: 0,
    zoom: 1, zoomTarget: 1,
    target: new THREE.Vector3(),
    targetGoal: new THREE.Vector3(),
    aspect: 1,
    first: true,
  };

  function rotate(dir) { s.k += dir; }
  function setZoom(z) { s.zoomTarget = z; }
  function follow(v) { s.targetGoal.copy(v); if (s.first) { s.target.copy(v); s.first = false; } }
  function setAspect(a) { s.aspect = a; camera.aspect = a; camera.updateProjectionMatrix(); }

  // 見えるマス数から距離を決める: 横は約 11 マス、縦は約 15 マス(どちらか厳しい方)
  function baseDistance() {
    const vf = fov * D2R;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * s.aspect);
    const p = (s.pitch + s.dragPitch) * D2R;
    const byH = 13 / (2 * Math.tan(hf / 2));
    const byV = (19 * Math.sin(p)) / (2 * Math.tan(vf / 2));
    return Math.max(byH, byV);
  }

  function update(dt) {
    const a = 1 - Math.exp(-dt * 7);
    s.yaw += (s.k * 90 - s.yaw) * (1 - Math.exp(-dt * 9));
    s.zoom += (s.zoomTarget - s.zoom) * (1 - Math.exp(-dt * 4));
    s.target.lerp(s.targetGoal, a);
    const yaw = (s.yaw + s.dragYaw) * D2R;
    const p = (s.pitch + s.dragPitch) * D2R;
    const d = baseDistance() * s.zoom;
    camera.position.set(
      s.target.x + Math.sin(yaw) * Math.cos(p) * d,
      s.target.y + Math.sin(p) * d,
      s.target.z + Math.cos(yaw) * Math.cos(p) * d,
    );
    camera.lookAt(s.target);
  }

  // 画面の「上」にいちばん近いマスの向き(矢印キーをマスの向きに直す)
  function gridDirs() {
    const k = ((s.k % 4) + 4) % 4;
    // k=0: カメラは +z 側から -z を見る。上 = (0,-1)
    const up = [[0, -1], [-1, 0], [0, 1], [1, 0]][k];
    return { up, right: [-up[1] || 0, up[0] || 0] };
  }

  // カメラから注視点への水平の向き(単位ベクトル)。切り抜きや屋根の向きに使う
  function forward() {
    const yaw = (s.yaw + s.dragYaw) * D2R;
    return new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
  }

  function attach(dom) {
    let drag = null;
    dom.addEventListener('pointerdown', (e) => { if (e.isPrimary) drag = { x: e.clientX, y: e.clientY, yaw: s.dragYaw, pitch: s.dragPitch }; });
    window.addEventListener('pointermove', (e) => {
      if (!drag || !e.isPrimary) return;
      s.dragYaw = THREE.MathUtils.clamp(drag.yaw - (e.clientX - drag.x) * 0.18, -15, 15);
      s.dragPitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.18, -15, 15);
    });
    window.addEventListener('pointerup', () => (drag = null));
    dom.addEventListener('dblclick', () => { s.dragYaw = 0; s.dragPitch = 0; });
  }

  return {
    camera, state: s, rotate, setZoom, follow, setAspect, update, gridDirs, forward, attach,
    setTilt(yaw, p) { s.dragYaw = THREE.MathUtils.clamp(yaw, -15, 15); s.dragPitch = THREE.MathUtils.clamp(p, -15, 15); },
    snap() { s.yaw = s.k * 90; s.zoom = s.zoomTarget; s.target.copy(s.targetGoal); },
  };
}
