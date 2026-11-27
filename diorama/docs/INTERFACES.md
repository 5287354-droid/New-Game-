# 班どうしのつなぎ目

## マップ JSON(`data/areas/<id>.json`、作るのは diorama-builder の `tools/mapgen/gen.mjs`)

Phase 1 のたたき台からの形はできるだけ保った。**変わった点・増えた点には【新】** をつけた(技術美術班・エンジニア班へ)。

```jsonc
{
  "id": "village", "name": "ネジマキ村", "kind": "town|field|dungeon", "accent": "#e0a526", "bgm": "village", "box": "village",
  "levels": [ { "w": 48, "d": 40, "y": 0, "h": [高さ…], "t": "地面の種類の文字列" } ],   // マス番号 = z*w + x。描画の高さ = (y + h) * 0.5
  "objects": [ { "id", "type", "l", "x", "z", ... } ],
  "buildings": [ { "id", "name", "l": 0, "x0", "z0", "x1", "z1", "door": {x,z}, "doors"?: [{x,z}…]【新: 2マス幅の戸口】, "roof", "upper"?: 2階のレベル, "tall"?, "attic"?【新: upper が屋根裏】 } ],
  "discs":  [ { "id", "l", "cx", "cz", "r": 4, "start", "arms": ["N","E"…]【新】, "stage"【新】 } ],    // つみき野の回転台
  "rings":  [ { "id", "l", "cx", "cz", "r1": 3, "r2": 8, "start", "spokes", "arcs", "stage" } ],     // 時計塔の外周の床
  "casters": [ ... ]【新: 影を落とす物。たたき台の shadow / canopies はやめた】,
  "lampStart": 2,                      // ランプの森だけ(0 東 / 1 真上 / 2 西)
  "groundShade": [[x,z]…]【新: 森の飾りの木陰。歩く影とは関係ない。影の魔物の出現に使う】,
  "decor": [ { "type": "flowers|backyard", "l", "x0", "z0", "x1", "z1" } ]【新: 描画だけの飾り】,
  "spawns": [ { "l", "x0", "z0", "x1", "z1", "species": [[id, 重み]…], "lv": [下, 上], "n", "cond"?: "evening|shadow|light|beat", "disc"?: 台の上に出す【新】 } ],
  "rares": [ { "id", "species", "l", "x", "z", "lv", "needs"?: ["tweezers"], "shinyRate"? } ],
  "entries": { "home": {l,x,z}, ... }, "entry": "home"
}
```

### 地面の種類 `t`

| 文字 | 意味 | 歩ける |
|---|---|---|
| g p f k d s m r B L | 草・道・床・回転台の板・土・砂・塔の石の床・敷物・橋・はしご | ○ |
| c | 谷(ランプの森)。影が落ちているときだけ歩ける(`cell()` が光の当たる谷を `C` にして返す) | 影なら○ |
| x | 何もない(描かない) | × |
| W | 壁 | × |
| w | 水 | × |
| X | 柵・積み木の山・岩(高さ 2〜4) | × |
| e【新】 | 村の外周の柵(木の台の縁)。描画の色は未定 → tech-artist | × |
| v【新】 | 塔の回廊の床の穴(橋板のくぼみのまわり、h=0) | × |

回転台・外周の床のマスは **向き0のときの形** で書いてある。今の見た目は `grid.sourcePos()` / `grid.cell()` で引く(描画は台ごとに回す)。

### 物の `type`

| type | 主な項目 | 備考 |
|---|---|---|
| chest | item, qty, needs?, cond?, note | 宝箱。`cond: 'camera'`(カメラを回すと見える)/`'camNorth'`(屋根裏、北向きのときだけ) |
| shelf | item?, qty?, flag?, book?, text, cond? | 調べる棚・本 |
| npc | name, role, model, talk[], night?: {l?,x,z} | |
| handle | disc, onDisc? | 回転台のハンドル。onDisc は台の中心(乗ったまま回す) |
| post | text, axle? | 回転台の軸・飾り・折れた文字盤 |
| dial | ring | 文字盤(外周の床を回す) |
| lampStation | — | 乗って調べる |
| item | item(物の名前), kind, size?, name | ピンセットでつまめる物。**id = item**【新】。kind: ladder plank gear block cutout wedge【新: wedge】 |
| socket | kind, size?【新】, h?, link?, flag?【新】, caster?【新】 | くぼみ。gear と cutout は置いても通れない(軸・台座) |
| pendulum | cells, period, phase, jamSocket?【新】 | 振り子(時計塔4階) |
| tree | kind, caster?【新: 影を落とす木の id】, shade? | |
| arch【新】 | caster, x1, z1 | 大枝のアーチ(描画用。影は casters) |
| clockface【新】 | needFlag, flag | 塔の6階の文字盤(エンディング) |
| stairs | to:{l,x,z}, label, up? | 両側の階の同じマスに1つずつ。着くのは to |
| exit | to, entry?, label, needFlag?, needs? | |
| goal / boss / sign / statue / bed / counter | | |

### 影を落とす物 `casters`

```jsonc
{ "id": "fo_t_valley1", "l": 0, "x": 18, "z": 29, "angle": 0, "len": 4, "wide": 2 }   // 木。幹の1つ南の列 z+1 から wide 列、光と反対へ len マス
{ "id": "fo_arch_ew", "l": 0, "kind": "arch", "angle": 1, "rects": [[20,22,22,24]] }   // angle の光のとき rects がそのまま影
```

切り絵の木のくぼみ(`socket.kind: 'cutout'`)は `caster: {angle,len,wide}` を持ち、木を立てるとそのマスから影が落ちる。

### 村のレベル

0 = 地上 / 1 = 自宅の屋根裏・村長の家の2階・宿屋の2階(y=3)/ 2 = 物置の屋根裏(y=3)。屋根裏は `buildings[].attic: true`。

## grid.js の関数(`src/core/grid.js`、three に依存しない。ゲームとソルバーで共有)

| 関数 | 中身 |
|---|---|
| `newGimmickState(area)` | はじめのギミックの状態 `gs = {disc, ring, lamp, gp, items, held}` |
| `cloneGS(gs)` / `gsKey(gs)` | 写し / 文字列の鍵 |
| `cell(area, gs, l, x, z, opt?)` | マスの今の様子 `{h, t, block, objs}`。`opt.beat` を渡すと拍の振り子がふさぐ(ゲームだけ) |
| `walkable(c)` / `canStep(a, b)` | 歩けるか / となりへ移れるか(段差1まで、はしごは何段でも) |
| `neighbors(area, gs, l, x, z, opt?)` / `findPath(area, gs, from, goalFn, maxN?, opt?)` | となり(階段を含む)/ 幅優先の道のり |
| `interactCells(area, gs, o)` | その物を調べられるマス(ふつうは4方向のとなり、`STAND_ON` は上) |
| `applyInteract(area, gs, o, player, abilities)` | ギミックを1回動かす。戻り値 `{ok, gs, player, msg, flag}`。msg: need-tweezers / hands-full / socket-full / wrong-kind / standing / empty / broken。`flag` はくぼみに置いて立つ旗(立てるのはゲーム) |
| `objPos(area, gs, o)` / `sourcePos(area, gs, l, x, z)` / `moverAt(area, l, x, z)` | 回る台の上の物の今の位置 / 今のマスの、向き0での位置 / そのマスを動かす台・輪 |
| `objectsAt(area, gs, l, x, z)` / `isPresent(area, gs, o)` / `socketContent(gs, id)` / `itemObj(area, name)` / `fits(area, name, socket)` | 物を引く |
| `shadowSet(area, gs)` / `activeCasters(area, gs)` / `casterCells(c)` | 今の影のマス(`l*1e6 + z*w + x` の Set)/ 今効いている caster / 1つの caster の影 |
| `pendulumBlocks(gs, o, beat)` | 振り子がふさいでいるか。くさびつきは、はさむまでずっと。拍は `(beat+phase)%period < period/2` の間 |
| `exitOpen(area, gs, o, flags)` | 出口が開いているか(旗、またはその旗のくぼみに物がある) |
| `resetLooseItems(gs)` / `mustDropBeforeExit(gs)` | エリアを出る・持ったまま負ける → 置いていない物は元に戻る / 出口で「部品を置いてから出よう」 |
| 定数 | `WALK` `BLOCKING` `SOLID_SOCKETS` `DIRS` `STAND_ON` `GIMMICK_TYPES` |

規則のまとめ: ランプは 東(0)→真上(1)→西(2)→東。回転台・輪は時計回りに90°、台の上の主人公と物もいっしょに回る。歯車の軸は `link:{from,to}`: 小さい歯車は1:1、大きい歯車は印 `gp` が半回転ずつ進んで2回で1回。外すと切れる(外したとき gp は0に戻る)。軸の大きさ `socket.size` と歯車の大きさが合うときだけはまる。

## ソルバー(`tools/solver/solver.mjs`)

| 関数 | 中身 |
|---|---|
| `solveArea(area, {abilities, flags, forbidTake, maxStates})` | 幅優先。`reached[id] = {type, ops, needs}`、`unreached`、`stuck`、`plan(id)` |
| `checkArea(id)` | 合否(全部届く・詰みなし・ピンセットの印・EXPECT の約束) |
| `replayPlan(area, plan)` | 手順を grid.js の規則で通しで遊ぶ(QA の通しプレイの台本に使える) |
| 手順のファイル | `tools/solver/plans/<area>.json` = `{targets: {id: {ops, steps:[{walk:[l,x,z]}, {use:id}, {exit:id}, {reach:id}]}}}` |
