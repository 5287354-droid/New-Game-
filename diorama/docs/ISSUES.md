# 困ったこと

- (済)grid.js: 歯車の軸のマス → 歯車があってもなくても通れない(DECISIONS 2026-11-28 builder)
- tech-artist へ: 新しい地面の文字 `e`(村の外周の柵)と `v`(塔の床の穴)の色・形。物 `arch` `clockface` `pendulum` `socket` `item` の見た目。回転台の腕は `discs[].arms`、軸のまわり8マスも板(INTERFACES.md「マップ JSON」)
- engineer へ: `node --test tests/` は node 22 ではフォルダを受けつけない。`node --test tests/*.test.mjs`(または引数なしの `node --test`)で流す
- engineer へ: くぼみに置いたときの旗は `applyInteract` の戻り値 `flag`(openTower など)。立てるのはゲーム側
