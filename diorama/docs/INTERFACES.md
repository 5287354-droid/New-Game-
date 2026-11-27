# 班どうしのつなぎ目(関数の形)

作った班が書き、使う班が読む(ARCHITECTURE.md)。

## forge(monster-forge / `src/forge/forge.js`)

```js
import { createForge, SPECIES_SCALE, TRI_LIMIT } from './forge/forge.js';

const forge = await createForge({ url: 'assets/models/parts.glb', monsters });   // monsters = data/monsters.json の中身
// gltf を読み終えているなら createForge({ gltfScene: gltf.scene, monsters })

const geo = forge.build({
  species: 'nejiko',            // 種の id
  shiny: false,                 // きらり(色違い)
  osagari: {                    // おさがりパーツ(どれも省略できる)
    head: 'tsumiking',                                   // 種 id だけ → ★1、子の色で塗り直す
    back: { from: 'zenmainu', star: 3 },                 // star 1..3(★2 銀線 / ★3 金つぎ)
    tail: { from: 'hotarubin', shinyFrom: 'hotarubin' }, // きらりの親のパーツ → その種のきらり色のまま
  },
});
// geo: THREE.BufferGeometry(index つき・1体 = 1形状 = 1描画)
//   属性 position / normal / color(素材の色, linear) / aMat(vec4: スロット 0体 1差し色 2目, 素材, ★, きらり) / aPart(vec4: パーツ内の位置, 場所 0胴 1頭 2背中 3しっぽ)
//   geo.userData = { species, shiny, parts: {head, back, tail: 付けている種}, triangles, height, scale }
//   原点 = 足もとの中心。+Z が正面、+Y が上。高さはだいたい 1。ぬし・ボスは userData.scale 倍で置く

const mat = forge.material('A');          // 'A' つやソフビ / 'B' マット塗装。全員で1つを共有(同じ文字なら同じ物が返る)
scene.add(new THREE.Mesh(geo, mat));      // 戦闘・図鑑: 1体 1 Mesh

const batch = forge.batch(mat, { max: 24 });   // フィールド: BatchedMesh 1つ = 全員で1描画
scene.add(batch.mesh);
const id = batch.add(geo, matrix4);       // r160 は 1形状 = 1体(同じ種が2体なら2回 add)
batch.move(id, matrix4); batch.show(id, false); batch.remove(id);

forge.triangles('head_nejiko');           // パーツの三角形数
mat.userData.uniforms.uTime.value = t;    // (予約。今は使っていない)
```

- 低いレベルの関数も export している: `loadParts(url)` `partsFromScene(scene)` `buildMonster(lib, speciesById, spec)` `createMonsterMaterial(style, over)` `createMonsterBatch(material, opts)` `palette(sp, shiny)`
- 規格: 1体 ≤ `TRI_LIMIT`(4000)△。どのおさがりの組み合わせでも超えない(`tests/forge.test.mjs` で 20×20 を確かめる)
- 影はふつうの `castShadow` / `receiveShadow` でよい(頂点を動かしていないので、影のマテリアルの差しかえは要らない)
- 焼くのは「組み上がったとき」に1回(配合・スカウト・読みこみ時)。毎フレーム焼かない
