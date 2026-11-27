// 旗と進行・解禁の条件・会話の分岐・時刻。表は docs/DESIGN.md §1。
// 旗は save.flags[名前] = true。ほかのモジュールと同じく、セーブを直接書きかえる。

export const FLAGS = [
  'named', 'wokeUp', 'gotStarter', 'metChief', 'openTsumiki', 'clearTsumiki', 'openForest', 'breedUnlocked', 'firstBreed',
  'beatKageboushi', 'gotTweezers', 'openTower', 'tw_f2', 'tw_f3', 'tw_f4', 'tw_f5', 'tw_f6', 'beatTokeimori', 'ending',
  'ts_ladder', 'ts_plank', 'ts_block', 'fo_cutout', 'tw_room1', 'tw_room2', 'tw_room3', 'tw_room4', 'tw_room5',
];
export const STARTERS = ['nejiko', 'perari', 'inky'];
export const AREAS = ['village', 'tsumiki', 'forest', 'tower'];

// 場面の順(次の目的の表示に使う)。done の旗が立つまで、その場面が「いまの目的」
export const STEPS = [
  { id: 'name', done: 'named', goal: 'なまえを きめよう' },
  { id: 'wake', done: 'wokeUp', goal: 'へやを しらべよう' },
  { id: 'starter', done: 'gotStarter', goal: '工房で 親方に会おう' },
  { id: 'chief', done: 'metChief', goal: '村長の家へ いこう' },
  { id: 'tsumiki', done: 'clearTsumiki', goal: 'つみき野の 北のつなぎ目を なおそう' },
  { id: 'report', done: 'openForest', goal: '村長に 報告しよう' },
  { id: 'forest', done: 'beatKageboushi', goal: 'ランプの森の ぬしを たおそう' },
  { id: 'tweezers', done: 'gotTweezers', goal: '工房の 親方に 会おう' },
  { id: 'towerGate', done: 'openTower', goal: '時計塔の入口に 歯車を はめよう' },
  { id: 'tower', done: 'beatTokeimori', goal: 'ゼンマイ時計塔の 上をめざそう' },
  { id: 'ending', done: 'ending', goal: '時計塔が 鳴った!' },
];

export const has = (save, f) => !!save.flags?.[f];
export function setFlag(save, f, v = true) { save.flags = save.flags || {}; const was = !!save.flags[f]; if (v) save.flags[f] = true; else delete save.flags[f]; return !was && v; }

/**
 * 条件を調べる。会話の分岐・扉・宝箱・店などで使う。
 *   'clearTsumiki'           旗が立っている
 *   '!gotTweezers'           旗が立っていない
 *   ['a', '!b']              全部
 *   { any: [...] }           どれか
 *   { not: 条件 }
 *   { lv: 10 }               手持ちのだれかが Lv10 以上
 *   { item: 'patch', n: 2 }  道具を n 個以上
 *   { gold: 100 }            お金が 100 以上
 *   { ability: 'tweezers' }  能力
 *   { party: 'nejiko' }      手持ちにその種族
 *   { time: 'evening' }      時間帯(morning / day / evening / night)
 *   { caught: 5 }            図鑑で仲間にした種族の数
 */
export function check(save, cond) {
  if (cond == null || cond === true) return true;
  if (cond === false) return false;
  if (typeof cond === 'string') return cond.startsWith('!') ? !has(save, cond.slice(1)) : has(save, cond);
  if (Array.isArray(cond)) return cond.every((c) => check(save, c));
  if (cond.any) return cond.any.some((c) => check(save, c));
  if (cond.not) return !check(save, cond.not);
  if (cond.lv != null) return (save.party || []).some((u) => save.monsters[u]?.lv >= cond.lv);
  if (cond.item) return (save.bag?.[cond.item] || 0) >= (cond.n ?? 1);
  if (cond.gold != null) return (save.gold || 0) >= cond.gold;
  if (cond.ability) return !!save.abilities?.[cond.ability];
  if (cond.party) return (save.party || []).some((u) => save.monsters[u]?.sp === cond.party);
  if (cond.time) return timeOfDay(save.clock ?? 0) === cond.time;
  if (cond.caught != null) return Object.keys(save.dex?.caught || {}).length >= cond.caught;
  throw new Error('わからない条件: ' + JSON.stringify(cond));
}

// 会話の分岐: lines = [{ if: 条件, say: '…' | ['…', '…'], set?: '旗' | ['旗'] }, …] の上から、条件に合う最初のもの
export function pickLine(save, lines) {
  for (const l of lines) if (check(save, l.if)) return l;
  return null;
}
// pickLine して set の旗も立てる。返す: { say:[…], set:[新しく立った旗] }
export function talk(save, lines) {
  const l = pickLine(save, lines);
  if (!l) return { say: [], set: [] };
  const set = [].concat(l.set || []).filter((f) => setFlag(save, f));
  return { line: l, say: [].concat(l.say || []), set };
}

// エリアに入れるか(作業台の箱)
export function areaOpen(save, area) {
  switch (area) {
    case 'village': return true;
    case 'tsumiki': return has(save, 'openTsumiki');
    case 'forest': return has(save, 'openForest');
    case 'tower': return has(save, 'openTower');
    default: return false;
  }
}
export const canLeaveVillage = (save) => has(save, 'gotStarter');
export const canBreedNow = (save) => has(save, 'breedUnlocked');
export const nextGoal = (save) => STEPS.find((s) => !has(save, s.done)) || null;

/**
 * 物語の出来事を起こし、立った旗を返す。会話の文はデータ側(UI)。
 *   'name' {name}        名前 → named
 *   'wake'               → wokeUp(タンスの ばんそうこう×2 は宝箱の扱い)
 *   'starter' {sp}       → gotStarter(個体を作るのは呼ぶ側: createMonster → addCaught)
 *   'talkChief'          → metChief・openTsumiki / clearTsumiki のあとなら openForest
 *   'talkBolt'           → beatKageboushi のあとなら gotTweezers(abilities.tweezers) / clearTsumiki かつ Lv10 なら breedUnlocked
 *   'clearTsumiki' 'beatKageboushi' 'beatTokeimori' 'ending' 'openTower'
 *   'floor' {n}          → tw_f{n}(2〜6)
 *   'place' {id}         → ピンセットで正しく置いた(ts_ladder など)
 * 返す: { set:[旗], say?: 台詞のキー }
 */
export function storyEvent(save, ev, arg = {}) {
  const set = [];
  const S = (f) => { if (setFlag(save, f)) set.push(f); };
  let say = null;
  switch (ev) {
    case 'name': save.player = save.player || {}; save.player.name = (arg.name || 'ピン').slice(0, 8); S('named'); break;
    case 'wake': S('wokeUp'); break;
    case 'starter':
      if (!STARTERS.includes(arg.sp)) throw new Error('最初の魔物ではない: ' + arg.sp);
      S('gotStarter'); save.starter = arg.sp; say = 'bolt.starter'; break;
    case 'talkChief':
      if (!has(save, 'metChief')) { S('metChief'); S('openTsumiki'); say = 'chief.first'; }
      else if (has(save, 'clearTsumiki') && !has(save, 'openForest')) { S('openForest'); say = 'chief.report'; }
      else if (has(save, 'beatTokeimori')) say = 'chief.thanks';
      else say = 'chief.hint';
      break;
    case 'talkBolt':
      if (has(save, 'beatKageboushi') && !has(save, 'gotTweezers')) {
        S('gotTweezers'); save.abilities = save.abilities || {}; save.abilities.tweezers = true; say = 'bolt.tweezers';
      } else if (has(save, 'clearTsumiki') && !has(save, 'breedUnlocked') && check(save, { lv: 10 })) {
        S('breedUnlocked'); say = 'bolt.breed';
      } else if (!has(save, 'gotStarter')) say = 'bolt.starter';
      else if (has(save, 'clearTsumiki') && !has(save, 'breedUnlocked')) say = 'bolt.grow';
      else say = 'bolt.hint';
      break;
    case 'clearTsumiki': case 'beatKageboushi': case 'beatTokeimori': case 'ending': case 'openTower': S(ev); break;
    case 'floor': if (arg.n >= 2 && arg.n <= 6) S('tw_f' + arg.n); break;
    case 'place': if (FLAGS.includes(arg.id)) S(arg.id); break;
    default: throw new Error('知らない出来事: ' + ev);
  }
  return { set, say };
}

// ---------- 時刻 ----------
// 1日 = 実時間20分 = ゲーム内 1440分。朝 6:00〜 / 昼 12:00〜 / 夕 18:00〜 / 夜 0:00〜(それぞれ実時間5分)
export const GAME_MIN_PER_REAL_MS = 1440 / (20 * 60 * 1000);
export function timeOfDay(clock) {
  const c = ((Math.floor(clock) % 1440) + 1440) % 1440;
  if (c < 360) return 'night';
  if (c < 720) return 'morning';
  if (c < 1080) return 'day';
  return 'evening';
}
export function advanceClock(save, realMs) {
  save.clock = (((save.clock ?? 360) + realMs * GAME_MIN_PER_REAL_MS) % 1440 + 1440) % 1440;
  save.playMs = (save.playMs || 0) + realMs;
  return timeOfDay(save.clock);
}
export function clockText(clock) {
  const c = Math.floor(clock) % 1440;
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

// ---------- 達成率(エンディング・図鑑) ----------
export function completion(db, save) {
  const all = Object.values(db.species);
  const caught = all.filter((s) => save.dex?.caught?.[s.id]).length;
  const seen = all.filter((s) => save.dex?.seen?.[s.id]).length;
  const partsTotal = all.filter((s) => !s.noBreed).length * 3;
  const pv = Object.values(save.dex?.parts || {});
  return {
    seen, caught, total: all.length, dexPct: Math.round((caught / all.length) * 100),
    parts: pv.filter((v) => v >= 1).length, goldParts: pv.filter((v) => v >= 2).length, partsTotal,
    partsPct: Math.round((pv.filter((v) => v >= 1).length / partsTotal) * 100),
  };
}
