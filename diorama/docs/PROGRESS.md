# 進み具合(総司令官が段階ごとに更新)

## Phase 0 技術検証
- [x] bpy 5.3 が動き、.glb を書き出せる(総司令官が確認)
- [x] Three.js r160 を vendor/three/ に同梱
- [ ] scout: 60×48 マップを InstancedMesh で描いて renderer.info を計測、スマホ相当での確認 → docs/RECON.md
- [ ] tech-artist: ティルトシフト・手前の切り抜き・屋根が開く演出の試作とスクショ
- [ ] Blender か代わりの方法かを決める(暫定: Blender)

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
