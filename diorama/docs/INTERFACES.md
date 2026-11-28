# 班どうしのつなぎ目(関数の形)

作った班が書き、使う班が読む。

## audio(sound-lab)

`src/audio/audio.js`(ES モジュール。three に依存しない)。外部の音声ファイルは使わず、すべて WebAudio で合成する。

```js
import * as audio from './audio/audio.js';
```

### 起こす

| 関数 | 説明 |
|---|---|
| `initAudio({ target = window })` | 起動時に1回呼ぶ。最初の `pointerdown` / `touchend` / `keydown` / `mousedown` で AudioContext を起こす。画面が裏に回ると止め、戻ると再開する |
| `unlock()` → `Promise<boolean>` | 手で起こす(タップの処理の中から呼ぶ)。起きたら true |
| `isUnlocked()` → boolean | |

起こす前に `playBgm` を呼んでもよい。拍の時計はその時点から進み、タップ後は **同じ拍の位置から** 鳴りはじめる(振り子とずれない)。起こす前の `sfx` は何もしない(0 を返す)。

### BGM

| 関数 | 説明 |
|---|---|
| `playBgm(name, { fade = 1.2, restart = false })` | 曲を切りかえる。古い曲は `fade` 秒で消え、新しい曲は頭から入る(クロスフェード)。同じ曲なら何もしない(`restart:true` で頭から)。`name = null` で止める |
| `stopBgm({ fade = 1.0 })` | 止める |
| `currentBgm()` → name / null | |

曲の名前(`SONG_NAMES`):

| name | 場面 | BPM | 拍子 | ループ |
|---|---|---:|---|---|
| `title` | タイトル | 80 | 4/4 | 64拍 |
| `workbench` | 作業台(エリアを選ぶ) | 88 | 4/4 | 64拍 |
| `village` | ネジマキ村 | 92 | 4/4 | 64拍 |
| `tsumiki` | つみき野 | 116 | 4/4 | 64拍 |
| `forest` | ランプの森 | 70 | 4/4 | 64拍 |
| `tower` | ゼンマイ時計塔 | 108 | 4/4 | 64拍(**4拍で振り子が1往復**) |
| `battle` | ふつうの戦闘 | 152 | 4/4 | 前奏16拍 + 64拍 |
| `nushi` | ぬし戦(カゲボウシ) | 138 | 4/4 | 前奏8拍 + 64拍 |
| `boss` | ボス戦(トケイモリ) | 164 | 4/4 | 前奏16拍 + 64拍 |
| `ending` | エンディング | 72 | 4/4 | 64拍 |

エリアのデータの `bgm`(`data/areas/*.json`)は、この名前をそのまま使っている。戦闘から戻るときは `playBgm(area.bgm)`(曲は頭から)。

### 拍(振り子の通路が使う)

| 関数 | 返すもの |
|---|---|
| `beat()` | `{ song, bpm, beats, phase, beat, bar, beatInBar, beatsPerBar, secPerBeat, loopBeat }` |
| `pendulum(period = 4, phase = 0)` | 周期 `period` 拍の中の位置 0..1。`phase` は拍でずらす |
| `onBeat(fn)` → 外す関数 | 拍が変わるたびに `fn(beat())` を呼ぶ |
| `cycle(beats, period, phase)` | `pendulum` の中身(純粋な関数) |

- `beats` は曲の頭からの拍(小数、ループしても増えつづける)。`phase` は拍の中の位置 0..1。`loopBeat` は曲の中の位置
- **耳に届いている拍**を返す(`outputLatency` を引いてある)。毎フレーム呼んでよい(軽い)
- 曲がないときも 120 BPM の時計を返す(`song: null`)。止まらない
- 画面が裏に回って AudioContext が止まると、拍の時計も止まる(戻ると続きから)
- 時計塔の振り子(`docs/maps/tower.md`: `period: 4`、拍の 2/4 の間ふさがる)の例:

```js
const x = audio.pendulum(4, p.phase ?? 0);     // 0..1(4拍で1往復)
const blocked = x >= 0.25 && x < 0.75;          // 2/4 の間ふさぐ
const swing = Math.sin(x * Math.PI * 2);        // 振り子の見た目の角度 -1..1
```

### 効果音・ジングル

| 関数 | 説明 |
|---|---|
| `sfx(name, opt)` → 長さ(秒) | 効果音。共通の opt: `vol`(0..1.5、既定 1)・`when`(何秒後) |
| `jingle(name, { duck = 0.18 })` → 長さ(秒) | ジングル。鳴っている間 BGM を `duck` 倍に下げ、終わったら 0.8 秒で戻す。`sfx(name)` でも呼べる |
| `jingleLength(name)` → 秒 | 演出のタイミング合わせ用(起こす前でも使える) |

ジングル(`JINGLE_NAMES`): `victory`(勝利 2.4秒)・`scout`(スカウト成功 1.5秒)・`breed`(配合完成 2.75秒)・`levelup`(レベルアップ 1.17秒)。ジングルは BGM の音量に従う。勝利のときは `playBgm(null, { fade: 0.3 })` のあと `jingle('victory')` がよい。

効果音(`SFX_NAMES`):

| name | いつ | opt |
|---|---|---|
| `cursor` | カーソルが動く | |
| `ok` | 決定 | |
| `cancel` | キャンセル・もどる | |
| `pickup` | ピンセットでつまむ | |
| `place` | ピンセットで置けた(パチッ) | |
| `roof` / `roofClose` | 屋根が開く / 閉じる | |
| `step` | 足音 | `ground`: 地面の文字 `g p f k d s L c m r B`(grid.js の WALK)か名前 `grass path wood board dirt sand ladder shadow stone rug` |
| `turntable` | 回転台が回る(ゴロゴロ・カタカタ・ゴトン) | `dur`: 回る秒数(既定 0.7)。最後の「ゴトン」が `dur` 秒後 |
| `lamp` | ランプの角度が変わる | |
| `tick` | 文字盤の針が進む(カチッ) | |
| `gear` | 歯車がかみ合う | |
| `kintsugi` | 金つぎが光る | |
| `chest` | 宝箱を開ける | |
| `hit` / `hitWeak` | ヒット(通常 / 弱点) | |
| `miss` | はずれ | |
| `faint` | 倒れる(パタン) | |
| `heal` | 回復 | |
| `fall` | 谷に落ちて前の足場にもどる | |
| `door` | 扉 | |
| `buy` | 買い物 | |
| `alarm` | ぬしが現れる合図 | |

足音は1歩ごとに `sfx('step', { ground: level.t[z * w + x] })`。

### 音量(BGM と効果音を別々に5段階)

| 関数 | 説明 |
|---|---|
| `setBgmLevel(n)` / `setSeLevel(n)` → 丸めた n | `n` は 0..4(0 = 消音、既定 3)。範囲外は丸める |
| `getLevels()` → `{ bgm, se }` | |

音量は `localStorage` の `diorama.audio.v1` に自分で保存する(セーブデータとは別。版を上げる必要なし)。

### 測定・試聴用(ゲームでは使わない)

- `renderSong(name, { secs, fromBeat, sampleRate })` / `renderSfx(name, opt, { secs })` → `AudioBuffer`(OfflineAudioContext。本番と同じ通り道)
- `songInfo(name)` → `{ label, bpm, bpb, key, len, loopStart, scoring, once }`
- 試聴ページ `tools/audio/listen.html`、測定 `node tools/audio/levels.mjs`、本物の AudioContext での確認 `node tools/audio/live_check.mjs`
