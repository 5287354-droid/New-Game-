# 進み具合(総司令官が段階ごとに更新)

## Phase 0 技術検証
- [x] bpy 5.3 が動き、.glb を書き出せる(総司令官が確認)
- [x] Three.js r160 を vendor/three/ に同梱
- [x] scout: 計測 → docs/RECON.md(工夫後 描画23回・13.4万△・2.64MB。魔物は1体を1形状に焼いて BatchedMesh)
- [x] tech-artist: src/render/ 7部品、tools/proto/render.html → docs/RECON_RENDER.md(最大 8.4万△・49回)
- [x] Blender に決定
- 宿題: トケイモリ 4,308△ を 4,000 以下に / build_parts.py の出力を毎回同じにする(monster-forge)

## Phase 1 作戦立案
- [ ] game-designer: docs/DESIGN.md、docs/maps/*.md、わざ表・配合表の確定
- [ ] art-director: docs/ART_BIBLE.md(魔物の試作3体で A案・B案)
## Phase 2 量産 / Phase 3 統合 / Phase 4 検証 / Phase 5 納品
- [ ] (Phase 1 のあとに割りふる)

## たたき台(総司令官が軍隊方式に切りかえる前に作ったもの。Phase 1 で各班が見直す)
- tools/blender/build_parts.py → assets/models/parts.glb(胴6 + 20種×3パーツ)
- data/monsters.json, skills.json, breed.json, items.json
- src/core/grid.js(マス目とギミックの規則。ゲームとソルバーで共有)
- tools/mapgen/gen.mjs → data/areas/*.json(4エリア)
