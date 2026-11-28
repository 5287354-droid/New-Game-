// 音(sound-lab)のテスト。WebAudio はにせもの(tools/audio/fake_context.mjs)で代わりに動かす
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FakeAudioContext } from '../tools/audio/fake_context.mjs';
import { mel, barLengths, chords, minorize, beatInfo, cycle, midi, tones } from '../src/audio/theory.js';
import { THEME_A, THEME_B, CH_A, CH_B, CHM_A, CHM_B, compile, SONG_NAMES, JINGLE_NAMES, SONG_TRIM } from '../src/audio/songs.js';
import { SFX, SFX_NAMES, STEP_GROUNDS, GROUND } from '../src/audio/sfx.js';
import * as audio from '../src/audio/audio.js';

const REQUIRED_SONGS = ['village', 'tsumiki', 'forest', 'tower', 'battle', 'nushi', 'boss', 'title', 'workbench', 'ending'];
const REQUIRED_JINGLES = ['victory', 'scout', 'breed', 'levelup'];
const REQUIRED_SFX = ['place', 'roof', 'ok', 'cancel', 'cursor', 'step', 'turntable', 'lamp', 'tick', 'chest', 'hit', 'hitWeak', 'faint', 'fall'];

test('主題は16小節、どの小節も4拍', () => {
  assert.deepEqual(barLengths(THEME_A), Array(8).fill(4));
  assert.deepEqual(barLengths(THEME_B), Array(8).fill(4));
  assert.equal(chords(CH_A + ' ' + CH_B).len, 64);
  assert.equal(chords(CHM_A + ' ' + CHM_B).len, 64);
});

test('楽譜の読みとり', () => {
  assert.equal(midi('A4'), 69);
  assert.equal(midi('Bb3'), 58);
  const s = mel('C4:.5 r E4+G4:2 D4!');
  assert.equal(s.len, 4.5);
  assert.deepEqual(s.ev.map((e) => e.b), [0, 1.5, 3.5]);
  assert.deepEqual(s.ev[1].n, [64, 67]);
  assert.deepEqual(tones(chords('Am').at(0).c, 60, 3), [57, 60, 64]);
});

test('短調にすると、和音にない ミ・ラ・シ が半音下がる', () => {
  const m = minorize(mel('E5 A5 B5 B5'), chords('Cm:1 Fm:1 Eb:1 G:1'));
  assert.deepEqual(m.ev.map((e) => e.n), [midi('Eb5'), midi('Ab5'), midi('Bb5'), midi('B5')]);
});

test('必要な曲・ジングル・効果音がそろっている', () => {
  for (const n of REQUIRED_SONGS) assert.ok(SONG_NAMES.includes(n), n);
  for (const n of REQUIRED_JINGLES) assert.ok(JINGLE_NAMES.includes(n), n);
  for (const n of REQUIRED_SFX) assert.ok(SFX_NAMES.includes(n), n);
  for (const n of [...SONG_NAMES, ...JINGLE_NAMES]) assert.ok(SONG_TRIM[n] > 0, '補正がない: ' + n);
  // 地面の文字はすべて足音がある(grid.js の WALK)
  for (const ch of 'gpfkdsLcmrB') assert.ok(STEP_GROUNDS.includes(GROUND[ch]), ch);
});

test('曲の形: 小節に合った長さ、ループは小節の頭から、音は曲の中', () => {
  for (const n of [...SONG_NAMES, ...JINGLE_NAMES]) {
    const s = compile(n);
    assert.ok(s.bpm >= 60 && s.bpm <= 200, n);
    assert.ok(s.ev.length > 0, n);
    for (const e of s.ev) {
      assert.ok(e.b >= 0 && e.b < s.len, `${n}: ${e.b} が曲の外`);
      assert.ok(e.d > 0 && e.v > 0 && e.v <= 1.01, `${n}: 長さか強さがおかしい`);
      if (typeof e.n === 'number') assert.ok(e.n >= 24 && e.n <= 108, `${n}: 音域の外 ${e.n}`);
    }
    if (s.once) continue;
    assert.equal(s.len % s.bpb, 0, n);
    assert.equal(s.loopStart % s.bpb, 0, n);
    assert.ok(s.len - s.loopStart >= 16, n);
  }
});

test('時計塔: 4拍で振り子が1往復。ループの長さが4拍の倍数なので、継ぎ目で振り子がとばない', () => {
  const s = compile('tower');
  assert.equal(s.bpb, 4);
  assert.equal((s.len - s.loopStart) % 4, 0);
  // チク・タクが毎拍ある
  const ticks = s.ev.filter((e) => e.n === 'tick' || e.n === 'tock').map((e) => e.b);
  for (let b = 0; b < s.len; b++) assert.ok(ticks.includes(b), '拍 ' + b + ' にチクタクがない');
});

test('拍の時計', () => {
  const b = beatInfo(10.25, 10, 120, 4, 0);
  assert.equal(b.beat, 0);
  assert.ok(Math.abs(b.phase - 0.5) < 1e-9);
  const c = beatInfo(12.6, 10, 120, 4, 0.1); // 遅れ 0.1 秒を引く → 5拍
  assert.equal(c.beat, 5);
  assert.equal(c.bar, 1);
  assert.equal(c.beatInBar, 1);
  assert.equal(cycle(6, 4), 0.5);
  assert.equal(cycle(3, 4, 1), 0);
});

// にせの ctx で、曲を1周+α 予約し、WebAudio の約束を破らないか見る
function runSong(name, secs) {
  const ctx = new FakeAudioContext();
  ctx.state = 'running';
  const g = audio.buildGraph(ctx);
  const p = new audio.Player(ctx, name, 0.05, { out: g.bgm, revIn: g.bgmRevIn });
  for (let t = 0; t < secs; t += 0.1) { ctx.currentTime = t; p.schedule(t + 0.3); }
  if (p.errors) throw p.lastError;
  return { ctx, p };
}

test('すべての曲が1周以上つまずかずに鳴る(にせの ctx)', () => {
  for (const n of SONG_NAMES) {
    const s = compile(n);
    const loopSecs = (s.len * 60) / s.bpm;
    const { ctx, p } = runSong(n, loopSecs + 8);
    assert.ok(p.k >= 1, n + ' がループしていない');
    // 同時に作る音源の数(重さの目安): 1秒あたり 600 個まで
    const perSec = ctx.stats.sources / (loopSecs + 8);
    assert.ok(perSec < 600, `${n}: 1秒に ${perSec.toFixed(0)} 個`);
  }
});

test('ジングルは1回で終わる', () => {
  for (const n of JINGLE_NAMES) {
    const { p } = runSong(n, 8);
    assert.ok(p.ended, n);
  }
});

test('途中の拍から入れる(タップ前に流れていた曲に追いつく)', () => {
  const ctx = new FakeAudioContext();
  const g = audio.buildGraph(ctx);
  const s = compile('battle');
  const p = new audio.Player(ctx, 'battle', 0, { out: g.bgm, revIn: g.bgmRevIn, fromBeat: 100 });
  // 100拍目 = 前奏16 + 1周64 + 20 → 2周目の 36 拍目
  assert.equal(p.k, 1);
  assert.ok(s.ev[p.i].b >= 36 && s.ev[p.i - 1].b < 36);
});

test('すべての効果音が約束どおりに鳴る(にせの ctx)', () => {
  for (const n of SFX_NAMES) {
    const opts = n === 'step' ? [...STEP_GROUNDS, ...'gpfkdsLcmrB'].map((ground) => ({ ground })) : [{}, { dur: 1.2 }];
    for (const o of opts) {
      const ctx = new FakeAudioContext();
      const g = audio.buildGraph(ctx);
      const len = SFX[n](ctx, g.se, 0.01, { seed: 0.3, ...o }, { rev: g.seRevIn });
      assert.ok(len > 0 && len < 5, n);
      assert.ok(ctx.stats.sources > 0, n + ' が何も鳴らさない');
      assert.ok(ctx.stats.lastStart <= len + 0.01, `${n}: 返した長さ ${len} より後に音がある`);
    }
  }
});

test('エンジン: タップ前も拍が進む、タップで同じ拍から鳴る、音量5段階、フェードで切りかえ', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  globalThis.AudioContext = FakeAudioContext;
  audio._reset();
  assert.deepEqual(audio.getLevels(), { bgm: 3, se: 3 });

  audio.playBgm('tower');
  assert.equal(audio.currentBgm(), 'tower');
  assert.equal(audio.beat().bpm, 108);
  assert.equal(audio.sfx('tick'), 0); // まだ鳴らない

  assert.equal(await audio.unlock(), true);
  const E = audio._engine;
  assert.ok(E.bgm.player, 'タップでプレイヤーができる');
  E.ctx.currentTime += 1; // 曲の頭(0.08 秒先)を過ぎてから測る
  const before = audio.beat().beats;
  E.ctx.currentTime += 2;
  const after = audio.beat().beats;
  assert.ok(Math.abs(after - before - 2 * 108 / 60) < 0.05, '拍が ctx の時刻で進む');
  const pend = audio.pendulum(4);
  assert.ok(pend >= 0 && pend < 1);

  assert.ok(audio.sfx('step', { ground: 'm' }) > 0);
  assert.ok(audio.jingle('victory') > 2);
  assert.ok(audio.sfx('levelup') > 0, 'ジングルの名前は sfx からも呼べる');

  audio.playBgm('tower'); // 同じ曲 → そのまま
  assert.equal(E.old.length, 0);
  audio.playBgm('battle', { fade: 0.8 });
  assert.equal(E.old.length, 1, '古い曲はフェード中');
  assert.equal(audio.beat().song, 'battle');

  assert.equal(audio.setBgmLevel(9), 4);
  assert.equal(audio.setSeLevel(-3), 0);
  assert.equal(audio.sfx('ok'), 0, '効果音 0 なら鳴らさない');
  assert.deepEqual(JSON.parse(store.get('diorama.audio.v1')), { bgm: 4, se: 0 });
  audio._reset();
  assert.deepEqual(audio.getLevels(), { bgm: 4, se: 0 }, '音量は保存される');

  audio.stopBgm();
  assert.equal(audio.currentBgm(), null);
  assert.equal(audio.beat().song, null);
  audio._reset();
  delete globalThis.AudioContext;
});

test('測った音量(tools/audio/levels.json): 曲の RMS の幅 1.5dB 以内、ピークは -1dBFS 未満、継ぎ目が切れない', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../tools/audio/levels.json', import.meta.url)));
  const songs = Object.values(j.songs);
  assert.equal(songs.length, SONG_NAMES.length);
  const r = songs.map((s) => s.rms);
  assert.ok(Math.max(...r) - Math.min(...r) <= 1.5, 'RMS の幅 ' + (Math.max(...r) - Math.min(...r)));
  for (const s of [...songs, ...Object.values(j.jingles), ...Object.values(j.sfx)]) assert.ok(s.peak < -1, 'ピーク ' + s.peak);
  for (const s of songs) assert.ok(s.seamOk, s.label + ' の継ぎ目');
});
