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
