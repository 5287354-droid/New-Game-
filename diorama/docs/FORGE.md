# 魔物の工房(monster-forge): A+ 案 と パーツの規格

2026-11-28 / ブランチ wt/forge-p2b / art-director の第2回の判定用(第1回の判定は `docs/ART_REVIEW.md`)

## まとめ(第2回)

- 質感を **A+ 案**(`docs/ART_BIBLE.md` §1-1 の値)に一本化した。A/B の切りかえは消した(`forge.material()` で A+)。素材ごとのつや・あらさの上書き(ブリキ・水・ロウは強く、紙・布は半分、石は 0.6)をシェーダーに入れた。紙は三角形ごとの平らな法線で **折り目の面** を見せる
- 新しいスロット **glow**(光ってよい部品: 炎・ホタルの光・炭。§1-6)。外の色 → 内の明るい黄の2段 + 発光。おさがりで受けついでも炎は炎のまま
- 部品の模様(1種1か所、パーツについて回る): ヌイヘビの赤いギンガム、カミシバイの紙芝居の絵(山と太陽)、ロウソクンの絵付けの花
- 判定の **直す 12 体・作り直し 2 体(マッチボウ・ジャリヘビ)・しずくの胴の作り直し・へびの胴の直し** をすべて入れた(下の表)
- 64px の **同じ型どうしの IoU は全組で 0.75 以下**(最大 0.746 ゼンマイヌ/ヒバチネコ の見下ろし)。`forge_silhouette_64.png` の下の表で自動計測
- 規格: 違反 0、2回ビルドして同じバイト列、20種の最大 3,236△、おさがりの最悪 3,418△(上限 4,000)。`node tests/run_all.mjs` 73 件合格

### 色の直し(data/monsters.json は game-designer の持ち場なので、forge.js の `COLOR_FIX` で上書きしている)

| 種 | 地の色 | 差し色 | きらり | 理由 |
|---|---|---|---|---|
| コロイシ | (そのまま) | `#5f7d4a` → `#d9893a` 橙の地衣 | `#d3b98c` → `#7fb0c8` | こけが草に溶ける / きらりが通常に近い |
| ワタボウシ | | | `#c8b6e8` → `#f2b6c6` 桜色 | 紫は影の予約色 |
| マッチボウ | `#d8b57a` → `#efe3c8` 白木 | `#d33a24` → `#c8462c` | | ビードルに寄る肌色をやめる |
| ジャリヘビ | `#7d786e` → `#a89c86` 黄土 | `#b9a27a` → `#9a5a3c` 赤さび | | 灰の連なり(イワーク)をやめる |
| フェルトン | `#7fae6b` → `#e0806a` 珊瑚色 | `#e85c5c` → `#3a6ea5` 藍の糸 | `#e8a0c8` → `#8fc7d8` | 緑が草に溶ける |
| ロウソクン | `#f2ead8` → `#c8462c` 朱 | `#f08a24` → `#f2d27a` 金 | `#9fb7f0` → `#5f9fd8` | 白いロウ(ヒトモシ)をやめる |
| ツミキング | `#e8c35a` → `#d8cbb0` 石の生成り | `#3f6fb5` → `#d9a32a` 金の冠 | | 黄色+石の穴がチーズに見える |
| ハリボテ | | | `#f0f0f0` → `#a9cde8` 空色 | 生成り→白は 64px で見分けられない |
| ヒバチネコ | `#5b4a43` → `#b8764a` 素焼きの土色 | `#e27a2b` → `#3a3330` 墨 | | 黒猫+火+橙(ニャビー)をやめる |
| ヌイヘビ | `#8c6db0` → `#e8dcc4` 生成りの木綿 | `#f2c84b` → `#c8462c` 赤いギンガム | | 紫+黄のへび(アーボ)をやめる |
| カゲボウシ | | `#5a4a8a` → `#6a4fa8` すみれ | | マントの裏地を明るく |

→ game-designer へ: この値を monsters.json に移したら、`COLOR_FIX` から消す(どちらでも見た目は同じ)。

## 1体ずつ、何をどう直したか

| No | 種 | 判定 | 直したこと |
|---:|---|---|---|
| 1 | ネジコ | 直す | `back_nejiko`: 輪2つ(マグの取っ手・めがね)→ **平たい8の字の板2枚 + 軸**。軸は背中から後ろ上へ 45°、板は左右を向き、真横でいちばん大きい。上の板は頭の後ろから出る。頭のふちの帯を太く(まるの型のほかの種と 64px で分ける) |
| 2 | ペラリ | 直す | 胴は新しいしずく(1つの形)。紙は **折り目の面**(三角形ごとの平らな法線)で、胴も面に見える。`tail_perari`: 浮き輪 → **1回ねじれた紙のリボン**(厚み 0.024) |
| 3 | インキー | 直す | `head_inky`: 首のあるびん → **横に広い四角いインク壺 + 短い首 + コルク**(しずくの先を壺でかくす。口なし、地の色はそのまま)。`back_inky`: 何か分からないかたまり → **ななめに刺さったつけペン**(軸 + 金具 + ペン先) |
| 4 | コロイシ | 直す | `head_koroishi`: 胴の上のキノコ → **胴の大半を包む、なめらかな平たい楕円の河原石**(多面体をやめて UV 球 + 弱いでこぼこ)。目は石の前の面に寄せて埋めた。こけ → 橙の地衣 |
| 5 | ワタボウシ | 合格 | きらりだけ 桜色 |
| 6 | マッチボウ | **作り直し** | `head_matchbo`: 赤い円すい(角・帽子)→ **縦長のだ円のマッチの頭(朱)+ 左右になびく2つのしずく形の炎(glow: 外 朱 → 内 黄、発光)**。地の色を白木に。胴はかま首(へびの直し) |
| 7 | オリガラス | 合格 | 紙の折り目の面がシェーダーで胴にも出る(任意の直しが自動で入った)。折り羽を大きく(鳥の型で 64px を分ける) |
| 8 | ジャリヘビ | **作り直し** | 頭 = **こてのような三角の平石** + 目の台。背中のとげの列 → **平たく並べた2色の玉砂利(黄土と赤さび)**。しっぽ = **ひとすくいの砂利の山**。地の色を灰 → 黄土。胴はかま首 |
| 9 | フェルトン | 直す | 地の色 緑 → 珊瑚色。触角のぽんぽん → **頭のてっぺんに直接つく大きな毛玉2つ**(左右に置くと耳に見えたので前後に)。ぬい針を長く(0.56)、糸(藍)を胴に1周 |
| 10 | ホタルビン | 直す | 頭 = **細長いびん + 長い首 + コルク**。びんの下に **光る水**(glow)、しっぽの玉も glow。水の素材は透け 0.6。羽を上向き(トンボのよう)に |
| 11 | ゼンマイヌ | 合格 | 64px の見下ろしでヒバチネコと近かったので、たれ耳を大きく、うず巻きゼンマイを大きく |
| 12 | ロウソクン | 直す | 頭 = **上が広い和ろうそく(朱)+ 絵付けの花(模様)**。炎は2段の glow。燭台の取っ手は残す。胴は新しいしずく |
| 13 | ツミキング | 直す | 地の色を石の生成り、冠を金に。頭 = **大小2つの積み木(上は 45° 回す)+ 冠**。王しゃくを長く、背中の城を後ろへ大きく(人形の型で 64px を分ける) |
| 14 | カミシバイ | 合格 | 任意の直し: 枠の中に **紙芝居の絵(山と太陽、差し色)** を模様で |
| 15 | ハリボテ | 合格 | きらりだけ 空色 |
| 16 | ヒバチネコ | 直す | 地の色 黒 → 素焼きの土色、差し色 橙 → 墨(ひげ・耳の内側)。火鉢 = **口の広い鉢(上向き)+ 灰 + 光る炭4つ(glow)+ 火箸2本**。しっぽの火ばしを立てる。耳を大きく |
| 17 | ヌイヘビ | 直す | 地の色 紫 → 生成りの木綿、差し色 黄 → 赤。**少し浮いた四角い当て布(赤いギンガム模様)** を頭に2枚・背中に3枚。頭を大きく、綿のしっぽを上向きに。胴はかま首 |
| 18 | ブリキシ | 直す | かぶとの羽かざり: 円すい → **後ろへなびく扇の板3枚**。たては背中の中心 → **左の腕**(正面から丸いたてが見える) |
| 19 | カゲボウシ | 直す | つばの直径 1.12 → **0.78**(肩幅の 1.3 倍)、帽子を **後ろへ 15°**、山を低く。マント = **外は地の色、内は すみれの裏地**の厚みのある殻(前があいていて裏地が見える) |
| 20 | トケイモリ | 合格 | なし |
| 胴 | しずく | **作り直し** | 2つの球(雪だるま)→ **回転体の1つのしずく形**(下が大きくふくらみ、上へ細くなる)。先は頭のソケット(0.7)の上でかくれる |
| 胴 | へび | 直す | ふせた玉5つ → **7つの玉のかま首**(前の1/3 を S 字に持ち上げ、頭のソケットの高さ 0.66)。玉は前ほど大きい |

前後の比較: `docs/shots/forge_compare_1.png`・`forge_compare_2.png`(左3枚 = 第1回の A案、右3枚 = A+。正面ななめ・真横・見下ろし 52°)。フィールドの距離: `forge_field_before_grass.png` → `forge_field_Aplus_grass.png`。

## スクショ(docs/shots/)

| 中身 | ファイル |
|---|---|
| 20種の並び(通常 / きらり) | `forge_Aplus_all20.png` |
| 20種それぞれの8方向(通常 / きらり / おさがり★1 / おさがり★3。試作3体は5行) | `forge_Aplus_<種id>.png`(20枚) |
| 64px シルエット(正面ななめ・真横・見下ろし 52°・色つき)+ 同じ型どうしの IoU 表 | `forge_silhouette_64.png` |
| フィールドのカメラ(見下ろし 52°、ART_REVIEW の付録と同じ並べ方) | `forge_field_Aplus_grass.png`、`forge_field_Aplus_clay.png`、直す前 `forge_field_before_grass.png` |
| 直す前と後 | `forge_compare_1.png`、`forge_compare_2.png` |
| 第1回の A案・B案(記録) | `forge_A_*.png`、`forge_B_*.png` |

撮り方: `cd diorama && python3 -m http.server 8103 &` → `node tools/forge_shots/shoot.cjs [絞りこみ]`。直す前の版は git の `a6264f1` から自動で取り出す(`BEFORE_REV` で変えられる)。数字は `docs/shots/forge_stats.json`(三角形・IoU)。

### 64px の IoU(同じ型どうし、上位。全 24 組で 0.75 以下)

| 組 | 正面ななめ | 真横 | 見下ろし 52° |
|---|---:|---:|---:|
| ゼンマイヌ / ヒバチネコ | 0.73 | 0.65 | 0.75(0.746) |
| ネジコ / コロイシ | 0.69 | 0.63 | 0.74 |
| ハリボテ / ヒバチネコ | 0.74 | 0.67 | 0.71 |
| ペラリ / ロウソクン | 0.70 | 0.65 | 0.73 |
| ブリキシ / カゲボウシ | 0.73 | 0.70 | 0.68 |
| (第1回で赤だった)ネジコ / フェルトン | 0.61 | 0.55 | 0.52 |
| (第1回で赤だった)ツミキング / ブリキシ | 0.68 | 0.60 | 0.69 |
| (第1回で赤だった)ジャリヘビ / ヌイヘビ | 0.63 | 0.52 | 0.67 |

IoU は、1体ずつ外接球で枠いっぱいに撮った 64px のシルエットの重なり。大きさの差は数えない(形だけ)。

## 質感(A+、`src/forge/forge.js`)

| 値 | A+ |
|---|---:|
| rough / coat / coatRough | 0.38 / 0.60 / 0.30 |
| sss / surf / accentSat | 0.35 / 0.90 / 1.15 |
| edge / tinMetal / sheen / cavity | 0.20 / 0.45 / 0.60 / 0.35 |
| 目のひとみ | 水色 `#5fe0ff` |

| 素材 | coat の倍率 | rough | 表面 |
|---|---:|---:|---|
| ブリキ | ×1.0 | 0.30 | 打ち出しのくぼみ(ボロノイ)、金属 0.45 |
| 水(インク・ガラス) | ×1.2 | 0.15 | にじみのしみ + ふちの濃い輪、透け 0.6 |
| 火(ロウ) | ×1.1 | 0.30 | 下へ垂れる筋、透け 0.5。炎は glow |
| 石 | ×0.6 | 0.55 | ざらつき + ごま(穴は cavity で暗く) |
| 布 | ×0.5 | 0.60 | 織り目 + 中心線のミシン目 + 起毛 sheen |
| 紙 | ×0.5 | 0.55 | 繊維 + 粒 + **折り目の面**(平らな法線を 85% まぜる) |

- くぼみの暗がり(cavity): 表面の高さ(バンプ)が下がる所ほど暗く(縫い目の溝・打ち出し・石の穴)
- ★3 金つぎ: ひびの幅を 0.05 → 0.075、発光 0.55 → 0.85(紙の上でも見えるように)。★2 銀線はそのまま
- 光る所は ひとみ・glow(炎・ホタルの光・炭)・★3 金つぎ だけ

## 規格

- 座標: Blender で -Y が正面・+Z が上 → three.js で +Z が正面・+Y が上。1体の高さはだいたい 1(足もとが原点)
- 胴 `body_<型>`(6型)の子に `socket_head_<型>` / `socket_back_<型>` / `socket_tail_<型>`。名前に「.」なし。読む側は前方一致
- パーツ `head_<種>` / `back_<種>` / `tail_<種>` は原点 = つなぎ目
- マテリアルのスロットは `body` / `accent` / `eye` / **`glow`**。eye は目のガラス玉だけ、glow は光ってよい部品だけ(テストで マッチボウ・ホタルビン・ロウソクン・ヒバチネコ の4種と確かめる)
- 目: 半径 0.075、左右 ±0.135、左右同じ高さ(check_parts.py が glb から測る)
- 三角形: 胴 ≤ 1000、頭 ≤ 1300、背中 ≤ 900、しっぽ ≤ 700 → どの組み合わせでも ≤ 3,900
- 同じ出力: 頂点と面を座標の順に並べ直す(`canon()`)+ `PYTHONHASHSEED=0` で起動し直す。新しい形の道具 `lathe()`(回転体)・`shell()`(厚みのある殻、外と内で色を分ける)・`ribbon(twist=)`(ねじれた帯)も from_pydata で作るので順番は決まっている

## 自動チェック(`python3 tools/blender/check_parts.py --repro --write` が下を書きかえる)

<!-- check_parts:begin -->
- 対象: `assets/models/parts.glb`  773,604 バイト  sha256 `4be8a0da17add8af…`
- パーツ 66 個(胴6 + 20種×3)、三角形の合計 32,638
- 違反: **0 件**

| No | 種 | 型 | 胴 | 頭 | 背中 | しっぽ | **組み立て後** |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | ネジコ | maru | 956 | 1216 | 584 | 480 | **3,236** |
| 2 | ペラリ | shizuku | 684 | 438 | 192 | 124 | **1,438** |
| 3 | インキー | shizuku | 684 | 752 | 142 | 46 | **1,624** |
| 4 | コロイシ | maru | 956 | 660 | 140 | 60 | **1,816** |
| 5 | ワタボウシ | tori | 672 | 1286 | 600 | 300 | **2,858** |
| 6 | マッチボウ | hebi | 840 | 872 | 516 | 172 | **2,400** |
| 7 | オリガラス | tori | 672 | 366 | 16 | 12 | **1,066** |
| 8 | ジャリヘビ | hebi | 840 | 632 | 200 | 140 | **1,812** |
| 9 | フェルトン | maru | 956 | 948 | 298 | 168 | **2,370** |
| 10 | ホタルビン | tori | 672 | 828 | 520 | 188 | **2,208** |
| 11 | ゼンマイヌ | yotsuashi | 988 | 832 | 428 | 320 | **2,568** |
| 12 | ロウソクン | shizuku | 684 | 980 | 356 | 168 | **2,188** |
| 13 | ツミキング | ningyo | 736 | 618 | 450 | 136 | **1,940** |
| 14 | カミシバイ | ningyo | 736 | 780 | 168 | 216 | **1,900** |
| 15 | ハリボテ | yotsuashi | 988 | 624 | 348 | 316 | **2,276** |
| 16 | ヒバチネコ | yotsuashi | 988 | 820 | 400 | 104 | **2,312** |
| 17 | ヌイヘビ | hebi | 840 | 876 | 324 | 228 | **2,268** |
| 18 | ブリキシ | ningyo | 736 | 1040 | 364 | 154 | **2,294** |
| 19 | カゲボウシ | ningyo | 736 | 1028 | 504 | 160 | **2,428** |
| 20 | トケイモリ | yotsuashi | 988 | 1008 | 572 | 544 | **3,112** |
| | 20体の合計 | | | | | | **44,114** |

おさがりで一番重くなる組み合わせ(その型の胴 + 頭の最大 1286 + 背中の最大 600 + しっぽの最大 544):

| 型 | hebi | maru | ningyo | shizuku | tori | yotsuashi |
|---|---:|---:|---:|---:|---:|---:|
| 最悪の△ | 3,270 | 3,386 | 3,166 | 3,114 | 3,102 | 3,418 |

ソケット: hebi(socket_back_hebi, socket_head_hebi, socket_tail_hebi)、maru(socket_back_maru, socket_head_maru, socket_tail_maru)、ningyo(socket_back_ningyo, socket_head_ningyo, socket_tail_ningyo)、shizuku(socket_back_shizuku, socket_head_shizuku, socket_tail_shizuku)、tori(socket_back_tori, socket_head_tori, socket_tail_tori)、yotsuashi(socket_back_yotsuashi, socket_head_yotsuashi, socket_tail_yotsuashi)

全パーツの三角形とスロット:

| パーツ | △ | スロット | パーツ | △ | スロット | パーツ | △ | スロット |
|---|---:|---|---|---:|---|---|---:|---|
| `back_burikishi` | 364 | accent/body | `back_felton` | 298 | accent | `back_haribote` | 348 | accent/body |
| `back_hibachineko` | 400 | accent/body/glow | `back_hotarubin` | 520 | accent | `back_inky` | 142 | accent/body |
| `back_jarihebi` | 200 | accent/body | `back_kageboushi` | 504 | accent/body | `back_kamishibai` | 168 | accent/body |
| `back_koroishi` | 140 | accent | `back_matchbo` | 516 | accent/body | `back_nejiko` | 584 | accent |
| `back_nuihebi` | 324 | accent | `back_origarasu` | 16 | accent/body | `back_perari` | 192 | body |
| `back_rousokun` | 356 | accent | `back_tokeimori` | 572 | accent/body | `back_tsumiking` | 450 | accent/body |
| `back_watabou` | 600 | body | `back_zenmainu` | 428 | accent/body | `body_hebi` | 840 | accent/body |
| `body_maru` | 956 | accent/body | `body_ningyo` | 736 | accent/body | `body_shizuku` | 684 | accent/body |
| `body_tori` | 672 | accent/body | `body_yotsuashi` | 988 | accent/body | `head_burikishi` | 1040 | accent/body/eye |
| `head_felton` | 948 | accent/body/eye | `head_haribote` | 624 | accent/body/eye | `head_hibachineko` | 820 | accent/body/eye |
| `head_hotarubin` | 828 | accent/body/eye/glow | `head_inky` | 752 | accent/body/eye | `head_jarihebi` | 632 | accent/body/eye |
| `head_kageboushi` | 1028 | accent/body/eye | `head_kamishibai` | 780 | accent/body/eye | `head_koroishi` | 660 | body/eye |
| `head_matchbo` | 872 | accent/eye/glow | `head_nejiko` | 1216 | accent/body/eye | `head_nuihebi` | 876 | accent/body/eye |
| `head_origarasu` | 366 | accent/body/eye | `head_perari` | 438 | accent/body/eye | `head_rousokun` | 980 | accent/body/eye/glow |
| `head_tokeimori` | 1008 | accent/body/eye | `head_tsumiking` | 618 | accent/body/eye | `head_watabou` | 1286 | accent/body/eye |
| `head_zenmainu` | 832 | accent/body/eye | `tail_burikishi` | 154 | accent/body | `tail_felton` | 168 | accent |
| `tail_haribote` | 316 | accent/body | `tail_hibachineko` | 104 | accent/body | `tail_hotarubin` | 188 | accent/glow |
| `tail_inky` | 46 | accent/body | `tail_jarihebi` | 140 | accent/body | `tail_kageboushi` | 160 | accent/body |
| `tail_kamishibai` | 216 | accent | `tail_koroishi` | 60 | accent | `tail_matchbo` | 172 | accent/body |
| `tail_nejiko` | 480 | accent | `tail_nuihebi` | 228 | accent/body | `tail_origarasu` | 12 | accent |
| `tail_perari` | 124 | accent | `tail_rousokun` | 168 | body | `tail_tokeimori` | 544 | accent/body |
| `tail_tsumiking` | 136 | accent/body | `tail_watabou` | 300 | accent | `tail_zenmainu` | 320 | accent/body |
<!-- check_parts:end -->

## 他の班への申し送り

| 班 | 中身 |
|---|---|
| game-designer | 上の「色の直し」の表の値を `data/monsters.json` に。移したら forge.js の `COLOR_FIX` を消す |
| engineer / ui-fx | `forge.material()`(引数なし)で A+。前の `material('A')` も A+ を返す。属性 `aMat.x` に 3(glow)が増えた。`aMat.w` = きらり + 2×模様 |
| art-director | 第2回の判定に。直した 14 体 + 胴2つは `forge_compare_*.png`、全種の8方向は `forge_Aplus_<種id>.png` |
