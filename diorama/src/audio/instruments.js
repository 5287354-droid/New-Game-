// 楽器(すべて WebAudio のオシレーターとノイズで合成する)
// どの楽器も play(ctx, out, t, n, d, v, opt) の形。n は MIDI 番号(打楽器は名前)、d は秒、v は 0..1
import { freq } from './theory.js';

const NOISE = new WeakMap();
export function noiseBuf(ctx) {
  let b = NOISE.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let x = 22222;
    for (let i = 0; i < len; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
      d[i] = (x / 4294967296) * 2 - 1;
    }
    NOISE.set(ctx, b);
  }
  return b;
}

const NYQ = (ctx) => ctx.sampleRate * 0.45;

// 減衰する正弦波(オルゴールの歯・鉄琴・木琴の部分音)
export function partial(ctx, out, t, f, amp, tau, { attack = 0.002, detune = 0, type = 'sine', end } = {}) {
  if (f >= NYQ(ctx) || amp <= 0) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.setTargetAtTime(0, t + attack, tau);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(end ?? t + attack + tau * 7);
}

// 短いノイズ(打撃・息・カチッ)
export function noise(ctx, out, t, { amp = 0.5, tau = 0.03, attack = 0.001, type = 'bandpass', f = 2000, q = 1, f2 = null, len = null, rate = 1 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx);
  s.loop = true;
  s.playbackRate.value = rate;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + (len ?? tau * 6));
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + attack);
  g.gain.setTargetAtTime(0, t + attack, tau);
  s.connect(fl).connect(g).connect(out);
  const off = (t * 7919) % 1.5; // 毎回ちがう場所から
  s.start(t, off);
  s.stop(t + attack + (len ?? tau * 7));
}

// 音程が下がる正弦波(キック・木魚・ノック)
export function drop(ctx, out, t, f0, f1, amp, tau, { glide = 0.05, type = 'sine' } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.002, tau);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + tau * 7 + 0.01);
}

// ---- オルゴール ----
// 櫛歯は「基音 + 速く消える高い部分音(片持ち梁の 6.27 倍)」。少しずらした基音を重ねてうなりを出す
export function musicBox(ctx, out, t, n, d, v, opt = {}) {
  const f = freq(n);
  const low = opt.low; // 低いオルゴール(森)
  const tau = (low ? 1.9 : 1.15) * Math.pow(440 / f, 0.35);
  const a = v * 0.32;
  partial(ctx, out, t, f, a, tau);
  partial(ctx, out, t, f, a * 0.28, tau * 0.8, { detune: 4 });
  partial(ctx, out, t, f * 2, a * (low ? 0.1 : 0.16), tau * 0.45);
  partial(ctx, out, t, f * 3, a * (low ? 0.03 : 0.05), tau * 0.25);
  partial(ctx, out, t, f * 6.27, a * (low ? 0.04 : 0.11), 0.06 + 20 / f);
  noise(ctx, out, t, { amp: a * (low ? 0.08 : 0.18), tau: 0.004, f: Math.min(9000, f * 5), q: 3 });
}
export const lowBox = (ctx, out, t, n, d, v) => musicBox(ctx, out, t, n, d, v, { low: true });

// チェレスタ風(やわらかい鉄琴。タイトル・作業台)
export function celesta(ctx, out, t, n, d, v) {
  const f = freq(n);
  const tau = 0.9 * Math.pow(440 / f, 0.3);
  const a = v * 0.28;
  partial(ctx, out, t, f, a, tau, { attack: 0.004 });
  partial(ctx, out, t, f * 4, a * 0.12, tau * 0.2, { attack: 0.003 });
  partial(ctx, out, t, f * 2, a * 0.08, tau * 0.5);
}

// 木琴(基音 + 3倍の部分音 + ばちの音)
export function xylo(ctx, out, t, n, d, v) {
  const f = freq(n);
  const tau = 0.16 * Math.pow(523 / f, 0.4);
  const a = v * 0.42;
  partial(ctx, out, t, f, a, tau);
  partial(ctx, out, t, f * 3.0, a * 0.28, tau * 0.35);
  partial(ctx, out, t, f * 6.2, a * 0.06, tau * 0.15);
  noise(ctx, out, t, { amp: a * 0.3, tau: 0.006, f: Math.min(8000, f * 4), q: 2 });
}

// マリンバ(低めでやわらかい。ベースにも)
export function marimba(ctx, out, t, n, d, v) {
  const f = freq(n);
  const tau = 0.35 * Math.pow(262 / f, 0.35);
  const a = v * 0.5;
  partial(ctx, out, t, f, a, tau, { attack: 0.003 });
  partial(ctx, out, t, f * 4, a * 0.14, tau * 0.18);
  partial(ctx, out, t, f * 10, a * 0.03, 0.02);
}

// 口笛(ゆれのある正弦波 + 息)
export function whistle(ctx, out, t, n, d, v) {
  const f = freq(n);
  const a = v * 0.2;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f * 0.985, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.3;
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, d * 0.6));
  lfo.connect(lg).connect(o.frequency);
  const g = ctx.createGain();
  const rel = 0.07;
  const end = t + Math.max(0.08, d * 0.92);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + 0.035);
  g.gain.setValueAtTime(a, end);
  g.gain.linearRampToValueAtTime(0, end + rel);
  o.connect(g).connect(out);
  o.start(t); lfo.start(t);
  o.stop(end + rel + 0.02); lfo.stop(end + rel + 0.02);
  noise(ctx, out, t, { amp: a * 0.18, tau: Math.max(0.05, d * 0.3), f: f * 1.02, q: 9, attack: 0.02 });
}

// 鐘・小さなベル(はずれた部分音)
const BELL_R = [1, 2.0, 2.76, 4.07, 5.4, 8.93];
const BELL_A = [1, 0.45, 0.35, 0.18, 0.14, 0.06];
const BELL_T = [1, 0.7, 0.5, 0.35, 0.22, 0.12];
export function bell(ctx, out, t, n, d, v, opt = {}) {
  const f = freq(n);
  const len = opt.len ?? 1.6 * Math.pow(880 / f, 0.5);
  const a = v * 0.22;
  for (let i = 0; i < BELL_R.length; i++) partial(ctx, out, t, f * BELL_R[i], a * BELL_A[i], len * BELL_T[i], { attack: 0.001, detune: i * 1.5 });
}
// 時計の鐘(低く長い)
export const chime = (ctx, out, t, n, d, v) => bell(ctx, out, t, n, d, v * 1.15, { len: 3.2 });

// 鈴(すず)。高いはずれた音が細かくゆれる
export function suzu(ctx, out, t, n, d, v) {
  const a = v * 0.07;
  const base = typeof n === 'number' ? freq(n) : 3600;
  for (let k = 0; k < 4; k++) {
    const tk = t + k * 0.045 + (k % 2) * 0.008;
    const ak = a * Math.pow(0.62, k);
    partial(ctx, out, tk, base, ak, 0.12);
    partial(ctx, out, tk, base * 1.47, ak * 0.7, 0.09);
    partial(ctx, out, tk, base * 2.09, ak * 0.5, 0.06);
    noise(ctx, out, tk, { amp: ak * 0.6, tau: 0.01, f: 7000, q: 2 });
  }
}

// 金管(ノコギリ波 2 本 + フィルターの開き)
export function brass(ctx, out, t, n, d, v, opt = {}) {
  const f = freq(n);
  const a = v * (opt.amp ?? 0.11);
  const end = t + Math.max(0.06, d * 0.95);
  const rel = opt.rel ?? 0.09;
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.Q.value = 1.2;
  const bright = opt.bright ?? 5;
  fl.frequency.setValueAtTime(Math.min(NYQ(ctx), f * 1.2), t);
  fl.frequency.linearRampToValueAtTime(Math.min(NYQ(ctx), f * bright), t + 0.05);
  fl.frequency.setTargetAtTime(Math.min(NYQ(ctx), f * bright * 0.55), t + 0.06, 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + (opt.attack ?? 0.035));
  g.gain.setTargetAtTime(a * 0.75, t + 0.06, 0.15);
  g.gain.setValueAtTime(a * 0.75, end);
  g.gain.linearRampToValueAtTime(0, end + rel);
  fl.connect(g).connect(out);
  for (const det of [-7, 6]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.detune.setValueAtTime(det, t);
    o.connect(fl);
    o.start(t);
    o.stop(end + rel + 0.02);
  }
}
// 低い金管(チューバ風。ベース用)
export const tuba = (ctx, out, t, n, d, v) => brass(ctx, out, t, n, d, v * 1.25, { bright: 3, attack: 0.05, rel: 0.12 });
// 金管の和音(パッド風。音を短めに)
export const horns = (ctx, out, t, n, d, v) => brass(ctx, out, t, n, d, v * 0.55, { bright: 3.2, attack: 0.12, rel: 0.3 });

// 弦のパッド(ゆっくり立ち上がる)
export function pad(ctx, out, t, n, d, v, opt = {}) {
  const f = freq(n);
  const a = v * (opt.amp ?? 0.045);
  const att = opt.attack ?? 0.35;
  const rel = opt.rel ?? 0.6;
  const end = t + Math.max(att, d);
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = Math.min(NYQ(ctx), opt.cut ?? 1500);
  fl.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + att);
  g.gain.setValueAtTime(a, end);
  g.gain.linearRampToValueAtTime(0, end + rel);
  fl.connect(g).connect(out);
  for (const [type, det, k] of [['sawtooth', -9, 1], ['sawtooth', 8, 1], ['triangle', 0, 1.6]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.setValueAtTime(det, t);
    const og = ctx.createGain();
    og.gain.value = k;
    o.connect(og).connect(fl);
    o.start(t);
    o.stop(end + rel + 0.02);
  }
}
export const darkPad = (ctx, out, t, n, d, v) => pad(ctx, out, t, n, d, v, { cut: 700, attack: 0.8, rel: 1.2, amp: 0.06 });

// はじくベース(三角波 + 正弦波)
export function pluckBass(ctx, out, t, n, d, v) {
  const f = freq(n);
  const a = v * 0.42;
  const tau = Math.min(0.5, d * 0.5 + 0.08);
  partial(ctx, out, t, f, a, tau, { attack: 0.004, type: 'triangle' });
  partial(ctx, out, t, f * 2, a * 0.25, tau * 0.4, { attack: 0.003 });
}

// 戦闘のベース(ノコギリ波をローパス)
export function synthBass(ctx, out, t, n, d, v) {
  const f = freq(n);
  const a = v * 0.2;
  const end = t + Math.max(0.05, d * 0.85);
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.Q.value = 3;
  fl.frequency.setValueAtTime(f * 8, t);
  fl.frequency.setTargetAtTime(f * 2.2, t + 0.005, 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + 0.006);
  g.gain.setValueAtTime(a, end);
  g.gain.linearRampToValueAtTime(0, end + 0.04);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const s = ctx.createOscillator();
  s.frequency.value = f;
  const sg = ctx.createGain();
  sg.gain.value = 0.9;
  o.connect(fl);
  s.connect(sg).connect(g);
  fl.connect(g).connect(out);
  o.start(t); s.start(t);
  o.stop(end + 0.06); s.stop(end + 0.06);
}

// ---- 打楽器 ----
export function kit(ctx, out, t, name, d, v) {
  const a = v;
  switch (name) {
    case 'kick':
      drop(ctx, out, t, 140, 44, a * 0.9, 0.13, { glide: 0.09 });
      noise(ctx, out, t, { amp: a * 0.12, tau: 0.004, f: 3000, q: 1 });
      break;
    case 'snare':
      noise(ctx, out, t, { amp: a * 0.36, tau: 0.07, type: 'highpass', f: 1100, q: 0.7 });
      drop(ctx, out, t, 230, 170, a * 0.32, 0.05, { type: 'triangle' });
      break;
    case 'hat':
      noise(ctx, out, t, { amp: a * 0.14, tau: 0.018, type: 'highpass', f: 7500, q: 0.8 });
      break;
    case 'ohat':
      noise(ctx, out, t, { amp: a * 0.12, tau: 0.11, type: 'highpass', f: 7000, q: 0.8 });
      break;
    case 'shaker':
      noise(ctx, out, t, { amp: a * 0.07, tau: 0.03, attack: 0.012, type: 'bandpass', f: 6500, q: 1.2 });
      break;
    case 'tom':
      drop(ctx, out, t, 200, 110, a * 0.6, 0.16, { glide: 0.12 });
      break;
    case 'timp':
      drop(ctx, out, t, 98, 88, a * 0.75, 0.45, { glide: 0.2 });
      noise(ctx, out, t, { amp: a * 0.12, tau: 0.03, type: 'lowpass', f: 900, q: 0.7 });
      break;
    case 'crash':
      noise(ctx, out, t, { amp: a * 0.16, tau: 0.6, type: 'highpass', f: 4500, q: 0.6 });
      break;
    // チクタク(木の拍子木 + 金属のカチッ)
    case 'tick':
      drop(ctx, out, t, 2100, 1900, a * 0.3, 0.025, { glide: 0.02 });
      noise(ctx, out, t, { amp: a * 0.2, tau: 0.006, f: 4200, q: 4 });
      break;
    case 'tock':
      drop(ctx, out, t, 1300, 1150, a * 0.32, 0.03, { glide: 0.02 });
      noise(ctx, out, t, { amp: a * 0.16, tau: 0.007, f: 2600, q: 4 });
      break;
    case 'wood': // 木魚・ウッドブロック
      drop(ctx, out, t, 900, 760, a * 0.35, 0.04, { glide: 0.02 });
      break;
    case 'ratchet': // ゼンマイを巻く音
      for (let k = 0; k < 6; k++) noise(ctx, out, t + k * 0.035, { amp: a * 0.14 * (1 - k * 0.1), tau: 0.004, f: 3500 + k * 150, q: 5 });
      break;
    case 'tap': // 作業台の小さな金づち
      drop(ctx, out, t, 1600, 1400, a * 0.16, 0.02, { glide: 0.01 });
      noise(ctx, out, t, { amp: a * 0.08, tau: 0.005, f: 5000, q: 3 });
      break;
    default:
      throw new Error('打楽器がない: ' + name);
  }
}

export const INSTRUMENTS = {
  musicBox, lowBox, celesta, xylo, marimba, whistle, bell, chime, suzu, brass, tuba, horns, pad, darkPad, pluckBass, synthBass, kit,
};
