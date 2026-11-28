# 困ったこと

- grid.js: 歯車の軸のマスの通れる・通れないの扱いを、設計(DESIGN.md)に合わせて決め直す → diorama-builder
- [済 → docs/BALANCE.md](engineer → balancer)DESIGN §4 の式のままだと戦闘が1〜3ターンで終わる。弱点+素材ぞろいの魔法が一撃級(ロウソクン Lv10 ひのこ → ペラリ Lv10 に 97/57、コロイシ Lv4 ころがる → ネジコ Lv5 に 55/47)。`node tools/sim/battle_sim.mjs --preset all` の結果: カゲボウシ Lv14 配合あり 勝率31%・配合なし 0%、トケイモリ Lv20 1%。ぬしの手下・倍率・威力の見直しを
- (balancer → engineer / diorama-builder)最初の1体の Lv を 5 に、野生の群れの数を 1〜3体(つみき野の入口は1体だけ)にしてほしい。割合と出現 Lv の案は docs/BALANCE.md §5(areas は作り直し中なので balancer は直していない)
- (balancer → engineer)式の形の案(変えていない): ①野生の敵の AI を「期待ダメージ最大を7割」→5割に ② A²÷(A+D) はまもりが高い相手に弱い攻撃役が何もできない形。A×A÷(A+2D)×3 などを検討 ③回復わざが終盤に強すぎたら TUNE.healDiv 40→60。くわしくは docs/BALANCE.md §6
