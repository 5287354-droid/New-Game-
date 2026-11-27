# 偵察報告 Phase 0 技術検証(scout)

2026-11-28 / ブランチ wt/scout-p0 / 計測ページ `tools/bench/bench.html`

## まとめ

- **パーツをそのままつなぐと、魔物20体だけで描画 155 回**(1体 6〜9 回)。地面・物と合わせて本描画 171 回で、**上限 150 を超える**
- 1体を頂点色つきの1ジオメトリに焼く(merged)と本描画 36 回、`BatchedMesh` で全員を1回にまとめる(batched)と 17 回。見た目の差は目では分からない(スクショ比較)
- **三角形**: 魔物は 1体 平均 2,777 / 最大 4,308(トケイモリ)、20体で 55,546。**上限 15万 の 37%**
- 地面を「角を丸めた箱 × 2,880 マス」の InstancedMesh にすると地面だけで 86,400 △。本描画 145,198 △ で上限ぎりぎり。隠れる側面を省いた1枚メッシュにすると地面は約 8,300 △ になり、本描画 67,138 △
- **r160 の `renderer.info` は影の描画を数えない**(`shadowMap.render()` のあとで `info.reset()` している)。影こみで数えると三角形・描画回数ともほぼ2倍
- 読みこみ合計 2.64MB(上限 15MB の 18%)。初期化(読込→初描画)は 160〜460ms(ヘッドレス・ソフトウェア描画)

## 環境

| 項目 | 値 |
|---|---|
| ブラウザ | Google Chrome for Testing 153.0.8010.12(`/usr/bin/google-chrome`、ヘッドレス) |
| Playwright | 1.63.0(node の `require('playwright')`) |
| GPU | `ANGLE (Mesa, Vulkan 1.4.335 (llvmpipe (LLVM 20.1.2 256 bits)), llvmpipe)` = CPU のソフトウェア描画 |
| WEBGL_multi_draw | あり(BatchedMesh が1回の呼び出しになる) |
| Three.js | r160(`vendor/three`) |
| bpy | 5.3.0 |

## 試したコマンドと結果

```sh
# 配信(ポート 8101)
python3 -m http.server 8101 --directory /home/claude/wt/scout/diorama
# 計測(20 ケース、スクショと JSON)
node diorama/tools/bench/run_bench.cjs diorama/tools/bench/results.json
```

- 1回目: 魔物のパーツがほぼ全部 `missing` になった。原因は、GLTFLoader が **マテリアルが2つ以上あるパーツを `Group`(子 Mesh が `head_nejiko_1`, `_2` …)にする**ため、`isMesh` で集めると頭などが抜けること。`gltf.scene.children` を名前で引くように直した
- 1回目: 影の三角形・描画回数が 0 と出た。原因は上の `info.reset()` の順番(three.module.js 29594 行 `shadowMap.render`、29600 行 `info.reset`)。`renderer.info.autoReset = false` にして自分で `reset()` してから描くと、影こみの数字が取れる(`bench.js` の `measure()`)
- ソケット名は glb では `socket_back.004` のように番号つき。GLTFLoader は `.` を消すので `socket_back004` になる。**`startsWith('socket_back')` で探す必要がある**
- `python3 tools/blender/build_parts.py /tmp/scout_parts.glb` → 3.07 秒で書き出し成功(glTF 書き出し 0.22 秒)。ただし **出力 1,308,636 バイトで、リポジトリの parts.glb(1,302,712 バイト)と一致しない**(スクリプトがコミット後に変わったか、出力が毎回同じにならない（推測）)
- コンソールの警告は `GPU stall due to ReadPixels`(スクショ時、ソフトウェア描画由来)だけ。ページのエラーは 0

## 数字の表

条件: マップ全体が画面に入る距離(最悪の場合)、画角 25°、影 PCFSoft 2048² 1枚、魔物 20 種を 1 体ずつ。
「本」= `renderer.info` そのまま(影なし)、「影」= 影マップの描画、「計」= 両方。上限は 三角形 150,000 / 描画 150。

| ケース | 魔物 | 地面 | 本△ | 影△ | 計△ | 本 描画 | 影 描画 | 計 描画 |
|---|---|---|---:|---:|---:|---:|---:|---:|
| naive_inst | パーツのまま | 箱 Instanced | 145,198 | 122,536 | 267,734 | **171 ×** | 169 | 340 |
| naive_inst (影なし) | パーツのまま | 箱 Instanced | 145,198 | 0 | 145,198 | **171 ×** | 0 | 171 |
| merged_inst | 1体1メッシュ | 箱 Instanced | 145,198 | 122,536 | 267,734 | 36 | 34 | 70 |
| batched_inst | BatchedMesh | 箱 Instanced | 145,198 | 122,536 | 267,734 | 17 | 15 | 32 |
| merged_merged | 1体1メッシュ | 1枚メッシュ | 67,138 | 67,126 | 134,264 | 31 | 30 | 61 |
| **batched_merged** | BatchedMesh | 1枚メッシュ | **67,138** | 67,126 | **134,264** | **12** | 11 | **23** |
| naive_inst (寄り) | パーツのまま | 箱 Instanced | 119,434〜129,506 | 122,536 | 241,970〜252,042 | 98〜123 | 169 | 267〜292 |
| batched_merged (寄り) | BatchedMesh | 1枚メッシュ | 41,862〜53,044 | 67,126 | 108,988〜120,170 | 11 | 11 | 22 |

- 縦 390×844 / 横 844×390、dpr 1 / 2 で、三角形と描画回数は**同じ**(全体表示のとき)。寄りは縦横で画面に入る魔物の数が変わる(範囲は 縦〜横)
- 影の描画は、影カメラがマップ全体を覆うので、寄っても減らない
- 内訳: 地面(箱)86,400 △ = 30 △ × 2,880 マス / 地面(1枚)約 8,300 △ / 物(木14・宝箱9 など41個)3,240 △ / 台 12 △
- 描画の内訳(naive): 魔物 155 + 地面の種類 6(g p k B X w)+ 物の種類 9 + 台 1 = 171

### 初期化の時間(ms、ヘッドレス・llvmpipe)

| ケース | 縦 dpr1 | 横 dpr1 | 縦 dpr2 | 横 dpr2 |
|---|---:|---:|---:|---:|
| naive_inst | 328 | 232 | 218 | 242 |
| batched_merged | 387 | 306 | 439 | 427 |

読込(fetch+glb 解析)は 56〜81ms、組立は naive 46〜69ms / batched 136〜216ms(焼き込みの分)、初描画(シェーダーのコンパイル込み)は 90〜176ms。実機の GPU では初描画の比率が変わる（推測）。

### 魔物1体あたり(パーツをつないだ状態)

| 種 | 型 | △ | 描画単位 |
|---|---|---:|---:|
| ネジコ | まる | 3,492 | 7 |
| ペラリ | しずく | 1,918 | 7 |
| インキー | しずく | 3,664 | 7 |
| コロイシ | まる | 2,144 | 6 |
| ワタボウシ | 鳥 | 2,946 | 7 |
| マッチボウ | へび | 3,348 | 9 |
| オリガラス | 鳥 | 1,110 | 7 |
| ジャリヘビ | へび | 2,816 | 7 |
| フェルトン | まる | 2,680 | 7 |
| ホタルビン | 鳥 | 2,682 | 7 |
| ゼンマイヌ | 四つ足 | 3,100 | 9 |
| ロウソクン | しずく | 2,788 | 7 |
| ツミキング | 人形 | 1,894 | 9 |
| カミシバイ | 人形 | 1,960 | 8 |
| ハリボテ | 四つ足 | 2,792 | 8 |
| ヒバチネコ | 四つ足 | 3,920 | 9 |
| ヌイヘビ | へび | 2,812 | 7 |
| ブリキシ | 人形 | 2,616 | 9 |
| カゲボウシ | 人形 | 2,556 | 9 |
| トケイモリ | 四つ足 | 4,308 | 9 |
| **20体の合計** | | **55,546** | **155** |

### 読みこんだファイル(Resource Timing の encodedBodySize)

| ファイル | バイト |
|---|---:|
| vendor/three/three.module.js | 1,272,972 |
| assets/models/parts.glb | 1,302,712 |
| vendor/three/addons/loaders/GLTFLoader.js | 108,522 |
| vendor/three/addons/utils/BufferGeometryUtils.js | 31,906 |
| tools/bench/bench.js | 約 20,000 |
| data/areas/tsumiki.json | 13,651 |
| data/monsters.json | 13,659 |
| bench.html | 954 |
| **合計** | **2,763,993(2.64MB)** |

gzip にすると three.module.js 257,886 / parts.glb 399,626 バイト(`gzip -c | wc -c`)。

## 上限に対する余裕

| 項目 | 上限 | いちばん良い組み方(batched_merged) | 余裕 | パーツのまま + 箱の地面(naive_inst) |
|---|---:|---:|---:|---:|
| 三角形(本描画) | 150,000 | 67,138 | 55% 残り | 145,198(3% 残り) |
| 三角形(影こみ) | 150,000 | 134,264 | 10% 残り | 267,734(超過) |
| 描画(本描画) | 150 | 12 | 92% 残り | 171(超過) |
| 描画(影こみ) | 150 | 23 | 85% 残り | 340(超過) |
| 読みこみ | 15MB | 2.64MB | 82% 残り | 同じ |

## 問題点

1. **パーツのままでは描画回数が上限を超える。** 原因は、1体が胴・頭・背中・しっぽ × マテリアル(body/accent/eye)で 6〜9 個のプリミティブに分かれること。**マテリアルを共有しても描画回数は減らない**(減るのはシェーダーの切り替えだけ。three.js はプリミティブごとに1回描く)
2. **`renderer.info` の数字は影を含まない。** 仕様の「`renderer.info` で測る」をそのまま実装すると、影のぶん(ほぼ同じ量)が見えない。上限の判定に影を入れるかを決める必要がある
3. 角を丸めた箱を全マスに置くと、地面だけで三角形 86,400(上限の 58%)。見えない側面と、水面の下の柱まで描いている
4. glb のマテリアルが全部 `doubleSided: true`。ソフビの閉じた形なら片面で足り、ピクセルの負担と影のにじみ(影のアクネ)が減る（推測）
5. BatchedMesh(r160)は1つの形を1回しか置けない(`addGeometry` = 1体。同じ種を複数置く `addInstance` は r166 から)。同じ種が2体なら形を2回入れることになる
6. 焼き込み(merged / batched)では、目のガラス玉のつや(roughness 0.05)と胴のつや(0.35)の差が消える。今回のスクショでは差は分からないが、寄りの戦闘画面では目立つかもしれない（推測）
7. 全体表示ではマップ 60×48 がスマホ縦で幅 340px ほどになり、魔物は数ピクセル。遊ぶときは寄った視点が前提(`?cam=near` のスクショ)

## 提案

- **魔物は「1体 = 1ジオメトリ(頂点色)」に焼いて、フィールドは BatchedMesh 1つ、戦闘(3対3 = 6体)は1体1メッシュ** にする。焼くのは配合で組み上がった時に1回だけ。パーツ受けつぎ(配合)は焼く前のパーツ選びで表せる
- 目のつやを残したいときは、目だけを別の共有マテリアルにする(1体2回 or BatchedMesh 2つ)。あるいは頂点属性に roughness を入れて `onBeforeCompile` で読む(1回のまま)
- **地面は、エリアごとに「隠れる面を省いた1枚のメッシュ」を作る**(回転台は台ごとに1メッシュにして回す)。面取りは上面の縁だけ、外から見える辺だけに付ける。今回の1枚メッシュ(面取りなし)は地面 約 8,300 △
- 影: 水・地面の上面は `castShadow=false` にし、影を落とすのは段差・物・魔物だけにする。影カメラを主人公の周り(例 ±16 マス)に絞って毎フレームではなく動いたときだけ更新すれば、影の描画はさらに減る（推測）
- 上限の判定は「影こみの合計」で行う。計測は `bench.js` の `measure()` と同じく `info.autoReset=false` → `reset()` → `render()` で取る
- 画質「低」= 影なし・dpr 1、「中」= 影 1024²・dpr 1.5、「高」= 影 2048²・dpr 2 を出発点にする（推測。実機で確かめる）
- 読みこみには余裕が大きい(残り 12MB)。parts.glb は gzip で 30% になるので、配信側の圧縮で足りる。meshopt / Draco は今は要らない
- 実機(GPU あり)の fps は、ここでは測れていない。スマホ実機かリモートの端末で、batched_merged の寄りを 60fps で回せるかを Phase 1 で確かめる

## スクショ(docs/shots/)

| ケース | 縦 390×844 | 横 844×390 |
|---|---|---|
| naive_inst dpr1 | phase0_naive_inst_portrait_dpr1.png | phase0_naive_inst_landscape_dpr1.png |
| naive_inst dpr2 | phase0_naive_inst_portrait_dpr2.png | phase0_naive_inst_landscape_dpr2.png |
| merged_inst | phase0_merged_inst_portrait_dpr1.png | phase0_merged_inst_landscape_dpr1.png |
| batched_inst | phase0_batched_inst_portrait_dpr1.png | phase0_batched_inst_landscape_dpr1.png |
| merged_merged | phase0_merged_merged_portrait_dpr1.png | phase0_merged_merged_landscape_dpr1.png |
| batched_merged dpr1 | phase0_batched_merged_portrait_dpr1.png | phase0_batched_merged_landscape_dpr1.png |
| batched_merged dpr2 | phase0_batched_merged_portrait_dpr2.png | phase0_batched_merged_landscape_dpr2.png |
| 影なし | phase0_naive_inst_noshadow_portrait_dpr1.png | phase0_naive_inst_noshadow_landscape_dpr1.png |
| 寄り(パーツのまま) | phase0_naive_inst_near_portrait_dpr1.png | phase0_naive_inst_near_landscape_dpr1.png |
| 寄り(batched) | phase0_batched_merged_near_portrait_dpr1.png | phase0_batched_merged_near_landscape_dpr1.png |

生の数字は `tools/bench/results.json`。

## 計測ページの使い方

`tools/bench/bench.html?monsters=naive|merged|batched&terrain=inst|merged&shadow=0|1&cam=fit|near&n=20`
結果は画面左上・console(`BENCH {...}`)・`window.__bench` に出る。
