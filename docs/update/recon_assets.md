# 偵察: ビジュアル・音・演出のアセット棚卸し

- 対象: `src/game.html`（759,405 バイト、6,911 行）、`src/parts/overworld.js`（2,912 行）、`art/original/`、`icons/`、`tools/embed_art.py`、`CLAUDE.md`、`sw.js`
- 方法: grep と行番号照合による事実確認。推測は（推測）と明記。コードは変更していない。
- 行番号は特記なければ `src/game.html` のもの。

---

## 0. 結論の要約

- 魔生物の絵は 159 種すべてが手続き描画（`DRAW` / `DRAW96` の関数）で、外部画像は使っていない。埋め込み画像（base64）は 0 件で、`const ART={};`（5677 行）は空のまま。
- `art/original/` の 6 枚（jpg、計約 420KB）は game.html から参照されていない。`tools/embed_art.py` は使われていない状態。
- 音はすべて Web Audio の合成。音源ファイルは無し。BGM は 30 曲（MML 風の文字列）、SFX は 10 種。音量は ON/OFF だけで、音量調整 UI は無い。
- 同形の使い回し（進化形は基本形の再描画＋光のオーバーレイ、`LEGS` / `claw` などの共通ヘルパー）と、目 `eye()` を呼ばない個体が約 2/3 ある点が画風のばらつき候補。
- 同期ずれ 1 件: `overworld.js` 2858 行と `game.html` 5481 行で、`${wildCard(t)}${` の有無が違う。

---

## 1. 魔生物の描画方式

### 1-1. 種データ（何体あるか）
| 項目 | 場所 | 数 |
|---|---|---|
| `S(id,name,fam,rank,glyph,motif,desc,base,skills,trait,special)` | 829 行の `const SP={}` と 830 行の `function S(...)` | 通常種 141 件（`S('` 行） |
| `GS(...)`（伝説・ガチャ限定系。内部で `S(...)` を呼び `gacha=true`） | 2160 行 | 18 件（`GS('` 行） |
| 合計 | | 159 種 |

- 種族の系統は `FAM`（657〜672 行）の 9 系統: beast, bird, bug, plant, aqua, soft, dragon, spirit, metal。`IRIS`（961 行）で系統ごとの目の色を決める（例: `plant:'#b6f04a'`、`spirit:'#b99cff'`）。
- ランクは `RANKS`（657 行）。`RANKS.push('SS')`（1497 行）、`RANKS.push('SSS','創世')`（2134 行）で後から拡張。

### 1-2. 描画定義の場所と数
| 定義 | 場所 | 数 |
|---|---|---|
| `DRAW`（通常の魔生物。`g=>{...}` 形式） | 896 行 `const DRAW={` ＋ `Object.assign(DRAW,{` が 1032, 1056, 1546, 1642, 1916, 2057, 2188, 2360, 2486 行に 9 ブロック | 145 件 |
| `DRAW96`（大型。96 単位の座標系） | 1692 行 `Object.assign(DRAW96,{` | 10 件: horobiookami, ryuuguu, yatsumata, sorakujira, kokonobi, yatagarasu, nue, narukami, mizuchi, mukadeou |
| 進化形（真・四神） | 2205 行 `const shinDraw=(base,c1,c2)=>g=>{...}`、2206 行で `DRAW.shinsuzaku` ほか 4 件 | 4 件（shinsuzaku, shinbyakko, shinseiryu, shingenbu） |

- 照合結果: 通常 145 + 大型 10 + 進化形 4 = 159。SP（141）＋GS（18）＝159 と一致。描画定義がない種は 0。
- 描画定義がない種がないことは、`sp.txt`（S 行）と `GS(` 行の id を突き合わせて確認した。

### 1-3. `flatPainter` と `sprite()` の仕組み
- `function flatPainter(x,o={})`（931 行）: 描画用のメソッドを返す。
  - `vol(make,c,big,bb,round)`（934 行付近）: 形ごとに陰影をつける。`big` が真のときだけグラデーション、小さい形は単色塗り。
    - 楕円（`round`）は放射グラデーション（中心を左上にずらす）。多角形は直線グラデーション。
    - 色は `mixc(c,HI,.34)`（白へ混ぜる）と `mixc(c,SH,.34〜.56)`（`SH='#141a44'` の影へ混ぜる）。
  - `e(cx,cy,rx,ry,c,rot)`: 楕円。`big` の閾値は `min(rx,ry) >= 2.4*MN`。
  - `h(cx,cy,rx,ry,c)`: 半楕円（下半分の形）。
  - `r(a,b,w,h,c)`: 矩形。陰影なし（平塗り）。
  - `p(pts,c)`: 多角形。`big` は bbox が両辺 5*MN 以上のとき。
  - `l(a,b,c,d,col,w)`: 直線。`path(pts,c,w)`: 折れ線。陰影なし。
  - `eye(a,b)`（953 行）: 目。黒い縁、虹彩（`o.iris`）、黒い瞳孔（縦長）、白い反射、上まぶた（`s` で左右の向きを決める）。
  - 注意: 892 行にも `eye(a,b)` を持つ別の描画関数 `painter(x,o)`（873 行）がある。この関数は呼び出し箇所がなく、未使用の旧コードと見られる（推測: 旧方式の残り）。
- `function sprite(id,sil)`（962 行）:
  1. キャッシュ確認: `SPRC[id]`（シルエットは `id+'_s'`）。
  2. 作業キャンバス 192×192。`translate(N*.05)`、`scale(.9)`。
  3. `DRAW96[id]` があれば `scale(2)`、なければ `scale(4)` で描画（座標 48 単位相当）。`IRIS[SP[id].fam]` で目の色。例外は握りつぶす（`catch(e){}`）。
  4. 立体化（975〜990 行）: アルファから高さマップを作り、半径 7 のぼかしを 2 回かける。
     - 左上からの光（`lit=-(gx*.62+gy*.78)`）: 正のとき白へ最大 42% 混ぜる。
     - 右下の青い逆光（`rim`）: `(96,196,255)` へ最大 55%。
     - 影の側: `(14,18,58)` へ最大 50%。
  5. 外周の黒いふち（993〜995 行）: 半径 3 で 16 方向にずらして `#070916` で塗る。
  6. 戻り値 `SPRC[k]=cv.toDataURL()`（995 行）。シルエット（`sil`）は 966〜974 行で別処理（`#6e7a96` と `#262e42` の 2 色）。
- 進化形（`shinDraw`、2205 行）: 基本形の `DRAW[base](g)` を呼び直し、16 本の放射状の光（c1/c2 の交互色）、黄色い星、白い sparkle を重ねる。形は基本種と同じ。

### 1-4. 色違い（レア）と進化形の扱い
- 色違いは別の絵を描かない。`.seal img.spr.shiny{filter:hue-rotate(150deg) saturate(1.5) ...}`（81 行）。`.seal img.art.shiny`（79 行）は ART 用で、現在は使われない。
- 色違いの抽選: ガチャ `Math.random()<1/40`（2276 行）で `m.shiny=true`、全ステータスの talent を +1（上限 17）。
- 色違いの配合: 配合レシピに `aShiny:true`（1481 行など）がある。`state.shinySeen[sp]` で図鑑の色違い記録（5672 行 `addMon`、6262 行）。
- ランクの光（CSS）: `.seal.r-S::before`（317〜322 行）、`.seal.r-SS`（322〜323 行）、`.seal.r-SSS` と `.seal.r-創世`（459〜464 行、`ssglow` アニメ）。`seal()`（5681 行）が `sp.rank>=5` のときにクラスを付ける。
- 進化: `SP.suzaku.evo='shinsuzaku'` など（2179 行）。ただし、進化の処理そのものは未確認（推測: 演出は `shinDraw` の見た目のみ）。

### 1-5. 描画サイズとキャッシュ
- 表示は `seal(spId,size,known,shiny)`（5681〜5686 行）。`<img class="spr">` に `sprite()` の data URL を入れる。
- CSS の表示サイズ: `.seal.xs` 24px（`--i:24px`、73 行）、`.sm` 48px、`.lg` 96px、`.xl` 192px（スマホ幅 560px 以下は 96px、75 行）。
- 描画元は 192px。xs（24px）では約 1/8 に縮小されるため、細部はほぼ消える（推測）。
- キャッシュ: `SPRC`（929 行）に data URL の文字列を保存。上限や破棄はない。マップ用は `owSpriteImg(id)`（4837 行）が `OWC.img[id]` に `Image` を保持。
- 背景シーン（`scene()` 1128 行、`SCN` キャッシュ、`toDataURL` 1133 行）も同じ方式で、192×72 の canvas。

---

## 2. 画風のばらつき・弱点になりそうな点

1. 目 `eye()` の有無: `g.eye(` を呼ぶ定義は 155 件中 56 件だけ。99 件は `eye()` を呼ばない（例: `yadoridake` 、`happadanuki`、`tsukinowa`、`hashibuton`、`gorodango`、`hotarubi`、`kurobikari`、`kabutoo`、`dokuyaribachi`、`takaashi`、`inishieuo`、`numekuji`、`iroumiushi`、`happoudako`、`yamoryu`、`oohanzaki`、`jorou`、`musasabin`、`kooryu`、`tokoyo` ほか）。
   - CLAUDE.md の「光る目とするどいまぶた」と合わない個体が多い。ただし、手描きで目を描く個体もある可能性がある（推測）。実際に全個体を並べて目の有無を見る確認が必要。
2. 同形の使い回し:
   - 進化形 4 種（2205〜2206 行）は、基本形 `DRAW[base]` をそのまま描き、星と光を重ねるだけ。形は基本種と同じ（スザク → 真・スザク など）。
   - 共通ヘルパー `LEGS`（895 行）が 25 件、`claw`（1691 行）が 6 件で使われる。脚・爪の形が似やすい。
   - `sparkle`（2187 行）と `crescent`（2186 行）は月・星の共通形（`tsukiusagi`、`seihakuchou` などで使用）。
   - 同じ 50 文字以上の行が 3 件以上の定義に重複するものは 0（コピペは無い。ヘルパーでの再利用が中心）。
3. 色数: 描画定義の中で使う異なる色（#rrggbb）は 785 種。最も多いのは `'#101018'`（51 件、輪郭・影）、`'#ffffff'`（27 件）。色の数は多いが、色の決め方が個体ごとの手入力なので、系統（FAM）との色の対応は揃っていない（推測）。
4. 大型（DRAW96）は 10 件だけ。描画単位が違う（96 単位 vs 48 単位）ため、線の太さ `min:1.8` や `mid:48` の値が個体ごとに違って見えやすい（推測）。
5. 描画の長さ: 最長は `nue`（約 1,911 文字）、`ryuuguu`（約 1,884）、`horobiookami`（約 1,710）。最短は `kanahebin`（約 239）、`aodaija`（約 243）、`numekuji`（約 247）。個体ごとの情報量の差が大きい。
6. 実表示の 24px（xs）では、陰影と目が見えなくなる（推測）。図鑑の小さな表示に影響する可能性。

---

## 3. 埋め込み画像・art/original・フォント

### 3-1. 埋め込み画像（base64）
- `data:image/...;base64` の埋め込みは 0 件（grep で確認）。
- `const ART={};`（5677 行、`/*ART-START*/` と `/*ART-END*/` の間）は空。`seal()`（5685 行）の `ART[spId]` 分岐は実行されない。
- 実行時に生成される data URL は `toDataURL()` のみ（974, 995, 1133 行）。
- game.html のサイズは 759,405 バイト（ほぼ全部がコードと文字列）。

### 3-2. art/original の使用
- `art/original/`: `dobuchu.jpg`、`dokudamin.jpg`、`happadanuki.jpg`、`horobiookami.jpg`、`ibote.jpg`、`yadoridake.jpg`（計 414,232 バイト、約 404KB）。
- game.html からの参照: 0 件（`art/original` の文字列も無し）。
- `tools/embed_art.py`: `art/original/*.jpg|png` を 384px に正方形で切り出し、WebP（品質 78）にして `ART={...}` へ埋める。現在は実行されていないため `ART` が空。
- 注意: `CLAUDE.md` は「`art/original` の画像は使っていない」と明記。この方針と一致する。
- 整理候補（推測）: `art/original` と `tools/embed_art.py` は、使わない方針が確定していれば削除の検討対象。

### 3-3. アイコン・PWA
- `icons/`: `apple-touch-icon.png`、`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`。`sw.js`の CORE 対象。
- `sw.js`（版 `michikusa-a05b5f86f3`）: 同一オリジンの GET と、`fonts.googleapis.com` / `fonts.gstatic.com` の応答をキャッシュ（13〜14 行）。フォントはオフラインでも一度読めば使える。

### 3-4. フォント
- 読み込み（5 行）: Google Fonts の css2 で `Barlow Condensed:wght@500;600;700`、`DotGothic16`、`Zen Antique`、`Zen Kaku Gothic New:wght@400;500;700;900`。
- 変数（13〜15 行、テーマ 1）:
  - `--f-disp: 'DotGothic16', 'Zen Kaku Gothic New', ...`（13 行）
  - `--f-body: 'Zen Kaku Gothic New', ...`（14 行）
  - `--f-seal: 'Zen Antique', 'Yu Mincho', ...`（15 行）
- 上書き（596 行、「テーマ: 駅の案内サイン調」のブロック）: `--f-disp: 'Zen Kaku Gothic New', ...` と `--f-num: 'Barlow Condensed', ...`。この後段の定義が効くため、13 行の `DotGothic16` は実際には使われていない（推測: 後段の `:root` で上書きされるため。ブラウザでの確認は未実施）。
- `--f-num`（数字）の使用: `.num,.yen,.stars{font-family:var(--f-num)}`（601 行）。Barlow Condensed の使用箇所は限定的。
- 参考: `CLAUDE.md` は「数字は Barlow Condensed」と指定。実装と一致。

---

## 4. 音

### 4-1. 実装方式
- すべて Web Audio API（`AudioContext`）の合成。音源ファイル（mp3/ogg/wav）の読み込みは無し（`new Audio`、`.mp3` などの検索で 0 件）。
- 共通の AudioContext: `let AC=null`（1137 行付近）。`bgmCtx()`（1298 行）でも作る。

### 4-2. SFX（効果音）
- 定義: `const SFX={`（1138〜1148 行）。10 種: `sel`、`hit`、`crit`、`heal`、`lvup`、`scout`、`breed`、`win`、`lose`、`shiny`。
- 再生: `function sfx(type)`（1150〜1162 行）。各音は `[周波数, 長さ, 開始の遅れ, 波形='square', 音量=.045]`。`OscillatorNode` → `GainNode` → `AC.destination`。
- 呼び出し: 93 箇所（`sfx(` の出現）。文字列リテラル 87 件の内訳: `sel` 36、`win` 18、`shiny` 18、`heal` 11、`scout` 1、`lose` 1、`hit` 1、`crit` 1。変数・三項演算子の呼び出しは 4 箇所（2280、5025、6262、6665 行）。
- 「効果音」の ON/OFF は `state.sound`（`sfx` の先頭で判定）。トグル: `sound:()=>{...}`（6813 行）、タイトル画面のボタン（5727 行 `data-act="sound"`）。

### 4-3. BGM（BGM）
- 楽譜: `const SONGS={`（1166 行）に 14 件。`Object.assign(SONGS,{` が 1269（9 件）、2208（2 件）、2430（3 件）、2590（6 件）。
- 重複: 1269 行の `battle`、`boss`、`rival`、`komorebi` が、1166 行の同名定義を上書きする（1166 行のものは実質無効）。
- 重複を除いた曲数: **30 曲**。
  - 町（TOWN）: komorebi、kasumi、shiomi、tengu、mayoiga、ryuhyo、hinoshima、sango、yomi（`TOWN_BGM` 1224 行、2444 行、2616 行）。
  - 町の外・特別: michi（道）、victory、battle、boss、rival、gacha、tower、komorebi_t 系の `_t`（hinoshima_t、sango_t、yomi_t）。
  - ボス（`BOSS_BGM` 1225 行、2444 行、2617 行）: kyuubi、nue、sorakujira、sakamata、amanotsuru、hisanshou、kagutsuchi、oniitomaki、nirai、orochi、tokoyo。
- 楽譜の書き方: MML 風の文字列（1227 行の `parseMML(m,o0)`）。`arrange(S)`（1249 行）がコード進行（`chords`）から伴奏を作る。`thicken(chs)`（1291 行）が重ね。
- 音色: `pulseWave(ctx,duty)`（1299 行、デューティ 25%/12.5%/50%）、ノイズ（打楽器 k/s/h、1300〜1307 行 `bgmNote`）、ビブラート（1314 行）、ディレイ（1347〜1348 行）。
- 再生ループ: `bgmTick()`（1325 行、60ms 間隔、先読み 0.3 秒）、`bgmStop()`（1332 行、フェードアウト）、`bgmPlay(id)`（1337 行）。
- 曲選び: `bgmWanted()`（1354 行）。
  - 戦闘: `B.phase==='end'` かつ勝ちで `victory`。ボスは `BOSS_BGM`（`B.ura` で `_ura` を付ける）。ライバルは `rival`。塔は `tower` / ボスの `boss`、通常は `battle`。
  - メニュー: `ui.tab==='gacha'` で `gacha`、`ui.tab==='tower'` で `tower`。
  - 町の中: `TOWN_BGM` の曲（`_t` があれば `_t`）。町の外（歩くマップ）: `tb` か `michi`（1366 行）。
- 切り替えの呼び出し: `bgmUpdate()`（1369 行）。画面を描画するたびに呼ばれると思われる（推測）。
- 音量:
  - BGM: `BGM.gain.gain.value = state.bgmVol == null ? .8 : state.bgmVol`（1344 行）。`bgmVol` は読むだけで、どこにも書かれていない（grep で 1 件）。音量の UI は無い。
  - 圧縮: `DynamicsCompressor` の threshold -16、ratio 3（1345 行）。BGM 側だけに掛かる。
  - SFX: 音量は各音の定義値（既定 .045、1155 行）。SFX 用の GainNode も主音量も無い。BGM と SFX の音量バランスは固定（推測）。
- 再開と一時停止: 最初のタップで `AC.resume`（1370 行）。タブが隠れたら `suspend`（1371 行）。
- ON/OFF: `data-act="bgm"`（5727 行、タイトル）。トグルの本体は `bgm:` のハンドラ（確認のため未読）。

---

## 5. UI・演出

### 5-1. 画面の種類
| 画面 | 関数（game.html の行） | 備考 |
|---|---|---|
| タイトル・最初の相棒選び | `renderIntro`（5721）、`renderHeader`（5732） | 開始は 3 種（ibote、happadanuki、yamoryu） |
| 共通の描画 | `render()`（5699）、`renderTab`（5739）、`renderFoot`（5740） | `ui.tab` で切り替え（`map`、`party`、`breed`、`shop`、`gacha`、`tower`） |
| マップ（町の地図） | `renderMap`（5805） | |
| 歩くマップ（フィールド） | `renderOverworld`（5462）、`owPaint`（4590、overworld.js は 1971） | 描画は canvas（`#owc`、2846 行付近） |
| 駅・施設 | `renderStationIn`（5479）、`renderInside`（5484）、`ui.inside` で `sauna`、`dome`、`board` | |
| パーティ | `renderParty`（5857）、`renderPartyBar`（5894） | |
| 配合 | `renderBreed`（6109） | `ui.tab='breed'` |
| 図鑑 | `renderDex`（6282） | |
| ショップ | `renderShop`（6304） | |
| ガチャ | `renderGacha`（2290）、`renderGachaResult`（2282） | |
| 塔 | `renderTower`（2329） | |
| 戦闘 | `renderBattle`（6685） | `B` が戦闘状態 |
| 配合結果 | `renderResult`（6266） | |
| 引き継ぎ | `renderTransfer`（5755）、`saveCode`（1 行目付近の `MKR1:` コード） | |
| ダイアログ | `renderDlg`（5717） | |

### 5-2. 既存の演出（有無と場所）
- 画面の揺れ:
  - 戦闘全体: `body.bshake` / `body.bshake2`（646〜647 行、`bshk`/`bshk2` アニメ）。JS は `bshake(big)`（6403 行）。被ダメージが一定以上（HP の 22%/45%）のとき（6408 行）。
  - 被弾したモンスター: `.hit{animation:shake .32s}`（279 行）、`@keyframes shake`（282 行）。
  - 歩くマップ（overworld）: 画面揺れは無し（`owHurt` はHPの減少のみ、5248 行）。
- フラッシュ: `.battle.flash .stage`（235 行）、`@keyframes flash`（236 行）。クリティカル時 `B.flash=true`（6443 行）。
- 戦闘の入場: `.battle.enter`（`@keyframes enter`、234 行、clip-path で左右から開く）。
- ダメージ数字: `pop(c,t,k)`（6395 行）、`.pop` の `@keyframes pop`（260 行）。
- 攻撃の演出: `fx(c,type)`（6394 行）。`B.fx` を描画で使う（6688 行付近）。
- 進化・合体: `.fusion`（6270 行）、`@keyframes fuseL` / `fuseR`（301〜302 行）、`.burst` の `@keyframes burst`（304 行、白い円が広がる。パーティクルではなく 1 つの円）。
- ガチャ: `.gflash`（486 行、`gflash`）、`.gsky`（481 行、星空）、`.gstar`（482〜483 行、流れ星）、`gin`（495 行）、`revealIn`（297 行）。
- 「カットイン」: `@keyframes cutband`（644 行）、`cutmon`（645 行）。用途は未確認（推測: 戦闘のカットイン）。
- 演出の雑多: `twinkle`（84 行）、`spin`（327 行）、`ssglow`（328 行、SS ランクの光）、`roar`（332 行）、`metal`（338 行、メタル系の光沢）、`rainbow`（489 行）、`shoot`（484 行）、`bob`（257 行）、`blink`（271 行）、`glow`（283 行）、`slideIn`（63 行）。
- パーティクル: 専用のパーティクル機構は無し。`burst` の円と、`sparkle` の描画（2187 行、絵の中）のみ。
- 画面遷移: フェード・ワイプの専用キーフレームは無し。`enter`（234 行、clip-path）が戦闘開始の幕のような動き（推測）。
- 天候・雰囲気（overworld）: `owPaint` の放射グラデーション（霧 fog、光 light、洞窟 cave、吹雪 storm）。game.html では 4590 行以降。overworld.js では 2329〜2337 行、2520 行。
- モーション軽減: `@media (prefers-reduced-motion:reduce)`（588 行）で、すべての `animation` と `transition` を止める。

### 5-3. 画面のテーマ
- `CLAUDE.md` の方針どおり、黒い地（`--bg:#0d0f12`、596 行付近のテーマ 1）、太いゴシック、路線色 `--tl` をアクセントに使う（`.eyebrow` 597 行付近）。
- 影や光のにじみは使わないと書かれているが、`text-shadow`（`.logo` は 597 行付近で `none`）、`box-shadow` の光（`.seal.r-SSS` 462 行）などは使われている。魔生物のランク光は例外として扱っている（推測）。

---

## 6. 同期・整理の確認事項

1. `overworld.js` と `game.html` の同期ずれ 1 件:
   - `src/parts/overworld.js` 2858 行: `…<h3>${t.name}駅</h3>…` の行に `${wildCard(t)}${` が無い。
   - `src/game.html` 5481 行: 同じ行に `${wildCard(t)}${` がある。
   - `wildCard` の定義は game.html の 5475 行のみ（overworld.js には無い）。`CLAUDE.md` が求める「overworld.js を変えたら game.html にも反映」と食い違っている。
   - 空行を除いて比べると、不一致は上の 1 行だけ（overworld.js は 2,912 行）。
2. 未使用の関数・資産（推測を含む）:
   - `painter(x,o)`（873 行）: 呼び出しなし。
   - `ART`（5677 行）: 空。`ART` を使う分岐（5685 行）は実行されない。
   - `art/original/*`、`tools/embed_art.py`: game.html から参照されない。
   - `--f-disp` の `DotGothic16`（13 行）: 後段で上書きされるため使われていない（推測）。Google Fonts の読み込みに含まれる。
3. `SONGS` の重複定義（1166 行の `battle`、`boss`、`rival`、`komorebi` が 1269 行で上書き）。
4. `state.bgmVol` は読み取りだけで、設定 UI が無い。
5. 音量の調整手段が無い（ON/OFF のみ）。

---

## 7. 確認できなかった点（今後の調査候補）

- 99 件の `eye()` 無し個体の見た目（目が手描きで別にあるかどうか）を、実際にスクリーンショットで確認する。
- `DotGothic16` が実際に描画されているか（ブラウザの開発者ツールでの確認）。
- 戦闘のカットイン（`cutband` / `cutmon`）がどの処理から呼ばれるか。
- `sfx` の変数呼び出しが期待どおりに鳴るか（実機での確認）。
- `bgmUpdate()` の呼び出し箇所（画面描画ごとか、状態変化時か）。
