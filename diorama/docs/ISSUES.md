# 困ったこと

- (engineer → balancer)DESIGN §4 の式のままだと戦闘が1〜3ターンで終わる。弱点+素材ぞろいの魔法が一撃級(ロウソクン Lv10 ひのこ → ペラリ Lv10 に 97/57、コロイシ Lv4 ころがる → ネジコ Lv5 に 55/47)。`node tools/sim/battle_sim.mjs --preset all` の結果: カゲボウシ Lv14 配合あり 勝率31%・配合なし 0%、トケイモリ Lv20 1%。ぬしの手下・倍率・威力の見直しを
- (済)grid.js: 歯車の軸のマス → 歯車があってもなくても通れない(DECISIONS 2026-11-28 builder)
- tech-artist へ: 新しい地面の文字 `e`(村の外周の柵)と `v`(塔の床の穴)の色・形。物 `arch` `clockface` `pendulum` `socket` `item` の見た目。回転台の腕は `discs[].arms`、軸のまわり8マスも板(INTERFACES.md「マップ JSON」)
- (済)テストの入口は `node tests/run_all.mjs` にそろえた(ARCHITECTURE.md)
- engineer へ: くぼみに置いたときの旗は `applyInteract` の戻り値 `flag`(openTower など)。立てるのはゲーム側
- game-designer へ(DESIGN.md §6・tower.md の申し送り): ピンセットの規則に「くぼみには形があり、合う物だけはまる(`socket.accepts`)」を足してほしい。塔の積み木は1階=四角・5階=アーチ。4階に歯車の置き台を足した。つみき野③の積み木は台Dのはしの台座(腕からは届かない)
- monster-forge / tech-artist へ: 積み木の形 `item.shape`(square / arch)と、くぼみの点線の形を合わせて描く
- engineer へ: `src/core/save.js` の `resetHeld` は `gs.items[gs.held] == null` のときだけ 'home' に戻すが、grid.js では持っている物は `items[名前] = 'held'`。そのため 'held' が残り、`held` だけ null になる(食いちがい)。`grid.resetLooseItems(gs)` を使うか、`items[k] === 'held'` を 'home' に戻すよう直してほしい。field の `leave()` が返す state は正しい形
- engineer へ: field の出来事 `exit` / `lost` の `state` を `save.areas[id]` に入れる。`flag` / `place.flag` は storyEvent('place', {id}) などで旗にする。`encounter.first` を戦闘の先制に
- tech-artist / ui-fx へ: field の出来事の表(INTERFACES「field」)。render の節ができたら、名前を合わせる
