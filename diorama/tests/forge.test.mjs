// 魔物の工房の検査: node --test tests/
// 1) parts.glb の規格(check_parts.py) 2) forge.js で20種 × おさがりの全組み合わせを焼いて、属性と三角形数を確かめる
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ブラウザの importmap と同じ読みかえ('three' → vendor/three)
const map = { three: pathToFileURL(path.join(ROOT, 'vendor/three/three.module.js')).href, addons: pathToFileURL(path.join(ROOT, 'vendor/three/addons/')).href };
register('data:text/javascript,' + encodeURIComponent(`
const m = ${JSON.stringify(map)};
export async function resolve(s, c, next) {
  if (s === 'three') return { url: m.three, shortCircuit: true };
  if (s.startsWith('three/addons/')) return { url: m.addons + s.slice(13), shortCircuit: true };
  return next(s, c);
}`));

test('parts.glb の規格(check_parts.py)', () => {
  const out = execFileSync('python3', [path.join(ROOT, 'tools/blender/check_parts.py')], { encoding: 'utf8' });
  assert.match(out, /違反: \*\*0 件\*\*/);
});

test('forge: 20種 × おさがりの全組み合わせ', async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { partsFromScene, buildMonster, TRI_LIMIT } = await import(pathToFileURL(path.join(ROOT, 'src/forge/forge.js')).href);
  const buf = readFileSync(path.join(ROOT, 'assets/models/parts.glb'));
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const lib = partsFromScene(gltf.scene);
  const mons = JSON.parse(readFileSync(path.join(ROOT, 'data/monsters.json'), 'utf8'));
  const byId = Object.fromEntries(mons.species.map((s) => [s.id, s]));
  assert.equal(Object.keys(lib.sockets).length, 6);
  let n = 0, worst = 0;
  for (const s of mons.species) {
    const g = buildMonster(lib, byId, { species: s.id });
    for (const a of ['position', 'normal', 'color', 'aMat', 'aPart']) assert.ok(g.attributes[a], `${s.id} ${a}`);
    // 目のスロット(2)がちょうど頭にある
    const am = g.attributes.aMat.array, ap = g.attributes.aPart.array;
    let eyes = 0; for (let i = 0; i < am.length; i += 4) if (am[i] === 2) { eyes++; assert.equal(ap[i + 3], 1); }
    assert.ok(eyes > 0, s.id + ' の目');
    // おさがり: 3か所すべて、ほかの19種のパーツ(★3・きらりの親も)
    for (const o of mons.species) {
      const g2 = buildMonster(lib, byId, { species: s.id, shiny: true, osagari: { head: { from: o.id, star: 3 }, back: { from: o.id, star: 2 }, tail: { from: o.id, shinyFrom: o.id } } });
      worst = Math.max(worst, g2.userData.triangles);
      assert.ok(g2.userData.triangles <= TRI_LIMIT, `${s.id}+${o.id} ${g2.userData.triangles}`);
      n++;
    }
  }
  assert.equal(n, 400);
  assert.ok(worst <= TRI_LIMIT);
});
