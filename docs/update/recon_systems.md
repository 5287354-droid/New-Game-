# ミチクサ鉄道 偵察報告: 全システムとセーブ形式

調査対象: `/home/user/new-game-`(単一HTMLのPWA)。本体 `src/game.html`(6911行・約759KB)、歩けるマップ `src/parts/overworld.js`(2911行)。
行番号は調査時点の `src/game.html` のもの。`（推測）` と書いた箇所以外は、コードを読んで確認した事実。

---

## 1. 使用技術・ビルド・ディレクトリ構成

| 項目 | 内容 | 根拠 |
|---|---|---|
| フレームワーク | なし。素のJavaScript。画面は `render()` で `innerHTML` を組み立てる | `src/game.html` 5698-5699 `const app=document.getElementById('app')`, `function render()` |
| 描画 | DOM(HTMLの文字列テンプレート) + Canvas 2D(歩けるマップ・魔生物のドット絵) | `getContext('2d')` 965, 970, 973, 1131, 4591, 5440 |
| 魔生物の絵 | 手続き描画。`painter` 873, `flatPainter` 931, `sprite(id,sil)` 962, 描画定義 `DRAW` 896 / `DRAW96` 929 | CLAUDE.md の「立体フィギュア調」方針と一致 |
| 音 | Web Audio。効果音 `SFX` 1138 / `sfx()` 1150、BGM(MML風) `SONGS` 1166 / `parseMML` 1227 / `arrange` 1249 / `thicken` 1291 / `bgmPlay` 1337 | `AudioContext` 1153, 1298 |
| 入力 | `pointerdown` 1370, 5497, 5517 / `keydown` 5510 | |
| フォント | Google Fonts(Barlow Condensed, DotGothic16, Zen Antique, Zen Kaku Gothic New) | 3-5 行 |
| 外部通信 | なし(Google Fonts 以外)。クラウド保存は `window.claude` のホスト API | 5612 `claude.use('db'|'user'|'downloads')` |
| 保存先 | `localStorage`(キー `michikusa-save-v1`) + クラウド(任意) | 5552 |
| スタイル | 同一ファイル内の `<style>` 6-650 | |
| スクリプト | 同一ファイル内の `<script>` 654-6910 | |
| 起動 | `start()` 6896 → `window.claude.hot.ready(start)` 6909(ホストがなければ直接 `start({})`) | |

### ビルド
- ゲーム本体は `src/game.html` をそのまま編集する(ビルド不要)。
- アプリ版: `python3 tools/build_app.py src/game.html .` で `index.html`・`sw.js`・`manifest.webmanifest`・`icons/` を生成(`tools/build_app.py` 全体)。`index.html` の先頭に版番号 `JG_VER` を入れる。
- 版番号は `src/game.html` の SHA-1 先頭10桁。調査時点で `index.html` の `JG_VER="a05b5f86f3"` と `src/game.html` の SHA-1 先頭10桁(`a05b5f86f3`)が一致(事実)。つまり index.html は現行の game.html から作られている。
- `tools/embed_art.py` は `art/original/*.jpg|png` を WebP 384px の data URI にして `/*ART-START*/ … /*ART-END*/` の `ART` に埋め込む。調査時点では埋め込みは空(5677行、約38バイト)。`ART[spId]` は `seal()` 5685 でのみ参照されるため、現状は実質使われていない(事実)。`art/original` には6枚(dobuchu, dokudamin, happadanuki, horobiookami, ibote, yadoridake の jpg)があるが、CLAUDE.md の通り使われていない。
- `tools/make_icons.py` はアイコン生成(Pillow 使用)。

### ディレクトリ構成
```
/home/user/new-game-
├── src/game.html            本体(単一HTML)
├── src/parts/overworld.js   歩けるマップのエンジン(game.html の一部と同じ内容のはず。3章参照)
├── index.html               アプリ版(build_app.py の生成物)
├── sw.js / manifest.webmanifest / icons/   PWA用(生成物)
├── tools/build_app.py, embed_art.py, make_icons.py
├── art/original/            魔生物の元画像6枚(未使用)
├── docs/update/             過去の作業記録(COST.md, DECISIONS.md, PROGRESS.md, before/, after/)
├── .claude/agents/          エージェント定義(scout.md など)
├── README.md, CLAUDE.md
└── .gitignore               .env, .env.*, node_modules/, *.log
```
- `package.json` なし。依存パッケージなし(事実)。

---

## 2. 全システム一覧

### 2-1. 基本データ(定数)
| 名前 | 行 | 内容 |
|---|---|---|
| `RANKS` | 657 | `['F','E','D','C','B','A','S']`。のち `RANKS.push('SS')` 1497、`RANKS.push('SSS','創世')` 2134。index 0〜9 |
| `STATS` / `STL` | 658-659 | `hp,mp,atk,def,agi,int` |
| `FAM` | 660-670 | 系統9種(beast, bird, bug, plant, aqua, soft, dragon, spirit, metal)。各 `res`(属性相性)。`myst`(？？？？系)は `FAM.myst` 1498 で後から追加、`FK.push('myst')` 1499 |
| `MIX` / `mx()` | 672-673 | 系統の配合相性。`mx()` の呼び出し31件(675-684、1500)。`MIX[a|b]` |
| `SK` | 685-754 | 技68件。`{n,mp,k(phys/mag/stat/buff/heal),t(one/all/self/ally/allies/revive),b(威力),p(物理威力),e(属性),st(状態異常[種類,確率]),next(上位技),...}` |
| `COMBOS` | 755-761 | 技の組み合わせ5件(（推測）特殊な技の連携。参照箇所は未確認) |
| `TR` | 763-792 | 特性27種。`base`(上位特性の元), `up`(両親が持つと上位化) |
| `NAT` | 793-801 | 性格8種。能力補正 `m` |
| `STN` / `STMSG` / `STTURN` | 803-805 | 状態異常5種(poison, confuse, sleep, para, blind)とターン数 |
| `ITEMS` | 806-827 | 道具19件(基本)。後から `Object.assign(ITEMS,…)` 1559, 1898, 2184 で追加 |
| `SP` / `SPL` / `S()` | 829-833 | 魔生物の登録。`S(id,name,fam,rank,glyph,motif,desc,base,skills,trait,special)`。`SP[id]`と配列 `SPL` |
| `GS()` | 2160 | ガチャ専用の魔生物(`S(…,true)` + `SP[id].gacha=true`) |

#### 魔生物データの形式(`S()` 830-833)
- `id`(英字), `name`(和名), `fam`(系統キー), `rank`(RANKS の index), `glyph`(一文字の字), `motif`(モチーフの生物名), `desc`(説明), `base`(6値 `[hp,mp,atk,def,agi,int]`), `skills`(`[[習得Lv, 技id], …]`), `trait`(初期特性), `special`(ガチャ専用フラグ)
- 件数: `S(` 141件 + `GS(` 18件 = 159体。図鑑に載るのは `dexList()` 2227 の `!s.gacha` の141体。README の「141体」と一致(事実)。
- 系統別(S): aqua 20, beast 17, bird 15, bug 16, dragon 13, metal 7, myst 12, plant 16, soft 12, spirit 13。ガチャ(GS): aqua 3, beast 4, bird 3, bug 1, dragon 3, myst 1, plant 1, soft 1, spirit 1(事実、grep集計)。
- ランク(S): A21, B22, C24, D23, E16, F12, S16, SS7。ガチャ(GS): S5, SS4, SSS4, 創世5。

#### 進化・覚醒・レア・色違い
- **一般の進化はない**。魔生物が種を変える仕組みは、覚醒の一種のみ(事実)。
  - `SP.suzaku.evo='shinsuzaku'` など四神の真の姿: 2179行(SP.suzaku, byakko, seiryu, genbu → 真・〇〇)。
  - 覚醒の処理: `awaken:` 6802。条件は `SP[m.sp].evo` があり、`m.lv>=80`、`state.items.kakusei>0`(覚醒の宝珠、ITEMS 2184、非売品 `rare:true`)。`m.sp` を入れ替え、特性 `shishin`→`sousei`。
- **技の上位化**(進化に近いもの): `SK[id].next`(例: 686 `kamitsuki`→`kamikudaku`)。（推測）習得した技を上位技に差し替えるための仕組み。
- **色違い(shiny)**:
  - 野生: `startBattle` 6340 で `1/150`。能力+1。
  - 配合: `shinyP(a,b,cat)` 6076。基本 1/40、両親とも色違い 0.7、片方 0.35、`kai`(色変わりの貝)があれば最低 0.2。
  - ガチャ: `gachaPull` 2276 で 1/40、能力+1。
  - 表示: `seal()` 5685 の `sh` で CSS `shiny`(hue-rotate)。
  - 色違いの図鑑記録: `state.shinySeen`(migrate 6894 で補完)。

### 2-2. 町・路線・駅・電車
| 項目 | 行 | 内容 |
|---|---|---|
| `TOWNS` | 1374-1405 | 町の定義配列。`{id, code('MK01'〜'MK09'), name, roma, kind, scene, sento, sentoP, desc, fields[...]}`。 |
| `_tw()` | 2532-2533, 2543 | 後から追加された町(`sango`=珊瑚島 MK08, `yomi`=黄泉ヶ原 MK09)を追加 |
| `TOWN` | 1406 | `id → 町` の辞書 |
| `TLC` | 5679 | 町ごとの路線色(`--tl` のアクセント) |
| `townOpen(t)` | 5675 | `!t.req || state.boss[t.req]`(前の町のぬしを倒すと開く) |
| `H.town` | 6747 付近 | 町を選んで移動。`state.town` を更新、`MAPS[id].station` の位置へ `state.ow` を設定 |
| 駅画面 | `renderStationIn` 5479、`wildCard` 5475 | 駅の中。「ぬしの再戦」カード(5475) |
| 電車移動の画面 | `renderTransfer` 5755 | ほかの駅への移動案内 |
| 町数 | — | 9町(MK01〜MK09)。（推測）町名の一覧は `TOWNS` 配列を参照 |

#### 町の探索先(`fields`)
- `fields` は `{id, name, scene, lv:[min,max], max(1戦あたりの最大数), table:[[魔生物id, 重み, 時間タグ?], …], req?}`。時間タグ `'n'`=夕方・夜のみ、`'d'`=朝・昼のみ(`timeOK` 1408)。
- 探索先は25前後（（推測）grep による概算）。

### 2-3. 歩けるマップ(移動・マップ・仕掛け)
- ソース: `overworld.js` と `game.html` 2620-5536 の同じブロック(3章で差分あり)。
- マップ数: `MAPS` 2657 以降に **44マップ**(町ごと: komorebi 2, kasumi 4, shiomi 4, tengu 4, mayoiga 5, ryuhyo 5, hinoshima 4, sango 4, yomi 5、（推測）数え漏れの可能性あり)。
- 定数: `TS=16`, `VW=15`, `OWSCALE=4` 2625。
- タイル: 凡例コメント 2646-2651。文字1つ=1タイル。`OW_SOLID` 2653(通れない文字)。`OW_DAY` 2627 系の色パレット、`OW_PALS` 2642(朝昼・夕方・夜で配色変更)。
- 状態: `OWC` 4585(マップの実行時状態)。保存は `state.ow` `{map,x,y,dir}`。

#### 移動の処理
| 名前 | 行 | 役割 |
|---|---|---|
| `OWD` | 5185 | 方向ベクトル |
| `owSolid` | 5186 | 通行判定 |
| `owTryMove` | 5204 | 1マス移動 |
| `owArrive` | 5225 | 到着時の処理。ワープ 5227、キノコの輪 5233-、クモの糸 `Q` 5237、**遭遇判定** 5238-5241 |
| `owTap` | 5404 | タップで目的地へ自動歩行 |
| `owFindPath` | 5391 | 経路探索(`OW_SOLID` 基準) |
| `owPathStep` | 5429 | 経路に沿って1歩 |
| `owLoop` | 5437 | `requestAnimationFrame` の描画・更新ループ |
| `owA` | 5325 | A ボタン(話す・調べる・釣り・入る) |
| `owBackToTown` | 5178 | 「駅へもどる」(B 押し2回) |
| `owTimePass` | 5276 | 120歩ごとに時間経過(`owSteps>=120` 5227) |
| `advanceTime` | 5800 | `state.time=(state.time+1)%4` |
| `TIMES` | 1064 | 朝・昼・夕方・夜 |
| `OW_DYN` | 4589 | 動く要素(扉・ゴミ箱・燭台など) |

#### 仕掛け(マップ別の主なしかけ・関数)
| 仕掛け | 関数(行) |
|---|---|
| 霞ヶ丘の信号・車 | `owPedGreen` 4840(9秒周期), `owCarsStep` 4847, `owCarHit` 4857, `owCarsHold` 4841 |
| 地下鉄トンネルの明かり | `owTorch*`/`owSaidan` 5020-5058 系、配電盤 `power` |
| 潮の満ち引き | `owTideHigh` 4580(朝・夕方が満潮), `owTimePass` 5282 |
| 釣り | `owFishStart` 5287, `owFishStep` 5292, `owFishPull` 5297 |
| ゴミ箱 | `owTrash` 5314 |
| 火ノ島の溶岩・噴火・間欠泉 | `owFlow` 4962(12秒周期), `owVent` 4963, `owGeyser` 4964(6秒), `owErupt` 4965, `owVolcStep` 4970, `owBurn` 5000, `owFallLava` 5002, `owVolcReset` 4968 |
| 火ノ島のトロッコ | `owRail` 5004, `owRideStart` 5005, `owRideNext` 5010 |
| 流氷岬の寒さ・雪 | `owColdAdd` 5249, `owWarm` 5255, `owColdBar` 5143, `owBliz` 5131(26秒周期), `owSnowFx` 5132 |
| 流氷・氷の穴・薄氷 | `owIceStep` 5080, `owIceDraw` 5112, `owThin` 5268, `owFreeze` 5260, `owFloatPos` 5066 |
| 雪崩・クレバス・崖 | `owAval` 5070, `owCrevasse` 5075, `owCliff` 5078, `owSeaFall` 5072 |
| 天狗岳の突風 | `owGust` 5160(7秒周期) |
| 天狗岳の落石 | `owRocks` 5173, `owKeepRk` 5175 |
| 鬼火の回廊 | `owSaidan` 5021, `owTorchDraw` 5058 |
| 灯籠(狐火) | `owToro` 5163, `OW_LSEQ` 5162 |
| 扉・NPC | `OW_DOOR` 4564, `owDoor` 4581, `owNpcTalk` 4552, `owFlag` 4579, `owSetFlag` 4582 |
| マヨイガの座敷わらし・お膳 | `owWarashi` 5157, `owFeast` 5158(日替わり) |
| 鏡・門・回廊の鏡 | `m.rings`(キノコの輪, 5235), `H` の `mirror`(4576) |
| 追いかけ(ぬし追跡) | `OWC.chase` 参照。`owTapLimit` 5390 |
| 霧・暗闇の見える範囲 | `owTapLimit` 5390(霧3マス等) |

- （推測）天候システムは存在しない。`grep` で天候・雨・天気の変数は見当たらない。代わりに上記の周期タイマー(信号・風・吹雪・噴火など)と、時間帯4種がある。

### 2-4. 遭遇(出会い)
| 項目 | 行 | 内容 |
|---|---|---|
| マップの遭遇タイル | `m.enc`(文字列) | 例: `enc:'T'`(草むら), `'Y'`(線路跡), `'Ty'`(雪の草むら), `'EU'`(磯と干潟)。`owArrive` 5238 で、いまのタイルが `enc` に含まれると抽選 |
| 遭遇率 | `m.rate` | マップごと(例 0.035〜0.25)。既定 `0.11`。きらきらの砂 `state.lure>0` で ×1.8 |
| 遭遇の開始 | `owEncounter(fid)` 5304 | 1〜`f.max` 体(重み 6:3:1)。時間タグで出現表を絞る。レベルは `f.lv` +`lvUp`(マップごとの上乗せ) |
| 稀な出現 | 5309-5310 | `mrate=.035`(×4 はきらきらの砂)で、1体目を特定の魔生物(町の番号で `haganetsubu` `koganetsubu` `gintachi` `nijitama` などから選ぶ。（推測）いずれもメタル系)に差し替える |
| ゴミ箱の待ち伏せ | `owTrash` 5314-5324(待ち伏せは 5320) | `r<.3` でイベント「なにかが飛び出してきた！」→ `owEncounter(owMap().field)` |
| 町の「探索する」ボタン | `explore(fid)` 6726、`H.explore` 6751 | 町の探索先からの戦闘。12%で拾い物、残り88%は**必ず戦闘**(事実)。遭遇率の概念は使わない |
| 時間帯 | `TIMES` 1064, `timeOK` 1408 | 朝・昼・夕方・夜の4段階。魔生物テーブルの時間タグ |
| 天候 | — | なし（（推測）時間帯と周期タイマーで代用） |

- 出現テーブルは `TOWNS[].fields[].table` と各マップの `fish.table`(釣り)、`orca`(クジラ・シャチ等の特殊敵)。

### 2-5. 戦闘
| 名前 | 行 | 役割 |
|---|---|---|
| `B` / `B.allies` / `B.enemies` | 5553 系 | 戦闘状態 |
| `startBattle(foes,opt)` | 6334 | 敵の生成。`opt`: `boss`, `ura`, `wild`, `trainer`, `cup`, `rival`, `tower`。野生は色違い 1/150 |
| `comb(m,side)` | 6328 | 戦闘用の状態(`st`=能力, `hp`, `mp`, `stg`=強化段階, `sts`=状態異常) |
| `renderBattle` | 6685 | 戦闘画面 |
| `cmdPanel` | 6704 | 行動メニュー |
| `setCmd` / `cmdBack` / `nextInput` | 6362-6368 | 行動入力 |
| `ai(c)` / `autoTurn` | 6371, 6369 | 味方のAI・自動 |
| `act(c,cmd)` | 6520 | 行動の実行(攻撃・技・道具・スカウト・逃走) |
| `basicAttack` | 6464 | 通常攻撃 |
| `useSkill` | 6469 | 技の処理 |
| `hitPhys` / `magDmg` | 6434 / 6453 | 物理・魔法ダメージ |
| `damage` / `heal` / `inflict` | 6404 / 6416 / 6420 | 与ダメ・回復・状態異常の付与 |
| `endTick` | 6548 | ターン終了時の状態異常の経過 |
| `runTurn(mode)` | 6579 | ターン進行 |
| `checkEnd` / `win` / `lose` | 6611 / 6617 / 6667 | 勝敗。`win` の報酬計算 6617-6640 |
| `cutIn` | 6397 | 大技のカットイン |
| `bshake` | 6403 | 大ダメージの画面ゆれ |
| `BSPD` / `wait` | 5543-5544 | 戦闘速度(ゆっくり/ふつう/はやい、`state.bspd`) |
| `ELC` | 6396 | 属性の色 |
| `lockUntil` / `battleLocked` | 6684 | 演出中の入力ロック |

#### 戦闘報酬(`win` 6617)
- 経験値: `Math.floor(3.5*lv^1.5*(1+.25*rank)*(ぬし3 / 対人1.5 / 1)*expx)`。
- 円: `floor(lv*2.5*(1+.3*rank))+rand(0-5)`(`win` 6622)。ぬし・裏のぬしは `BB.reward` を加算。
- 才能のかけら: 敵が `expx` を持つと `expx/160` の確率で `saino` を落とす(6626)。
- 育て屋(`state.daycare`)の魔生物は経験値の半分(6634-6636)。

#### 状態異常・特性
- 状態異常 5種(`STN`): 毒・混乱・眠り・マヒ・暗闇。継続 `STTURN`(4/3/3/2/3ターン)。
- 特性 `TR` 27種: 例 `houshi`(物理攻撃を受けると30%で相手を…), `koura`(物理ダメージ25%減), `shizen`(毎ターンHP6%回復)。
- 系統の属性相性は `FAM[].res`(例 bird は 雷1.5、風0.5)。`FAM` 660-670。

### 2-6. スカウト・収集
| 名前 | 行 | 内容 |
|---|---|---|
| `scoutP(t)` | 6560 | 成功率。基礎 `[.42,.34,.27,.2,.14,.08,.05,.03][rank]` × 体力が減るほど上がる(×(1+1.6*(1-HP比))) × 味方レベル比(0.6〜1.4) × おにぎり 1.6(上限 .92)。ぬし・ブリーダー戦は不可 |
| `doScout()` | 6566 | 実行。成功で `addMon`、失敗で「そっぽを向いた」 |
| `addMon(m)` | 5672 | パーティ3体まで(`state.party`)、超えたら `state.box`。初捕獲で `firstOwn` 2238 が ★1 |
| `removeMon` | 5673 | 削除 |
| 図鑑 | `renderDex` 6282、`dexList()` 2227 | 141体。`state.owned`(入手済み), `state.seen`(見た), `state.dexClaim` |
| 図鑑の報酬 | `DEX_MS` 1453 | 10, 20, 30… 体ごとの道具・円 |

### 2-7. 配合・育成
| 名前 | 行 | 内容 |
|---|---|---|
| `mx()` と `MIX` | 672-673, 675-684 | 系統の組み合わせ規則(31件) |
| `RECIPES` | 1467-1500 | 特殊配合15件。`{a, b, out, hint, cond?}`。`a`/`b` は魔生物id か `{fam, minRank}` 条件 |
| `m1(spec,m)` / `condOK` / `condText` | 5981-5990 | 条件の判定と説明文 |
| `predict(a,b)` | 6005 | 生まれる種の予想。特殊配合を優先、次に系統・血統・同種 |
| `LINEAGE_RANK` | 1875 | 血統配合の対象は B ランク以上 |
| `swapLineage` / `kidPlus` / `childPlus` | 6022-6024 | 血統配合の判定、+強化値の継承(`childPlus` = 両親の+の合計+1、金属系は+2) |
| `skillSlots` / `traitSlots` | 6025-6026 | 継承できる技・特性の枠数(技は `min(5, 2+floor(plus/4))`、特性は `plus>=8` で2) |
| `inhPool` / `resolveInh` | 6027-6033 | 技・特性の継承候補と選択 |
| `traitPool` / `finalTraits` | 6051, 6068 | 特性の継承 |
| `talRange` | 6077 | 才能値(talent)の範囲 |
| `CATS` / `CATMAX` | 6086-6087 | 配合の触媒(`tane`, `makimono`, `tsuki`, `omamori`, `kai`, `kettou`)。2つまで |
| `doBreed()` | 6227 | 実行。隔世遺伝(8%、omamori で40%)、突然変異(5%、tsuki で30%)、色違い(`shinyP`) |
| `renderBreed` / `breedRecs` | 6109 / 6097 | 配合画面 |
| 強化(+) | `plusRate` 2231, `capFor` 2233, `genBonus` 2232 | +の上限(通常 `min(250,30+plus*4)`, ガチャ系 `min(250,80+plus*3)`)。世代ボーナス `1+min(gen,10)*.015` |
| 才能の種・かけら | `saino` / `tenpu` ITEMS 1560-1561 | ステータス才能の上限アップ。`tmaxOf` 2229 は常に25 |
| 育て屋 | `state.daycare`, `careList` 5876 | 箱の魔生物を1体預ける |
| 系統の「？？？？系」 | `FAM.myst` 1498 | 配合の `mx('myst', f, 'myst')` 1500 |

### 2-8. 経済(お金・店・道具)
| 項目 | 行 | 内容 |
|---|---|---|
| 所持金 | `state.yen` | 初期 300円(`fresh()` 5555) |
| 流星石(ガチャ通貨) | `state.stars` | `addStars` 2237 |
| 店 | `renderShop` 6304 | ミチクサマート(一般道具), 配合研究所の売店(`cat:true` の触媒), 流星石の交換所(10000円で★1、1日5回 `state.xchg`), 異界の行商人(マヨイガ到達後) |
| 道具の表 | `ITEMS` 806-827 | 例: ばんそうこう 30円 HP45、ドクダミ茶 60円、駅弁 260円(全員HP80)、反魂香 2400円(たおれた味方を全快で立ち上がらせる) |
| 道具の開放 | `itemOpen(it)` 6303 | `it.open` の町に着くまで店に並ばない |
| 道具の使用 | `useItemBattle` 6509, `useItem` 操作 | 戦闘中・画面から |
| 拾い物 | `explore` 6730-6736 | 12%で、才能のかけら(マヨイガ以降5%)か円(`ri(20,60)*(町番号+1)`)か道具 |
| 売買 | `H.buy` 操作 | 店で購入 |

#### 道具の種類(`ITEMS`)
- 回復: `bansoko`, `shippu`, `tokusei`, `bannou`, `tea`, `ekiben`, `tokujou`, `drink`, `tansan`, `reisui`(hp/hpAll/mp/rev/cure で効果)。
- 戦闘補助: `onigiri`(スカウト成功率↑)。
- 配合触媒(`cat:true`): `tane`, `makimono`, `tsuki`, `omamori`, `kai`。
- 町の中: `kirakira`(きらきらの砂, `field:true`: 探索10回メタル系↑)。
- 特殊(`rare:true`): `saino`(才能のかけら 15000円相当), `tenpu`(天賦の宝珠), `kakusei`(覚醒の宝珠)。

### 2-9. 進行・クエスト・ぬし・ライバル・大会
| 項目 | 行 | 内容 |
|---|---|---|
| 物語 | `STORY` 1454-1466 | `intro`, `visit_kasumi`, `visit_shiomi`, `visit_tengu`, `boss_komorebi`〜`boss_tengu`, `cup`, `v2news` |
| ぬし | `TOWNS[].boss`, `state.boss[townId]` | 町ごとの主。`H.boss` 6758。鎮めると次の町が開く(`townOpen`) |
| 裏のぬし | `TOWNS[].ura`, `H.ura` | 町の奥地を鎮めた後に入る裏ぬし |
| 荒ぶるぬし | `H.wild`, `state.wild[townId]`(★1〜★5), `WILDRW` 6332, `wildLv` 6333, 報酬 6636-6640 | 駅から強化版に挑戦。初回の鎮圧で流星石★(n×10)と道具。★3(Lv≤60・+5)と★5(+10・色違い)でなかま化。★5の色違いは能力+1ではなく、才能は randTalent(14〜18) で生成 |
| ライバル | `RIVALS` 1413-1426, `state.rival[id]` | 町ごとの1回限りの戦闘 |
| 配合杯 | `CUPS` 1427-1433, `startCup` 5973, `cupOpen` 5799, `cupsPanel` 5802 | D〜S の大会(霞ヶ丘ドーム)。`S` は `reqBoss:'tengu'` |
| 依頼 | `REQUESTS` 1436-1452(15件), `reqMatch` 5792, `state.reqDone` | 町の人の依頼。条件を満たすと報酬 |
| 星界の塔 | `towerOpen` 2310, `towerLv` 2311 (`30+n*4`), `towerFoes` 2312, `startTower` 2324, `towerReward` 2328, `renderTower` 2329 | 5階ごとに番人(`n%5===0`)。階数の上限は未確認(`TMAX`=20 は未使用、5-3参照) |
| デイリーミッション | `MISSIONS` 2241, `dailyRoll` 2239, `missionVal` 2242, `state.daily` | 歩数300・戦闘5勝・配合1回 |
| ログインボーナス | `loginBonus` 2244, `loginCheck` 2252 | 1日★5、7日連続で★30(`5+25`) |
| 異界・四神 | `GS` 2160-2183, `BANNERS` 2235 | ガチャの対象 |
| 裏の町 | `TOWNS[].ura` / `owFlag('boss:...')` 4579 | 「ぬし」フラグで表示切替 |

### 2-10. ガチャ(星降りの祠)
- `GACHA` 2225: 1回★100(`c1:100`)、10回★1000(`c10:1000`)。確率 SSS(8)=3%、SS(7)=15%、S(6)=82%。天井 `pity:100`。
- `rollRank` 2261-2266、`gachaPull(n)` 2267(ピックアップ `curBanner().sp` を r=8 で50%、天井で必中)。
- `BANNERS` 2235: 南天・西天・東天・北天… の4種(`state.gban`)。
- 画面: `renderGacha` 2290, `renderGachaResult` 2282。
- 10連の10回目(`i===9`)は、それまでにSS以上が出ていなければ SS 以上に引き上げる(`rollRank(guar)` 2265: `if(guar&&r<7)r=7`)。
- 天井: `state.gpity` が `GACHA.pity`(100)に達すると SSS(r=8)を強制。回数 `state.gpulls`。

---

## 3. 歩けるマップの二重管理(`overworld.js` と `game.html`)

- CLAUDE.md は「`overworld.js` を変えたら `game.html` の同じ部分にも入れる」と定めている。
- 調査: `game.html` の 2620 行(`ミチクサ: 歩けるマップ`)から 5536 行(`ユーティリティ`の直前)までを抽出し、`overworld.js` と比較した。
- **差分 2か所(事実)**:
  1. `game.html` 5475-5478 に `function wildCard(t)` がある。`overworld.js` にはない。
  2. `game.html` 5479 `renderStationIn` のテンプレートに `${wildCard(t)}` が挿入されている。`overworld.js` にはない。
- 結論: 現在は `game.html` の方が新しい。`overworld.js` を正として再ビルドする場合は、この2か所を `overworld.js` へ戻す必要がある。（推測）ぬしの再戦カード(荒ぶるぬし)の追加が、`overworld.js` 側へ反映されなかったと考えられる。
- 版番号 `JG_VER` は `game.html` から作られており、`index.html` は `game.html` と一致(事実)。

---

## 4. セーブデータ形式

### 4-1. 保存場所とキー
| 項目 | 行 | 内容 |
|---|---|---|
| localStorage キー | `KEY='michikusa-save-v1'` 5552 | 1つのJSON文字列 |
| 保存 | `save()` 5556 | `state.savedAt=Date.now()`、`localStorage.setItem`、`cloudSchedule()`。例外は握りつぶす(try/catch) |
| 読込 | `load()` 5557 | `o.v===1` のときのみ返す。それ以外は `null` |
| 初期状態 | `fresh()` 5555 | 下の初期値 |
| 起動 | `start(data)` 6896 | `state = data.state || load() || fresh()`、`migrate()`、`cloudInit()`、`loginBonus` |

### 4-2. トップレベルのキー(`fresh()` 5555 + 追加分)
- 初期定義: `v:1, started:false, yen:300, items:{bansoko:3,tea:1,drink:0,onigiri:2}, party:[], box:[], uidN:1, seen:{}, owned:{}, boss:{}, town:'komorebi', breeds:0, time:1, steps:0, reqDone:{}, cups:{}, rival:{}, flags:{}, shinySeen:{}, dexClaim:{}, sound:false, lure:0, daycare:[]`
- 実行中に追加されるキー(grep による `state.*` の使用一覧): `ow`(`{map,x,y,dir}`), `owItems`, `owFlags`(マップのフラグ), `owRk`(岩の位置), `owFilled`(埋めた穴), `owFails`, `owTrash`(ゴミ箱の日付), `owCold`(寒さ), `owTorch`(火種), `owFire`(焚き火), `owWara`, `owLay`, `owFeast`(日替わり), `stars`(★), `gpity`, `gpulls`, `gban`(ガチャの対象), `bgm`, `bgmVol`, `bspd`(戦闘速度), `login{last,streak}`, `daily{d,ex,win,br,got}`, `xchg`(交換の日付と回数), `wild{townId:n}`, `tower`, `savedAt`, `owSteps`, `steps`, `time`(0〜3), `town`。
- 注意: `state.v` は常に `1`(セーブ形式の版番号)。

### 4-3. 魔生物1体の形(`newMon` 5649)
```
{ uid, sp(魔生物id), lv, exp, plus(+強化値), nature(性格id), talent{hp,mp,atk,def,agi,int},
  bonus{...}, skills[技id…](最大10), traits[特性id…], parents(親のノード・null可),
  gen(世代), shiny(色違い), lin(血統フラグ, 任意), nick(ニックネーム, 任意) }
```
- 親の情報は `trimNode`/`nodeOf` 6084-6085 で `{sp, plus, sh, p}` に縮めて保存。

### 4-4. 移行処理(マイグレーション)
- `migrate()` 6885(`start` と `adoptState` から呼ばれる)。
  - 古い親の形式 `par` を `parents` の形式へ変換(6886 `fix`)。
  - 魔生物の `gen` が無ければ 0 または 1 を入れる。
  - 欠けた既定値を埋める: `time:1, steps:0, reqDone:{}, cups:{}, rival:{}, flags:{}, shinySeen:{}, dexClaim:{}, sound:false, lure:0, daycare:[]`。`bgm`, `stars` も。
  - 一度だけの処理: `flags.star20`(流星石の数を÷20 に変更、`ui.starMig` で案内 6905 付近)。
  - `shinySeen` を既存の色違いから補完。
  - `started` のとき `flags.intro=true`。
- `start()` 6896 の中で、`flags.v2`(新しい話の表示と `gachaRetro`)と `flags.gacha` のフラグを見て、一度だけの案内を出す。
- **バージョン番号による移行は存在しない**。`state.v` は常に 1。移行は「欠けていたら足す」形の追記型。

### 4-5. 引き継ぎコード・ファイル保存
- `saveCode()` 5745: `'MKR1:' + base64(UTF-8 の JSON)`。
- `readCode(s)` 5746: `{` で始まる JSON ファイル、または `MKR1:` のコードを読む。どちらも `v===1` と `party` 非空を確認。
- 画面: `renderTransfer` 5755、`makeCode`/`copyCode`/`importAsk`/`importCode` 6782、`fileSave` 6779(ダウンロード `michikusa-save-…`)。

### 4-6. クラウド保存(claude.ai ホスト API、任意)
- 初期化 `cloudInit` 5612: `window.claude.use('db'|'user'|'downloads')` が無ければ `CLOUD.status='off'`。ユーザー ID で `data/users/{uid}/main` を読み込む。
- 保存先: `cloudRef(k)` 5576 → `data/users/{uid}/main`(本体)、`data/users/{uid}/backup`(手動バックアップ、`bkSave` 6776 / `bkLoad` 6777)。
- 書き込み `cloudWrite(key)` 5587: `{v:1, savedAt, town, breeds, dex(図鑑の数), z(gzip+base64) または s(JSON 文字列)}`。`packState` 5564 は `CompressionStream('gzip')` があれば圧縮。`unpackState` 5569 で展開。
- 送信 `cloudPush` 5591: 失敗時は 30秒後に再試行。`CLOUD.status` は `ok`/`saving`/`readonly`(invalid_argument)/`full`(quota)/`off`/`error`。
- 読込の採否 `cloudInit` 5612-5625: 未開始の端末か、クラウドの `savedAt` が端末より1秒以上新しいときに `adoptState`(5606)でクラウドの内容を採用。
- 同期の契機: `save()` の `cloudSchedule()`(5583)、`visibilitychange` 5632(隠れるとき即時保存、戻ると `loginCheck`)。
- `IS_APP`(5560): アプリ版(`window.JG_APP`)かどうか。

### 4-7. セーブ形式の注意点（事実 / 推測）
- 事実: `load()` 5557 と `readCode()` 5746 は `v!==1` のデータを**拒否**する。将来 `v` を2に上げると、既存の localStorage は `load()` で `null` になり、新規(`fresh()`)として始まる。その後の `save()` で上書きされる。
- 事実: 版を上げるための移行チェーンはない。
- （推測）形式を変えるときは、`load()`・`readCode()`・`cloudInit` の `o.v` の判定を同時に直し、`migrate()` に移行を足す必要がある。CLAUDE.md の「セーブデータ互換を壊さない(変える場合は移行処理とテスト)」に従うには、テスト自体が無いので作る必要がある。

---

## 5. テストの有無・TODO・既知の不具合らしき箇所

### 5-1. テスト
- テストファイルなし。`package.json` なし。CI 設定なし(事実: `find` で `*test*`, `*.spec.*`, `package.json`, `playwright*` を探して0件)。
- CLAUDE.md は「行けない場所・詰む状態がないことは、ソルバーやテストで必ず確かめる」と定めているが、リポジトリにソルバーもテストも見当たらない(事実)。

### 5-2. TODO / FIXME
- コード中に `TODO`, `FIXME`, `XXX`, `HACK` は見つからなかった(事実)。日本語の「未実装・暫定・要確認」も該当なし(事実)。

### 5-3. 不具合らしき箇所・整合性の問題
1. **`overworld.js` と `game.html` のずれ**(3章): `wildCard` が `overworld.js` に無い。CLAUDE.md の同期ルールに反する状態。
2. **`TMAX` は未使用の定数**: `const TMAX=20;` 1501 のみ参照(事実)。才能の上限は `tmaxOf(m)` 2229 が常に `25` を返す。`TMAX` を使う意図があったかは（推測）不明。
3. **色違いの才能加算の上限が箇所ごとに違う**: ガチャ 2276 は色違いで各能力+1(上限17)、野生 6340 は+1(上限15)。荒ぶるぬし★5の色違い 6638 は+1を行わず、才能を `randTalent(14,18)` で生成する。（推測）意図的な差。
4. **町の「探索する」は遭遇率を使わない**: `explore()` 6726-6745 は、12%の拾い物以外は必ず戦闘になる(事実)。マップ上の草むら遭遇(`owArrive` 5238)とは仕組みが別。（推測）町の探索ボタンの仕様として意図的かは不明。
5. **`load()` の `v!==1` 判定**(4-7): 形式変更時に既存セーブが読めなくなる設計。
6. **`RANKS.indexOf(rank)` の未知のランク**: `S()` 831 は未知のランク文字列で `-1` を入れる(事実)。`RANKS.push` の順番(1497, 2134)に依存しており、順番を変えると壊れる。
7. **`COMBOS` の参照先が未確認**: 755-761 の5組み合わせは、grep では定義以外の利用が見つからなかった(（推測）未使用か、別名で参照)。
8. **`ART` は空**: 5677 の `ART` は空で、`art/original` の6枚は埋め込まれていない。`seal()` 5685 の画像分岐は現状いつも通らない(事実)。CLAUDE.md の方針(外部画像を混ぜない)とは整合する。

---

## 6. 参考: 主要な識別子の索引

| 目的 | 識別子(行) |
|---|---|
| 魔生物の登録 | `S()` 830, `GS()` 2160, `SP`, `SPL`, `dexList()` 2227 |
| 系統・ランク | `FAM` 660, `FAM.myst` 1498, `RANKS` 657 |
| 技・特性・性格 | `SK` 685, `TR` 763, `NAT` 793, `STN` 803 |
| 道具 | `ITEMS` 806 (+1559, 1898, 2184) |
| 町・探索先 | `TOWNS` 1374, `_tw` 2532, `TOWN` 1406, `townOpen` 5675 |
| マップ | `MAPS` 2657, `owTryMove` 5204, `owArrive` 5225, `owLoop` 5437 |
| 遭遇 | `owArrive` 5238-5241, `owEncounter` 5304, `explore` 6726 |
| 戦闘 | `startBattle` 6334, `act` 6520, `runTurn` 6579, `win` 6617 |
| スカウト | `scoutP` 6560, `doScout` 6566, `addMon` 5672 |
| 配合 | `RECIPES` 1467, `MIX` 672, `predict` 6005, `doBreed` 6227 |
| 色違い | `startBattle` 6340, `shinyP` 6076, `gachaPull` 2276 |
| 経済 | `state.yen`, `renderShop` 6304, `explore` 6730 |
| ガチャ | `GACHA` 2225, `gachaPull` 2267, `BANNERS` 2235 |
| クエスト・進行 | `STORY` 1454, `REQUESTS` 1436, `RIVALS` 1413, `CUPS` 1427, `MISSIONS` 2241, `loginBonus` 2244 |
| 保存 | `KEY` 5552, `fresh` 5555, `save` 5556, `load` 5557, `migrate` 6885, `start` 6896 |
| 引き継ぎ・クラウド | `saveCode` 5745, `readCode` 5746, `cloudInit` 5612, `cloudWrite` 5587, `cloudPush` 5591 |
| 画面 | `render` 5699, `renderTab` 5739, `renderMap` 5805, `renderBreed` 6109, `renderDex` 6282 |
| 起動 | `start(data)` 6896 |

---

## 7. 調査の範囲と限界
- `game.html` の全行は読んでいない。grep で識別子・行番号を特定し、必要な範囲だけを読んだ。
- 各マップの細かな仕掛け(2620〜4560行)は、関数名と分類の一覧にとどめた。1マップずつの座標・タイル配置は未調査。
- `docs/update/before/errors.txt` と `docs/update/before/agents/*.md` は未読。
- `COMBOS`・`TMAX` の利用箇所は grep の結果のみで判断した(（推測）を付けた)。
- 出現表の全種類と重みは、`TOWNS` と各マップの `table` を読んで確認するのがよい(本書では件数のみ)。
- 作業ディレクトリ外の一時ファイルは scratchpad(`/tmp/claude-0/-home-user/8830a8dd-a147-5add-ba52-f0f313625f50/scratchpad/`)に作成した。プロジェクトへの変更は本書の追加のみ。git commit はしていない。
