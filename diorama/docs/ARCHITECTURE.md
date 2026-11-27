# 構成と持ち場(総司令官が決める)

ビルドなしの ES モジュール。`index.html` が importmap で three(`vendor/three/`)を読み、`src/main.js` から始まる。

| フォルダ / ファイル | 持ち場の班 | 中身 |
|---|---|---|
| `src/core/grid.js` `tools/mapgen/` `tools/solver/` `data/areas/` | diorama-builder | マス目とギミックの規則(three に依存しない)・マップ生成・ソルバー |
| `src/field/` | diorama-builder | フィールドの動き(主人公・経路・ギミックの見た目の動き・魔物の歩き回り) |
| `src/core/battle.js` `breed.js` `stats.js` `save.js` `inventory.js` `story.js` | engineer | 戦闘・配合・成長・セーブ・道具・進行(three に依存しない、node でテストできる) |
| `src/main.js` `index.html` `sw.js` `manifest.webmanifest` | engineer | 全体の組み立て・場面の切り替え・`window.__debug` |
| `src/render/` | tech-artist | 描画・カメラ・ティルトシフト・切り抜き・屋根・画質 |
| `tools/blender/` `assets/models/` `src/forge/` | monster-forge | 魔物のパーツと、実行時の組み立て(1体を1形状に焼く・BatchedMesh) |
| `src/ui/` `css/` | ui-fx | 組立説明書調の UI・戦闘と配合の演出 |
| `src/audio/` | sound-lab | WebAudio の曲と効果音 |
| `data/*.json`(areas 以外) | game-designer(数値は balancer が提案) | 魔物・わざ・配合・道具 |
| `tests/` | 各班が自分の持ち場のテストを置く。`node --test tests/` で全部流れる | |

- ほかの班の持ち場のファイルを直したいときは、直さずに報告に書く(総司令官が割りふる)
- 班どうしのつなぎ目(関数の形)は `docs/INTERFACES.md` に書く。作った班が書き、使う班が読む
