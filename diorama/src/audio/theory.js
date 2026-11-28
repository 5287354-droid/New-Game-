// 音の「楽譜」まわり(WebAudio に依存しない。node でテストできる)
//
// 拍(beat)を単位にした音の並び = seq { ev:[{b,d,n,v}], len }
//   b: 始まりの拍 / d: 長さ(拍) / n: MIDI 番号(数)または打楽器の名前(文字) / v: 強さ 0..1
//
// mel('G4:.5 C5:.5 E5 | D5:2 r') のように書く。
//   音名は C D E F G A B + #/b + オクターブ。長さは ':' のあと(省略で1拍)。
//   'r' は休み、'C4+E4+G4:2' は和音、末尾の '!' は強く、'?' は弱く。'|' は小節線(読みとばす)

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('音名が読めない: ' + name);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function mel(str, v = 0.8) {
  const ev = [];
  let b = 0;
  for (let tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    let vel = v;
    if (tok.endsWith('!')) { vel = Math.min(1, v * 1.25); tok = tok.slice(0, -1); }
    else if (tok.endsWith('?')) { vel = v * 0.6; tok = tok.slice(0, -1); }
    const [name, ds] = tok.split(':');
    const d = ds === undefined ? 1 : Number(ds);
    if (!(d > 0)) throw new Error('長さが読めない: ' + tok);
    if (name !== 'r') {
      const ns = name.split('+').map(midi);
      ev.push({ b, d, n: ns.length === 1 ? ns[0] : ns, v: vel });
    }
    b += d;
  }
  return { ev, len: b };
}

// 小節ごとの長さ(テスト用)。'|' で区切った各小節の拍数
export function barLengths(str) {
  return str.split('|').map((bar) => mel(bar.trim() || 'r:0.0001').len);
}

export const seq = (ev = [], len = 0) => ({ ev, len });

export function cat(...seqs) {
  const ev = [];
  let len = 0;
  for (const s of seqs) {
    for (const e of s.ev) ev.push({ ...e, b: e.b + len });
    len += s.len;
  }
  return { ev, len };
}

export const rep = (s, k) => cat(...Array.from({ length: k }, () => s));
export const rest = (len) => ({ ev: [], len });

export function shift(s, beats) {
  return { ev: s.ev.map((e) => ({ ...e, b: e.b + beats })), len: s.len + beats };
}

export function mapN(s, f) {
  return {
    ev: s.ev.map((e) => ({ ...e, n: typeof e.n === 'string' ? e.n : Array.isArray(e.n) ? e.n.map(f) : f(e.n) })),
    len: s.len,
  };
}

export const tr = (s, k) => mapN(s, (n) => n + k);
export const vol = (s, k) => ({ ev: s.ev.map((e) => ({ ...e, v: e.v * k })), len: s.len });
// 拍の長さを k 倍(拡大・縮小)
export const stretch = (s, k) => ({ ev: s.ev.map((e) => ({ ...e, b: e.b * k, d: e.d * k })), len: s.len * k });
export function slice(s, from, to) {
  return {
    ev: s.ev.filter((e) => e.b >= from && e.b < to).map((e) => ({ ...e, b: e.b - from, d: Math.min(e.d, to - e.b) })),
    len: to - from,
  };
}
// 音を短く切る(スタッカート)
export const stacc = (s, k = 0.5) => ({ ev: s.ev.map((e) => ({ ...e, d: e.d * k })), len: s.len });
// 重ねる(長さは長いほう)
export function mix(...seqs) {
  return { ev: seqs.flatMap((s) => s.ev).sort((a, b) => a.b - b.b), len: Math.max(...seqs.map((s) => s.len)) };
}

// ---- 和音 ----
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11],
  dim: [0, 3, 6], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14],
};

export function chord(sym) {
  const [main, slash] = sym.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m || !(m[2] in QUAL)) throw new Error('和音が読めない: ' + sym);
  const root = midi(m[1] + '4') % 12;
  const bass = slash ? midi(slash + '4') % 12 : root;
  return { sym, root, bass, iv: QUAL[m[2]], pcs: QUAL[m[2]].map((i) => (root + i) % 12) };
}

// 'C:4 Am:4 F:2 G:2' → [{b,d,c}] と全体の長さ
export function chords(str) {
  const list = [];
  let b = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [sym, ds] = tok.split(':');
    const d = ds === undefined ? 4 : Number(ds);
    list.push({ b, d, c: chord(sym) });
    b += d;
  }
  list.len = b;
  return list;
}

export function chordAt(list, b) {
  for (const x of list) if (b >= x.b && b < x.b + x.d) return x.c;
  return list[list.length - 1].c;
}

// 和音を center 付近(下から上へ)に並べた音の列。足りなければ上のオクターブへのばす
export function tones(c, center, count = 8) {
  let r = center - (((center - c.root) % 12) + 12) % 12; // center 以下でいちばん近い根音
  if (center - r > 6) r += 12;
  const out = [];
  for (let o = 0; out.length < count; o += 12) for (const i of c.iv) if (out.length < count) out.push(r + o + i);
  return out.sort((a, b) => a - b);
}

// 分散和音。pat は tones の番号の列、step は1音の拍。'-' は休み
export function arp(list, { pat = [0, 1, 2, 1], step = 0.5, center = 60, v = 0.5, dur = null, accent = 0 } = {}) {
  const ev = [];
  let k = 0;
  for (const x of list) {
    for (let b = x.b; b < x.b + x.d - 1e-6; b += step, k++) {
      const p = pat[k % pat.length];
      if (p === '-' || p === null) continue;
      const t = tones(x.c, center);
      const onBeat = Math.abs(b - Math.round(b)) < 1e-6;
      ev.push({ b, d: dur ?? step, n: t[p], v: v * (onBeat ? 1 + accent : 1) });
    }
  }
  return { ev, len: list.len };
}

// 刻み。rhythm は 'x.x.' の文字列(1文字 = step 拍)。x=和音 / o=根音だけ / 5=5度 / X=強い和音
export function comp(list, { rhythm = 'x...', step = 0.5, center = 64, v = 0.5, dur = null, size = 3 } = {}) {
  const ev = [];
  for (const x of list) {
    let i = 0;
    for (let b = x.b; b < x.b + x.d - 1e-6; b += step, i++) {
      const ch = rhythm[i % rhythm.length];
      if (ch === '.') continue;
      const t = tones(x.c, center, size);
      const n = ch === 'o' ? t[0] : ch === '5' ? t[0] + 7 : t;
      ev.push({ b, d: dur ?? step, n, v: ch === 'X' ? Math.min(1, v * 1.3) : v });
    }
  }
  return { ev, len: list.len };
}

// ベース。pat は 'R . 5 . 8 . 5 .'(R=根音・3・5・8=オクターブ・7・b7・-=休み・.=休み)。step 拍ごと
export function bass(list, { pat = 'R . 5 .', step = 1, center = 40, v = 0.7, dur = null } = {}) {
  const P = pat.trim().split(/\s+/);
  const ev = [];
  for (const x of list) {
    const c = x.c;
    let r = center - ((((center - c.bass) % 12) + 12) % 12);
    if (center - r > 6) r += 12;
    let i = 0;
    for (let b = x.b; b < x.b + x.d - 1e-6; b += step, i++) {
      const s = P[i % P.length];
      if (s === '.' || s === '-') continue;
      const third = c.iv[1];
      const fifth = c.iv.includes(6) ? 6 : c.iv.includes(8) ? 8 : 7;
      const off = { R: 0, '3': third, '5': fifth, '8': 12, '7': 11, b7: 10, '-5': fifth - 12, '-8': -12, '2': 2, '6': 9, '4': 5 }[s];
      if (off === undefined) throw new Error('ベースの記号が読めない: ' + s);
      ev.push({ b, d: dur ?? step * 0.9, n: r + off, v });
    }
  }
  return { ev, len: list.len };
}

// 打楽器。'k..s..k.' の文字列 + 文字→名前の表。step 拍ごと。大文字は強く
export function drums(str, map, { step = 0.5, v = 0.7 } = {}) {
  const ev = [];
  const s = str.replace(/\s|\|/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.') continue;
    const name = map[ch.toLowerCase()];
    if (!name) throw new Error('打楽器の記号が読めない: ' + ch);
    ev.push({ b: i * step, d: step, n: name, v: ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? Math.min(1, v * 1.35) : v });
  }
  return { ev, len: s.length * step };
}

// 長調で書いた旋律を短調にする。E・A・B は、その時の和音にふくまれていればそのまま、なければ半音下げる
export function minorize(s, list, tonic = 0) {
  const flat = new Set([4, 9, 11].map((p) => (p + tonic) % 12));
  return {
    ev: s.ev.map((e) => {
      const fix = (n) => {
        const pc = ((n % 12) + 12) % 12;
        if (!flat.has(pc)) return n;
        return chordAt(list, e.b).pcs.includes(pc) ? n : n - 1;
      };
      return { ...e, n: Array.isArray(e.n) ? e.n.map(fix) : fix(e.n) };
    }),
    len: s.len,
  };
}

// 決まった乱数(書き出すたびに同じ音になるように)
export function rng(seed = 1) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

// 拍の時計。start(秒)から bpm で進む。latency だけ遅らせて「耳に届いた拍」を返す
export function beatInfo(now, start, bpm, beatsPerBar = 4, latency = 0) {
  const beats = Math.max(0, ((now - latency - start) * bpm) / 60);
  const whole = Math.floor(beats);
  return {
    bpm,
    beats, // 曲の頭からの拍(小数)
    phase: beats - whole, // 拍の中の位置 0..1
    beat: whole,
    bar: Math.floor(whole / beatsPerBar),
    beatInBar: whole % beatsPerBar,
    beatsPerBar,
    secPerBeat: 60 / bpm,
  };
}

// 周期 period 拍のくり返しの中の位置 0..1(振り子など)。phase は拍でずらす
export function cycle(beats, period = 4, phase = 0) {
  const x = (beats + phase) / period;
  return x - Math.floor(x);
}
