// 手前の切り抜き。主人公とカメラのあいだをふさぐ壁や木を、根もとの高さで「切る」。
// 切り口は materials.paint({cut:true}) の裏面の塗り(生成り + 黒インクの斜線)で、断面として見える。
//
//   const cut = createCutaway();
//   cut.add(instancedMesh, items)   // items[i] = { x, z, top, stub, bid?, level? }(i はインスタンス番号)
//   cut.update(dt, playerFeet, camera, forced)   // forced(item) が数値を返したら、その高さで切る(建物の中など)
//
// aCut 属性(インスタンスごとの世界のY)を書きかえるだけなので、描画の呼び出しは増えない。
import * as THREE from 'three';

export function createCutaway() {
  const sets = [];
  const E = new THREE.Vector3();

  function add(mesh, items) {
    const n = items.length;
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    const cur = new Float32Array(n);
    for (let i = 0; i < n; i++) { cur[i] = items[i].top + 0.05; attr.array[i] = cur[i]; }
    mesh.geometry.setAttribute('aCut', attr);
    const set = { mesh, items, attr, cur, hit: new Uint8Array(n) };
    sets.push(set);
    return set;
  }

  // 1つの物が視線をふさぐか
  function occludes(it, u, slope, wasHit) {
    const qx = it.x - E.x, qz = it.z - E.z;
    const along = qx * u.x + qz * u.y;
    if (along < 0.35 || along > 9) return false;
    const lat = Math.abs(qx * u.y - qz * u.x);
    const yRay = E.y + along * slope;
    const w = 1.05 + along * 0.16 + (wasHit ? 0.45 : 0);
    return lat < w && it.top > yRay - 0.35 - (wasHit ? 0.3 : 0);
  }

  function update(dt, feet, camera, forced) {
    E.copy(feet); E.y += 0.45;
    const u = new THREE.Vector2(camera.position.x - E.x, camera.position.z - E.z);
    const hd = Math.max(0.001, u.length());
    u.multiplyScalar(1 / hd);
    const slope = (camera.position.y - E.y) / hd;
    const a = 1 - Math.exp(-dt * 11);
    for (const s of sets) {
      let dirty = false;
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i];
        const lift = it.lift || 0;
        const full = it.top + 0.05 + lift;
        if (lift > 0.01) {
          // 持ち上げて動かしている物(2階の分解図など)は切らない
          s.cur[i] = full; s.attr.array[i] = full; s.hit[i] = 0; dirty = true;
          continue;
        }
        let tgt = full;
        const f = forced ? forced(it) : undefined;
        if (f !== undefined && f !== null) tgt = Math.min(tgt, f);
        const h = occludes(it, u, slope, s.hit[i] === 1);
        s.hit[i] = h ? 1 : 0;
        if (h) tgt = Math.min(tgt, it.stub);
        const c = s.cur[i];
        if (Math.abs(c - tgt) > 0.002) {
          s.cur[i] = c + (tgt - c) * a;
          if (Math.abs(s.cur[i] - tgt) < 0.004) s.cur[i] = tgt;
          s.attr.array[i] = s.cur[i];
          dirty = true;
        }
      }
      if (dirty) s.attr.needsUpdate = true;
    }
  }

  return { add, update, sets };
}
