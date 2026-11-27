# 魔物の工房(monster-forge)Phase 1: 画風の A案・B案 と パーツの規格

2026-11-28 / ブランチ wt/forge-p2 / art-director の判定用

## まとめ

- 20種すべてを **1体 = 1形状(1描画)** に焼けるようになった(`src/forge/forge.js`)。マテリアルは全員で1つなので、フィールドは BatchedMesh で **全員1描画**
- 質感はシェーダー1本で、素材6つの表面(紙の繊維・石のざらつき・ブリキの打ち出し・布の織り目と縫い目・ロウのとろみ・インクのにじみ)、共通のガラス玉の目、きらり(真珠色+ラメ)、なじみ★2 銀線・★3 金つぎ を描く。テクスチャ画像は0枚(すべて手続き)
- **A案 = つやの強いソフビ + はっきりした差し色**、**B案 = マットな塗装フィギュア + 素材の表面を強く**。どちらも同じ形・同じ光で、`forge.material('A' | 'B')` の切りかえだけ
- 規格: トケイモリ 4,308△ → **3,112△**。20種の最大 3,172△(ネジコ)。**おさがりでどう組み合わせても 3,418△ 以下**(上限 4,000)。`build_parts.py` は **2回流して同じバイト列**
- 64px で似ていた インキー / ロウソクン を作り直し(ロウソクンを ずんぐり+大きな炎+横に出る燭台の取っ手)。カゲボウシの とんがり帽子+暗い顔 は既存IP(魔法使いのキャラクター)に寄って見えたので、シルクハットに変えた

## スクショ(docs/shots/)

| 中身 | A案 | B案 |
|---|---|---|
| ネジコ 8方向 × 5行 | `forge_A_nejiko.png` | `forge_B_nejiko.png` |
| ペラリ 8方向 × 5行 | `forge_A_perari.png` | `forge_B_perari.png` |
| コロイシ 8方向 × 5行 | `forge_A_koroishi.png` | `forge_B_koroishi.png` |
| 20種の並び(通常 / きらり) | `forge_A_all20.png` | `forge_B_all20.png` |
| 64px シルエット一覧(正面ななめ・横・色つき) | `forge_silhouette_64.png` | (形は共通) |

行は **通常 / きらり / おさがり★1 / おさがり2か所(★3 金つぎ + ★2 銀線、つなぎネジ) / きらりの親から(きらり色のまま)**。
撮り方: `cd diorama && python3 -m http.server 8103 &` → `node tools/forge_shots/shoot.cjs [絞りこみ]`。光と色はゲームと同じ `src/render/renderer.js`(画質「低」= 後処理なし)、画角 25°、見下ろし 20°。数字は `docs/shots/forge_stats.json`。

| 試作 | おさがり★1 | おさがり2か所 | きらりの親から |
|---|---|---|---|
| ネジコ | 頭 ← ツミキング「つみきの冠」(ブリキシのレシピの鍵) | 背中 ← ブリキシ「たて」★3 / しっぽ ← フェルトン ★2 | 頭 ← きらりのホタルビン |
| ペラリ | 背中 ← ネジコ「ねじ巻き」 | 頭 ← オリガラス ★3 / しっぽ ← インキー ★2 | 背中 ← きらりのワタボウシ |
| コロイシ | 背中 ← ホタルビン「ガラスの羽」 | 頭 ← ツミキング ★3 / しっぽ ← マッチボウ ★2 | しっぽ ← きらりのジャリヘビ |

## A案と B案のちがい

| 項目 | A案 つやソフビ | B案 マット塗装 |
|---|---|---|
| ねらい | 店の棚に並んだ新品のソフビ。光が回って、ふちが少し透ける | 手で塗った塗装フィギュア。素材の手ざわりが主役 |
| 下地のあらさ(roughness) | 0.32 | 0.70 |
| クリアコート(つやの上がけ) | 0.75(あらさ 0.28 = やわらかいハイライト) | 0(ロウ・インクだけ素材の分を残す) |
| 透け(ふちの明るさ)`sss` | 0.42 | 0.08 |
| 素材の表面の強さ `surf` | 0.55(近くで見ると分かる) | 1.5(遠くからでも分かる) |
| 差し色の彩度 | ×1.30(はっきり) | ×0.92(落ち着いた色) |
| ふちのドライブラシ `edge` | なし | 0.55(上を向いたふちを明るく) |
| ブリキの金属感 | 0.35 | 0.55 |
| 布の起毛(sheen) | 0.35 | 0.8 |
| 目(ガラス玉)のひとみの光 | 水色 `#5fe0ff` | 琥珀 `#ffb43c` |
| 64px での見え方 | 色の面がはっきりして、遠くで見分けやすい | 素材の差は分かるが、遠くでは色が沈む |
| 費用 | 同じ(1描画、同じシェーダー。uniform だけちがう) | 同じ |

工房としての推し: **A案**(ジオラマの塗装した木・紙・粘土の地面の上で、魔物が「人形」として浮き立つ。64px でも色で分かる)。ただし B案の素材の強さは戦闘の寄りで効くので、A案の `surf` を 0.8 前後まで上げる折衷も `createMonsterMaterial('A', { surf: 0.8 })` ですぐ試せる。

## 素材の表面(両案共通のシェーダー、`src/forge/forge.js` の FRAG_SURFACE)

| 素材 | 表面 | 作り方 |
|---|---|---|
| 紙 | 繊維の筋 + ざら紙の粒、あらめ | 3方向に引きのばしたノイズを法線で混ぜる + 細かい粒。バンプ |
| 石 | ざらつき + 黒と白のごま、いちばんあらい | fBm のバンプ + 粒のしきい値で色 |
| ブリキ | 金づちの打ち出し(浅いくぼみ)、面ごとの照り、金属 | ボロノイのくぼみをバンプ |
| 布 | 織り目 + 中心線のミシン目(生成りの糸)+ けば、起毛の sheen | sin の織り目、パーツの中心線(x=0)に点線の縫い目と溝 |
| 火(ロウ) | 下へ垂れる筋、とろみのつや、よく透ける | 縦に引きのばしたノイズ。透けとクリアコートを強制 |
| 水(インク) | にじみのしみ + ふちの濃い輪、ぬれたつや | fBm のしきい値で濃い色、しきい値の近くを輪に |
| 目(全種共通) | 暗いガラス玉、光るひとみの輪、黒いひとみ、**左上の白いハイライト + 右下の青い照り返し(向きは全種で同じ)** | 物体の正面(+Z)との角度でひとみ、視点空間の固定方向でハイライト |
| きらり | 見る角度で色がうつろう真珠色 + ラメ | 法線と視線の角度で色相を回す。物体座標のセルごとにラメ |
| なじみ★2 | パーツのつぎ目に銀の輪 + ふちの銀の光 | パーツの原点からの距離で輪、視線とのかすめ角でふち |
| なじみ★3 金つぎ | パーツ全体のひびに金がしみて光る + つぎ目の金の輪 | パーツ座標のボロノイの境目(F2−F1)を金にして発光 |

## 規格

- 座標: Blender で -Y が正面・+Z が上 → three.js で +Z が正面・+Y が上。1体の高さはだいたい 1(胴の足もとが原点)
- 胴 `body_<型>`(6型)は、子に空オブジェクト `socket_head_<型>` / `socket_back_<型>` / `socket_tail_<型>` を持つ。**名前に「.」を使わない**(GLTFLoader が消すため)。読む側は前方一致 `startsWith('socket_head')`
- パーツ `head_<種>` / `back_<種>` / `tail_<種>` は **原点 = つなぎ目**(たたき台は原点が最初の部品の位置にずれていて、ソケットの位置もずれていた。直した)
- マテリアルのスロットは `body` / `accent` / `eye` だけ。`eye` は目のガラス玉だけ(たたき台でブリキシのかぶとのすき間・トケイモリの針・カゲボウシのランタンに eye を使っていたのを accent に直した)
- 目: 全種共通で半径 0.075、左右 ±0.135、左右同じ高さ(check_parts.py が glb から測る)
- 三角形: 胴 ≤ 1000、頭 ≤ 1300、背中 ≤ 900、しっぽ ≤ 700 → **どの組み合わせでも ≤ 3,900**(実測の最悪 3,418)
- 同じ出力: bpy の球などは並列処理で面の順番が毎回変わる → 書き出す前に頂点と面を座標の順に並べ直す(`canon()`)。glTF 書き出しの dict の順番のため `PYTHONHASHSEED=0` で自分を起動し直す。UV は使わない(表面は手続き)ので書き出さない → 1.30MB → 0.73MB

## 自動チェック(`python3 tools/blender/check_parts.py --repro --write` が下を書きかえる)

<!-- check_parts:begin -->
- 対象: `assets/models/parts.glb`  735,260 バイト  sha256 `bc507eb2bbfb9d6e…`
- パーツ 66 個(胴6 + 20種×3)、三角形の合計 31,326
- 2回ビルドしたバイト列: **同じ**(`bc507eb2bbfb` / `bc507eb2bbfb`)
- 違反: **0 件**

| No | 種 | 型 | 胴 | 頭 | 背中 | しっぽ | **組み立て後** |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | ネジコ | maru | 956 | 1216 | 520 | 480 | **3,172** |
| 2 | ペラリ | shizuku | 900 | 438 | 192 | 100 | **1,630** |
| 3 | インキー | shizuku | 900 | 976 | 504 | 46 | **2,426** |
| 4 | コロイシ | maru | 956 | 416 | 140 | 60 | **1,572** |
| 5 | ワタボウシ | tori | 672 | 1286 | 600 | 300 | **2,858** |
| 6 | マッチボウ | hebi | 980 | 746 | 516 | 172 | **2,414** |
| 7 | オリガラス | tori | 672 | 366 | 16 | 12 | **1,066** |
| 8 | ジャリヘビ | hebi | 980 | 678 | 40 | 80 | **1,778** |
| 9 | フェルトン | maru | 956 | 900 | 258 | 168 | **2,282** |
| 10 | ホタルビン | tori | 672 | 768 | 520 | 188 | **2,148** |
| 11 | ゼンマイヌ | yotsuashi | 988 | 832 | 428 | 320 | **2,568** |
| 12 | ロウソクン | shizuku | 900 | 1180 | 356 | 168 | **2,604** |
| 13 | ツミキング | ningyo | 736 | 510 | 330 | 136 | **1,712** |
| 14 | カミシバイ | ningyo | 736 | 780 | 168 | 216 | **1,900** |
| 15 | ハリボテ | yotsuashi | 988 | 624 | 348 | 316 | **2,276** |
| 16 | ヒバチネコ | yotsuashi | 988 | 820 | 290 | 104 | **2,202** |
| 17 | ヌイヘビ | hebi | 980 | 696 | 36 | 228 | **1,940** |
| 18 | ブリキシ | ningyo | 736 | 730 | 336 | 154 | **1,956** |
| 19 | カゲボウシ | ningyo | 736 | 836 | 166 | 160 | **1,898** |
| 20 | トケイモリ | yotsuashi | 988 | 1008 | 572 | 544 | **3,112** |
| | 20体の合計 | | | | | | **43,514** |

おさがりで一番重くなる組み合わせ(その型の胴 + 頭の最大 1286 + 背中の最大 600 + しっぽの最大 544):

| 型 | hebi | maru | ningyo | shizuku | tori | yotsuashi |
|---|---:|---:|---:|---:|---:|---:|
| 最悪の△ | 3,410 | 3,386 | 3,166 | 3,330 | 3,102 | 3,418 |

ソケット: hebi(socket_back_hebi, socket_head_hebi, socket_tail_hebi)、maru(socket_back_maru, socket_head_maru, socket_tail_maru)、ningyo(socket_back_ningyo, socket_head_ningyo, socket_tail_ningyo)、shizuku(socket_back_shizuku, socket_head_shizuku, socket_tail_shizuku)、tori(socket_back_tori, socket_head_tori, socket_tail_tori)、yotsuashi(socket_back_yotsuashi, socket_head_yotsuashi, socket_tail_yotsuashi)

全パーツの三角形とスロット:

| パーツ | △ | スロット | パーツ | △ | スロット | パーツ | △ | スロット |
|---|---:|---|---|---:|---|---|---:|---|
| `back_burikishi` | 336 | accent/body | `back_felton` | 258 | accent/body | `back_haribote` | 348 | accent/body |
| `back_hibachineko` | 290 | accent/body | `back_hotarubin` | 520 | accent | `back_inky` | 504 | accent |
| `back_jarihebi` | 40 | accent | `back_kageboushi` | 166 | accent/body | `back_kamishibai` | 168 | accent/body |
| `back_koroishi` | 140 | accent | `back_matchbo` | 516 | accent/body | `back_nejiko` | 520 | accent |
| `back_nuihebi` | 36 | accent | `back_origarasu` | 16 | accent/body | `back_perari` | 192 | body |
| `back_rousokun` | 356 | accent | `back_tokeimori` | 572 | accent/body | `back_tsumiking` | 330 | accent/body |
| `back_watabou` | 600 | body | `back_zenmainu` | 428 | accent/body | `body_hebi` | 980 | accent/body |
| `body_maru` | 956 | accent/body | `body_ningyo` | 736 | accent/body | `body_shizuku` | 900 | accent/body |
| `body_tori` | 672 | accent/body | `body_yotsuashi` | 988 | accent/body | `head_burikishi` | 730 | accent/body/eye |
| `head_felton` | 900 | accent/body/eye | `head_haribote` | 624 | accent/body/eye | `head_hibachineko` | 820 | accent/body/eye |
| `head_hotarubin` | 768 | accent/body/eye | `head_inky` | 976 | accent/body/eye | `head_jarihebi` | 678 | accent/body/eye |
| `head_kageboushi` | 836 | accent/body/eye | `head_kamishibai` | 780 | accent/body/eye | `head_koroishi` | 416 | body/eye |
| `head_matchbo` | 746 | accent/body/eye | `head_nejiko` | 1216 | accent/body/eye | `head_nuihebi` | 696 | accent/body/eye |
| `head_origarasu` | 366 | accent/body/eye | `head_perari` | 438 | accent/body/eye | `head_rousokun` | 1180 | accent/body/eye |
| `head_tokeimori` | 1008 | accent/body/eye | `head_tsumiking` | 510 | accent/body/eye | `head_watabou` | 1286 | accent/body/eye |
| `head_zenmainu` | 832 | accent/body/eye | `tail_burikishi` | 154 | accent/body | `tail_felton` | 168 | accent |
| `tail_haribote` | 316 | accent/body | `tail_hibachineko` | 104 | accent/body | `tail_hotarubin` | 188 | accent |
| `tail_inky` | 46 | accent/body | `tail_jarihebi` | 80 | accent | `tail_kageboushi` | 160 | accent/body |
| `tail_kamishibai` | 216 | accent | `tail_koroishi` | 60 | accent | `tail_matchbo` | 172 | accent/body |
| `tail_nejiko` | 480 | accent | `tail_nuihebi` | 228 | accent/body | `tail_origarasu` | 12 | accent |
| `tail_perari` | 100 | accent | `tail_rousokun` | 168 | body | `tail_tokeimori` | 544 | accent/body |
| `tail_tsumiking` | 136 | accent/body | `tail_watabou` | 300 | accent | `tail_zenmainu` | 320 | accent/body |
<!-- check_parts:end -->

## 64px で見分けるための「決め手の形」

| 型 | 種 | 決め手 |
|---|---|---|
| まる | ネジコ / コロイシ / フェルトン | 横に張り出したねじ巻きの鍵 / 横に平たく大きな河原石(上に何も立たない) / 頭の上の2つのぽんぽん + ななめのぬい針 |
| しずく | ペラリ / インキー / ロウソクン | とがった紙のテント + はね上がった角 / 細い首とふたのインク壺 / ずんぐりのロウソク + 大きな炎 + 横の燭台の取っ手 |
| 鳥 | ワタボウシ / オリガラス / ホタルビン | 綿毛のかんむり + 玉を連ねたつばさ / 左右に大きな三角の折り羽 + 長いくちばし / 背の高いびん + うすいガラスの羽 |
| へび | マッチボウ / ジャリヘビ / ヌイヘビ | 縦長の頭 + 炎 + 背中の3本のマッチ / 平たい頭 + 背中の4本のとげ / まるい頭のつぎあて + 綿のしっぽ |
| 四つ足 | ゼンマイヌ / ハリボテ / ヒバチネコ / トケイモリ | 四角い犬の顔 + たれ耳 + うず巻きゼンマイ / 上にのびた馬の顔 + たてがみ / とがった猫耳 + 火鉢 + ひげ / 平たいヤモリの顔 + 文字盤 + 長いしっぽ |
| 人形 | ツミキング / カミシバイ / ブリキシ / カゲボウシ | 立方体の頭 + ギザギザの冠 / 横に広くうすい枠の頭 / かぶとの羽かざり + 丸いたて + 長いけん / 広いつばのシルクハット |

見直したこと(`forge_silhouette_64.png` を見て):
- インキーとロウソクンが 64px でほぼ同じ形(しずくの胴 + 上の細い出っぱり)→ ロウソクンを作り直し
- カゲボウシの「暗い顔に光る目 + とんがり帽子」は、有名なRPGの魔法使いキャラクターに寄って見えた → シルクハットに
- 既存IPのチェック(自分で一度): ロウソクのキャラクターは「白いロウ + 紫の炎 + 片目が隠れる」形に寄せないよう、色は種の色(白っぽいロウ + 橙の炎)・両目・ずんぐり・燭台つきにした。綿の鳥は「雲のつばさの青い鳥」に寄らないよう、色はピンク系の布・玉を連ねたつばさ・綿毛のかんむり。剣と盾の騎士は「剣そのものが魔物」の形を避けて、人形の胴にかぶと・たて・けん。最終判定は art-director に任せる

## 他の班への申し送り

| 班 | 中身 |
|---|---|
| engineer / diorama-builder | 魔物は `createForge()` → `forge.build(spec)` で1形状、`forge.material('A')` を全員で共有。フィールドは `forge.batch(mat)`(r160 の BatchedMesh は1形状=1体なので、同じ種が2体なら2回 add)。戦闘は `new THREE.Mesh(geo, mat)` を6体。ぬし・ボスは `geo.userData.scale`(カゲボウシ 1.35・トケイモリ 1.6)で大きく置く |
| ui-fx | 図鑑・部品表のビューアも `forge.build()` で同じ形を出せる。★2/★3 は `osagari.<場所>.star` で見た目に出る |
| scout(tools/bench) | ソケット名が `socket_head_maru` の形に変わった(前方一致なので bench.js はそのまま動く)。パーツの原点がつなぎ目になったので、bench の `p.position.set(0,0,0)` が正しい置き方になった |
| 全体 | ARCHITECTURE.md の `node --test tests/` は node 22 ではフォルダを受けつけない(`Cannot find module .../tests`)。`node --test`(引数なし)なら tests/*.test.mjs を拾う |
