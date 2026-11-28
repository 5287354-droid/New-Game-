// 音のエンジン(sound-lab)。外部の音声ファイルは使わず、WebAudio ですべて合成する。
//
//   import * as audio from './audio/audio.js';
//   audio.initAudio();               // 最初のタップ・キーで AudioContext を起こす
//   audio.playBgm('village');        // フェードで切りかえ
//   audio.sfx('step', { ground: 'g' });
//   audio.jingle('victory');         // BGM を下げて鳴らす
//   audio.beat();                    // 今の曲の拍(振り子の通路が使う)
//
// くわしくは docs/INTERFACES.md の「audio」。
import { compile, SONG_NAMES, JINGLE_NAMES, songInfo } from './songs.js';
import { INSTRUMENTS } from './instruments.js';
import { SFX, SFX_NAMES, GROUND, STEP_GROUNDS } from './sfx.js';
import { beatInfo, cycle, rng } from './theory.js';

export { SONG_NAMES, JINGLE_NAMES, SFX_NAMES, GROUND, STEP_GROUNDS, songInfo, cycle };

// 5段階(0=消音 … 4=最大)。耳の感じ方に合わせた曲線
export const LEVEL_GAINS = [0, 0.16, 0.36, 0.64, 1];
export const DEFAULT_LEVELS = { bgm: 3, se: 3 };
const STORE = 'diorama.audio.v1';

const LOOKAHEAD = 0.3; // 何秒先まで予約するか
const LOOKAHEAD_HIDDEN = 1.5; // 裏に回ったとき(タイマーが遅くなる)
const BGM_HEADROOM = 0.42; // 曲どうしの RMS をそろえたあとの全体の大きさ
const SE_HEADROOM = 0.8;

// ---------- 音の通り道 ----------
// 曲 → [曲のフェード] → bgmLevel → duck → master ─┐
// 効果音 ──────────────→ seLevel ─────→ master ─┤→ やわらかいコンプ → リミッター → 出力
// 残響(BGM 用・効果音用)は、それぞれの音量の手前に戻す
function impulse(ctx, secs, decay, seed) {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const r = rng(seed);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      d[i] = (r() * 2 - 1) * Math.pow(1 - x, decay) * (i < ctx.sampleRate * 0.008 ? i / (ctx.sampleRate * 0.008) : 1);
    }
  }
  return buf;
}

export function buildGraph(ctx, levels = DEFAULT_LEVELS) {
  const g = {};
  g.comp = ctx.createDynamicsCompressor();
  g.comp.threshold.value = -14;
  g.comp.knee.value = 10;
  g.comp.ratio.value = 2.5;
  g.comp.attack.value = 0.012;
  g.comp.release.value = 0.25;
  g.limit = ctx.createDynamicsCompressor();
  g.limit.threshold.value = -2.5;
  g.limit.knee.value = 0;
  g.limit.ratio.value = 20;
  g.limit.attack.value = 0.002;
  g.limit.release.value = 0.1;
  g.master = ctx.createGain();
  g.master.connect(g.comp).connect(g.limit).connect(ctx.destination);

  g.duck = ctx.createGain();
  g.duck.connect(g.master);
  g.bgm = ctx.createGain();
  g.bgm.gain.value = LEVEL_GAINS[levels.bgm] * BGM_HEADROOM;
  g.bgm.connect(g.duck);
  g.jin = ctx.createGain(); // ジングルは BGM の音量に従う(ダックの外)
  g.jin.gain.value = LEVEL_GAINS[levels.bgm] * BGM_HEADROOM;
  g.jin.connect(g.master);
  g.se = ctx.createGain();
  g.se.gain.value = LEVEL_GAINS[levels.se] * SE_HEADROOM;
  g.se.connect(g.master);

  g.bgmRev = ctx.createConvolver();
  g.bgmRev.buffer = impulse(ctx, 2.6, 3.2, 7);
  g.bgmRevIn = ctx.createGain();
  g.bgmRevIn.connect(g.bgmRev).connect(g.bgm);
  g.jinRevIn = ctx.createGain();
  const jr = ctx.createConvolver();
  jr.buffer = g.bgmRev.buffer;
  g.jinRevIn.connect(jr).connect(g.jin);
  g.seRev = ctx.createConvolver();
  g.seRev.buffer = impulse(ctx, 1.2, 3.5, 11);
  g.seRevIn = ctx.createGain();
  g.seRevIn.gain.value = 0.7;
  g.seRevIn.connect(g.seRev).connect(g.se);
  return g;
}

// ---------- 曲を鳴らす係 ----------
// start: 曲の頭(0拍目)の ctx の時刻。fromBeat より前の音はとばす(途中から入るとき)
export class Player {
  constructor(ctx, name, start, { out, revIn, fromBeat = 0, fade = 0 } = {}) {
    this.ctx = ctx;
    this.s = compile(name);
    this.name = name;
    this.start = start;
    this.spb = 60 / this.s.bpm;
    this.out = ctx.createGain();
    this.revOut = ctx.createGain();
    const lv = this.s.gain;
    if (fade > 0) {
      this.out.gain.setValueAtTime(0, Math.max(ctx.currentTime, start));
      this.out.gain.linearRampToValueAtTime(lv, Math.max(ctx.currentTime, start) + fade);
      this.revOut.gain.setValueAtTime(0, Math.max(ctx.currentTime, start));
      this.revOut.gain.linearRampToValueAtTime(lv * this.s.rev, Math.max(ctx.currentTime, start) + fade);
    } else {
      this.out.gain.value = lv;
      this.revOut.gain.value = lv * (this.s.rev ?? 0.3);
    }
    this.out.connect(out);
    this.revOut.connect(revIn);
    this.tracks = this.s.tracks.map((t) => {
      const g = ctx.createGain();
      g.gain.value = t.vol;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = t.pan; g.connect(p).connect(this.out); } else g.connect(this.out);
      const send = ctx.createGain();
      send.gain.value = t.rev;
      g.connect(send).connect(this.revOut);
      return { g, play: INSTRUMENTS[t.inst] };
    });
    this.rand = rng(name.length * 977 + 13);
    // 再生の位置
    this.cycleLen = this.s.len - this.s.loopStart;
    this.loopIdx = this.s.ev.findIndex((e) => e.b >= this.s.loopStart);
    this.i = 0;
    this.k = 0; // ループの回数
    this.ended = false;
    this.stopped = false;
    this.errors = 0;
    this.seek(fromBeat);
  }

  absBeat(e, k) {
    return e.b < this.s.loopStart ? e.b : e.b + k * this.cycleLen;
  }

  seek(beat) {
    const s = this.s;
    if (beat <= 0) { this.i = 0; this.k = 0; return; }
    if (s.once || beat < s.loopStart) {
      this.k = 0;
      this.i = s.ev.findIndex((e) => e.b >= beat);
      if (this.i < 0) { if (s.once) this.ended = true; else { this.i = this.loopIdx; this.k = 1; } }
      return;
    }
    this.k = Math.floor((beat - s.loopStart) / this.cycleLen);
    const inLoop = beat - s.loopStart - this.k * this.cycleLen + s.loopStart;
    this.i = s.ev.findIndex((e) => e.b >= inLoop && e.b >= s.loopStart);
    if (this.i < 0) { this.i = this.loopIdx; this.k++; }
  }

  // until(ctx の時刻)までの音を予約する
  schedule(until) {
    if (this.ended || this.stopped) return;
    const s = this.s;
    const now = this.ctx.currentTime;
    let guard = 0;
    while (guard++ < 2000) {
      if (this.i >= s.ev.length) {
        if (s.once || this.loopIdx < 0) { this.ended = true; return; }
        this.i = this.loopIdx;
        this.k++;
      }
      const e = s.ev[this.i];
      let b = this.absBeat(e, this.k);
      const frac = b - Math.floor(b);
      if (s.swing && Math.abs(frac - 0.5) < 1e-6) b += s.swing;
      const t = this.start + b * this.spb;
      if (t >= until) return;
      this.i++;
      if (t < now - 0.02) continue; // 遅れた音は鳴らさない(つまりを防ぐ)
      const tr = this.tracks[e.ti];
      const v = e.v * (0.94 + this.rand() * 0.12);
      try { tr.play(this.ctx, tr.g, Math.max(t, now), e.n, e.d * this.spb, v); } catch (err) { this.errors++; this.lastError = err; /* 1音の失敗で曲を止めない */ }
    }
  }

  fadeOut(t, secs) {
    for (const g of [this.out.gain, this.revOut.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + secs);
    }
    this.stopAt = t + secs;
  }

  disconnect() {
    this.stopped = true;
    try { this.out.disconnect(); this.revOut.disconnect(); } catch (e) { /* もう外れている */ }
  }

  // 曲の長さ(秒)。once の曲(ジングル)は残響を足さない長さ
  get seconds() { return this.s.len * this.spb; }
}

// ---------- エンジン本体(1つだけ) ----------
const E = {
  ctx: null,
  g: null,
  levels: loadLevels(),
  offset: 0, // 時計 = ctx.currentTime + offset(ctx がないうちは performance.now)
  bgm: null, // { name, start(時計の秒), player }
  old: [], // フェード中の古い曲
  jingles: [],
  timer: null,
  listeners: [],
  beatSubs: new Set(),
  lastBeat: -1,
  duckUntil: 0,
};

function perfNow() {
  return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
}
function clock() {
  return E.ctx ? E.ctx.currentTime + E.offset : perfNow();
}
const toCtx = (c) => c - E.offset;

function loadLevels() {
  try {
    const j = JSON.parse(globalThis.localStorage?.getItem(STORE) || 'null');
    if (j && Number.isInteger(j.bgm) && Number.isInteger(j.se)) return { bgm: clampLv(j.bgm), se: clampLv(j.se) };
  } catch (e) { /* 読めなければ既定 */ }
  return { ...DEFAULT_LEVELS };
}
function saveLevels() {
  try { globalThis.localStorage?.setItem(STORE, JSON.stringify(E.levels)); } catch (e) { /* 保存できなくても鳴らす */ }
}
const clampLv = (n) => Math.max(0, Math.min(4, Math.round(Number(n) || 0)));

// 最初のタップ・キーで起こす。何度呼んでもよい
export function initAudio({ target = globalThis.window } = {}) {
  if (!target || E.listeners.length) return;
  const h = () => { unlock(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) {
    target.addEventListener(ev, h, { passive: true });
    E.listeners.push([ev, h, target]);
  }
  globalThis.document?.addEventListener?.('visibilitychange', onVisibility);
}

function removeUnlockListeners() {
  for (const [ev, h, target] of E.listeners) target.removeEventListener(ev, h);
  E.listeners = [];
}

function onVisibility() {
  if (!E.ctx) return;
  if (globalThis.document.hidden) E.ctx.suspend?.();
  else E.ctx.resume?.();
}

export async function unlock() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  if (!E.ctx) {
    const before = clock();
    E.ctx = new AC({ latencyHint: 'interactive' });
    E.offset = before - E.ctx.currentTime; // 時計がとばないように
    E.g = buildGraph(E.ctx, E.levels);
    // iOS 用: 無音を1つ鳴らす
    const b = E.ctx.createBuffer(1, 1, E.ctx.sampleRate);
    const s = E.ctx.createBufferSource();
    s.buffer = b;
    s.connect(E.ctx.destination);
    s.start(0);
    if (E.bgm) startBgmPlayer(0.6);
    E.timer = setInterval(tick, 25);
    E.timer.unref?.(); // node のテストでプロセスを止めない
  }
  if (E.ctx.state !== 'running') {
    try { await E.ctx.resume(); } catch (e) { return false; }
  }
  if (E.ctx.state === 'running') removeUnlockListeners();
  return E.ctx.state === 'running';
}

export const isUnlocked = () => !!E.ctx && E.ctx.state === 'running';

// 今の曲のプレイヤーを作る(途中の拍から入る)
function startBgmPlayer(fade) {
  const b = E.bgm;
  const nowBeat = Math.max(0, ((clock() - b.start) * compile(b.name).bpm) / 60);
  b.player = new Player(E.ctx, b.name, toCtx(b.start), { out: E.g.bgm, revIn: E.g.bgmRevIn, fromBeat: nowBeat + 0.01, fade });
}

function tick() {
  if (!E.ctx) return;
  const ahead = globalThis.document?.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
  const until = E.ctx.currentTime + ahead;
  if (E.bgm?.player) E.bgm.player.schedule(until);
  const t = E.ctx.currentTime;
  E.old = E.old.filter((p) => {
    if (p.stopAt > t) { p.schedule(Math.min(until, p.stopAt)); return true; }
    setTimeout(() => p.disconnect(), 4000)?.unref?.(); // 残響が消えてから外す
    return false;
  });
  E.jingles = E.jingles.filter((p) => {
    p.schedule(until);
    if (p.ended && t > p.start + p.seconds + 4) { p.disconnect(); return false; }
    return true;
  });
  if (E.duckUntil && t >= E.duckUntil) {
    E.g.duck.gain.cancelScheduledValues(t);
    E.g.duck.gain.setValueAtTime(E.g.duck.gain.value, t);
    E.g.duck.gain.linearRampToValueAtTime(1, t + 0.8);
    E.duckUntil = 0;
  }
  notifyBeat();
}

// ---------- BGM ----------
// name: SONG_NAMES のどれか / null で止める。fade は秒。同じ曲なら何もしない(restart:true で頭から)
export function playBgm(name, { fade = 1.2, restart = false } = {}) {
  if (!name) return stopBgm({ fade });
  if (!SONG_NAMES.includes(name)) throw new Error('曲がない: ' + name);
  if (E.bgm && E.bgm.name === name && !restart) return;
  retireBgm(fade);
  E.bgm = { name, start: clock() + 0.08, player: null };
  E.lastBeat = -1;
  if (E.ctx) startBgmPlayer(E.bgm && fade > 0 ? Math.min(fade, 0.6) : 0);
}

export function stopBgm({ fade = 1.0 } = {}) {
  retireBgm(fade);
  E.bgm = null;
}

function retireBgm(fade) {
  const p = E.bgm?.player;
  if (!p) return;
  const t = E.ctx.currentTime;
  p.fadeOut(t, Math.max(0.03, fade));
  E.old.push(p);
}

export const currentBgm = () => E.bgm?.name ?? null;

// ---------- 拍 ----------
// 今の曲の拍。耳に届いている拍(出力の遅れを引く)。曲がなくても 120 拍/分の時計を返す(振り子が止まらない)
export function beat() {
  const lat = E.ctx ? (E.ctx.outputLatency || E.ctx.baseLatency || 0) : 0;
  if (!E.bgm) return { song: null, ...beatInfo(clock(), 0, 120, 4, lat), loopBeat: 0 };
  const s = compile(E.bgm.name);
  const info = beatInfo(clock(), E.bgm.start, s.bpm, s.bpb, lat);
  const cyc = s.len - s.loopStart;
  const loopBeat = info.beats < s.loopStart ? info.beats : s.loopStart + ((info.beats - s.loopStart) % cyc);
  return { song: E.bgm.name, ...info, loopBeat };
}

// 振り子用: 周期 period 拍の中の位置 0..1(phase 拍ずらす)。tower の曲は 4 拍で1往復
export function pendulum(period = 4, phase = 0) {
  return cycle(beat().beats, period, phase);
}

// 拍ごとに呼ばれる(fn({beat, bar, beatInBar, song}))。外すときは返り値の関数を呼ぶ
export function onBeat(fn) {
  E.beatSubs.add(fn);
  return () => E.beatSubs.delete(fn);
}
function notifyBeat() {
  if (!E.beatSubs.size) return;
  const b = beat();
  if (b.beat === E.lastBeat) return;
  E.lastBeat = b.beat;
  for (const fn of E.beatSubs) try { fn(b); } catch (e) { /* 呼び先の失敗で止めない */ }
}
// ctx がない間(まだタップされていない)も拍の通知を回す
if (typeof setInterval === 'function' && globalThis.window) setInterval(() => { if (!E.ctx) notifyBeat(); }, 50);

// ---------- 効果音・ジングル ----------
// opt: 名前ごとの指定(step は {ground}、turntable は {dur})+ 共通の {vol(0..1.5), when(秒後)}
export function sfx(name, opt = {}) {
  if (JINGLE_NAMES.includes(name)) return jingle(name);
  const f = SFX[name];
  if (!f) throw new Error('効果音がない: ' + name);
  if (!E.ctx || E.ctx.state !== 'running' || E.levels.se === 0) return 0;
  const out = E.ctx.createGain();
  out.gain.value = opt.vol ?? 1;
  out.connect(E.g.se);
  const t = E.ctx.currentTime + 0.005 + (opt.when ?? 0);
  const len = f(E.ctx, out, t, opt, { rev: E.g.seRevIn }) || 1;
  setTimeout(() => { try { out.disconnect(); } catch (e) { /* */ } }, (len + 2 + (opt.when ?? 0)) * 1000)?.unref?.();
  return len;
}

// ジングル: BGM を下げて重ねる。戻り値は長さ(秒)
export function jingle(name, { duck = 0.18 } = {}) {
  if (!JINGLE_NAMES.includes(name)) throw new Error('ジングルがない: ' + name);
  const len = jingleLength(name);
  if (!E.ctx || E.ctx.state !== 'running') return len;
  const t = E.ctx.currentTime + 0.03;
  const p = new Player(E.ctx, name, t, { out: E.g.jin, revIn: E.g.jinRevIn });
  E.jingles.push(p);
  p.schedule(t + LOOKAHEAD);
  const d = E.g.duck.gain;
  d.cancelScheduledValues(t);
  d.setValueAtTime(d.value, E.ctx.currentTime);
  d.linearRampToValueAtTime(duck, t + 0.08);
  E.duckUntil = Math.max(E.duckUntil, t + len);
  return len;
}

export function jingleLength(name) {
  const s = compile(name);
  return (s.len * 60) / s.bpm;
}

// ---------- 音量(5段階 0..4) ----------
export function setBgmLevel(n) {
  E.levels.bgm = clampLv(n);
  saveLevels();
  if (E.g) {
    const v = LEVEL_GAINS[E.levels.bgm] * BGM_HEADROOM;
    E.g.bgm.gain.setTargetAtTime(v, E.ctx.currentTime, 0.05);
    E.g.jin.gain.setTargetAtTime(v, E.ctx.currentTime, 0.05);
  }
  return E.levels.bgm;
}
export function setSeLevel(n) {
  E.levels.se = clampLv(n);
  saveLevels();
  if (E.g) E.g.se.gain.setTargetAtTime(LEVEL_GAINS[E.levels.se] * SE_HEADROOM, E.ctx.currentTime, 0.05);
  return E.levels.se;
}
export const getLevels = () => ({ ...E.levels });

// ---------- 書き出し(試聴ページ・測定用) ----------
// OfflineAudioContext で曲を secs 秒書き出す。本番と同じ通り道(コンプとリミッター)を通す
export async function renderSong(name, { secs = 12, sampleRate = 44100, fromBeat = 0, levels = { bgm: 4, se: 4 }, OAC = globalThis.OfflineAudioContext } = {}) {
  const ctx = new OAC(2, Math.ceil(secs * sampleRate), sampleRate);
  const g = buildGraph(ctx, levels);
  const once = JINGLE_NAMES.includes(name);
  const s = compile(name);
  const start = 0.02 - (fromBeat * 60) / s.bpm;
  const p = new Player(ctx, name, start, { out: once ? g.jin : g.bgm, revIn: once ? g.jinRevIn : g.bgmRevIn, fromBeat });
  p.schedule(secs + 1);
  return ctx.startRendering();
}

export async function renderSfx(name, opt = {}, { secs = 2.5, sampleRate = 44100, levels = { bgm: 4, se: 4 }, OAC = globalThis.OfflineAudioContext } = {}) {
  const ctx = new OAC(2, Math.ceil(secs * sampleRate), sampleRate);
  const g = buildGraph(ctx, levels);
  SFX[name](ctx, g.se, 0.02, { seed: 0.5, ...opt }, { rev: g.seRevIn });
  return ctx.startRendering();
}

// テスト用: エンジンの中身(さわらないこと)
export const _engine = E;
export function _reset() {
  if (E.timer) clearInterval(E.timer);
  removeUnlockListeners();
  Object.assign(E, { ctx: null, g: null, offset: 0, bgm: null, old: [], jingles: [], timer: null, lastBeat: -1, duckUntil: 0, levels: loadLevels() });
  E.beatSubs.clear();
}
