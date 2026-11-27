// 建物の屋根と「中に入る」演出。読みこみも画面の切り替えもなし。
//   - 主人公が建物の中(戸口を含む)に入ると、屋根がふわっと持ち上がって横(画面の右)にずれ、少し傾く
//   - 手前(カメラ側)の壁は根もとで切れて、断面が見える(cutaway の forced)
//   - カメラが少し寄る(戻り値 zoom)
//   - 2階建て: 1階にいるときは、2階の床がカメラ側からめくれるようにはがれ、2階の壁も消える。2階にいるときは2階の手前の壁だけ切る
//   - 外にいて屋根の陰に入ったときは、屋根が透ける
//
//   const B = buildBuildings(D, scene);
//   const zoom = B.update(dt, player, camera);  // player = { l, x, z, pos:Vector3 }
//   cutaway.update(dt, feet, camera, B.forced);
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, colored, m4 } from './materials.js';

const OV = 0.35; // 軒の出

function roofGeometry(b, rnd) {
  const parts = [];
  const P = (g, c, mm) => parts.push(colored(g.index ? g.toNonIndexed() : g, c, mm));
  const wx = b.x1 - b.x0 + 1, wz = b.z1 - b.z0 + 1;
  const ridgeX = wx >= wz;
  const Lw = ridgeX ? wx : wz;        // 棟の向きの長さ(壁)
  const Ww = ridgeX ? wz : wx;        // 棟と直角の幅(壁)
  const roofC = new THREE.Color(b.roof);
  const dark = roofC.clone().offsetHSL(0, 0, -0.1);
  const rot = ridgeX ? 0 : Math.PI / 2;
  const R = (x, y, z, rx = 0, rz = 0) => m4(0, 0, 0, rot).multiply(m4(x, y, z, 0, rx, rz));

  if (b.tall) {
    // 時計塔: 細くなった塔の胴 + 4面の文字盤 + 四角すいの屋根 + てっぺんの風見
    const s = Math.min(wx, wz) - 1.6, H = 3.6;
    P(new THREE.BoxGeometry(s, H, s), '#eadfc8', m4(0, H / 2, 0));
    P(new THREE.BoxGeometry(s + 0.2, 0.2, s + 0.2), '#5a3f2c', m4(0, 0.1, 0));
    P(new THREE.BoxGeometry(s + 0.3, 0.25, s + 0.3), '#5a3f2c', m4(0, H, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const face = new THREE.Matrix4().multiplyMatrices(m4(0, H * 0.55, 0, a), new THREE.Matrix4().makeTranslation(0, 0, s / 2 + 0.03));
      P(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 24), '#f6f1e4', face.clone().multiply(m4(0, 0, 0, 0, Math.PI / 2)));
      P(new THREE.TorusGeometry(1.15, 0.08, 6, 24), '#c8a04a', face.clone().multiply(m4(0, 0, 0.05)));
      P(new THREE.BoxGeometry(0.1, 0.8, 0.06), '#1d1a17', face.clone().multiply(m4(0, 0.35, 0.09)));
      P(new THREE.BoxGeometry(0.08, 0.6, 0.06), '#1d1a17', face.clone().multiply(m4(0.2, -0.15, 0.09, 0, 0, 2.1)));
    }
    P(new THREE.ConeGeometry(s * 0.82, 3.2, 4), b.roof, m4(0, H + 1.6 + 0.12, 0, Math.PI / 4));
    P(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), '#2d2a26', m4(0, H + 3.6, 0));
    P(new THREE.BoxGeometry(0.7, 0.3, 0.04), '#c8a04a', m4(0.2, H + 3.9, 0));
    return { geo: mergeGeometries(parts), height: H + 4.2, width: s };
  }

  const halfW = Ww / 2 + OV;
  const Hr = Math.max(1.2, Ww * 0.36);
  // 妻壁(屋根裏の三角柱。中が詰まっている)
  const tri = new THREE.Shape();
  tri.moveTo(-Ww / 2, 0); tri.lineTo(Ww / 2, 0); tri.lineTo(0, Hr - 0.05); tri.closePath();
  const prism = new THREE.ExtrudeGeometry(tri, { depth: Lw, bevelEnabled: false }).translate(0, 0, -Lw / 2).rotateY(Math.PI / 2);
  P(prism, '#e6d8bb', m4(0, 0, 0, rot));
  // 屋根の板(2枚)と、瓦の段
  const slope = Math.atan2(Hr, Ww / 2);
  const sl = Math.hypot(halfW, Hr * (halfW / (Ww / 2)));
  for (const side of [-1, 1]) {
    const cxp = (side * halfW) / 2, cyp = Hr - (Hr * (halfW / (Ww / 2))) / 2;
    const plate = R(0, cyp + 0.06, cxp, side * slope);
    P(new THREE.BoxGeometry(Lw + OV * 2, 0.12, sl + 0.05), b.roof, plate);
    // 瓦の段: 板の上に細い帯を並べる
    const rows = Math.max(3, Math.round(sl / 0.45));
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows - 0.5;
      const c = (r % 2 ? dark : roofC).clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.04);
      P(new THREE.BoxGeometry(Lw + OV * 2 + 0.02, 0.07, (sl / rows) * 0.62), c, plate.clone().multiply(m4(0, 0.08, t * sl)));
    }
  }
  // 棟の飾り
  P(new THREE.CylinderGeometry(0.11, 0.11, Lw + OV * 2 + 0.1, 8), '#3a2c22', R(0, Hr + 0.08, 0, 0, Math.PI / 2));
  // 煙突
  if (b.id === 'home' || b.id === 'inn' || b.id === 'workshop') {
    P(new THREE.BoxGeometry(0.5, 1.4, 0.5), '#9c5a45', R(Lw * 0.25, Hr * 0.55 + 0.4, halfW * 0.35));
    P(new THREE.BoxGeometry(0.62, 0.12, 0.62), '#3a2c22', R(Lw * 0.25, Hr * 0.55 + 1.12, halfW * 0.35));
  }
  return { geo: mergeGeometries(parts), height: Hr + 0.3, width: Ww };
}

export function buildBuildings(D, scene, opts = {}) {
  let seed = 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const list = D.blds.map((b) => {
    const { geo, height, width } = roofGeometry(b, rnd);
    const mat = paint({ vertexColors: true, roughness: 0.7, paintAmt: 0.22, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    const top = b.upper ? b.floorUp + 1.5 - 0.0 : b.wallTop0;
    const home = new THREE.Vector3(b.cx, top, b.cz);
    mesh.position.copy(home);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'roof_' + b.id;
    mesh.renderOrder = 1;
    scene.add(mesh);
    const upperWalls = b.upper !== undefined ? D.wallItems.filter((w) => w.bid === b.id && w.level === b.upper && w.mesh) : [];
    return { b, mesh, mat, home, top, height, width, open: 0, vel: 0, fade: 1, peel: 0, peelVel: 0, upperWalls };
  });
  const byId = Object.fromEntries(list.map((r) => [r.b.id, r]));

  let player = { l: 0, x: 0, z: 0 };
  const camU = new THREE.Vector2(0, 1); // 注視点からカメラへの水平の向き

  function inside(b, p) {
    if (p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1) return false;
    return p.l === b.l || p.l === b.upper;
  }

  // 建物の手前側(カメラ側)の壁か
  function nearSide(b, x, z, margin = 0.75) {
    const ax = (x - b.cx) * camU.x + (z - b.cz) * camU.y;
    const ext = Math.abs(((b.x1 - b.x0) / 2) * camU.x) + Math.abs(((b.z1 - b.z0) / 2) * camU.y);
    return ax > ext - margin;
  }

  // cutaway に渡す: 建物の中にいるときの、切る高さ
  function forced(it) {
    if (!it.bid) return undefined;
    const r = byId[it.bid];
    if (!r || r.open < 0.02) return undefined;
    const b = r.b;
    if (player.l === b.l) {
      if (it.level === b.l && nearSide(b, it.x, it.z)) return it.stub;
    } else if (player.l === b.upper) {
      if (it.level === b.upper && nearSide(b, it.x, it.z)) return it.stub;
      if (it.level === b.l && nearSide(b, it.x, it.z, 0.2)) return Math.min(it.top, b.floorUp - 0.14);
    }
    return undefined;
  }

  const _s = new THREE.Vector3(), _off = new THREE.Vector3(), _t = new THREE.Matrix4();
  const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _hinge = new THREE.Vector3();

  function spring(r, key, velKey, target, dt, k = 70, c = 11) {
    // ふわっと: 少しだけ行きすぎて戻るばね
    const a = (target - r[key]) * k - r[velKey] * c;
    r[velKey] += a * dt;
    r[key] += r[velKey] * dt;
  }

  function update(dt, p, camera) {
    player = p;
    dt = Math.min(dt, 1 / 30);
    camU.set(camera.position.x - p.pos.x, camera.position.z - p.pos.z).normalize();
    // 画面の右 = (カメラの前) × (上)。前 = -camU なので 右 = (camU.y, 0, -camU.x)
    const right = new THREE.Vector3(camU.y, 0, -camU.x);
    let anyOpen = false;
    const eye = p.pos.clone(); eye.y += 0.45;
    const slope = (camera.position.y - eye.y) / Math.max(0.01, Math.hypot(camera.position.x - eye.x, camera.position.z - eye.z));
    for (const r of list) {
      const b = r.b;
      const isIn = inside(b, p);
      if (isIn) anyOpen = true;
      spring(r, 'open', 'vel', isIn ? 1 : 0, dt);
      const o = Math.max(0, r.open);
      // 屋根: 持ち上げて、画面の右へずらし、少し傾ける
      const exploded = b.upper !== undefined && p.l === b.l ? 1 : 0;
      r.ex = (r.ex ?? 0) + (exploded - (r.ex ?? 0)) * (1 - Math.exp(-dt * 5));
      const lift = o * (2.6 + r.height * 0.6 + r.ex * 2.6);
      const slide = o * (r.width * 0.7 + 1.8 + r.ex * r.width * 0.3);
      r.mesh.position.set(r.home.x + right.x * slide, r.home.y + lift, r.home.z + right.z * slide);
      _ax.set(camU.x, 0, camU.y);
      r.mesh.quaternion.setFromAxisAngle(_ax, -o * 0.22);
      r.mesh.castShadow = o < 0.3;
      // 外で、屋根の陰に入ったら透かす
      let occl = false;
      if (!isIn) {
        for (let t = 0.4; t < 14; t += 0.4) {
          const x = eye.x + camU.x * t, z = eye.z + camU.y * t, y = eye.y + slope * t;
          if (x > b.x0 - 0.5 - OV && x < b.x1 + 0.5 + OV && z > b.z0 - 0.5 - OV && z < b.z1 + 0.5 + OV && y < r.top + r.height) { occl = true; break; }
        }
      }
      r.fade += ((occl ? 0 : 1) - r.fade) * (1 - Math.exp(-dt * 8));
      r.mat.opacity = r.fade;
      r.mat.depthWrite = r.fade > 0.95;
      r.mesh.visible = r.fade > 0.04;
      if (r.fade < 0.9) r.mesh.castShadow = false;

      // 2階建て: 1階にいるときは、2階(床・壁・家具)がまるごとはがれて、右上へ浮く(説明書の分解図)
      if (b.upper !== undefined && D.upperMesh) {
        const want = isIn && p.l === b.l ? 1 : 0;
        spring(r, 'peel', 'peelVel', want, dt, 38, 10);
        const pe = THREE.MathUtils.clamp(r.peel, 0, 1.08);
        const ext = Math.abs(((b.x1 - b.x0) / 2 + 0.5) * camU.x) + Math.abs(((b.z1 - b.z0) / 2 + 0.5) * camU.y);
        const lift2 = 1.7, slide2 = r.width * 0.6 + 0.6, back2 = ext * 0.9; // 右上の奥へ(画面に収まる量)
        _ax.set(-camU.y, 0, camU.x); // カメラから見て横の軸
        let k = 0;
        for (const it of D.upperItems) {
          if (!it.b || it.b.id !== b.id) { k++; continue; }
          // 手前(カメラ側)の板から順にめくれる
          const along = (it.x - b.cx) * camU.x + (it.z - b.cz) * camU.y;
          const sNear = THREE.MathUtils.clamp((along + ext) / (2 * ext), 0, 1);
          const ei = THREE.MathUtils.clamp(pe * 1.7 - (1 - sNear) * 0.7, 0, 1.08);
          const e = ei * ei * (3 - 2 * Math.min(1, ei));
          const curl = Math.sin(Math.min(1, ei) * Math.PI) * 0.55; // 動いているあいだだけ、手前のふちが反る
          _q.setFromAxisAngle(_ax, curl);
          _v.setFromMatrixPosition(it.base);
          _v.x += (right.x * slide2 - camU.x * back2) * e; _v.z += (right.z * slide2 - camU.y * back2) * e; _v.y += lift2 * e + curl * 0.4;
          _m.makeRotationFromQuaternion(_q).scale(_s.set(1, 0.14, 1)).setPosition(_v);
          D.upperMesh.setMatrixAt(k, _m);
          k++;
        }
        D.upperMesh.instanceMatrix.needsUpdate = true;
        D.upperMesh.computeBoundingSphere();
        // 2階の壁と家具は、まとめて同じだけ動かす
        const eg = THREE.MathUtils.clamp(pe * 1.25 - 0.1, 0, 1.08);
        const e = eg * eg * (3 - 2 * Math.min(1, eg));
        _off.set((right.x * slide2 - camU.x * back2) * e, lift2 * e, (right.z * slide2 - camU.y * back2) * e);
        const touched = new Set();
        for (const it of r.upperWalls) {
          _m.copy(it.m).premultiply(_t.makeTranslation(_off.x, _off.y, _off.z));
          it.mesh.setMatrixAt(it.index, _m);
          it.lift = _off.y;
          touched.add(it.mesh);
        }
        for (const m of touched) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
        const props = D.propsByLevel[b.upper];
        if (props) props.position.copy(_off);
      }
    }
    // 分解図を見せているときは、寄りすぎない
    const ex = list.some((r) => r.b.upper !== undefined && inside(r.b, p) && p.l === r.b.l);
    return anyOpen ? (ex ? 1.0 : 0.8) : 1;
  }

  return { list, update, forced, inside };
}
