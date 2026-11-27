// マップ JSON からジオラマを組み立てる。同じ形はすべて InstancedMesh(1回の描画)にまとめる。
//
//   const D = buildDiorama(area, scene, cutaway);
//   D.floorY(l, x, z)       そのマスの床の高さ(世界のY)
//   D.buildingAt(l, x, z)   そのマスの建物(なければ null)
//
// 座標: マス (x, z) の中心 = 世界 (x, *, z)。高さ1段 = 0.5。1階ぶん = 1.5
// 描くもの
//   地面のタイル(面取り + 塗りムラ + 色のゆらぎ)/ 草の房と花 / 水(樹脂)と水底
//   壁・窓・まぐさ・柱(1つの InstancedMesh。切り抜き可)/ 2階の床(はがれる演出用)
//   木(幹・丸い葉・とんがり葉。切り抜き可)/ 家具や小物(階ごとに1つにまとめる)/ 村人の駒
//   ジオラマの台(断面の地層)・カッターマット・机・巨大な道具(卓上ランプ・定規・ペン立て・ピンセット・ランナー・塗料びん)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, cutDepth, chamferTile, chamferBox, colored, m4, mulberry, canvasTex } from './materials.js';

export const HU = 0.5;        // 高さ1段
export const STORY = 1.5;     // 1階ぶんの壁の高さ

const TILE_COLOR = {
  g: '#7c9f4b', p: '#d9c294', f: '#b8875a', w: '#2e6a7c', B: '#9a6a3e', d: '#a47a50', s: '#e2d2a0',
  k: '#c9b087', m: '#9c9a92', r: '#b5523b', c: '#5d5248', L: '#9a6a3e', C: '#5d5248',
};

export function buildDiorama(area, scene, cutaway, opts = {}) {
  const rnd = mulberry(opts.seed ?? 1234);
  const L0 = area.levels[0];
  const W = L0.w, Dp = L0.d;
  const root = new THREE.Group();
  root.name = 'diorama';
  scene.add(root);

  // ---- 建物の表 ----
  const blds = (area.buildings || []).map((b) => {
    const floor0 = (area.levels[b.l].y + 1) * HU;
    const up = b.upper ? area.levels[b.upper] : null;
    const floorUp = up ? (up.y + 1) * HU : null;
    const tall = !!b.tall;
    const wallTop0 = floor0 + (tall ? STORY * 1.7 : STORY);
    return { ...b, floor0, floorUp, wallTop0, top: up ? floorUp + STORY : wallTop0, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 };
  });
  function buildingAt(l, x, z) {
    for (const b of blds) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.l === l || b.upper === l) return b;
    }
    return null;
  }
  function floorY(l, x, z) {
    const L = area.levels[l];
    const i = z * L.w + x;
    return (L.y + L.h[i]) * HU;
  }
  const tAt = (l, x, z) => {
    const L = area.levels[l];
    if (!L || x < 0 || z < 0 || x >= L.w || z >= L.d) return 'x';
    return L.t[z * L.w + x];
  };

  // ---- 地面のタイル ----
  const tileGeo = chamferTile(0.07);
  const ground = [], upper = [];
  for (let l = 0; l < area.levels.length; l++) {
    const L = area.levels[l];
    for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) {
      const t = L.t[z * L.w + x];
      if (t === 'x' || t === 'W') continue;
      if (l > 0 && area.objects.some((o) => o.type === 'stairs' && o.l === l && o.x === x && o.z === z)) continue; // 階段の吹きぬけ
      const top = floorY(l, x, z);
      if (l === 0) ground.push({ x, z, t, top, l });
      else upper.push({ x, z, t, top, l, b: buildingAt(l, x, z) });
    }
  }
  const col = new THREE.Color();
  const mtx = new THREE.Matrix4();
  // 大きなムラ(草の濃淡のまだら)
  const patch = (x, z) => Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * 0.5 + Math.sin(z * 0.27 - x * 0.11) * 0.5;
  function tileColor(t, x, z) {
    col.set(TILE_COLOR[t] || '#999');
    const r = rnd();
    if (t === 'g') col.offsetHSL(patch(x, z) * 0.02 + (r - 0.5) * 0.015, (rnd() - 0.5) * 0.08, patch(x, z) * 0.035 + (rnd() - 0.5) * 0.04);
    else if (t === 'f') col.offsetHSL(0, 0, ((z * 7 + (x >> 2)) % 3 - 1) * 0.025 + (r - 0.5) * 0.03); // 板の継ぎ目
    else col.offsetHSL((r - 0.5) * 0.01, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05);
    return col;
  }
  // まわりが同じ高さのタイルは側面が見えないので、上面と面取りだけの形(14三角形)にする
  const innerGeo = chamferTile(0.07, 0, false);
  const topOf = (g) => (g.t === 'w' ? 0.06 : g.top);
  const gIndex = new Map(ground.map((g) => [g.x + ',' + g.z, g]));
  const isEdge = (g) => {
    if (g.t === 'B') return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (tAt(0, g.x + dx, g.z + dz) === 'W') continue; // 壁の下は見えない
      const n = gIndex.get(g.x + dx + ',' + (g.z + dz));
      if (!n || topOf(n) < topOf(g) - 0.01 || n.t === 'B') return true;
    }
    return false;
  };
  const edgeT = ground.filter(isEdge), innerT = ground.filter((g) => !isEdge(g));
  const groundMat = paint({ roughness: 0.92, paintAmt: 0.42 });
  const fillTiles = (geo, list, name) => {
    const m = new THREE.InstancedMesh(geo, groundMat, list.length);
    list.forEach((g, i) => {
      let bottom = 0, top = topOf(g);
      if (g.t === 'B') bottom = top - 0.13;
      const jitter = g.t === 'B' || g.t === 'f' ? 0 : (rnd() - 0.5) * 0.018; // 手作りの、ほんの少しの段ちがい
      mtx.makeScale(1, Math.max(0.02, top - bottom + jitter), 1).setPosition(g.x, bottom, g.z);
      m.setMatrixAt(i, mtx);
      m.setColorAt(i, tileColor(g.t, g.x, g.z));
    });
    m.receiveShadow = true;
    m.castShadow = false;
    m.name = name;
    root.add(m);
    return m;
  };
  const groundMesh = fillTiles(innerGeo, innerT, 'groundInner');
  fillTiles(tileGeo, edgeT, 'groundEdge');

  // ---- 2階の床(はがれる演出のため別にする。底面つき) ----
  let upperMesh = null;
  if (upper.length) {
    upperMesh = new THREE.InstancedMesh(chamferBox(0.06), paint({ roughness: 0.9, paintAmt: 0.4 }), upper.length);
    upper.forEach((g, i) => {
      mtx.makeScale(1, 0.14, 1).setPosition(g.x, g.top - 0.14, g.z);
      upperMesh.setMatrixAt(i, mtx);
      upperMesh.setColorAt(i, tileColor(g.t, g.x, g.z));
      g.base = mtx.clone();
    });
    upperMesh.castShadow = upperMesh.receiveShadow = true;
    upperMesh.name = 'upperFloor';
    upperMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(upperMesh);
  }

  // ---- 草の房と花(静的な草 = 模型のフロック) ----
  {
    // 草の房: 1枚の三角形の葉を3枚、ねじって立てる(両面)
    const blade = (a, tilt) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, 0.24, 0], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.5, 1, 0, 0.5, 1, 0, 0.8, 0.6], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      return g.rotateZ(tilt).rotateY(a);
    };
    const tuftGeo = mergeGeometries([blade(0, 0.25), blade(2.1, -0.3), blade(4.2, 0.15)]);
    const flowerGeo = new THREE.OctahedronGeometry(0.06, 0).translate(0, 0.16, 0);
    const tufts = [], flowers = [];
    const occupied = new Set(area.objects.filter((o) => o.l === 0).map((o) => o.x + ',' + o.z));
    for (const g of ground) {
      if (g.t !== 'g' || occupied.has(g.x + ',' + g.z)) continue;
      // 道や壁のきわは草が多い
      let edge = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tAt(0, g.x + dx, g.z + dz) !== 'g') edge++;
      const n = Math.floor(rnd() * 2.2 + edge * 0.9);
      for (let k = 0; k < n; k++) tufts.push([g.x + (rnd() - 0.5) * 0.8, g.top, g.z + (rnd() - 0.5) * 0.8, rnd() * 6.28, 0.7 + rnd() * 0.7]);
      if (rnd() < 0.09) for (let k = 0; k < 3; k++) flowers.push([g.x + (rnd() - 0.5) * 0.7, g.top, g.z + (rnd() - 0.5) * 0.7, rnd()]);
    }
    const tm = new THREE.InstancedMesh(tuftGeo, paint({ roughness: 1, paintAmt: 0.2, side: THREE.DoubleSide }), tufts.length);
    tufts.forEach(([x, y, z, a, s], i) => {
      tm.setMatrixAt(i, m4(x, y, z, a, 0, 0, s));
      tm.setColorAt(i, col.set('#6f9a3c').offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.4) * 0.12));
    });
    tm.receiveShadow = true;
    tm.name = 'tufts';
    root.add(tm);
    const fm = new THREE.InstancedMesh(flowerGeo, paint({ roughness: 0.7, paintAmt: 0.1 }), flowers.length);
    const fc = ['#f4f0e0', '#f2c94c', '#e26d5a', '#c58ad8'];
    flowers.forEach(([x, y, z, r], i) => { fm.setMatrixAt(i, m4(x, y, z)); fm.setColorAt(i, col.set(fc[Math.floor(r * fc.length)])); });
    fm.name = 'flowers';
    root.add(fm);
  }

  // ---- 水(つやのある樹脂) ----
  {
    const quads = [];
    for (const g of ground) if (g.t === 'w' || g.t === 'B') quads.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(g.x, 0.34, g.z));
    if (quads.length) {
      const wm = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshStandardMaterial({ color: '#4c9fbd', roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.58, depthWrite: false }));
      wm.name = 'water';
      wm.renderOrder = 2;
      root.add(wm);
    }
  }

  // ---- 壁・窓・まぐさ・柱(1つの InstancedMesh、切り抜き可) ----
  const wallItems = [];
  const wallMats = [];
  const WALL = '#eadfc8', TIMBER = '#5a3f2c', GLASS = '#2c4258', FRAME = '#f6f1e4';
  for (let l = 0; l < area.levels.length; l++) {
    const L = area.levels[l];
    for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) {
      if (L.t[z * L.w + x] !== 'W') continue;
      const b = buildingAt(l, x, z);
      const floor = floorY(l, x, z);
      const bottom = l === 0 ? 0 : floor - 0.14;
      const top = b ? (l === 0 ? (b.upper ? b.floorUp - 0.14 : b.wallTop0) : floor + STORY) : floor + STORY;
      const stub = floor + 0.3;
      const base = { x, z, top: l === 0 && b?.upper ? top : top, stub, bid: b?.id, level: l, floor };
      const corner = b && (x === b.x0 || x === b.x1) && (z === b.z0 || z === b.z1);
      // 壁の本体
      wallItems.push({ ...base, body: true, m: new THREE.Matrix4().makeScale(1, top - bottom, 1).setPosition(x, bottom, z), c: col.set(corner ? TIMBER : WALL).offsetHSL(0, 0, (rnd() - 0.5) * 0.04).clone() });
      if (corner) continue;
      // 腰の板(木の帯)
      wallItems.push({ ...base, m: new THREE.Matrix4().makeScale(1.04, 0.32, 1.04).setPosition(x, floor - 0.02, z), c: new THREE.Color(TIMBER) });
      // 上の梁
      wallItems.push({ ...base, m: new THREE.Matrix4().makeScale(1.03, 0.14, 1.03).setPosition(x, top - 0.12, z), c: new THREE.Color(TIMBER) });
      // 窓(壁を貫く箱。外からも中からも見える)
      if (b) {
        const alongX = z === b.z0 || z === b.z1;
        const pos = alongX ? x - b.x0 : z - b.z0;
        const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
        const nearDoor = Math.abs(x - b.door.x) + Math.abs(z - b.door.z) <= 1 && b.l === l;
        if (!nearDoor && pos % 2 === 0 && pos > 0 && pos < len) {
          const sx = alongX ? 1 : 1.06, sz = alongX ? 1.06 : 1;
          const fw = 0.62, gw = 0.46;
          wallItems.push({ ...base, m: new THREE.Matrix4().makeScale(alongX ? fw : sx, 0.66, alongX ? sz : fw).setPosition(x, floor + 0.5, z), c: new THREE.Color(FRAME) });
          wallItems.push({ ...base, m: new THREE.Matrix4().makeScale(alongX ? gw : sx + 0.02, 0.5, alongX ? sz + 0.02 : gw).setPosition(x, floor + 0.58, z), c: new THREE.Color(GLASS) });
        }
      }
    }
  }
  // 戸口の上のまぐさと、戸口の柱
  for (const b of blds) {
    const floor = b.floor0;
    const top = b.upper ? b.floorUp - 0.14 : b.wallTop0;
    const it = { x: b.door.x, z: b.door.z, top, stub: floor + 0.3, bid: b.id, level: b.l, floor };
    wallItems.push({ ...it, body: true, m: new THREE.Matrix4().makeScale(1, top - floor - 1.12, 1).setPosition(b.door.x, floor + 1.12, b.door.z), c: new THREE.Color(WALL) });
    wallItems.push({ ...it, m: new THREE.Matrix4().makeScale(1.04, 0.14, 1.04).setPosition(b.door.x, floor + 1.06, b.door.z), c: new THREE.Color(TIMBER) });
  }
  const wallMat = paint({ cut: true, roughness: 0.88, paintAmt: 0.3, section: '#f1e6cc' });
  wallMats.push(wallMat);
  // 壁の本体は面取りの箱、帯・梁・窓は角のない箱(12三角形)で別の InstancedMesh に分ける
  const mkWalls = (geo, items, name, shadow) => {
    const m = new THREE.InstancedMesh(geo, wallMat, items.length);
    items.forEach((w, i) => { m.setMatrixAt(i, w.m); m.setColorAt(i, w.c); w.mesh = m; w.index = i; });
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = shadow; m.receiveShadow = true;
    m.customDepthMaterial = cutDepth();
    m.name = name;
    root.add(m);
    cutaway?.add(m, items);
    return m;
  };
  const bodies = wallItems.filter((w) => w.body), trims = wallItems.filter((w) => !w.body);
  const wallMesh = mkWalls(chamferBox(0.035), bodies, 'walls', true);
  mkWalls(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), trims, 'wallTrims', false);

  // ---- 木(幹・葉。切り抜き可) ----
  {
    const trees = area.objects.filter((o) => o.type === 'tree');
    const round = trees.filter((t) => t.kind !== 'cone'), cone = trees.filter((t) => t.kind === 'cone');
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 1, 6).translate(0, 0.5, 0);
    const roundGeo = (() => {
      const a = new THREE.IcosahedronGeometry(0.62, 1).scale(1, 0.92, 1).translate(0, 1.35, 0);
      const b = new THREE.IcosahedronGeometry(0.42, 1).translate(0.28, 1.85, -0.12);
      const c = new THREE.IcosahedronGeometry(0.38, 1).translate(-0.3, 1.62, 0.2);
      return mergeGeometries([a, b, c].map((g) => (g.index ? g.toNonIndexed() : g)));
    })();
    const coneGeo = mergeGeometries([
      new THREE.ConeGeometry(0.62, 0.9, 7).translate(0, 1.0, 0),
      new THREE.ConeGeometry(0.5, 0.8, 7).translate(0, 1.5, 0),
      new THREE.ConeGeometry(0.36, 0.75, 7).translate(0, 1.98, 0),
    ].map((g) => (g.index ? g.toNonIndexed() : g)));
    const mk = (geo, list, color, name, topOf, trunk) => {
      const mat = paint({ cut: true, roughness: 0.95, paintAmt: 0.45, section: trunk ? '#d9b98c' : '#c9dca0' });
      if (!trunk) mat.flatShading = true;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const items = list.map((t, i) => {
        const y = floorY(t.l, t.x, t.z);
        const s = 0.9 + rnd() * 0.3;
        m.setMatrixAt(i, trunk ? new THREE.Matrix4().makeScale(1, t.kind === 'cone' ? 0.9 : 1.1, 1).setPosition(t.x, y, t.z) : m4(t.x, y, t.z, rnd() * 6.28, 0, 0, s));
        m.setColorAt(i, col.set(color).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08));
        return { x: t.x, z: t.z, top: y + topOf * s, stub: y + 0.32, level: t.l };
      });
      m.castShadow = true; m.receiveShadow = true;
      m.customDepthMaterial = cutDepth();
      m.name = name;
      root.add(m);
      cutaway?.add(m, items);
      return m;
    };
    mk(trunkGeo, trees, '#7a5236', 'trunks', 2.2, true);
    if (round.length) mk(roundGeo, round, '#5f9a3f', 'treeRound', 2.3);
    if (cone.length) mk(coneGeo, cone, '#3f7f4a', 'treeCone', 2.4);
  }

  // ---- 家具と小物(階ごとに1つのメッシュ) ----
  const propsByLevel = [];
  {
    const lists = area.levels.map(() => []);
    const box = (list, w, h, d, x, y, z, color, ry = 0, ox = 0, oz = 0) => {
      // (ox, oz) は家具の向きで回す前のずれ
      const c = Math.cos(ry), s = Math.sin(ry);
      const px = x + ox * c + oz * s, pz = z - ox * s + oz * c;
      list.push(colored(new THREE.BoxGeometry(w, h, d), color, m4(px, y + h / 2, pz, ry)));
    };
    const cyl = (list, r1, r2, h, x, y, z, color, seg = 10) => list.push(colored(new THREE.CylinderGeometry(r1, r2, h, seg), color, m4(x, y + h / 2, z)));
    const orient = (o) => {
      for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (tAt(o.l, o.x + dx, o.z + dz) === 'W') return Math.atan2(-dx, -dz);
      return 0;
    };
    const BOOKS = ['#b5523b', '#4f6d8f', '#6c8f4f', '#c98a2b', '#5f4f8f', '#e8dcc0', '#2f4f4f'];
    for (const o of area.objects) {
      const list = lists[o.l];
      if (!list) continue;
      const y = floorY(o.l, o.x, o.z), ry = orient(o);
      const B = (w, h, d, oy, color, ox = 0, oz = 0) => box(list, w, h, d, o.x, y + oy, o.z, color, ry, ox, oz);
      switch (o.type) {
        case 'bed':
          B(0.82, 0.22, 0.96, 0, '#7a5236');
          B(0.74, 0.1, 0.86, 0.22, '#f4efe2');
          B(0.5, 0.09, 0.22, 0.32, '#ffffff', 0, -0.28);
          B(0.78, 0.07, 0.56, 0.31, ['#c0583f', '#4f6d8f', '#6c8f4f', '#c98a2b'][o.x % 4], 0, 0.16);
          B(0.86, 0.5, 0.08, 0, '#6a452d', 0, -0.46);
          break;
        case 'shelf': {
          B(0.92, 1.25, 0.07, 0, '#5a3b26', 0, -0.4);
          B(0.07, 1.25, 0.38, 0, '#5a3b26', -0.43, -0.25);
          B(0.07, 1.25, 0.38, 0, '#5a3b26', 0.43, -0.25);
          for (let r = 0; r < 4; r++) B(0.86, 0.05, 0.36, r * 0.4, '#6e4a30', 0, -0.25);
          for (let r = 0; r < 3; r++) {
            let ox = -0.38;
            while (ox < 0.36) {
              const bw = 0.05 + rnd() * 0.06, bh = 0.22 + rnd() * 0.12;
              B(bw, bh, 0.26, r * 0.4 + 0.05, BOOKS[Math.floor(rnd() * BOOKS.length)], ox + bw / 2, -0.26);
              ox += bw + 0.008;
            }
          }
          break;
        }
        case 'counter':
          B(0.96, 0.52, 0.6, 0, '#8a5d3b');
          B(1.0, 0.06, 0.66, 0.52, '#c9a679');
          if (o.role === 'shop') { B(0.18, 0.2, 0.18, 0.58, '#e2c044', -0.25); B(0.14, 0.26, 0.14, 0.58, '#4f6d8f', 0.05); B(0.2, 0.12, 0.2, 0.58, '#b5523b', 0.3); }
          if (o.role === 'breed') { B(0.36, 0.08, 0.36, 0.58, '#d8d2c4'); cyl(list, 0.08, 0.08, 0.12, o.x, y + 0.66, o.z, '#b5523b'); }
          if (o.role === 'inn') B(0.3, 0.04, 0.22, 0.58, '#f4efe2');
          break;
        case 'post':
          cyl(list, 0.05, 0.07, 1.3, o.x, y, o.z, '#2d2a26', 6);
          B(0.22, 0.24, 0.22, 1.3, '#f6d27a');
          B(0.28, 0.05, 0.28, 1.54, '#2d2a26');
          break;
        case 'sign':
          cyl(list, 0.04, 0.05, 0.9, o.x, y, o.z, '#6a452d', 6);
          B(0.7, 0.36, 0.06, 0.62, '#e8d6ad');
          B(0.74, 0.04, 0.08, 0.98, '#6a452d');
          break;
        case 'statue': {
          B(0.86, 0.36, 0.86, 0, '#a19d93');
          B(0.7, 0.1, 0.7, 0.36, '#bab6ac');
          // 歯車の像
          const gy = y + 1.05;
          list.push(colored(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16), '#c8a04a', m4(o.x, gy, o.z, ry, Math.PI / 2)));
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const g = new THREE.BoxGeometry(0.16, 0.16, 0.12);
            const off = new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0);
            list.push(colored(g, '#c8a04a', new THREE.Matrix4().multiplyMatrices(m4(o.x, gy, o.z, ry), off.multiply(m4(0, 0, 0, 0, 0, a)))));
          }
          cyl(list, 0.08, 0.08, 0.6, o.x, y + 0.46, o.z, '#8a8478', 6);
          break;
        }
        case 'stairs':
          if (o.to && o.to.l > o.l) {
            // 階段: to の反対側(壁の方)へ上る6段
            const ra = Math.atan2(o.x - o.to.x, o.z - o.to.z);
            const topY = floorY(o.to.l, o.to.x, o.to.z), n = 6;
            for (let k = 0; k < n; k++) box(list, 0.84, ((k + 1) * (topY - y)) / n, 1 / n, o.x, y, o.z, k % 2 ? '#8a5d3b' : '#9c6b45', ra, 0, -0.5 + (k + 0.5) / n);
          }
          break;
        case 'exit':
          // 出口の矢印板(地面に描いた三角)
          list.push(colored(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 3), '#f4efe2', m4(o.x, y + 0.01, o.z, (o.z > Dp / 2 ? 0 : Math.PI) + Math.PI / 6 * 3)));
          break;
      }
    }
    lists.forEach((list, l) => {
      if (!list.length) { propsByLevel[l] = null; return; }
      const m = new THREE.Mesh(mergeGeometries(list), paint({ vertexColors: true, roughness: 0.8, paintAmt: 0.25 }));
      m.castShadow = m.receiveShadow = true;
      m.name = 'props_L' + l;
      root.add(m);
      propsByLevel[l] = m;
    });
  }

  // ---- 村人の駒(全員で1つの InstancedMesh) ----
  const pawnGeo = makePawnGeometry();
  const npcs = area.objects.filter((o) => o.type === 'npc');
  const NPC_COL = ['#d77a61', '#7aa6c9', '#9bc27a', '#e3b85c', '#b392cc', '#e09bb5', '#8fc7b8', '#c9a27a', '#a0a6d8'];
  const npcMesh = new THREE.InstancedMesh(pawnGeo, paint({ vertexColors: true, roughness: 0.45, paintAmt: 0.08 }), npcs.length);
  npcs.forEach((o, i) => {
    npcMesh.setMatrixAt(i, m4(o.x, floorY(o.l, o.x, o.z), o.z, rnd() * 6.28));
    npcMesh.setColorAt(i, col.set(NPC_COL[i % NPC_COL.length]));
  });
  npcMesh.castShadow = true;
  npcMesh.name = 'npcs';
  root.add(npcMesh);

  // ---- 台・作業台・巨大な道具 ----
  const bench = buildWorkbench(root, W, Dp);

  return {
    root, area, blds, buildingAt, floorY, groundMesh, wallMesh, wallItems, upperMesh, upperItems: upper, propsByLevel, npcMesh, bench,
    W, D: Dp,
  };
}

// 駒(ペグ人形)の形。頂点色: 胴 = 白(インスタンス色で塗る)、頭 = 生成り
export function makePawnGeometry({ key = false } = {}) {
  const parts = [
    colored(new THREE.CylinderGeometry(0.17, 0.24, 0.12, 14), '#ffffff', m4(0, 0.06, 0)),
    colored(new THREE.CylinderGeometry(0.13, 0.2, 0.36, 14), '#ffffff', m4(0, 0.3, 0)),
    colored(new THREE.SphereGeometry(0.17, 14, 10), '#f3e3c8', m4(0, 0.62, 0)),
    colored(new THREE.SphereGeometry(0.035, 6, 4), '#1d1a17', m4(-0.06, 0.64, 0.15)),
    colored(new THREE.SphereGeometry(0.035, 6, 4), '#1d1a17', m4(0.06, 0.64, 0.15)),
  ];
  if (key) {
    // 背中のねじ巻き(見習い人形のしるし)
    parts.push(colored(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), '#c8a04a', m4(0, 0.38, -0.2, 0, Math.PI / 2)));
    parts.push(colored(new THREE.BoxGeometry(0.22, 0.1, 0.03), '#c8a04a', m4(0, 0.38, -0.29)));
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

// ---- 作業台: ジオラマの台(断面)・カッターマット・机・巨大な道具 ----
function buildWorkbench(root, W, D) {
  const g = new THREE.Group();
  g.name = 'workbench';
  root.add(g);
  const cx = (W - 1) / 2, cz = (D - 1) / 2;
  const BASE_H = 1.8, M = 0.35;
  const deskY = -BASE_H;

  // 台の断面テクスチャ(上から: 草のフロック / 土 / 発泡材 / 合板 / 黒い額縁)
  const strata = canvasTex(64, 512, (c, w, h) => {
    const r = mulberry(5);
    const band = (y0, y1, color) => { c.fillStyle = color; c.fillRect(0, y0 * h, w, (y1 - y0) * h); };
    band(0, 0.06, '#6f9a3c');
    band(0.06, 0.3, '#7b5a3c');
    for (let i = 0; i < 400; i++) { c.fillStyle = r() < 0.5 ? '#5e432c' : '#9a7652'; c.fillRect(r() * w, (0.06 + r() * 0.24) * h, 2, 2); }
    for (let x = 0; x < w; x += 2) { c.fillStyle = '#6f9a3c'; c.fillRect(x, 0.055 * h, 2, r() * 0.03 * h); }
    band(0.3, 0.42, '#efe9dc');
    for (let i = 0; i < 120; i++) { c.fillStyle = '#d9d0bd'; c.beginPath(); c.arc(r() * w, (0.3 + r() * 0.12) * h, 1.5, 0, 7); c.fill(); }
    band(0.42, 0.9, '#a77b4f');
    for (let k = 0; k < 7; k++) band(0.42 + k * 0.068, 0.42 + k * 0.068 + 0.012, k % 2 ? '#7e5734' : '#c69a68');
    band(0.9, 1, '#2a201a');
  });
  const baseGeo = new THREE.BoxGeometry(W + M * 2, BASE_H, D + M * 2);
  // 上下の面は草の帯の色を引く
  const uv = baseGeo.attributes.uv;
  for (let f = 2; f <= 3; f++) for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, 0.5, 0.8); // 土の色(タイルのすき間に見える)
  const base = new THREE.Mesh(baseGeo, paint({ map: strata, roughness: 0.9, paintAmt: 0.25 }));
  base.position.set(cx, -BASE_H / 2 - 0.001, cz);
  base.receiveShadow = true; base.castShadow = true;
  base.name = 'base';
  g.add(base);

  // カッターマット(緑、1マス = 1cm の方眼、5ごとに太線、目盛りの数字、角度の線)
  const MW = 96, MD = 76;
  const mat = canvasTex(2048, 1622, (c, w, h) => {
    const s = w / MW;
    c.fillStyle = '#2f6a58'; c.fillRect(0, 0, w, h);
    for (let i = 0; i <= MW; i++) { c.fillStyle = i % 5 ? 'rgba(220,240,225,0.28)' : 'rgba(235,250,238,0.6)'; c.fillRect(i * s, 0, i % 5 ? 1 : 2.5, h); }
    for (let j = 0; j <= MD; j++) { c.fillStyle = j % 5 ? 'rgba(220,240,225,0.28)' : 'rgba(235,250,238,0.6)'; c.fillRect(0, j * s, w, j % 5 ? 1 : 2.5); }
    c.strokeStyle = 'rgba(235,250,238,0.45)'; c.lineWidth = 2;
    for (const a of [30, 45, 60]) { c.beginPath(); c.moveTo(w - 4 * s, h - 4 * s); c.lineTo(w - 4 * s - Math.cos(a * Math.PI / 180) * 40 * s, h - 4 * s - Math.sin(a * Math.PI / 180) * 40 * s); c.stroke(); }
    c.fillStyle = 'rgba(240,252,242,0.85)'; c.font = `bold ${Math.round(s * 0.9)}px "Barlow Condensed", sans-serif`;
    for (let i = 5; i < MW; i += 5) { c.fillText(String(i), i * s + 3, s * 1.2); c.fillText(String(i), i * s + 3, h - s * 0.4); }
    for (let j = 5; j < MD; j += 5) c.fillText(String(j), s * 0.3, j * s - 3);
    c.font = `bold ${Math.round(s * 1.6)}px sans-serif`;
    c.fillText('SELF HEALING  CUTTING MAT  A0', s * 4, h - s * 2);
  });
  const matMesh = new THREE.Mesh(new THREE.BoxGeometry(MW, 0.25, MD), paint({ map: mat, roughness: 0.75, paintAmt: 0.08 }));
  matMesh.position.set(cx + 6, deskY - 0.125, cz + 4);
  matMesh.receiveShadow = true;
  matMesh.name = 'cuttingMat';
  g.add(matMesh);

  // 机(木の天板)
  const wood = canvasTex(512, 512, (c, w, h) => {
    const r = mulberry(9);
    c.fillStyle = '#7a5537'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(${r() < 0.5 ? '50,30,18' : '150,110,75'},${0.15 + r() * 0.2})`; c.lineWidth = 1 + r() * 2; c.beginPath(); const y = r() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 20, w * 0.6, y + (r() - 0.5) * 20, w, y); c.stroke(); }
    for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(30,18,10,0.6)'; c.fillRect(0, (k * h) / 4, w, 2); }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(10, 10);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), paint({ map: wood, roughness: 0.6, paintAmt: 0.1 }));
  desk.position.set(cx, deskY - 0.26, cz);
  desk.receiveShadow = true;
  desk.name = 'desk';
  g.add(desk);

  // 巨大な道具(頂点色で1つにまとめる)
  const parts = [], lampParts = [];
  let P = (geo, color, mm) => parts.push(colored(geo, color, mm));
  const y0 = deskY;
  const P0 = P;
  P = (geo, color, mm) => lampParts.push(colored(geo, color, mm)); // ランプは影を落とさない(光そのものなので)
  // 卓上ランプ(左奥。主光の向きと合わせる)
  const lx = cx - W * 0.5 - 16, lz = cz - D * 0.5 - 12;
  P(new THREE.CylinderGeometry(5.2, 6, 1.2, 28), '#2e3a44', m4(lx, y0 + 0.6, lz));
  P(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), '#c9ced2', m4(lx, y0 + 2, lz));
  const arm = (ax, ay, az, bx, by, bz, r) => {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(r, r, len, 10);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    P(geo, '#d24a33', new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    P(new THREE.SphereGeometry(r * 1.6, 12, 8), '#c9ced2', m4(bx, by, bz));
  };
  const j1 = [lx + 3, y0 + 20, lz + 2], j2 = [lx + 13, y0 + 27, lz + 9];
  arm(lx, y0 + 2.5, lz, ...j1, 0.55);
  arm(lx + 0.8, y0 + 2.5, lz + 0.6, j1[0] + 0.8, j1[1], j1[2] + 0.6, 0.25);
  arm(...j1, ...j2, 0.5);
  // かさ(マップの方を向いた円すい)
  const shadeDir = new THREE.Vector3(cx - j2[0], -18, cz - j2[2]).normalize();
  const sq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), shadeDir);
  const sPos = new THREE.Vector3(...j2).addScaledVector(shadeDir, 3.5);
  P(new THREE.CylinderGeometry(1.5, 6.5, 7, 28, 1, true), '#d24a33', new THREE.Matrix4().compose(sPos, sq, new THREE.Vector3(1, 1, 1)));
  P(new THREE.CylinderGeometry(1.6, 1.6, 1.2, 20), '#d24a33', new THREE.Matrix4().compose(new THREE.Vector3(...j2).addScaledVector(shadeDir, 0.2), sq, new THREE.Vector3(1, 1, 1)));
  P = P0;
  // 定規(右側、マットの上)
  const rx = cx + W * 0.5 + 4.5;
  // ペン立て(右奥)
  const px = cx + W * 0.5 + 13, pz = cz - D * 0.5 - 4;
  P(new THREE.CylinderGeometry(4, 3.7, 10, 24, 1, true), '#3b4a5c', m4(px, y0 + 5, pz));
  P(new THREE.CylinderGeometry(3.7, 3.7, 0.4, 24), '#3b4a5c', m4(px, y0 + 0.2, pz));
  P(new THREE.TorusGeometry(3.85, 0.25, 6, 24), '#2a3644', m4(px, y0 + 10, pz, 0, Math.PI / 2));
  const pens = [['#e2c044', 0.25, 0.15], ['#b5523b', -0.2, 0.3], ['#2f4f8f', 0.1, -0.28], ['#2d2a26', -0.3, -0.12], ['#6c8f4f', 0.32, -0.05]];
  pens.forEach(([c, tx, tz], i) => {
    const len = 17 + i * 1.3;
    const mm = new THREE.Matrix4().compose(new THREE.Vector3(px + tx * 4, y0 + len / 2 + 0.6, pz + tz * 4), new THREE.Quaternion().setFromEuler(new THREE.Euler(tz * 0.5, 0, -tx * 0.5)), new THREE.Vector3(1, 1, 1));
    P(new THREE.CylinderGeometry(0.55, 0.55, len, i === 0 ? 6 : 12), c, mm);
    const tip = new THREE.Matrix4().multiplyMatrices(mm, new THREE.Matrix4().makeTranslation(0, len / 2 + 0.6, 0));
    P(new THREE.ConeGeometry(0.55, 1.2, 12), i === 0 ? '#f0d7a8' : '#e8e4da', tip);
  });
  // ピンセット(左手前に置きっぱなし)
  const tx0 = cx - W * 0.5 - 7, tz0 = cz + D * 0.5 + 3;
  P(new THREE.BoxGeometry(0.9, 0.35, 22), '#c9ced2', m4(tx0, y0 + 0.2, tz0, 0.5, 0, 0.0).multiply(new THREE.Matrix4().makeTranslation(0.55, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(0.04)));
  P(new THREE.BoxGeometry(0.9, 0.35, 22), '#b9bfc4', m4(tx0, y0 + 0.2, tz0, 0.5).multiply(new THREE.Matrix4().makeTranslation(-0.55, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(-0.04)));
  // プラモのランナー(右手前)
  const rnx = cx + W * 0.5 + 9, rnz = cz + D * 0.5 + 7;
  const RG = '#d8d4cc';
  P(new THREE.BoxGeometry(14, 0.5, 0.5), RG, m4(rnx, y0 + 0.25, rnz - 4.5));
  P(new THREE.BoxGeometry(14, 0.5, 0.5), RG, m4(rnx, y0 + 0.25, rnz + 4.5));
  P(new THREE.BoxGeometry(0.5, 0.5, 9.5), RG, m4(rnx - 7, y0 + 0.25, rnz));
  P(new THREE.BoxGeometry(0.5, 0.5, 9.5), RG, m4(rnx + 7, y0 + 0.25, rnz));
  P(new THREE.BoxGeometry(14, 0.35, 0.35), RG, m4(rnx, y0 + 0.2, rnz));
  for (let i = 0; i < 4; i++) {
    P(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 16), RG, m4(rnx - 5 + i * 3.3, y0 + 0.25, rnz - 2.2));
    P(new THREE.BoxGeometry(1.6, 0.4, 1.0), RG, m4(rnx - 5 + i * 3.3, y0 + 0.25, rnz + 2.2));
  }
  // 塗料のびん(左)
  const jx = cx - W * 0.5 - 8, jz = cz + 3;
  P(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 20), '#c8d6dc', m4(jx, y0 + 1.8, jz));
  P(new THREE.CylinderGeometry(2.0, 2.0, 2.6, 20), '#c0452f', m4(jx, y0 + 1.4, jz));
  P(new THREE.CylinderGeometry(2.5, 2.5, 1.0, 20), '#2a2622', m4(jx, y0 + 4.1, jz));
  P(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 20), '#c8d6dc', m4(jx + 1, y0 + 1.8, jz + 6));
  P(new THREE.CylinderGeometry(2.0, 2.0, 2.6, 20), '#e0a526', m4(jx + 1, y0 + 1.4, jz + 6));
  P(new THREE.CylinderGeometry(2.5, 2.5, 1.0, 20), '#2a2622', m4(jx + 1, y0 + 4.1, jz + 6));
  const giants = new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), paint({ vertexColors: true, roughness: 0.45, paintAmt: 0.08, side: THREE.DoubleSide }));
  giants.castShadow = giants.receiveShadow = true;
  giants.name = 'giants';
  g.add(giants);
  const lamp = new THREE.Mesh(mergeGeometries(lampParts.map((p) => (p.index ? p.toNonIndexed() : p))), giants.material);
  lamp.castShadow = false; lamp.receiveShadow = true;
  lamp.name = 'deskLamp';
  g.add(lamp);

  // 電球(光って見える)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff4d6' }));
  bulb.position.copy(sPos).addScaledVector(shadeDir, 2.2);
  bulb.name = 'bulb';
  g.add(bulb);

  // 定規(金属。目盛りのテクスチャ)
  const ticks = canvasTex(128, 2048, (c, w, h) => {
    c.fillStyle = '#c3c9cd'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f2326';
    const n = 300;
    for (let i = 0; i <= n; i++) {
      const y = (i / n) * h;
      const len = i % 10 === 0 ? 0.42 : i % 5 === 0 ? 0.3 : 0.18;
      c.fillRect(0, y, w * len, 1.6);
      if (i % 10 === 0) { c.save(); c.translate(w * 0.5, y + 4); c.font = 'bold 20px "Barlow Condensed", sans-serif'; c.fillText(String(i / 10), 0, 14); c.restore(); }
    }
  });
  const rulerGeo = new THREE.BoxGeometry(4.2, 0.28, 56);
  // 上面(+y = 面2)だけ目盛り。ほかの面は目盛りのない端の色を引く(材質1つ = 描画1回)
  const ruv = rulerGeo.attributes.uv;
  for (let f = 0; f < 6; f++) if (f !== 2) for (let k = 0; k < 4; k++) ruv.setXY(f * 4 + k, 0.97, 0.5);
  const ruler = new THREE.Mesh(rulerGeo, paint({ map: ticks, metalness: 0.55, roughness: 0.35, paintAmt: 0.05 }));
  ruler.position.set(rx, y0 + 0.14, cz + 2);
  ruler.rotation.y = 0.06;
  ruler.castShadow = ruler.receiveShadow = true;
  ruler.name = 'ruler';
  g.add(ruler);

  return { group: g, lampHead: sPos, base };
}
