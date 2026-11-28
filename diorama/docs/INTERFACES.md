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
  "spawns": [ { "l", "x0", "z0", "x1", "z1", "species": [[id, 重み]…], "lv": [下, 上], "n", "cond"?: "evening|shadow|light|beat", "disc"?: 台の上に出す【新】, "pack"?: [1体,2体,3体の割合]【新】 } ],
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

## field(diorama-builder — `src/field/field.js` `src/field/monsters.js`、three に依存しない)

```js
import { createField } from './field/field.js';
const f = createField(area, {
  state: save.areas[area.id],          // { gs, opened:[id], rares:{id:true} }。なければ新しく作る(持っていた物は元へ)
  flags: save.flags, abilities: save.abilities, clock: save.clock,
  rng,                                 // core/rng.js の rng か種の数字
  beat: (ms) => 拍の番号,              // 音響班の拍。省くと仮の defaultBeat(120 BPM = 500ms ごと)
  entry: 'south' | at: {l,x,z}, dir,   // 入る場所
  monsters: true, respawnMs: 90000,
});
let ev = f.update(dtMs);               // 毎フレーム。出来事の配列
```

| 関数 | 中身 |
|---|---|
| `hold(dir, run)` / `release()` | 押し続けでその向きへ1マスずつ歩く。dir は grid の DIRS の番号(0 東 +x / 1 南 +z / 2 西 -x / 3 北 -z)。カメラの向きに合わせて変えるのは UI 側 |
| `walkTo([l,x,z])` / `tapObject(id)` | タップした所まで自動で歩く(出口・ランプ台は行き先のときだけ通る)。物なら、いちばん近い調べられるマスまで歩いて調べる。人形に触れる・ランプ台に乗る・ふさがれると止まる。振り子は待つ |
| `interact()` / `use(id)` | 目の前の物(乗る物は足もと)を調べる・話す・動かす / 指定の物(となりにいるとき。向きも変える) |
| `update(ms)` | 歩く(1マス 歩き 220ms・走り 130ms)・人形が歩く・振り子に押し戻される・出なくなった人形が戻る |
| `setClock(clock)` | 時刻。時間帯が変わると住人が `night` の位置へ(夜)・夕方の魔物が出る/消える |
| `battleEnd(puppetId, 'win'\|'scout'\|'flee'\|'lose')` | 戦闘のあと。win/scout は消えて `respawnMs` のあいだ出ない(レアはもう出ない `state.rares`)、flee は2秒触れない、lose は置いていない物が戻り `lost` |
| `leave()` / `leaveState()` | エリアを出る。セーブの `areas[id]` に入れる `{gs, opened, rares}`(`gs.held` は null、運んでいた物は 'home'、くぼみに置いた物は置いたまま) |
| `pos()` `player` `puppets` `gs` `view` `busy` | 今の様子。`busy` = 'battle' / 'left' / null(止まっているあいだ update は何もしない)。`view` は住人を時間帯の位置に置いたエリア(grid の関数にはこれを渡す) |

**出来事**(`{ t, ... }`。描画と UI がアニメにする。座標は `[l,x,z]`)

| t | 項目 | いつ |
|---|---|---|
| move | from, to, dir, run, dur, h, ladder | 1マス歩いた |
| turn | dir | 向きを変えた |
| stairs | id, from, to, up | 階段で別の階へ |
| bump | at, why: blocked/pendulum | 進めなかった |
| fall | at, back | 光の当たる谷に落ちて、直前の足場へ |
| pushed | from, to, why: pendulum/exitClosed/holding | 押し戻された |
| wait | why | 自動で歩いていて、振り子を待っている |
| walkStart / arrive / stop / noPath / tooFar | to, steps, then / at / why / to | 自動で歩く |
| rotate | kind: disc/ring, id, to, by, player(いっしょに回った), puppets:[{id,from,to}], linked(歯車で回った輪) | 回転台・外周の床が90°回った |
| gearHalf | socket, gp | 大きい歯車が半回転(相手の輪はまだ回らない) |
| lamp | id, lamp, shadow:[マス番号] | ランプの向きが変わった(影の Set の中身) |
| pick / place / flag | item, from / item, socket, flag / flag | ピンセットでつまんだ・置いた・旗が立つ(立てるのはゲーム) |
| gimmickFail | id, msg | need-tweezers / hands-full / wrong-kind / standing … |
| chest / chestEmpty | id, item, qty, book?, flag?, shelf? | 宝箱・棚(1回だけ。`state.opened`) |
| talk | id, name, role, lines, face | 人と話す(face = 人がこちらを向く向き) |
| read | id, text, book?, role?, locked? | 看板・本・家具 |
| encounter | puppet, species, lv, count(群れの数 1〜3。spawns[].pack の割合), rule, first: 'player'(後ろから触れた=先制)/'enemy'(後ろから触れられた)/null, rare, rareId, shinyRate | 人形に触れた → 戦闘 |
| boss / goal | id, species, lv, flag / id, flag, text | ぬし・ボス / つなぎ目・塔の文字盤 |
| exit / exitClosed / say | id, to, entry, state / id, needFlag / key:'dropFirst' | 出口(state はセーブに入れる)/ 閉じている / 部品を置いてから |
| spawn / despawn / puppetMove / puppetTurn | puppet / id, why / id, from, to, dir / id, dir | 人形 |
| npcMove / period | id, from, to / tod | 住人の時間帯の移動 / 時間帯が変わった |
| lost | state | 戦闘で負けた |

人形の形: `{ id, sp, lv, l, x, z, dir, rule(出現の表の行), rare, rareId?, asleep? }`。レアは光る台座で眠る(動かない)。回転台・外周の床の上の人形は、台といっしょに回る(`rotate.puppets`)。

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
