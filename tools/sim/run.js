#!/usr/bin/env node
/* ミチクサ鉄道 バランスシミュレータ
   使い方: node tools/sim/run.js <項目名> [--n 1000] [--seed 1] [--out tools/sim/out]
   項目名: opening sequence field income shiny scout metal boss all
   結果は tools/sim/out/<項目名>.json。グラフは python3 tools/sim/plot.py */
const fs = require('fs');
const path = require('path');
const { open, params } = require('./lib');

const args = process.argv.slice(2);
const item = args[0];
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const N = opt('n') ? +opt('n') : null;
const SEED = opt('seed') ? +opt('seed') : 1;
const OUT = path.resolve(opt('out') || path.join(__dirname, 'out'));
const STARTERS = ['ibote', 'happadanuki', 'yamoryu'];
fs.mkdirSync(OUT, { recursive: true });

const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const pct = (a, q) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : null; };
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };

const items = {
  /* 最初の草むらの最初の1戦: 相棒3体 */
  async opening(page) {
    const n = N || 1000, res = {};
    for (const st of STARTERS) {
      const raw = (await page.evaluate(([s, n, seed]) => SIM.opening(s, n, seed), [st, n, SEED])).filter(Boolean);
      const wins = raw.filter(r => r.win).length;
      const lostBy = {}, byN = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
      raw.forEach(r => { byN[r.n][1]++; if (r.win) byN[r.n][0]++; else r.foes.split(',').forEach(f => { const k = f.split(':')[0]; lostBy[k] = (lostBy[k] || 0) + 1; }); });
      res[st] = { n: raw.length, win: wins / raw.length, ci: wilson(wins, raw.length), turns: mean(raw.map(r => r.turns)), sec: mean(raw.map(r => r.sec)), byN, lostBy };
    }
    return res;
  },
  /* 続けて戦う(3勝までと4戦目以降) */
  async sequence(page) {
    const n = N ? Math.ceil(N / 10) : 300, K = 12, res = {};
    for (const [label, party] of [['solo', 1], ['party3', 3]]) {
      res[label] = {};
      for (const st of STARTERS) {
        const games = await page.evaluate(([s, n, K, seed, p]) => SIM.sequence(s, n, K, seed, p), [st, n, K, SEED, party]);
        const byIdx = Array.from({ length: K }, () => ({ w: 0, n: 0, lv: 0 }));
        const byW = { 0: [0, 0], 1: [0, 0], 2: [0, 0], '3+': [0, 0] };
        let secs = 0, cnt = 0;
        games.forEach(g => g.forEach((b, i) => { byIdx[i].n++; byIdx[i].lv += b.lv; if (b.win) byIdx[i].w++; const k = b.w >= 3 ? '3+' : b.w; byW[k][1]++; if (b.win) byW[k][0]++; secs += b.sec + b.steps * params.STEP_S; cnt++; }));
        res[label][st] = { games: games.length, byIdx: byIdx.map(x => ({ win: x.n ? x.w / x.n : null, n: x.n, lv: x.n ? x.lv / x.n : null })), byW: Object.fromEntries(Object.entries(byW).map(([k, [w, t]]) => [k, { win: t ? w / t : null, n: t, ci: wilson(w, t) }])), secPerBattle: secs / cnt };
      }
    }
    return res;
  },
  /* 裏山(と最初の草むら)をLvごとに */
  async field(page) {
    const n = N || 200, res = { urayama: {}, aze: {} };
    const lvs = { urayama: [5, 6, 7, 8, 9, 10, 11, 12], aze: [3, 4, 5, 6, 7, 8] };
    for (const map of ['urayama', 'komorebi']) {
      const key = map === 'komorebi' ? 'aze' : map;
      for (const st of STARTERS) for (const [label, o] of [['day', { time: 1, party: 1 }], ['night', { time: 3, party: 1 }], ['day_party3', { time: 1, party: 3 }]]) {
        const rows = [];
        for (const lv of lvs[key]) {
          const r = await page.evaluate(([s, m, lv, n, seed, o]) => SIM.fieldWin(s, m, lv, n, seed, o), [st, map, lv, n, SEED, o]);
          rows.push({ lv, ...r, ci: wilson(Math.round(r.win * r.n), r.n) });
        }
        (res[key][st] = res[key][st] || {})[label] = rows;
      }
    }
    return res;
  },
  /* 1時間あたりの経験値・円・遭遇数 */
  async income(page) {
    const hours = N ? Math.max(1, Math.round(N / 200)) : 5, res = {};
    for (const [key, map, lv] of [['aze_lv5', 'komorebi', 5], ['urayama_lv8', 'urayama', 8], ['urayama_lv11', 'urayama', 11]]) {
      let a = { hours: 0, exp: 0, yenNet: 0, enc: 0, wins: 0, losses: 0, steps: 0, battleSec: 0, rests: 0, shiny: 0, metal: 0, foes: 0 };
      for (const st of STARTERS) {
        const r = await page.evaluate(([s, m, lv, h, seed]) => SIM.income(s, m, lv, h, seed), [st, map, lv, hours, SEED]);
        Object.keys(a).forEach(k => a[k] += r[k]);
      }
      res[key] = { ...a, expPerH: a.exp / a.hours, yenPerH: a.yenNet / a.hours, encPerH: a.enc / a.hours, winRate: a.wins / a.enc, stepsPerEnc: a.steps / a.enc, secPerBattle: a.battleSec / a.enc, foesPerEnc: a.foes / a.enc };
    }
    return res;
  },
  /* 色違い・メタルの遭遇(歩数→遭遇率→1時間換算) */
  async shiny(page) {
    const n = N ? N * 20 : 20000, res = {};
    const inc = fs.existsSync(path.join(OUT, 'income.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'income.json'))) : null;
    for (const [key, map, incKey] of [['aze', 'komorebi', 'aze_lv5'], ['urayama', 'urayama', 'urayama_lv8']]) {
      const byTime = {};
      for (const [tn, t] of [['day', 1], ['night', 3]]) byTime[tn] = await page.evaluate(([m, n, seed, t]) => SIM.encounters('ibote', m, n, seed, t), [map, n, SEED, t]);
      const tot = { steps: 0, enc: 0, foes: 0, shiny: 0, metal: 0, encMetal: 0, encShiny: 0 };
      Object.values(byTime).forEach(r => Object.keys(tot).forEach(k => tot[k] += r[k]));
      const o = { ...tot, stepsPerEnc: tot.steps / tot.enc, encPerStep: tot.enc / tot.steps, shinyPerFoe: tot.shiny / tot.foes, metalPerEnc: tot.encMetal / tot.enc, shinyPerEnc: tot.encShiny / tot.enc, byTime };
      /* 1時間: 戦闘時間は income の実測(なければ15秒) */
      const bs = inc && inc[incKey] ? inc[incKey].secPerBattle : 15;
      const cycle = o.stepsPerEnc / params.GRASS * params.STEP_S + bs + 0.1 * params.REST_S;
      o.encPerH = 3600 / cycle; o.shinyPerH = o.encPerH * o.shinyPerEnc; o.metalPerH = o.encPerH * o.metalPerEnc; o.battleSecUsed = bs;
      o.minPerShiny = 60 / o.shinyPerH; o.minPerMetal = 60 / o.metalPerH;
      res[key] = o;
    }
    return res;
  },
  /* スカウト成功率 */
  async scout(page) {
    const res = {};
    for (const [fid, lv, t] of [['aze', 3, 1], ['aze', 6, 1], ['urayama', 6, 1], ['urayama', 10, 1], ['urayama', 10, 3]]) {
      const rows = await page.evaluate(([f, lv, t]) => SIM.scout('ibote', f, lv, t), [fid, lv, t]);
      const wmean = k => sum(rows.map(r => r.w * r.p[k]));
      const hist = Array(10).fill(0);
      rows.forEach(r => [1, .5, .25].forEach(h => { const p = r.p[h]; hist[Math.min(9, Math.floor(p * 10))] += r.w / 3; }));
      res[`${fid}_lv${lv}_t${t}`] = { rows, mean: { full: wmean('1'), half: wmean('0.5'), quarter: wmean('0.25'), full_o: wmean('1o'), half_o: wmean('0.5o'), quarter_o: wmean('0.25o') }, hist };
    }
    return res;
  },
  /* メタル系: 逃げる率・倒せる率 */
  async metal(page) {
    const n = N || 400, res = {};
    for (const [sp, lv, flv] of [['koganetsubu', 8, 6], ['haganetsubu', 8, 6], ['haganetsubu', 14, 6]]) {
      res[`${sp}_lead${lv}`] = await page.evaluate(([sp, lv, flv, n, seed]) => SIM.metalFight('ibote', sp, lv, flv, n, seed), [sp, lv, flv, n, SEED]);
    }
    return res;
  },
  /* こもれび町のぬしまで */
  async boss(page) {
    const n = N ? Math.ceil(N / 10) : 60, res = {};
    for (const [label, party] of [['solo', 1], ['party3', 3]]) for (const thr of [8, 10, 12, 14]) {
      const all = [];
      for (const st of STARTERS) all.push(...await page.evaluate(([s, n, seed, thr, p]) => SIM.toBoss(s, n, seed, thr, p), [st, n, SEED, thr, party]));
      const done = all.filter(r => r.done);
      res[`${label}_thr${thr}`] = { n: all.length, clear: done.length / all.length, firstTry: all.filter(r => r.firstTry === true).length / Math.max(1, all.filter(r => r.firstTry != null).length), reached: all.filter(r => r.firstTry != null).length / all.length,
        minutes: { p25: (pct(done.map(r => r.T), .25) || 0) / 60, p50: (pct(done.map(r => r.T), .5) || 0) / 60, p75: (pct(done.map(r => r.T), .75) || 0) / 60 },
        battles: { p50: pct(done.map(r => r.battles), .5) }, tries: mean(done.map(r => r.tries)), lvAtTry: mean(all.filter(r => r.firstTry != null).map(r => r.levelAtTry)), losses: mean(all.map(r => r.loses)) };
    }
    return res;
  }
};

(async () => {
  if (!item || (item !== 'all' && !items[item])) { console.error('項目名: ' + Object.keys(items).join(' ') + ' all'); process.exit(1); }
  const { browser, page } = await open();
  const list = item === 'all' ? ['opening', 'sequence', 'field', 'income', 'shiny', 'scout', 'metal', 'boss'] : [item];
  for (const it of list) {
    const t = Date.now();
    const r = await items[it](page);
    fs.writeFileSync(path.join(OUT, it + '.json'), JSON.stringify({ item: it, seed: SEED, n: N, params, result: r }, null, 1));
    console.log(`== ${it} (${((Date.now() - t) / 1000).toFixed(1)}s) -> ${path.join(OUT, it + '.json')}`);
    console.log(JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v).slice(0, 1500));
  }
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
