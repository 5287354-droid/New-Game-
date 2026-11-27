# 困ったこと

- (engineer → balancer)DESIGN §4 の式のままだと戦闘が1〜3ターンで終わる。弱点+素材ぞろいの魔法が一撃級(ロウソクン Lv10 ひのこ → ペラリ Lv10 に 97/57、コロイシ Lv4 ころがる → ネジコ Lv5 に 55/47)。`node tools/sim/battle_sim.mjs --preset all` の結果: カゲボウシ Lv14 配合あり 勝率31%・配合なし 0%、トケイモリ Lv20 1%。ぬしの手下・倍率・威力の見直しを
- (済)grid.js: 歯車の軸のマス → 歯車があってもなくても通れない(DECISIONS 2026-11-28 builder)
- tech-artist へ: 新しい地面の文字 `e`(村の外周の柵)と `v`(塔の床の穴)の色・形。物 `arch` `clockface` `pendulum` `socket` `item` の見た目。回転台の腕は `discs[].arms`、軸のまわり8マスも板(INTERFACES.md「マップ JSON」)
- (済)テストの入口は `node tests/run_all.mjs` にそろえた(ARCHITECTURE.md)
- engineer へ: くぼみに置いたときの旗は `applyInteract` の戻り値 `flag`(openTower など)。立てるのはゲーム側
