// 効果音(すべて合成)。どれも fn(ctx, out, t, opt, env) の形で、鳴る長さ(秒)を返す
//   out: 効果音のバス / env.rev: 残響へ送るノード / opt: 名前ごとの細かい指定
import { partial, noise, drop, musicBox, bell, suzu, xylo, celesta, brass } from './instruments.js';
import { midi } from './theory.js';

// 周波数が動く音
function sweep(ctx, out, t, f0, f1, dur, amp, { type = 'sine', attack = 0.005, curve = 'exp' } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  else o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.setValueAtTime(amp, t + Math.max(attack, dur * 0.6));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 鳴らし先を2つ(そのまま + 残響)に分ける
function wet(ctx, out, env, amount) {
  const g = ctx.createGain();
  g.connect(out);
  if (env?.rev && amount > 0) {
    const s = ctx.createGain();
    s.gain.value = amount;
    g.connect(s).connect(env.rev);
  }
  return g;
}

const N = (name) => midi(name);
const rand = (o, k) => 1 + ((o.seed ?? Math.random()) - 0.5) * 2 * k; // 少しずつちがう音に

// 足音の地面(grid.js の地面の文字 → 音の種類)
export const GROUND = {
  g: 'grass', p: 'path', f: 'wood', k: 'board', d: 'dirt', s: 'sand', L: 'ladder', c: 'shadow', m: 'stone', r: 'rug', B: 'board',
};

const STEP = {
  // 草: しゃりっと高めのノイズ
  grass: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.32, tau: 0.035, attack: 0.006, f: 3600 * r, q: 0.9 }); noise(ctx, o, t + 0.012, { amp: 0.15, tau: 0.02, f: 5200 * r, q: 1.5 }); },
  // 道(じゃり): ざっ
  path: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.32, tau: 0.03, attack: 0.003, f: 1700 * r, q: 1.2 }); noise(ctx, o, t + 0.018, { amp: 0.16, tau: 0.018, f: 2800 * r, q: 2 }); },
  // 土: こもった「とっ」
  dirt: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.4, tau: 0.03, type: 'lowpass', f: 700 * r, q: 0.8 }); drop(ctx, o, t, 120 * r, 80, 0.2, 0.03); },
  // 砂: やわらかく長め
  sand: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.26, tau: 0.06, attack: 0.02, type: 'lowpass', f: 1800 * r, q: 0.6 }); },
  // 室内の床: 木の「ことっ」
  wood: (ctx, o, t, r) => { drop(ctx, o, t, 260 * r, 190, 0.3, 0.035, { glide: 0.02 }); noise(ctx, o, t, { amp: 0.12, tau: 0.008, f: 2400, q: 2 }); },
  // 回転台の板・橋: 中が空洞の「こんっ」
  board: (ctx, o, t, r) => { drop(ctx, o, t, 180 * r, 150, 0.32, 0.06, { glide: 0.03 }); drop(ctx, o, t, 420 * r, 380, 0.08, 0.03); noise(ctx, o, t, { amp: 0.1, tau: 0.008, f: 2000, q: 2 }); },
  // はしご: 高い木の音
  ladder: (ctx, o, t, r) => { drop(ctx, o, t, 520 * r, 470, 0.2, 0.03, { glide: 0.02 }); noise(ctx, o, t, { amp: 0.08, tau: 0.006, f: 3000, q: 2 }); },
  // 影の上: 布をふむような、ほとんど音のしない「すっ」
  shadow: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.16, tau: 0.05, attack: 0.025, f: 900 * r, q: 0.6 }); partial(ctx, o, t, 1320 * r, 0.015, 0.08); },
  // 石の床(塔): 硬い「かっ」
  stone: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.26, tau: 0.012, f: 2600 * r, q: 1.5 }); drop(ctx, o, t, 420 * r, 330, 0.14, 0.02, { glide: 0.01 }); },
  // 敷物: とても小さい
  rug: (ctx, o, t, r) => { noise(ctx, o, t, { amp: 0.22, tau: 0.03, attack: 0.008, type: 'lowpass', f: 500 * r, q: 0.6 }); },
};

const RAW = {
  // ---- UI ----
  cursor: (ctx, out, t) => { partial(ctx, out, t, 1760, 0.09, 0.025, { attack: 0.002, type: 'triangle' }); return 0.15; },
  ok: (ctx, out, t, o, env) => {
    const w = wet(ctx, out, env, 0.15);
    musicBox(ctx, w, t, N('E6'), 0.2, 0.65);
    musicBox(ctx, w, t + 0.07, N('B6'), 0.2, 0.6);
    return 0.8;
  },
  cancel: (ctx, out, t) => {
    partial(ctx, out, t, 880, 0.12, 0.05, { type: 'triangle' });
    partial(ctx, out, t + 0.06, 587, 0.12, 0.07, { type: 'triangle' });
    return 0.4;
  },

  // ---- ピンセット ----
  pickup: (ctx, out, t) => {
    noise(ctx, out, t, { amp: 0.2, tau: 0.004, f: 4500, q: 3 });
    sweep(ctx, out, t + 0.01, 900, 1500, 0.08, 0.07);
    return 0.2;
  },
  // ピンセットで置けた: パチッ
  place: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.55, tau: 0.003, f: 3200, q: 1.5 });
    partial(ctx, out, t, 2500, 0.2, 0.012);
    drop(ctx, out, t + 0.004, 320, 240, 0.3, 0.035, { glide: 0.02 });
    noise(ctx, out, t + 0.03, { amp: 0.2, tau: 0.003, f: 5000, q: 2 });
    const w = wet(ctx, out, env, 0.35);
    musicBox(ctx, w, t + 0.08, N('G6'), 0.2, 0.32);
    return 0.6;
  },

  // ---- 屋根 ----
  // 屋根が開く: ふわっと持ち上がる風 + 上がっていく3つの音
  roof: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.12, tau: 0.25, attack: 0.25, f: 400, f2: 2600, q: 1.2, len: 0.7 });
    drop(ctx, out, t, 150, 140, 0.15, 0.05);
    const w = wet(ctx, out, env, 0.4);
    ['C6', 'E6', 'A6'].forEach((n, i) => celesta(ctx, w, t + 0.12 + i * 0.09, N(n), 0.3, 0.55));
    return 1.2;
  },
  roofClose: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.1, tau: 0.2, attack: 0.15, f: 2200, f2: 400, q: 1.2, len: 0.5 });
    drop(ctx, out, t + 0.45, 170, 120, 0.25, 0.05);
    const w = wet(ctx, out, env, 0.3);
    ['A6', 'E6'].forEach((n, i) => celesta(ctx, w, t + 0.05 + i * 0.09, N(n), 0.3, 0.4));
    return 0.9;
  },

  // ---- 足音 ---- opt.ground: 地面の文字(g p f k d s L c m r B)か名前
  step: (ctx, out, t, o = {}) => {
    const kind = STEP[o.ground] ? o.ground : GROUND[o.ground] || 'grass';
    const g = ctx.createGain();
    g.gain.value = STEP_TRIM[kind] ?? 1;
    g.connect(out);
    STEP[kind](ctx, g, t, rand(o, 0.08));
    return 0.2;
  },

  // ---- ギミック ----
  // 回転台が回る: 低いゴロゴロ + 歯止めのカタカタ + 止まるゴトン。opt.dur で長さ(秒)
  turntable: (ctx, out, t, o = {}) => {
    const dur = o.dur ?? 0.7;
    noise(ctx, out, t, { amp: 0.22, tau: dur * 0.6, attack: 0.08, type: 'lowpass', f: 260, q: 2, len: dur });
    const r = ctx.createOscillator();
    r.type = 'sawtooth';
    r.frequency.setValueAtTime(48, t);
    r.frequency.linearRampToValueAtTime(60, t + dur);
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.1, t + 0.08);
    rg.gain.setValueAtTime(0.1, t + dur - 0.08); rg.gain.linearRampToValueAtTime(0, t + dur);
    r.connect(rf).connect(rg).connect(out);
    r.start(t); r.stop(t + dur + 0.02);
    const n = Math.max(3, Math.round(dur / 0.085));
    for (let i = 0; i < n; i++) drop(ctx, out, t + 0.04 + (i * (dur - 0.08)) / n, 900, 760, 0.07, 0.012, { glide: 0.01 });
    drop(ctx, out, t + dur, 160, 90, 0.4, 0.07, { glide: 0.05 });
    noise(ctx, out, t + dur, { amp: 0.2, tau: 0.02, type: 'lowpass', f: 900, q: 0.7 });
    return dur + 0.4;
  },
  // ランプの角度が変わる: スイッチのカチ + 首が回るキュッ + 光のチーン
  lamp: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.35, tau: 0.004, f: 3000, q: 2 });
    drop(ctx, out, t, 1200, 900, 0.12, 0.015);
    sweep(ctx, out, t + 0.04, 520, 780, 0.28, 0.05, { type: 'triangle' });
    noise(ctx, out, t + 0.04, { amp: 0.05, tau: 0.1, attack: 0.05, f: 1800, f2: 2600, q: 6, len: 0.28 });
    const w = wet(ctx, out, env, 0.5);
    bell(ctx, w, t + 0.32, N('E7'), 1, 0.45, { len: 0.9 });
    return 1.4;
  },
  // 文字盤の針が進む: カチッ(金属)
  tick: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.4, tau: 0.003, type: 'highpass', f: 4000, q: 1 });
    partial(ctx, out, t, 3200, 0.14, 0.015);
    partial(ctx, out, t, 910, 0.12, 0.05);
    const w = wet(ctx, out, env, 0.25);
    partial(ctx, w, t + 0.002, 2240, 0.05, 0.12);
    return 0.4;
  },
  // 歯車がかみ合う: カチ・カチッ + 金属の響き
  gear: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.3, tau: 0.004, f: 3800, q: 3 });
    noise(ctx, out, t + 0.07, { amp: 0.4, tau: 0.005, f: 3000, q: 3 });
    drop(ctx, out, t + 0.07, 600, 500, 0.15, 0.03);
    const w = wet(ctx, out, env, 0.4);
    bell(ctx, w, t + 0.08, N('A5'), 1, 0.35, { len: 0.7 });
    return 1.0;
  },
  // 金つぎが光る: きらきら
  kintsugi: (ctx, out, t, o, env) => {
    const w = wet(ctx, out, env, 0.6);
    ['E6', 'G#6', 'B6', 'E7', 'G#7'].forEach((n, i) => bell(ctx, w, t + i * 0.06, N(n), 1, 0.35 - i * 0.03, { len: 1.0 }));
    suzu(ctx, w, t + 0.2, 104, 1, 0.5);
    return 1.6;
  },

  // ---- 宝箱 ----
  chest: (ctx, out, t, o, env) => {
    const c = ctx.createOscillator();
    c.type = 'sawtooth';
    c.frequency.setValueAtTime(110, t);
    c.frequency.linearRampToValueAtTime(170, t + 0.25);
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 700; cf.Q.value = 3;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.1, t + 0.05); cg.gain.linearRampToValueAtTime(0, t + 0.26);
    c.connect(cf).connect(cg).connect(out);
    c.start(t); c.stop(t + 0.3);
    noise(ctx, out, t + 0.27, { amp: 0.3, tau: 0.004, f: 3000, q: 2 });
    drop(ctx, out, t + 0.27, 300, 200, 0.2, 0.04);
    const w = wet(ctx, out, env, 0.4);
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => musicBox(ctx, w, t + 0.35 + i * 0.07, N(n), 0.3, 0.55));
    return 1.6;
  },

  // ---- 戦闘 ----
  hit: (ctx, out, t) => {
    noise(ctx, out, t, { amp: 0.55, tau: 0.05, type: 'lowpass', f: 1400, q: 0.8 });
    drop(ctx, out, t, 150, 60, 0.55, 0.07, { glide: 0.06 });
    noise(ctx, out, t, { amp: 0.15, tau: 0.008, f: 3000, q: 1 });
    return 0.4;
  },
  // 弱点: 明るい「バキッ」+ 金属の響き
  hitWeak: (ctx, out, t, o, env) => {
    noise(ctx, out, t, { amp: 0.6, tau: 0.06, type: 'lowpass', f: 1800, q: 0.8 });
    noise(ctx, out, t, { amp: 0.35, tau: 0.02, type: 'highpass', f: 3500, q: 0.8 });
    drop(ctx, out, t, 190, 55, 0.6, 0.09, { glide: 0.08 });
    const w = wet(ctx, out, env, 0.3);
    partial(ctx, w, t + 0.01, 1860, 0.1, 0.12);
    partial(ctx, w, t + 0.01, 2790, 0.06, 0.08);
    return 0.6;
  },
  miss: (ctx, out, t) => {
    noise(ctx, out, t, { amp: 0.16, tau: 0.08, attack: 0.05, f: 1200, f2: 3200, q: 2, len: 0.2 });
    return 0.3;
  },
  // 倒れる: パ・タン
  faint: (ctx, out, t) => {
    noise(ctx, out, t, { amp: 0.25, tau: 0.03, f: 900, q: 1 });
    drop(ctx, out, t, 300, 200, 0.12, 0.03);
    noise(ctx, out, t + 0.14, { amp: 0.5, tau: 0.05, type: 'lowpass', f: 700, q: 0.7 });
    drop(ctx, out, t + 0.14, 110, 60, 0.5, 0.1, { glide: 0.06 });
    return 0.6;
  },
  heal: (ctx, out, t, o, env) => {
    const w = wet(ctx, out, env, 0.5);
    ['G5', 'C6', 'E6', 'G6'].forEach((n, i) => celesta(ctx, w, t + i * 0.08, N(n), 0.3, 0.5));
    noise(ctx, out, t, { amp: 0.05, tau: 0.2, attack: 0.15, f: 5000, q: 2, len: 0.5 });
    return 1.0;
  },

  // ---- 移動 ----
  // 谷に落ちて、前の足場にもどる: ひゅーっ・ぽふっ・ぽん
  fall: (ctx, out, t, o, env) => {
    sweep(ctx, out, t, 1300, 220, 0.5, 0.07);
    noise(ctx, out, t + 0.52, { amp: 0.3, tau: 0.06, type: 'lowpass', f: 600, q: 0.7 });
    const w = wet(ctx, out, env, 0.3);
    sweep(ctx, w, t + 0.75, 500, 1000, 0.1, 0.07, { type: 'triangle' });
    return 1.0;
  },
  door: (ctx, out, t) => {
    drop(ctx, out, t, 220, 160, 0.3, 0.05);
    noise(ctx, out, t, { amp: 0.15, tau: 0.01, f: 2500, q: 2 });
    return 0.3;
  },
  buy: (ctx, out, t, o, env) => {
    const w = wet(ctx, out, env, 0.2);
    xylo(ctx, w, t, N('E6'), 0.1, 0.6);
    xylo(ctx, w, t + 0.08, N('A6'), 0.1, 0.6);
    return 0.5;
  },
  // ぬしが現れる合図(低い金管)
  alarm: (ctx, out, t, o, env) => {
    const w = wet(ctx, out, env, 0.3);
    brass(ctx, w, t, N('C3'), 0.5, 0.7, { bright: 3 });
    brass(ctx, w, t, N('F#3'), 0.5, 0.6, { bright: 3 });
    return 0.8;
  },
};

// 音量の補正(tools/audio/levels.mjs で測った RMS から決めた。UI は小さく、足音はさらに小さく、戦闘の打撃は大きめ)
export const SFX_TRIM = {
  cursor: 2.99, ok: 0.385, cancel: 1.15, pickup: 1.2, place: 1.4, roof: 0.64, roofClose: 0.81,
  turntable: 0.75, lamp: 0.88, tick: 1.5, gear: 1.75, kintsugi: 0.86, chest: 0.58,
  hit: 1.14, hitWeak: 1.23, miss: 3.04, faint: 0.69, heal: 0.62, fall: 1.4, door: 1, buy: 0.66, alarm: 1.29,
};
const STEP_TRIM = { grass: 1.14, path: 1.74, dirt: 0.8, sand: 1.3, wood: 0.57, board: 0.42, ladder: 0.87, shadow: 1.55, stone: 1.41, rug: 2.4 };

export const SFX = Object.fromEntries(Object.entries(RAW).map(([name, f]) => [name, (ctx, out, t, opt, env) => {
  const g = ctx.createGain();
  g.gain.value = SFX_TRIM[name] ?? 1;
  g.connect(out);
  let e2 = env;
  if (env?.rev) {
    const rg = ctx.createGain();
    rg.gain.value = g.gain.value;
    rg.connect(env.rev);
    e2 = { ...env, rev: rg };
  }
  return f(ctx, g, t, opt, e2);
}]));

export const SFX_NAMES = Object.keys(SFX);
export const STEP_GROUNDS = Object.keys(STEP);
