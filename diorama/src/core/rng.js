// 種つきの乱数(mulberry32)。戦闘・配合・スカウトはすべてこれを通す。テストでは種を固定するか、決まった数列を返す偽物に差しかえる。
// rng の形: { next():0..1, int(a,b), range(a,b), chance(p), pick(arr), state }   (state を読み書きすると、つづきから再現できる)

export function makeRng(seed = Date.now()) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return wrapRng(next, {
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  });
}

// 決まった数列をくり返し返す乱数(テスト用)。例: fixedRng([0.99]) なら、確率の判定はすべて失敗、乱数の幅は上の端
export function fixedRng(seq = [0.5]) {
  let i = 0;
  return wrapRng(() => seq[i++ % seq.length], { get state() { return i; }, set state(v) { i = v; } });
}

function wrapRng(next, extra) {
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)), // a 以上 b 以下の整数
    range: (a, b) => a + next() * (b - a),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
  Object.defineProperties(r, Object.getOwnPropertyDescriptors(extra));
  return r;
}

// 何でも rng に直す(数字なら種、rng ならそのまま、なければ時刻の種)
export function toRng(x) {
  if (x && typeof x.next === 'function') return x;
  return makeRng(typeof x === 'number' ? x : Date.now());
}
