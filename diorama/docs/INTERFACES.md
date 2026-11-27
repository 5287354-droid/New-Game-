# 班どうしのつなぎ目(関数の形)

作った班が書き、使う班が読む。

## ui(UI/演出班 — `src/ui/` `css/ui.css`)

### 読みこみ

```html
<link rel="stylesheet" href="css/ui.css">   <!-- Barlow Condensed は css/fonts/ に同梱 -->
```
```js
import * as UI from './ui/index.js';
```

- UI はすべて `.ui-root`(画面いっぱいの fixed、z-index 20)の中に作られる。3D の canvas はその下に置く
- UI は **データを受けとって表示し、選んだ結果をコールバック(と Promise)で返す** だけ。計算(戦闘・配合・セーブ)はしない
- 確認ページ: `tools/ui/gallery.html?scene=<名前>`(ダミーのデータで全部の部品)。スクショ `node tools/ui/shoot.cjs`、動きの検査 `node tools/ui/check.cjs`(どちらもポート 8106 で `python3 -m http.server 8106`)

### 共通

| 関数 | 中身 |
|---|---|
| `UI.setArea(id)` | アクセント色を切りかえる。`village` 山吹 / `tsumiki` 黄緑 / `forest` 藍 / `tower` 朱 / `workbench`。`--accent` `--on-accent` を `<html>` に入れる |
| `UI.setSfx(fn)` | 効果音のつなぎ口。`fn(name, opt)`。name は `cursor ok cancel open close snap cut slide pop coin type hit crit heal miss fanfare`(sound-lab がつなぐ) |
| `UI.setMaterials(monsters.materials)` | 素材の名前・色を data から入れる(なくても同じ値を持っている) |
| `UI.press(key)` | `a b up down left right menu rotL rotR` を UI に送る。キーボード(Z/Enter, X, 矢印, Esc, Q/E)は UI が自分で聞いている |
| `UI.setFallback(fn)` | UI の層が開いていないときのキーの行き先(フィールド)。`fn(key)` |
| `UI.hasLayer()` | UI の層(会話・メニュー・戦闘のコマンドなど)が開いているか。開いている間はフィールドの操作を止める |

### 演出の小道具 `UI.fx`

3D のヒットストップ・跳ね・ゆれと **同じ瞬間に** 呼ぶ。

| 関数 | 中身 |
|---|---|
| `fx.popNumber(x, y, value, {kind, dir, delay, hold})` → Promise | 引き出し線つきの部品番号の札で数字が跳ねて出る。kind = `dmg crit weak resist heal mp miss guard`。x,y は画面の px(人形の頭を project した位置) |
| `fx.snapIn(el, {from, burst, delay, sound})` → Promise | 札がパチッとはまる(はまる瞬間に `snap` の音と「カチッ」の線) |
| `fx.clickMark(el)` | 四隅の「カチッ」の線だけ |
| `fx.shake(el, power)` / `fx.hop(el, h)` | 札がふるえる / ぽよんと跳ねる |
| `fx.setGauge(bar, ratio)` | ゲージを減らす。元の長さに斜線の「なごり」が残って遅れて縮む |
| `fx.freeze(ms)` | UI の動きを ms だけ止める(3D のヒットストップに合わせる) |
| `fx.banner(text, {sub, code, kind, hold})` → Promise | 大きな札(`win scout done lose`) |
| `fx.typewriter(el, text, {speed})` → `{done, skip, finished}` | 文字送り。`**ことば**` はアクセントの下線 |

### 部品

```js
// 会話の窓(1つ作って使い回す)
const dlg = UI.createDialog({ speed: 32 });
await dlg.say({ name: 'ボルト親方', code: 'NPC-2', text: 'よう、起きたか。' });
const i = await dlg.say({ name, text, choices: ['はい', 'いいえ'], cancel: 1 });  // → 選んだ番号
await dlg.say({ note: true, text: '注意書き(チュートリアル)' });
await dlg.script([{ name, text }, 'つづきの文', ...]);   // 続けて話して閉じる
dlg.close();

// スマホの操作ボタン(A・B・⟲ ⟳・≡)。UI の層が開いている間は自動で隠れる
const pad = UI.createPad({ onButton(name, down) {}, auto: false, keepOnLayer: false });
pad.setMode('field' | 'ui' | 'menuonly' | 'hidden');  pad.setALabel('つまむ');

// メニュー(≡): A-1 なかま / A-2 どうぐ / A-3 図鑑 / A-4 設定 / A-5 セーブ
const menu = UI.openMenu({
  money, playTime: '01:24', place: 'ネジマキ村',
  party: [MonView], items: [{ id, name, count, desc, field?: false, target?: 'one'|'all'|'down'|'none' }],
  settings: { quality: 'low'|'mid'|'high', bgm: 0..5, se: 0..5 },
  onUseItem(itemId, targetIndex) → { ok, msg?, party?, items? },
  onSwap(i, j) → 新しい party(省略可),
  onDetail(mon, index, slotEl),            // くわしく の 3D の場所
  onOpenDex(), onSettings(settings, changedKey),
  getExport() → string, onImport(text) → { ok, msg? },
  onSave() → { ok, msg? } (Promise 可), onClose(),
});
menu.update({ money }); menu.close();

// 戦闘
const bt = UI.createBattleUI({ allies: [BattleMon], foes: [BattleMon], turn: 1 });
bt.setAnchors({ a0: { x, y }, f0: { x, y } });   // 3D の人形の頭の画面座標(毎フレームでもよい)
const cmd = await bt.askCommand('a0', { skills, items, canScout, canRun, canBack, prompt });
//   → { cmd: 'attack'|'skill'|'swap'|'item'|'scout'|'run'|'back', skillId?, itemId?, target?: id|'all', swapWith? }
//   後列からの近接・前列がいる後列への近接・MP 不足は UI で選べなくしている
await bt.message('ネジ太の ブリキパンチ!', { hold: 600 });
bt.pop('f0', 38, 'weak', { newHp: 2 });          // 数字 + 札のゲージ・ふるえ。crit/weak は freeze(60) も
bt.setMon('a1', { hp, mp, status, row });          // row が変わると札がはまりなおす
bt.setPhase({ lamp: { now: 'shadow', next: ['shadow', 'light'] } });   // カゲボウシ戦
bt.setPhase({ clock: { hand: 0..3, nextIn: 2 } });                     // トケイモリ戦
bt.setTurn(4); bt.replace(id, mon); bt.banner('勝った!', { kind: 'win' }); bt.destroy();

// 配合(組立説明書の見開き)
const br = UI.openBreed({
  candidates: [MonView & { id, skills }],  minLv: 10, maxParts: 1|2|3, maxSkills: 2,
  predict(aId, bId) → { ok?, reason?, species: { name, mat, body, no }, stats, bonus, gen, native: { head, back, tail }, note? },
  onConfirm({ a, b, parts: [{ from: 'a'|'b', slot }], skills: [id] }) → result(Promise 可),
  onStage(slotEl, { phase: 'preview'|'assemble', a, b, pick, result }),   // 3D の子を置く div
  onDone(result), onClose(),
});
// onConfirm のあと自動で ①切りはなす ②組み合わせる ③パチッ → 「完成!」→ つぎへ で onDone

// 図鑑(パーツ一覧)と部品表(57 + 金57)
UI.openDex({ species, state: { id: 'unseen'|'seen'|'caught' }, bom: { 'nejiko.back': 0|1|2 }, bodies,
  onSelect(id, viewerEl), onClose(), tab: 'dex'|'bom' });

// お店・宿屋・預かり所
UI.openShop({ name, money, stock: [{ id, name, price, desc }], bag: [{ id, name, count, price }],
  onBuy(id, n) → { ok, money, msg?, bag? }, onSell(id, n) → 同じ, onClose() });
UI.openInn({ name, price, money, party, onStay() → { ok, msg? }, onClose() });
UI.openStorage({ party, box, maxParty: 6, onMove(from: 'party'|'box', index) → { ok, party, box, msg? }, onClose() });

// タイトル(説明書の表紙)・名前入力
const t = UI.openTitle({ hasSave, version, onNew(), onContinue(), onSettings() });  // t.artEl = 表紙の 3D の場所
UI.openNameEntry({ title, initial, max: 6, onDone(name), onCancel() });

// 名札・手に入れた札(入力を止めない。自動で消える)
await UI.showAreaPlate('forest', { floor: '3F', sub, hold: 2200 });   // アクセント色も切りかえる
await UI.showGot({ name: 'つなぎネジ', count, kind: 'item'|'chest'|'gold'|'part'|'key', desc, hold });
```

### データの形

```ts
MonView = { id?, name, species?, lv, mat, hp, maxHp, mp, maxMp, status?, color?,
  stats?: { atk, def, spd, int }, xp?, nextXp?, gen?, bonus?,
  skills?: [{ id, name, el?, mp?, part? }],
  parts?: { head|back|tail: { label, from?, star?: 1..3, stat?, pct?, trait?, skill? } } }   // from があれば おさがり
BattleMon = { id, name, lv, mat, hp, maxHp, mp?, maxMp?, row?: 'front'|'back', status?, boss? }
```

### 3D を置く場所(技術美術班・モンスター工房へ)

`data-slot` のついた div を UI が空けておく。中に canvas を入れたら `is-live` クラスをつけると点線の枠が消える。

| data-slot | どこ |
|---|---|
| `title-art` | タイトルの表紙の絵 |
| `mon-detail` | メニュー → なかま → くわしく |
| `breed-child` / `breed-child-final` | 配合の予想 / 組み立ての ③ |
| `dex-viewer` | 図鑑の右のページ(指で回す) |
