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
    /* DESIGN 5-3 の条件(才能 randTalent(8,12) を強制)でも測る。T6 が入った版では既定と同じになるはず */
    res.talent812 = {};
    for (const st of STARTERS) {
      const raw = (await page.evaluate(([s, n, seed]) => SIM.opening(s, n, seed, [8, 12]), [st, n, SEED + 1])).filter(Boolean);
      const wins = raw.filter(r => r.win).length;
      res.talent812[st] = { n: raw.length, win: wins / raw.length, ci: wilson(wins, raw.length) };
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
    const hours = N ? Math.max(1, Math.round(N / 200)) : 4, res = {};
    for (const [key, map, lv, party] of [['aze_lv5_solo', 'komorebi', 5, 1], ['aze_lv5', 'komorebi', 5, 3], ['urayama_lv8', 'urayama', 8, 3], ['urayama_lv11', 'urayama', 11, 3]]) {
      let a = { hours: 0, exp: 0, yenNet: 0, yenGot: 0, yenLost: 0, flee: 0, shinyN: 0, shinyK: 0, shinyH: 0, kEnc: 0, kSteps: 0, hoshiEnc: 0, enc: 0, wins: 0, losses: 0, steps: 0, battleSec: 0, rests: 0, shiny: 0, metal: 0, foes: 0 };
      for (const st of STARTERS) {
        const r = await page.evaluate(([s, m, lv, h, seed, p]) => SIM.income(s, m, lv, h, seed, { party: p, kirari: true }), [st, map, lv, hours, SEED, party]);
        Object.keys(a).forEach(k => a[k] += r[k]);
      }
      res[key] = { ...a, expPerH: a.exp / a.hours, yenPerH: a.yenNet / a.hours, encPerH: a.enc / a.hours, winRate: a.wins / a.enc, stepsPerEnc: a.steps / a.enc, secPerBattle: a.battleSec / a.enc, foesPerEnc: a.foes / a.enc };
    }
    return res;
  },

  /* 天候限定7体に出会うまで(狙う/狙わない)。時間は分 */
  async wxfind(page) {
    const n = N || 200, res = {}, bs = 18;
    const list = [['amayadori', 'komorebi', 'aze'], ['kirigarasu', 'tengu', 'sando'], ['nijimimizu', 'kasumi', 'biru'], ['yukiwata', 'ryuhyo', 'genseirin'], ['haikagura', 'hinoshima', 'kokusa'], ['kumozumi', 'shiomi', 'gyokou'],
      ['hoshikuzume', 'komorebi', 'aze'], ['hoshikuzume', 'tengu', 'sando'], ['hoshikuzume', 'yomi', null]];
    for (const [sp, tw, fid] of list) {
      const fld = fid || await page.evaluate(t => TOWN[t].fields[0].id, tw);
      const o = {};
      for (const [label, tg] of [['target', true], ['idle', false]]) {
        const rows = await page.evaluate(([sp, tw, f, tg, n, seed, bs]) => SIM.wxFind(sp, tw, f, tg, n, seed, bs), [sp, tw, fld, tg, n, SEED, bs]);
        if (!rows) { o[label] = null; continue; }
        const T = rows.map(r => r.T / 60), f = rows.filter(r => r.found).length;
        o[label] = { n: rows.length, found: f / rows.length, mean: mean(T), p50: pct(T, .5), p90: pct(T, .9), enc: mean(rows.map(r => r.enc)), waits: mean(rows.map(r => r.waits)) };
      }
      res[`${sp}@${tw}`] = { sp, town: tw, field: fld, ...o };
    }
    return res;
  },
  /* ホシクズメの重み: 星降りの夜1回(約120歩)に何回会えるか、重みを変えて */
  async hoshiw(page) {
    const res = {};
    for (const w of [.6, 1, 1.5, 2, 3, 5]) {
      res[w] = await page.evaluate(w => {
        for (const t of TOWNS) { const r = t.fields[0].table.find(x => x[0] === 'hoshikuzume'); if (r) r[1] = w; }
        const out = {};
        for (const tid of ['komorebi', 'tengu', 'yomi']) {
          const f = TOWN[tid].fields[0], tb = wxTable(f.table, 3, 'hoshi'), tot = tb.reduce((a, x) => a + x.w, 0), me = tb.find(x => x.s === 'hoshikuzume');
          const pf = me.w / tot, nAvg = (6 * 1 + 3 * Math.min(2, f.max) + 1 * Math.min(3, f.max)) / 10; /* 1戦に出る敵の数(平均) */
          out[tid] = { pFoe: pf, pEnc: 1 - Math.pow(1 - pf, nAvg), encPerPeriod: 120 / 9.2 };
          out[tid].perHoshiNight = out[tid].pEnc * out[tid].encPerPeriod;
        }
        return out;
      }, w);
    }
    await page.reload(); await page.evaluate(p => { window.__SIM_PARAMS = p; }, params); await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8') });
    return res;
  },
  /* 寄り道ボーナス(段0〜5)ごとの1時間あたりの経験値・円、きらり、色違い(通常・きらり・星降り) */
  async bonus(page) {
    const hours = N ? Math.max(1, Math.round(N / 200)) : 6, res = {};
    for (const [key, map, lv] of [['aze_lv5', 'komorebi', 5], ['urayama_lv8', 'urayama', 8], ['okumori_lv16', 'okumori', 16]]) {
      res[key] = {};
      for (const d of (map === 'komorebi' ? [0] : [0, 1, 2, 3, 5])) {
        let a = null;
        for (const st of STARTERS) {
          const r = await page.evaluate(([s, m, lv, h, seed, d]) => SIM.income(s, m, lv, h, seed, { party: 3, kirari: true, detour: d }), [st, map, lv, hours, SEED, d]);
          if (!a) a = Object.fromEntries(Object.keys(r).map(k => [k, 0])); Object.keys(r).forEach(k => a[k] += r[k]);
        }
        const H = a.hours; res[key][d] = { ...a, expPerH: a.exp / H, yenPerH: a.yenNet / H, encPerH: a.enc / H, kPerH: a.kEnc / H, minPerKirari: a.kEnc ? 60 * H / a.kEnc : null, shinyPerH: a.shiny / H, shinyNPerH: a.shinyN / H, shinyKPerH: a.shinyK / H, shinyHPerH: a.shinyH / H, hoshiShare: a.hoshiEnc / a.enc, winRate: a.wins / (a.wins + a.losses) };
      }
    }
    return res;
  },
  /* みちくさ点: 町ごとに全マップの全区画を歩き切るのにかかる時間とたまる点 */
  async points(page) {
    const maps = await page.evaluate(() => SIM.mapList());
    const tours = [];
    for (const m of maps) tours.push(await page.evaluate(id => SIM.footTour(id), m.id));
    const order = await page.evaluate(() => TOWNS.map(t => t.id));
    const BS = 18, rows = tours.filter(Boolean).sort((a, b) => order.indexOf(a.town) - order.indexOf(b.town)).map(t => {
      const sec = params.TOUR_X * (t.steps * params.STEP_S + t.encSteps * t.rate * (BS + .1 * params.REST_S));
      const pts = t.blocks + 10 + 20; /* 区画 +1、80%で+10、100%で+20 */
      return { ...t, sec, pts, stars: 3 };
    });
    const gimmick = { n: 16, pts: 80, sec: 16 * 30 };
    let cumT = 0, cumP = 0; const cum = rows.map(r => { cumT += r.sec; cumP += r.pts; return { id: r.id, town: r.town, t: cumT / 3600, p: cumP }; });
    const total = cumP + gimmick.pts, totalT = (cumT + gimmick.sec) / 3600;
    const at = target => { const c = cum.find(x => x.p >= target); return c ? c.t : null; };
    const byTown = {}; rows.forEach(r => { const b = byTown[r.town] = byTown[r.town] || { maps: 0, blocks: 0, pts: 0, sec: 0 }; b.maps++; b.blocks += r.blocks; b.pts += r.pts; b.sec += r.sec; });
    return { rows, cum, byTown, total, totalHours: totalT, ptsPerHour: total / totalT, hoursTo: { 15: at(15), 40: at(40), 80: at(80), 400: at(400), 1000: at(1000), 1500: at(1500), 2000: at(2000) }, order };
  },
  /* 地域コンプにかかる時間(町ごと) */
  async region(page) {
    const n = N ? Math.ceil(N / 10) : 100, res = {}, order = await page.evaluate(() => TOWNS.map(t => t.id));
    for (const tid of order) {
      const r = await page.evaluate(([t, n, seed]) => SIM.regionTime(t, n, seed, .7, 18), [tid, n, SEED]);
      const T = r.runs.map(x => x.T / 60);
      res[tid] = { species: r.n, list: r.list, p50: pct(T, .5), mean: mean(T), p90: pct(T, .9), enc: mean(r.runs.map(x => x.enc)), periods: mean(r.runs.map(x => x.periods)) };
    }
    return res;
  },
  /* 負けの罰: 新ルール(1/4・上限つき)と旧ルール(1/2)の円のたまり方。こもれび町のぬしを倒したあとで測る */
  async penalty(page) {
    const hours = N ? Math.max(1, Math.round(N / 200)) : 6, res = {};
    for (const [key, map, lv, party] of [['aze_lv5', 'komorebi', 5, 3], ['urayama_lv8', 'urayama', 8, 3], ['urayama_lv11', 'urayama', 11, 3], ['urayama_lv8_solo', 'urayama', 8, 1]]) {
      res[key] = {};
      for (const [label, old] of [['new', false], ['old', true]]) {
        let a = null;
        for (const st of STARTERS) {
          const r = await page.evaluate(([s, m, lv, h, seed, p, old]) => SIM.income(s, m, lv, h, seed, { party: p, kirari: true, boss: true, oldPenalty: old }), [st, map, lv, hours, SEED, party, old]);
          if (!a) a = Object.fromEntries(Object.keys(r).map(k => [k, 0])); Object.keys(r).forEach(k => a[k] += r[k]);
        }
        const H = a.hours; res[key][label] = { ...a, yenNetPerH: a.yenNet / H, yenGotPerH: a.yenGot / H, yenLostPerH: a.yenLost / H, lossPerH: a.losses / H, winRate: a.wins / (a.wins + a.losses) };
      }
    }
    return res;
  },
  /* 流星石の流入(1回きりの分と1日あたり) */
  async stars(page) {
    return await page.evaluate(() => {
      const nMaps = Object.keys(MAPS).length, nTown = TOWNS.length;
      const ms = DEX_MS.map(x => ({ n: x.all ? dexList().length : x.n, stars: x.stars != null ? x.stars : 5, all: !!x.all }));
      const oldMs = ms.filter(x => x.n <= 51), newMs = ms.filter(x => x.n > 51);
      const reqs = REQUESTS.length, cups = typeof CUPS !== 'undefined' ? CUPS.length : null;
      const regStars = nTown * 10, stampStars = nMaps * 3;
      const base = { boss: TOWNS.length * 15, cups: (cups || 0) * 10, reqs: reqs * 2, firstOwn: dexList().length };
      const mexDay = MEX.filter(x => x.stars).map(x => ({ id: x.id, stars: x.stars, pt: x.pt }));
      return { nMaps, nTown, ms, oldMsStars: oldMs.reduce((a, x) => a + x.stars, 0), newMsStars: newMs.reduce((a, x) => a + x.stars, 0), regStars, stampStars, base, mexDay, reqs, cups, gacha: GACHA, dexN: dexList().length, daily: { login: 5, missions: MISSIONS.reduce((a, m) => a + m.rw, 0) } };
    });
  },
  /* 色違い・メタルの遭遇(歩数→遭遇率→1時間換算) */
  async shiny(page) {
    const n = N ? N * 40 : 40000, res = {};
    const inc = fs.existsSync(path.join(OUT, 'income.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'income.json'))).result : null;
    for (const [key, map, incKey] of [['aze', 'komorebi', 'aze_lv5'], ['urayama', 'urayama', 'urayama_lv8']]) {
      const byTime = {};
      for (const [tn, t] of [['day', 1], ['night', 3]]) byTime[tn] = await page.evaluate(([m, n, seed, t]) => SIM.encounters('ibote', m, n, seed, t), [map, n, SEED + 1000 * t + (map === 'urayama' ? 7 : 0), t]);
      const tot = { steps: 0, enc: 0, foes: 0, shiny: 0, metal: 0, encMetal: 0, encShiny: 0 };
      Object.values(byTime).forEach(r => Object.keys(tot).forEach(k => tot[k] += r[k]));
      const o = { ...tot, stepsPerEnc: tot.steps / tot.enc, encPerStep: tot.enc / tot.steps, shinyPerFoe: tot.shiny / tot.foes, metalPerEnc: tot.encMetal / tot.enc, shinyPerEnc: tot.encShiny / tot.enc, byTime };
      /* 1時間: 戦闘時間は income の実測(なければ15秒) */
      const bs = inc && inc[incKey] ? inc[incKey].secPerBattle : 15;
      const cycle = o.stepsPerEnc / params.GRASS * params.STEP_S + bs + 0.1 * params.REST_S;
      o.encPerH = inc && inc[incKey] ? inc[incKey].encPerH : 3600 / cycle; /* income の実測(回復の往復こみ)を優先 */ o.shinyPerH = o.encPerH * o.shinyPerEnc; o.metalPerH = o.encPerH * o.metalPerEnc; o.battleSecUsed = bs;
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
    for (const [label, party] of [['solo', 1], ['party3', 3]]) for (const thr of (opt("thr") || "8,11,14").split(",").map(Number)) {
      const all = [];
      for (const st of STARTERS) all.push(...(process.env.SIM_DEBUG && console.error("boss", label, thr, st), await page.evaluate(([s, n, seed, thr, p]) => SIM.toBoss(s, n, seed, thr, p), [st, n, SEED, thr, party])));
      const done = all.filter(r => r.done);
      res[`${label}_thr${thr}`] = { n: all.length, clear: done.length / all.length, firstTry: all.filter(r => r.firstTry === true).length / Math.max(1, all.filter(r => r.firstTry != null).length), reached: all.filter(r => r.firstTry != null).length / all.length,
        minutes: { p25: (pct(done.map(r => r.T), .25) || 0) / 60, p50: (pct(done.map(r => r.T), .5) || 0) / 60, p75: (pct(done.map(r => r.T), .75) || 0) / 60 },
        battles: { p50: pct(done.map(r => r.battles), .5) }, tries: mean(done.map(r => r.tries)), lvAtTry: mean(all.filter(r => r.firstTry != null).map(r => r.levelAtTry)), losses: mean(all.map(r => r.loses)), lvAtClear: mean(done.map(r => r.lv)) };
    }
    res.byLv = {};
    for (const party of [1, 3]) for (const lv of [10, 14, 18, 22]) {
      const rs = [];
      for (const st of STARTERS) rs.push(await page.evaluate(([s, lv, p, n, seed]) => SIM.bossWin(s, lv, p, n, seed), [st, lv, party, 100, SEED]));
      res.byLv[`p${party}_lv${lv}`] = { party, lv, win: mean(rs.map(r => r.win)), byStarter: rs.map(r => r.win) };
    }
    return res;
  }
};

(async () => {
  if (!item || (item !== 'all' && !items[item])) { console.error('項目名: ' + Object.keys(items).join(' ') + ' all'); process.exit(1); }
  const { browser, page } = await open();
  const list = item === 'all' ? ['opening', 'sequence', 'field', 'income', 'shiny', 'scout', 'metal', 'boss', 'wxfind', 'hoshiw', 'bonus', 'points', 'region', 'penalty', 'stars'] : [item];
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
