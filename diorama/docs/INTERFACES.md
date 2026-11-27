# 班どうしのつなぎ目(INTERFACES.md)

作った班が書き、使う班が読む。ここは engineer の節(stats / battle / breed / save / inventory / story)。ほかの班の節は、その班が足す。

## 共通: db と乱数(engineer)

`src/core/` はすべて three に依存しない ES モジュール(ブラウザでも node でも動く)。JSON は呼ぶ側が読む。

```js
import { makeDB, loadDBFetch } from './core/db.js';
const db = await loadDBFetch('./data/');   // または makeDB({ monsters, skills, breed, items })
import { makeRng } from './core/rng.js';   // 種つきの乱数。rng = { next, int(a,b), range(a,b), chance(p), pick(arr), state }
```

- ほかの関数は、すべて `db` を第1引数にとる。乱数を使う関数は `rng`(rng か種の数字)を受けとる。テストは `fixedRng([...])` で差しかえる
- 個体(魔物1体)の形 = セーブの `monsters[uid]`(DESIGN §7)。`{ uid, sp, nick, lv, xp, hp, mp, skills[4], status:'burn'|null, shiny, gen, bonus, parts:{head,back,tail}, parents, born, isBoss? }`
- おさがりパーツ = `parts[場所] = { from:'nejiko', slot:'back', star:1..3, shiny, history:['nejiko', …] }`。`null` は生まれつき

## stats(src/core/stats.js)

| 関数 | 中身 |
|---|---|
| `createMonster(db, { sp, lv, nick, skills, inherit, parts, bonus, gen, shiny, shinyRate, rng, born, parents, boss })` | 個体を作る。HP・MP は満タン。`shiny` を省くと 1/256(`shinyRate`)で抽選。`boss:true` はぬし・ボスとして出る個体(HP×hpMul) |
| `calcStats(db, mon)` | `{hp,mp,atk,def,spd,int}`(Lv・伸びボーナス・パーツ%) |
| `partsOf(db, mon)` | 3か所 `[{ slot, from, srcSlot, star, mul, def:{label,stat,pct,trait,skill}, shiny, inherited, history }]` … 描画(monster-forge)はこれで組み立てる。`star` 2=銀線 3=金つぎ、`shiny` はきらり色のまま |
| `partPct` / `traitsOf` / `partSkills` / `usableSkills` | パーツの% / 特性 `{名前:{star,gold}}` / パーツわざ(5つ目の枠)/ 戦闘で使えるわざ全部 |
| `xpForLevel(L)` `levelForXp(xp)` | 経験値の表 |
| `gainXp(db, mon, n)` | 出来事 `xp` `levelUp{lv,gain}` `learn{skill}` `learnFull{skill}`(4つ埋まっている → UI で `learnSkill(mon, skill, 忘れるわざ)`) |
| `healFull(db, mon)` `displayName(db, mon)` | 全回復 / 名前 |

## battle(src/core/battle.js)

```js
const b = createBattle(db, { allies: partyMons, enemies, rng, bag: save.bag, first: 'ally'|'enemy'|null });
// enemies: wildEnemies(db, [{sp,lv},…], rng) / bossEnemies(db, 'kageboushi'|'tokeimori', rng)
playEvents(b.startEvents);
while (!b.over) {
  const cmds = { a0: { cmd:'skill', skill:'tackle', target:'e1' }, a1: { cmd:'attack' }, a2: { cmd:'swap', with:'a3' } };
  playEvents(submit(b, cmds));            // 1ターン。書かなかった味方・正しくないコマンドは自動(autoAction)
}
const more = applyBattleResult(db, save, b); // 経験値・お金・図鑑・スカウトした子・負けの処理 → 出来事の列
```

- 魔物の key: 味方 `a0`〜`a5`(手持ちの順)、敵 `e0`〜(補充は `e3` `e4`)。`b.field.ally = [前列, 前列, 後列]`(key か null)、控えはそれ以外
- コマンド: `{cmd:'attack', target}` / `{cmd:'skill', skill, target}` / `{cmd:'swap', with:key}`(前後の入れかえ・控えと交代)/ `{cmd:'item', item, target}` / `{cmd:'scout', target, varnish?:true}` / `{cmd:'run'}` / `{cmd:'wait'}`
- UI 用: `availableCommands(b, key)` → `{ attack, skills:[{id, ok, reason:'back'|'mp'|null, part}], swap:[key], items:[id], scout, run }`、`validTargets(b, key, skillId)`、`getView(b)`(画面の写し: field / bench / phase / nextPhase / hand / bag)
- 確率の下見: `scoutChance(b, enemyUnit, {varnish})`、`runChance(b)`、`hitChance`、`calcDamage`
- `b.result = { outcome:'win'|'lose'|'escape'|'scout'|'timeout', turns, xp:[{unit, idx, amount}], gold, defeated, scouted? }`
- デバッグ: `forceFinish(b, 'win'|'lose')`、`runAuto(b, maxTurns)`

### 出来事の列(演出班がアニメにする)

| type | 中身 | いつ |
|---|---|---|
| `start` | kind('wild'/'boss'), rule('kageboushi'/'tokeimori'/null), first, field | はじめ(`b.startEvents`) |
| `trait` | trait('rattle'), side | 鈴が鳴る |
| `turnStart` | turn, phase?/next?(カゲボウシ: 'light'/'shadow')、hand?(トケイモリ: 0=12時 1=3時 2=6時 3=9時) | ターンのはじめ |
| `phase` | phase, next, forced? | ランプの予告 / ひかりのつぶで次が光に |
| `hand` | hand | トケイモリ戦のはじめ |
| `surprised` | side | 先制された側は1ターン目に動かない |
| `reinforce` | unit, sp, slot, left | トケイモリの手下の補充 |
| `order` | order:[key] | このターンの順番 |
| `action` | actor, skill('attack' はたたかう), name, targets, mp | わざを出した |
| `fail` | actor, skill/item, why('back'/'mp'/'none') | 出せなかった |
| `cantAct` | actor, why('sleep') | ねむっている |
| `wait` | actor | 何もしない |
| `miss` | actor, target, chance | はずれ |
| `damage` | target, amount, lost, hp, maxHp, crit, elem(1.5/0.67/1), skill, actor, row | ダメージ |
| `endure` | target, left | つぎはぎで HP1 で耐えた |
| `faint` | target, side | たおれた |
| `heal` | target, amount, hp, maxHp, why('skill'/'item'/'drain'/'regen') | 回復 |
| `status` / `statusBlocked` / `statusMiss` / `statusEnd` | target, status, turns / why('immune'/'already') | 状態異常 |
| `wake` | target | ダメージで起きた |
| `cure` | target, status | 状態異常が直った |
| `buff` / `buffEnd` | target, stat('atk'/'def'/'spd'/'eva'), mul(合計), by, turns | ばふ・でばふ |
| `shield` / `shieldBreak` | target, mul | おりがみのたて |
| `guard` / `cover` | actor→target / by, for | かばう(構え / 実際に受けた) |
| `swap` | side, out, in, from, to, field | いれかえ |
| `enter` | side, unit, slot, out | 控えが台に出た |
| `advance` | side, unit, field | 前列がいなくなり後列が前へ |
| `rotate` | hand, field:{ally,enemy} | トケイモリ: 台が回って前後が入れかわった |
| `item` / `revive` / `mp` / `varnish` | actor, item, target, left / hp / mp / mul | 道具 |
| `scout` | actor, target, chance, success, shakes(0〜3: 箱がゆれる回数) | スカウト |
| `run` | actor, success, chance, why('boss'/'trait'/'item') | にげる |
| `burnTick` | target, amount, hp | こげのダメージ |
| `flee` | target | ぬしが倒れて手下が逃げた |
| `end` | outcome, xp, gold, scouted | 決着 |

`applyBattleResult` の出来事: `xp` `levelUp` `learn` `learnFull`(unit つき)、`gold{amount,total}`、`caught{sp,uid,where:'party'|'box'|'full',shiny}`、`defeat{goldLost,gold,wakeAt}`

## breed(src/core/breed.js)

| 関数 | 中身 |
|---|---|
| `childSpecies(db, sp1, sp2, flags, wornParts)` | `{id, special?}`。表と特別な組み合わせ(`tools/check/breed_check.mjs` と同じ) |
| `breedPreview(db, a, b, { flags, items, save })` | 見開きの下見: `{ child, partChoices:[{from:'a'|'b', slot, src, label, stat, pct, trait, skill, star, gold, shiny, history}], skillChoices, maxParts, bonus, gen, ok, why }` |
| `breed(db, a, b, { parts:[{from, slot}], skills:[id], items:[id], flags, rng, nick, keep })` | `{ child, events, overflow }`。events: `breedStart{a,b,child,special}` `partAttach{slot,src,star,gold,shiny}` `skillInherit{skill}` `born{sp,shiny,gen,bonus}` |
| `breedInSave(db, save, uidA, uidB, opts)` | セーブの上で: 親を消す・道具をへらす・子を手持ちへ・部品表・ごほうび・`firstBreed`。`{ ok, why, child, uid, where, events, newParts, rewards }` |
| `canBreed` `breedTable` `registerParts` `claimPartRewards` `partsCount` `wornParts` | 条件('locked'/'same'/'noBreed'/'lv')・全組み合わせの表・部品表 |

## save(src/core/save.js)

- `SAVE_VERSION = 2`。キー `diorama.save.v1`(手動)・`diorama.auto.v1`(オート)・`diorama.settings`(キーの名前は枠の名前。形の版は中の `v`)
- `createStore(backend?)` → `{ save(save, 'manual'|'auto'), load(slot), has, remove, loadLatest, saveSettings, loadSettings }`。backend は localStorage と同じ形。なければ localStorage → メモリ
- `newSave(name)`、`migrate(obj)`(`MIGRATIONS[v]`)、`validate(save)`(問題の配列)、`exportText(save)` / `importText(text)`(`DMK1:` + base64)、`resetLooseItems(save)`(ピンセットで持っていた物を元へ。保存のとき自動)
- v1 → v2: 魔物に `uid`、`nextUid`、`stats.defeats`、`books`、`rewards`、`player.cam` を足し、`gs.held` を元にもどす。テストは `tests/save.test.mjs` と `tests/fixtures/save_v1.json`

## inventory(src/core/inventory.js)

- 道具: `addItem(save,id,n)` `removeItem` `count` `useFieldItem(db, save, id, mon)` → `{ok, why:'none'|'noEffect'|'notField', changes}`
- お店: `shopList(db, save)`(`open:'forest'` は旗 `openForest` まで並ばない)`buy(db,save,id,n)` `sell` `sellPrice` `addGold`
- 手持ち・預かり: `addCaught(save, mon)` → 'party'|'box'|'full'(uid をつけ図鑑に登録)、`removeMonster` `toBox` `toParty` `swapBox` `reorderParty` `partyMons` `hasAbleMonster` `newUid`
- 宿屋: `restAtInn(db, save, innId)`(全回復・`lastInn`・朝6時)

## story(src/core/story.js)

- 旗: `has(save,f)` `setFlag(save,f)`、`storyEvent(save, ev, arg)` → `{ set:[立った旗], say:'台詞のキー' }`。ev = `name` `wake` `starter{sp}` `talkChief` `talkBolt` `clearTsumiki` `beatKageboushi` `openTower` `floor{n}` `place{id}` `beatTokeimori` `ending`
- 条件: `check(save, cond)`。cond = `'旗'` `'!旗'` `[全部]` `{any:[…]}` `{not}` `{lv:10}` `{item:'patch',n}` `{gold}` `{ability:'tweezers'}` `{party:'nejiko'}` `{time:'evening'}` `{caught:5}`
- 会話の分岐: `talk(save, [{ if: cond, say: '…'|['…'], set: '旗' }, …])` → 上から最初に合うもの
- 解禁: `areaOpen(save, area)` `canLeaveVillage` `canBreedNow` `nextGoal(save)`(いまの目的の文)
- 時刻: `timeOfDay(clock)`('morning'/'day'/'evening'/'night')`advanceClock(save, 実時間ms)` `clockText`
- 達成率: `completion(db, save)` → 図鑑・部品表(57マス+金)の%

## デバッグ口(src/core/debug.js)

`main.js` が `window.__debug = { ...makeCoreDebug({ db, getSave, setSave, store, getBattle, onChange }), ...画面の操作 }` として付ける。
`state flags setFlag story goal skipTo(場面id) give gold addMon(sp,lv) setLv(uid,lv) healAll party battle turn autoTurn autoBattle winBattle loseBattle breedPreview breed save load exportText importText validate`

## テストの流し方

`node --test tests/`(node 22 はフォルダを直接ひらけないので、`tests/package.json` の main → `tests/run_all.mjs` がこのフォルダの `*.test.mjs` を全部読む。新しいテストは `tests/〜.test.mjs` に置くだけでよい。`tests/` の .js は ES モジュール扱い)

## forge(monster-forge / `src/forge/forge.js`)

```js
import { createForge, SPECIES_SCALE, TRI_LIMIT } from './forge/forge.js';

const forge = await createForge({ url: 'assets/models/parts.glb', monsters });   // monsters = data/monsters.json の中身
// gltf を読み終えているなら createForge({ gltfScene: gltf.scene, monsters })

const geo = forge.build({
  species: 'nejiko',            // 種の id
  shiny: false,                 // きらり(色違い)
  osagari: {                    // おさがりパーツ(どれも省略できる)
    head: 'tsumiking',                                   // 種 id だけ → ★1、子の色で塗り直す
    back: { from: 'zenmainu', star: 3 },                 // star 1..3(★2 銀線 / ★3 金つぎ)
    tail: { from: 'hotarubin', shinyFrom: 'hotarubin' }, // きらりの親のパーツ → その種のきらり色のまま
  },
});
// geo: THREE.BufferGeometry(index つき・1体 = 1形状 = 1描画)
//   属性 position / normal / color(素材の色, linear) / aMat(vec4: スロット 0体 1差し色 2目, 素材, ★, きらり) / aPart(vec4: パーツ内の位置, 場所 0胴 1頭 2背中 3しっぽ)
//   geo.userData = { species, shiny, parts: {head, back, tail: 付けている種}, triangles, height, scale }
//   原点 = 足もとの中心。+Z が正面、+Y が上。高さはだいたい 1。ぬし・ボスは userData.scale 倍で置く

const mat = forge.material('A');          // 'A' つやソフビ / 'B' マット塗装。全員で1つを共有(同じ文字なら同じ物が返る)
scene.add(new THREE.Mesh(geo, mat));      // 戦闘・図鑑: 1体 1 Mesh

const batch = forge.batch(mat, { max: 24 });   // フィールド: BatchedMesh 1つ = 全員で1描画
scene.add(batch.mesh);
const id = batch.add(geo, matrix4);       // r160 は 1形状 = 1体(同じ種が2体なら2回 add)
batch.move(id, matrix4); batch.show(id, false); batch.remove(id);

forge.triangles('head_nejiko');           // パーツの三角形数
mat.userData.uniforms.uTime.value = t;    // (予約。今は使っていない)
```

- 低いレベルの関数も export している: `loadParts(url)` `partsFromScene(scene)` `buildMonster(lib, speciesById, spec)` `createMonsterMaterial(style, over)` `createMonsterBatch(material, opts)` `palette(sp, shiny)`
- 規格: 1体 ≤ `TRI_LIMIT`(4000)△。どのおさがりの組み合わせでも超えない(`tests/forge.test.mjs` で 20×20 を確かめる)
- 影はふつうの `castShadow` / `receiveShadow` でよい(頂点を動かしていないので、影のマテリアルの差しかえは要らない)
- 焼くのは「組み上がったとき」に1回(配合・スカウト・読みこみ時)。毎フレーム焼かない

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
