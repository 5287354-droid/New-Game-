# 困ったこと

- grid.js: 歯車の軸のマスの通れる・通れないの扱いを、設計(DESIGN.md)に合わせて決め直す → diorama-builder
- (engineer → balancer)DESIGN §4 の式のままだと戦闘が1〜3ターンで終わる。弱点+素材ぞろいの魔法が一撃級(ロウソクン Lv10 ひのこ → ペラリ Lv10 に 97/57、コロイシ Lv4 ころがる → ネジコ Lv5 に 55/47)。`node tools/sim/battle_sim.mjs --preset all` の結果: カゲボウシ Lv14 配合あり 勝率31%・配合なし 0%、トケイモリ Lv20 1%。ぬしの手下・倍率・威力の見直しを
