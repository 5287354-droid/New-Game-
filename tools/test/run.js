/* ミチクサ鉄道 回帰テスト。使い方: node tools/test/run.js   (index.html を配信して Playwright で確かめる)
 * 先に `python3 tools/build_app.py src/game.html .` で index.html を作っておく。
 * 新しいテストは T('名前', async () => {...}) で足す。open() でページを開く。 */
const path = require('path'), fs = require('fs'), http = require('http'), cp = require('child_process'), os = require('os');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const tests = []; const T = (name, fn) => tests.push([name, fn]);
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a).slice(0, 200)} != ${JSON.stringify(b).slice(0, 200)}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
let browser, port;
async function open({ w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state);
  await page.evaluate(() => { const R = Date.now.bind(Date); window.dayAt = i => { Date.now = () => R() + i * 864e5; }; });   /* 天気は実際の日付で決まるので、i 日後にずらす */
  await wait(500);
  return { page, ctx, errors, ev: (f, a) => page.evaluate(f, a), close: () => ctx.close() };
}
/* 「更新前」のセーブを作る: ゲームを始めて、あとから足したキーを消した状態 */
const OLD_KEYS = ['wins', 'wxN', 'wxLog', 'foot', 'mpt', 'mptAll', 'stamps', 'detour', 'kirari', 'dexReg', 'seenAt'];
async function makeOldSave(s, stage) {
  return s.ev(([stage, OLD]) => {
    state = fresh(); H.starter({ id: 'ibote' }); ui.dlg = null;
    if (stage >= 1) { state.boss.komorebi = true; state.town = 'kasumi'; state.yen = 5200; state.owned.happadanuki = true; state.seen.happadanuki = true; state.stars = 120; }
    if (stage >= 2) { state.boss.kasumi = true; state.town = 'shiomi'; state.yen = 40000; state.party[0].lv = 30; }
    OLD.forEach(k => delete state[k]);
    const raw = JSON.stringify(state); localStorage.setItem(KEY, raw); return raw;
  }, [stage, OLD_KEYS]);
}

T('ページを開いて pageerror 0 / 始めて歩く', async () => {
  const s = await open();
  await s.ev(() => { H.starter({ id: 'ibote' }); ui.dlg = null; state.bgm = false; render(); });
  await wait(1500);
  await s.ev(() => { OWC.held = 'right'; }); await wait(600); await s.ev(() => { OWC.held = null; });
  eq(s.errors, [], 'エラーあり'); await s.close();
});
for (const [stage, label] of [[0, '序盤'], [1, '中盤'], [2, '終盤']]) {
  T(`旧セーブ(${label})を読み込むと新キーが補われる`, async () => {
    const s = await open(); const raw = await makeOldSave(s, stage);
    const before = JSON.parse(raw);
    await s.page.reload(); await s.page.waitForFunction(() => typeof state !== 'undefined' && state); await wait(600);
    const r = await s.ev(() => ({ wins: state.wins, v: state.v, boss: state.boss, owned: Object.keys(state.owned), yen: state.yen, party: state.party.length }));
    eq(r.wins, 0, 'wins が補われていない'); eq(r.v, 1, 'state.v'); eq(r.boss, before.boss, 'ぬし撃破状態が変わった');
    eq(r.owned, Object.keys(before.owned), '図鑑が変わった'); eq(r.yen, before.yen, '円が変わった');
    eq(s.errors, [], 'エラーあり'); await s.close();
  });
}
T('migrate() を2回呼んでも同じ', async () => {
  const s = await open(); await makeOldSave(s, 1);
  const r = await s.ev(() => { state = load(); migrate(); const a = JSON.stringify(state); migrate(); const b = JSON.stringify(state); return [a, b]; });
  eq(r[0], r[1], 'migrate が冪等でない'); eq(s.errors, []); await s.close();
});
T('引き継ぎコード MKR1: の書き出し→読み込み', async () => {
  const s = await open(); await makeOldSave(s, 2);
  const r = await s.ev(() => { state = load(); migrate(); const code = saveCode(); const o = readCode(code); return { head: code.slice(0, 5), same: JSON.stringify(o) === JSON.stringify(state) }; });
  eq(r.head, 'MKR1:'); ok(r.same, '読み直した内容が元と違う'); eq(s.errors, []); await s.close();
});
T('check_sync.py (game.html と overworld.js の一致)', async () => {
  const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/check_sync.py')], { encoding: 'utf-8' });
  ok(r.status === 0, r.stdout + r.stderr);
});
T('index.html が src/game.html から作り直したものと一致', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkr-'));
  const r = cp.spawnSync('python3', [path.join(ROOT, 'tools/build_app.py'), path.join(ROOT, 'src/game.html'), tmp], { encoding: 'utf-8', cwd: ROOT });
  ok(r.status === 0, r.stderr);
  ok(fs.readFileSync(path.join(tmp, 'index.html'), 'utf-8') === fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8'), 'index.html が古い。build_app.py を実行して');
});

/* ---- T6 ---- */
T('T6: 相棒の才能が8以上、はじめの1戦は敵1体・Lv-2、3勝までは敵1体・Lv-1、あぜ道では仲間1体のあいだ敵1体、ぬし後は補正なし', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'happadanuki' }); ui.dlg = null; const talent = Object.values(state.party[0].talent);
    const lead = state.party[0]; lead.lv = 5; state.wins = 0; state.boss = {};
    const a = owEarly([['ibote', 9], ['ibote', 9], ['ibote', 9]]);
    state.wins = 3; const b = owEarly([['ibote', 9], ['ibote', 9]]);
    state.wins = 0; state.boss = { komorebi: true }; const c = owEarly([['ibote', 9], ['ibote', 9]]);
    state.boss = {}; lead.lv = 1; const d = owEarly([['ibote', 9]]);
    lead.lv = 5; state.wins = 1; const a1 = owEarly([['ibote', 9], ['ibote', 9]]);
    state.wins = 3; const aze = owEarly([['ibote', 9], ['ibote', 9]], { id: 'aze' }), uray = owEarly([['ibote', 9], ['ibote', 9]], { id: 'urayama' });
    return { min: Math.min(...talent), a, a1, aze, uray, b, c, d };
  });
  ok(r.min >= 8, '才能 ' + r.min); eq(r.a, [['ibote', 3]]); eq(r.a1, [['ibote', 4]]); eq(r.aze, [['ibote', 4]]); eq(r.uray.length, 2); eq(r.b.length, 2); eq(r.c.length, 2); eq(r.d, [['ibote', 1]]);
  eq(s.errors, []); await s.close();
});
T('T6: 野生に勝つと wins が増える', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'ibote' }); ui.dlg = null; state.wins = 0;
    startBattle([['koganetsubu', 1]], { field: 'x', scene: 'inaka' }); B.enemies.forEach(c => c.hp = 0); win(); const w1 = state.wins; B = null;
    return w1;
  });
  eq(r, 1); eq(s.errors, []); await s.close();
});
T('T6: 負けの罰(ぬし前は0円、ぬし後は25%で上限あり)', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'ibote' }); ui.dlg = null; const out = {};
    state.boss = {}; state.yen = 1000; startBattle([['koganetsubu', 1]], { field: 'x', scene: 'inaka' }); lose(); out.early = state.yen; out.msg = B.result.lines[1]; B = null;
    state.boss = { komorebi: true }; state.town = 'komorebi'; state.yen = 1000; startBattle([['koganetsubu', 1]], { field: 'x', scene: 'inaka' }); lose(); out.later = state.yen; B = null;
    state.yen = 100000; startBattle([['koganetsubu', 1]], { field: 'x', scene: 'inaka' }); lose(); out.cap = state.yen; B = null;
    return out;
  });
  eq(r.early, 1000); ok(r.msg.includes('おかみさん'), r.msg); eq(r.later, 750); eq(r.cap, 98000); eq(s.errors, []); await s.close();
});
T('T6: 会話スキップで最後の行へ飛び、とじると cb が必ず呼ばれる', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'ibote' }); ui.dlg = null; window.__cb = 0;
    talk([['a', '1'], ['a', '2'], ['a', '3']], () => { window.__cb++; });
    const hasSkip = !!document.querySelector('[data-act="dlgSkip"]');
    H.dlgSkip(); const i = ui.dlg.i; const cb1 = window.__cb; H.dlgSkip();
    return { hasSkip, i, cb1, cb2: window.__cb, closed: !ui.dlg };
  });
  ok(r.hasSkip, 'スキップボタンがない'); eq(r.i, 2); eq(r.cb1, 0); eq(r.cb2, 1); ok(r.closed); eq(s.errors, []); await s.close();
});
T('T6: 戦闘後にHPが3割未満で道具があれば回復の札', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'ibote' }); ui.dlg = null; const m = state.party[0]; m.hp = 1; state.items.bansoko = 2; owHealHint(); const had = ui.heal; render();
    const btn = !!document.querySelector('[data-act="owHeal"]'); H.owHeal(); return { had, btn, hp: m.hp, left: state.items.bansoko, heal: ui.heal };
  });
  ok(r.had && r.btn); ok(r.hp > 1); eq(r.left, 1); eq(r.heal, null); eq(s.errors, []); await s.close();
});

/* ---- T7 ---- */
const goMap = (s, town) => s.ev(t => { H.starter({ id: 'ibote' }); ui.dlg = null; state.bgm = false; state.sound = false; state.boss = { komorebi: true, kasumi: true }; state.town = t; state.ow = null; ui.tab = 'map'; ui.station = false; ui.inside = null; ui.toast = ''; owEnsureState(); render(); }, town);
T('T7: 390x844 で地図が画面の高さの65%以上、十字キー56px以上、重ならない', async () => {
  const s = await open();
  for (const t of ['komorebi', 'kasumi', 'shiomi']) {
    await goMap(s, t); await wait(400);
    const r = await s.ev(() => { const R = e => { const b = document.querySelector(e).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
      const box = document.querySelector('.ow-screen').getBoundingClientRect();
      return { box: { y: box.top, b: box.bottom, h: box.height, w: box.width }, cv: R('#owc'), dp: R('.dp-up'), pad: R('.ow-pad'), cols: OWC.vw, rows: OWC.vh, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; });
    ok(r.box.h >= 844 * 0.65, `${t}: 地図の枠 ${r.box.h}px (65%未満)`);
    ok(r.dp.w >= 56, `${t}: 十字キー ${r.dp.w}px`);
    ok(r.pad.y >= r.box.b - 1, `${t}: 操作パッドが地図と重なる`);
    ok(r.sw <= 390 && r.sh <= 844, `${t}: はみ出し ${r.sw}x${r.sh}`);
    console.log(`      ${t}: 地図 ${Math.round(r.box.h)}px (${Math.round(r.box.h / 8.44)}%) ${r.cols}x${r.rows}マス キー${Math.round(r.dp.w)}px`);
  }
  eq(s.errors, []); await s.close();
});
T('T7: タップ移動が狙ったマスへ(座標のずれ0)', async () => {
  const s = await open();
  for (const t of ['komorebi', 'shiomi']) {
    await goMap(s, t); await wait(400);
    const pt = await s.ev(() => {
      const r = document.getElementById('owc').getBoundingClientRect(), sc = r.width / (OWC.vw * TS), o = state.ow, m = owMap();
      const okc = (x, y) => m.rows[y] && m.rows[y][x] && !OW_SOLID.includes(m.rows[y][x]);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1]]) { const x = o.x + dx, y = o.y + dy; if (okc(x, y)) return { x: r.left + ((x * TS - OWC.camX) + TS / 2) * sc, y: r.top + ((y * TS - OWC.camY) + TS / 2) * sc, tx: x, ty: y }; }
      return null; });
    ok(pt, t + ': 目標マスなし');
    await s.page.mouse.click(pt.x, pt.y); await wait(60);
    const goal = await s.ev(() => OWC.goal ? [...OWC.goal] : null);
    await wait(1800);
    const pos = await s.ev(() => [state.ow.x, state.ow.y]);
    ok((goal && goal[0] === pt.tx && goal[1] === pt.ty) || (pos[0] === pt.tx && pos[1] === pt.ty), `${t}: 目標 ${pt.tx},${pt.ty} goal=${goal} pos=${pos}`);
  }
  eq(s.errors, []); await s.close();
});
T('T7: 横長 844x390 とタブレットでもはみ出さない', async () => {
  for (const [w, h] of [[844, 390], [820, 1180]]) {
    const s = await open({ w, h }); await goMap(s, 'komorebi'); await wait(400);
    const r = await s.ev(() => { const c = document.getElementById('owc').getBoundingClientRect(), b = document.querySelector('.ow-screen').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cw: c.width, bw: b.width, cols: OWC.vw, rows: OWC.vh }; });
    ok(r.sw <= w && r.sh <= h, `${w}x${h}: はみ出し ${r.sw}x${r.sh}`); ok(r.cw <= r.bw + 1, `${w}x${h}: 地図が枠より広い ${r.cw}>${r.bw}`); ok(r.rows >= 8, `${w}x${h}: ${r.cols}x${r.rows}`);
    eq(s.errors, []); await s.close();
  }
});
T('T7: 時間帯の帯が出て、歩きを止めず、色が0.8秒で切り替わる', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  await s.ev(() => { state.time = 1; owTimePass(); OWC.held = 'right'; });
  await wait(250);
  const r = await s.ev(() => ({ band: (document.querySelector('.ow-band') || {}).textContent, fade: !!OWC.fade, held: OWC.held }));
  ok(r.band && r.band.includes('夕方'), '帯: ' + r.band); ok(r.fade, 'クロスフェード開始せず'); eq(r.held, 'right');
  await wait(2200); await s.ev(() => { OWC.held = null; });
  const r2 = await s.ev(() => ({ band: !!document.querySelector('.ow-band'), fade: !!OWC.fade }));
  ok(!r2.band, '帯が消えない'); ok(!r2.fade, 'フェードが終わらない');
  eq(s.errors, []); await s.close();
});
T('T7: 歩行中は細いバー、メニューで7タブが開く', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  const a = await s.ev(() => ({ tabs: !!document.querySelector('.tabs'), bar: !!document.querySelector('.wmenu-b') }));
  ok(!a.tabs && a.bar, '細いバーになっていない');
  await s.page.click('.wmenu-b'); await wait(200);
  const b = await s.ev(() => document.querySelectorAll('.tabs .tab').length); eq(b, 7);
  eq(s.errors, []); await s.close();
});

/* ---- T2 みちくさ踏破 ---- */
const GAME_SRC = fs.readFileSync(path.join(ROOT, 'src/game.html'), 'utf-8');
const startGame = s => s.ev(() => { H.starter({ id: 'ibote' }); ui.dlg = null; state.bgm = false; state.sound = false; state.boss = { komorebi: true, kasumi: true }; ui.tab = 'map'; ui.station = false; ui.inside = null; ui.toast = ''; state.ow = null; owEnsureState(); render(); });
/* 地図 id のいちばん最初に見つかる、通れるマス(区画ごと) */
const tileOfBlocks = (s, id) => s.ev(id => { const m = MAPS[id], fi = footInfo(id), out = {}; for (let y = 0; y < m.rows.length; y++) for (let x = 0; x < m.rows[y].length; x++) { const i = (y >> 2) * fi.bw + (x >> 2); if (fi.valid[i] && !out[i] && !OW_SOLID.includes(m.rows[y][x])) out[i] = [x, y]; } return Object.values(out); }, id);
T('T2: 区画の記録(同じ区画は1点だけ)・全区画で100%・金スタンプと★3は1回だけ', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const id = 'urayama', m = MAPS[id], out = {}; state.ow = { map: id, x: m.spawn.x, y: m.spawn.y, dir: 'down' };
    const p0 = state.mpt; owFoot(); const p1 = state.mpt; owFoot(); owFoot(); const p2 = state.mpt;
    out.once = [p1 - p0, p2 - p1]; out.hex = /^[0-9a-f]+$/.test(state.foot[id]); out.hexLen = state.foot[id].length; out.nb = footInfo(id).nb;
    out.total = footInfo(id).total; return out;
  });
  eq(r.once, [1, 0], '同じ区画で点が増えた'); ok(r.hex, '16進でない'); eq(r.hexLen, Math.ceil(r.nb / 4)); ok(r.total > 4);
  const blocks = await tileOfBlocks(s, 'urayama');
  const r2 = await s.ev(([bl]) => {
    const id = 'urayama', s0 = state.stars, out = {};
    for (const [x, y] of bl) { state.ow = { map: id, x, y, dir: 'down' }; owFoot(); const p = footPct(id); if (p >= .8 && out.p80 == null) { out.p80 = state.stamps[id]; out.pt80 = state.mpt; } }
    out.pct = footShow(id); out.stamp = state.stamps[id]; out.stars = state.stars - s0; out.mpt = state.mpt;
    const mp = state.mpt; for (const [x, y] of bl) { state.ow = { map: id, x, y, dir: 'down' }; owFoot(); } out.again = [state.mpt - mp, state.stars - s0]; return out;
  }, [blocks]);
  eq(r2.pct, 100); eq(r2.stamp, 2); eq(r2.p80, 1, '80%で銀スタンプ'); eq(r2.stars, 3); eq(r2.again, [0, 3], '2回目に再付与された');
  eq(s.errors, []); await s.close();
});
T('T2: 全マップで、到達できる区画を全部踏むと踏破100%(実際の通行判定 owSolid で解く)', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    /* ソルバー: しかけは全部解けるものとして(ぬしを倒し、旗が立ち、物は拾い、岩は穴に押し込み、流氷は全位置・潮と夜昼は全部・霧は晴れの時)、
       入口から実際の owSolid で広げて、立てたマスの全部を踏む */
    state.owFlags = new Proxy({}, { get: () => true }); TOWNS.forEach(t => state.boss[t.id] = true); state.owItems = new Proxy({}, { get: () => true });
    const bad = [], rows = []; let n = 0;
    for (const id in MAPS) {
      const m = MAPS[id]; n++; state.foot = {}; state.stamps = {};
      if (m.rocks) { const f = {}; m.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'O') f[x + ',' + y] = true; })); OWC.rk = { map: id, rocks: [], filled: f }; }
      const orig = owFloatPos; let sel = -1; window.owFloatPos = f => { if (sel < 0) return orig(f); const t = owFloatTiles(f); return t[Math.min(sel, t.length - 1)]; };
      const mx = Math.max(1, ...(m.floats || []).map(f => owFloatTiles(f).length));
      state.ow = { map: id, x: m.spawn.x, y: m.spawn.y, dir: 'down' };
      const okAny = (x, y) => { for (let t = 0; t < 4; t++) { state.time = t; for (sel = m.floats ? 0 : -1; sel < (m.floats ? mx : 0); sel++) if (!owSolid(m, x, y)) { sel = -1; return true; } } sel = -1; return false; };
      const DN = Date.now; if (m.fogStone) Date.now = () => m.fogStone.per * 1000 + m.fogStone.on + 1;
      const { seen, R, C } = footReach(id, okAny); Date.now = DN; window.owFloatPos = orig; OWC.rk = null;
      const fi = footInfo(id), hit = new Set(), tiles = [];
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (seen[y * C + x]) { tiles.push([x, y]); hit.add((y >> 2) * fi.bw + (x >> 2)); }
      let extra = 0, lack = 0; for (let i = 0; i < fi.nb; i++) { if (hit.has(i) && !fi.valid[i]) extra++; if (!hit.has(i) && fi.valid[i]) lack++; }
      for (const [x, y] of tiles) { state.ow = { map: id, x, y, dir: 'down' }; owFoot(); }
      const pct = footShow(id);
      if (!fi.total || pct !== 100 || extra || lack || state.stamps[id] !== 2) bad.push(`${id}:${pct}%(${footCount(id)}/${fi.total}) 数えすぎ${lack} 数え漏れ${extra}`);
      rows.push(fi.total);
    }
    return { n, bad, tot: rows.reduce((a, b) => a + b, 0) };
  });
  eq(r.bad, [], '踏み尽くしても100%にならない/到達できない区画を分母に入れている'); console.log(`      ${r.n}マップ 全${r.tot}区画 すべて到達でき、踏むと100%`);
  eq(s.errors, []); await s.close();
});
T('T2: しかけスタンプ18種がすべて取れる(関数を呼ぶ + ソースにフックがある)', async () => {
  const s = await open(); await startGame(s);
  const ids = await s.ev(() => OW_STAMPS.map(d => d[0])); eq(ids.length, 18);
  for (const id of ids) ok(GAME_SRC.split(`owStamp('${id}')`).length > 2 || GAME_SRC.includes(`owStamp('${id}')`), id + ' のフックがない');
  const r = await s.ev(() => {
    const got = {}, mark = id => { got[id] = !!state.stamps[id]; };
    state.ow = { map: 'komorebi', x: 5, y: 5, dir: 'down' };
    owWarashi(); mark('g:warashi'); owFeast(); mark('g:feast'); owWarm(); mark('g:warm');
    OWC.lseq = []; ['E', 'W', 'S', 'N'].forEach(k => owToro(k)); ui.dlg = null; mark('g:toro');
    owTrash('1,1'); ui.dlg = null; if (B) B = null; mark('g:trash');
    const fm = Object.keys(MAPS).find(k => MAPS[k].fish); state.ow = { map: fm, x: 2, y: 2, dir: 'down' }; OWC.fish = { phase: 'bite' }; owFishPull(); if (B) B = null; mark('g:fish');
    const fake = { cars: { lanes: [{ y: 7 }] }, floats: [], wind: true, aurora: true };
    const O = { x: 1, y: 7 }; const tide = owTideHigh; const pg = owPedGreen; window.owPedGreen = () => 'go'; owStampTiles(fake, O, 'a'); window.owPedGreen = pg; mark('g:signal'); mark('g:aurora');
    state.time = 1; owStampTiles(fake, O, 'U'); mark('g:tide'); state.stamps['g:gust'] || (owGust = () => 'gust'); owStampTiles(fake, O, 'H'); mark('g:gust');
    for (const id of ['g:power', 'g:ride', 'g:geyser', 'g:float', 'g:ring', 'g:mirror', 'g:ghost', 'g:fog']) { owStamp(id); mark(id); }
    return { got, n: OW_STAMPS.filter(d => state.stamps[d[0]]).length, mpt: state.mpt };
  });
  const miss = Object.entries(r.got).filter(([, v]) => !v).map(([k]) => k); eq(miss, [], '取れないスタンプ');
  eq(r.n, 18); ok(r.mpt >= 80, 'しかけ18種で +5点ずつ'); eq(s.errors.filter(e => !/owPedGreen|assign to const/.test(e)), []); await s.close();
});
T('T2: 寄り道ボーナスの段(10区画ごとに1段、最大5段)・駅に戻ると0・戦闘に倍率', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const id = Object.keys(MAPS).find(k => MAPS[k].town === 'komorebi' && k !== 'komorebi'), m = MAPS[id], fi = footInfo(id), out = { id }, tiles = [];
    for (let y = 0; y < m.rows.length; y++) for (let x = 0; x < m.rows[y].length; x++) { const i = (y >> 2) * fi.bw + (x >> 2); if (fi.valid[i] && !tiles[i] && !OW_SOLID.includes(m.rows[y][x])) tiles[i] = [x, y]; }
    const L = tiles.filter(Boolean); out.n = L.length; const steps = [];
    L.forEach(([x, y], k) => { state.ow = { map: id, x, y, dir: 'down' }; owFoot(); steps.push(state.detour); });
    out.d9 = steps[8]; out.d10 = steps[9]; out.max = Math.max(...steps);
    state.detour = 3; const hub = MAPS[id].town; state.ow = { map: hub, x: MAPS[hub].spawn.x, y: MAPS[hub].spawn.y, dir: 'down' }; owFoot(); out.hub = [state.detour, state.detourN];
    const exp = () => { startBattle([['koganetsubu', 5]], { field: 'x', scene: 'inaka' }); B.enemies.forEach(c => c.hp = 0); win(); const e = B.result.rw; const q = { exp: e.exp, bonus: e.bonus }; B = null; return q; };
    state.detour = 0; const a = exp(); state.detour = 3; const b = exp(); state.detour = 9; const c = exp();
    startBattle([['koganetsubu', 5]], { field: 'x', scene: 'inaka', boss: true, town: 'komorebi' }); state.detour = 3; B.enemies.forEach(c => c.hp = 0); win(); out.boss = B.result.rw.bonus; B = null;
    startBattle([['koganetsubu', 5]], { field: 'x', scene: 'inaka', cup: { id: CUPS[0].id, round: 1 } }); B.enemies.forEach(c => c.hp = 0); win(); out.cup = B.result.rw.bonus; B = null;
    out.a = a; out.b = b; out.c = c; state.detour = 3; startBattle([['koganetsubu', 5]], { field: 'x', scene: 'inaka' }); lose(); out.lose = state.detour; B = null;
    return out;
  });
  ok(r.n >= 12, '区画が足りない ' + r.n); eq(r.d9, 0); eq(r.d10, 1); ok(r.max >= 1 && r.max <= 5);
  eq(r.hub, [0, 0], '駅で0に戻らない'); eq(r.a.bonus, 0); eq(r.b.bonus, 30); eq(r.c.bonus, 50, '最大+50%');
  eq(r.b.exp, Math.floor(r.a.exp * 1.3), '経験値 +30%'); eq(r.c.exp, Math.floor(r.a.exp * 1.5)); eq(r.boss, 0, 'ぬしに倍率'); eq(r.cup, 0, '配合杯に倍率'); eq(r.lose, 0, '負けで0');
  eq(s.errors, []); await s.close();
});
T('T2: 結果画面に「寄り道 +N%」が出る', async () => {
  const s = await open(); await startGame(s);
  const t = await s.ev(() => { state.detour = 2; startBattle([['koganetsubu', 5]], { field: 'x', scene: 'inaka' }); B.enemies.forEach(c => c.hp = 0); win(); return (document.querySelector('.bonus') || {}).textContent; });
  ok(t && t.includes('+20%'), '寄り道の札: ' + t); eq(s.errors, []); await s.close();
});
T('T2: みちくさ帳の交換(点が足りないと不可・1日1回・累計1回・称号)', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const o = {}; state.mpt = 10; o.poor = mexBuy('kirakira'); state.mpt = 5000; state.items.kirakira = 0; state.items.kai = 0; state.items.saino = 0; state.items.tenpu = 0; const st0 = state.stars;
    o.k = mexBuy('kirakira'); o.kai = mexBuy('kai'); o.s1 = mexBuy('saino'); o.s2 = mexBuy('saino'); o.st1 = mexBuy('star'); o.st2 = mexBuy('star'); o.t1 = mexBuy('tenpu'); o.t2 = mexBuy('tenpu');
    o.items = [state.items.kirakira, state.items.kai, state.items.saino, state.items.tenpu]; o.stars = state.stars - st0; o.mpt = state.mpt;
    o.starPt = [['kirakira', 'kai', 'saino', 'star', 'tenpu'].map(id => MEX.find(x => x.id === id).pt), MEX.find(x => x.id === 'star').stars];
    state.mptAll = 2499; o.t0 = mchiTitle(); state.mptAll = 2500; o.t1x = mchiTitle();
    H.mchi(); o.inside = ui.inside; o.html = document.querySelector('.mex') ? document.querySelectorAll('.mex').length : 0; o.stamps = document.querySelectorAll('.mst').length;
    return o;
  });
  eq(r.poor, false); eq([r.k, r.kai, r.s1, r.s2, r.st1, r.st2, r.t1, r.t2], [true, true, true, false, true, false, true, false]);
  eq(r.items, [1, 1, 1, 1]); eq(r.stars, r.starPt[1]); eq(r.mpt, 5000 - r.starPt[0].reduce((a, b) => a + b, 0));
  eq(r.t0, ''); eq(r.t1x, 'みちくさ名人'); eq(r.inside, 'mchi'); eq(r.html, 5); eq(r.stamps, 18);
  eq(s.errors, []); await s.close();
});
T('T2: 画面(みちくさ帳)は390pxでもはみ出さず、ボタンが44px以上', async () => {
  const s = await open(); await startGame(s);
  await s.ev(() => { state.mpt = 999; state.mptAll = 2600; for (const d of OW_STAMPS.slice(0, 5)) state.stamps[d[0]] = 1; H.mchi(); });
  await wait(300);
  const r = await s.ev(() => ({ sw: document.documentElement.scrollWidth, btn: [...document.querySelectorAll('.mex .btn')].map(b => b.getBoundingClientRect().height), sub: !!document.querySelector('.ow-sub') }));
  ok(r.sw <= 390, 'はみ出し ' + r.sw); ok(r.btn.every(h => h >= 44), '交換ボタンが小さい ' + r.btn);
  await s.ev(() => { H.owLeave(); }); await wait(300);
  const r2 = await s.ev(() => ({ chip: (document.querySelector('.ow-foot') || {}).textContent, mchi: !!document.querySelector('.ow-mchi') }));
  ok(r2.chip && r2.chip.includes('踏破'), '踏破の札がない'); ok(r2.mchi, '駅のマップではみちくさ帳へ行ける');
  eq(s.errors, []); await s.close();
});
/* ---- T4 地域図鑑 ---- */
T('T4: 地域の種族が、町の出現表(fields + 釣り場)と一致し、9町すべてに種族がいる', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => TOWNS.map(t => { const want = new Set(); t.fields.forEach(f => f.table.forEach(([sp]) => want.add(sp))); for (const id in MAPS) if (MAPS[id].town === t.id && MAPS[id].fish) MAPS[id].fish.table.forEach(([sp]) => want.add(sp));
    const got = regList(t.id).map(x => x.s); return { id: t.id, n: got.length, same: got.length === want.size && got.every(x => want.has(x)), bad: got.filter(x => !SP[x]).length, rw: !!REG_RW[t.id] }; }));
  eq(r.length, 9); for (const x of r) { ok(x.same && x.n > 0 && !x.bad, x.id + ' が一致しない'); ok(x.rw, x.id + ' の報酬がない'); }
  console.log('      ' + r.map(x => x.id + ':' + x.n).join(' ')); eq(s.errors, []); await s.close();
});
T('T4: 地域コンプ報酬は町ごとに1回だけ・金スタンプ', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const o = {}, id = 'komorebi'; o.before = regClaim(id); regList(id).forEach(x => { state.owned[x.s] = true; state.seen[x.s] = true; });
    const s0 = state.stars, i0 = state.items.onigiri || 0; o.a = regClaim(id); o.b = regClaim(id); o.stars = state.stars - s0; o.item = state.items.onigiri - i0; o.stamp = state.stamps['reg:' + id]; o.flag = state.dexReg[id];
    ui.tab = 'dex'; ui.dexMode = 'reg'; render(); o.groups = document.querySelectorAll('.dexgroup.reg').length; o.done = !!document.querySelector('.regsum .badge'); o.sw = document.documentElement.scrollWidth;
    ui.dexMode = 'fam'; render(); o.fam = document.querySelectorAll('.dexgroup').length; ui.tab = 'map'; return o;
  });
  eq([r.before, r.a, r.b], [false, true, false]); eq(r.stars, 10); eq(r.item, 5); eq(r.stamp, 2); eq(r.flag, true); eq(r.groups, 9); ok(r.done); ok(r.sw <= 390); ok(r.fam > 5);
  eq(s.errors, []); await s.close();
});
T('T4: 記念品は「全種」(dexList().length)まで受け取れる・既存の受取済みはそのまま', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const o = {}; o.len = dexList().length; state.dexClaim = { 10: true, 20: true, 51: true };
    const all = dexList(); all.forEach(x => { state.owned[x.id] = true; state.seen[x.id] = true; }); state.stars = 0;
    o.keys = DEX_MS.map(dexKey); o.n = DEX_MS.map(x => x.n);
    o.old = [dexMsClaim(10), dexMsClaim(20), dexMsClaim(51)];
    let c = 0; DEX_MS.forEach(x => { if (dexMsClaim(dexKey(x))) c++; }); o.claimed = c; o.all = state.dexClaim.all; o.hakase = !!state.flags.hakase; o.top = Math.max(...DEX_MS.map(x => x.n));
    o.again = DEX_MS.some(x => dexMsClaim(dexKey(x))); ui.tab = 'dex'; render(); o.got = document.querySelectorAll('.ms.got').length; o.tot = DEX_MS.length; ui.tab = 'map';
    return o;
  });
  eq(r.old, [false, false, false], '既存の受取済みを再付与した'); eq(r.top, r.len, '最終段が全種'); ok(r.all && r.hakase); eq(r.again, false); eq(r.got, r.tot);
  ok(r.n.includes(140) && r.n.includes(70) && r.n.includes(100)); ok(!JSON.stringify(r.keys.slice(0, -1)).includes('all')); eq(s.errors, []); await s.close();
});
T('T4: はじめて会った場所 seenAt(最初の1回だけ)、図鑑の詳細に出る', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => {
    const o = {}; state.town = 'kasumi'; state.time = 3; delete state.seen.kurageru; delete state.seenAt; startBattle([['kurageru', 5]], { field: 'x', scene: 'inaka' }); o.a = state.seenAt.kurageru; B = null;
    state.town = 'shiomi'; state.time = 0; startBattle([['kurageru', 5]], { field: 'x', scene: 'inaka' }); o.b = state.seenAt.kurageru; B = null;
    o.text = seenAtText('kurageru'); delete state.seenAt.kurageru; o.none = seenAtText('kurageru'); return o;
  });
  eq(r.a.slice(0, 2), ['kasumi', 3]); ok(r.a[2] === null || typeof r.a[2] === 'string', '天気の記録の形が違う'); eq(r.b, r.a, '上書きされた'); ok(r.text.includes('霞ヶ丘') && r.text.includes('夜'), r.text); ok(r.none.includes('記録なし')); eq(s.errors, []); await s.close();
});
T('T2/T4: 旧セーブ(新キーなし)でも新キーが補われ、最初の1歩から記録される', async () => {
  const s = await open(); await makeOldSave(s, 1);
  await s.ev(() => { const st = JSON.parse(localStorage.getItem(KEY)); delete st.detourN; localStorage.setItem(KEY, JSON.stringify(st)); });
  await s.page.reload(); await s.page.waitForFunction(() => typeof state !== 'undefined' && state); await wait(600);
  const r = await s.ev(() => { const k = ['foot', 'mpt', 'mptAll', 'stamps', 'detour', 'detourN', 'dexReg', 'seenAt'].map(x => state[x] != null); const m0 = state.mpt; owEnsureState(); state.ow = { map: 'urayama', x: MAPS.urayama.spawn.x, y: MAPS.urayama.spawn.y, dir: 'down' }; owFoot(); return { k, d: state.mpt - m0, v: state.v }; });
  ok(r.k.every(Boolean), '補われないキー ' + r.k); eq(r.v, 1); eq(r.d, 1); eq(s.errors, []); await s.close();
});
T('T2/T4: foot・seenAt・stamps を全部埋めても 引き継ぎコード・クラウド保存の容量が小さい', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(async () => {
    for (const id in MAPS) { const fi = footInfo(id); state.foot[id] = 'f'.repeat(Math.ceil(fi.nb / 4)); }
    SPL.forEach(x => state.seenAt[x.id] = ['sango', 3, 'rain']); OW_STAMPS.forEach(d => state.stamps[d[0]] = 1); for (const id in MAPS) state.stamps[id] = 2; TOWNS.forEach(t => state.stamps['reg:' + t.id] = 2);
    const json = JSON.stringify(state), code = saveCode(), back = readCode(code); const pk = await packState(state);
    return { json: json.length, code: code.length, same: JSON.stringify(back) === json, z: pk.z ? pk.z.length : -1, foot: JSON.stringify(state.foot).length, seenAt: JSON.stringify(state.seenAt).length };
  });
  ok(r.same, '読み直した内容が違う'); console.log(`      json ${r.json}B / 引き継ぎコード ${r.code}字 / gzip+b64 ${r.z}字 (foot ${r.foot}B, seenAt ${r.seenAt}B)`);
  ok(r.foot < 6000 && r.seenAt < 6000, 'foot/seenAt が大きい'); ok(r.z > 0 && r.z < 100000, 'クラウド保存が大きい ' + r.z); eq(s.errors, []); await s.close();
});

/* ===== T1(空もよう)・T3(きらり) ===== */
T('T1: 天気は日付+町+時間帯だけで決まり(保存しない)、ベンチで休んでも(wxNが進んでも)振り直せない', async () => {
  const s = await open(); await goMap(s, 'komorebi');
  const r = await s.ev(() => {
    const a = wxOf('komorebi'), b = wxOf('komorebi'), keys = JSON.parse(JSON.stringify(state));
    const seq = []; for (let i = 0; i < 12; i++) { dayAt(i); seq.push(wxOf('komorebi')); } dayAt(0);
    /* 同じ日・同じ時間帯なら、wxN をどれだけ動かしても同じ。4つ進めて(丸1日)から戻ると、次の日の同じ時間帯 */
    const w0 = wxOf('komorebi'), t0 = state.time; let same = true; for (let i = 0; i < 50; i++) { state.wxN = i * 7; if (wxOf('komorebi') !== w0 || wxNow('komorebi') !== w0) same = false; }
    const day = []; for (let k = 0; k < 4; k++) { state.time = k; day.push(wxOf('komorebi')); } state.time = t0;
    const rest = []; for (let i = 0; i < 20; i++) { state.time = 1; const x = wxOf('komorebi'); advanceTime(); advanceTime(); advanceTime(); advanceTime(); rest.push(wxOf('komorebi') === x && state.time === 1); }
    return { same: a === b && same, noSaved: !('wx' in keys) && !('weather' in keys), kinds: new Set(seq).size, day, rest };
  });
  ok(r.same, '同じ状態で天気が変わる / wxN に左右される'); ok(r.noSaved, '天気を保存している'); ok(r.rest.every(x => x), '丸1日休むと(同じ日の)同じ時間帯の天気が変わった');
  ok(r.kinds >= 2, '天気が変化しない'); eq(r.day.length, 4); eq(s.errors, []); await s.close();
});
T('T1: 予報(k=1,2)が、時間を進めたときの天気と一致する', async () => {
  const s = await open(); await goMap(s, 'tengu');
  const r = await s.ev(() => { let bad = 0; for (let i = 0; i < 40; i++) { dayAt(i * 3); state.time = i % 4; const f1 = wxOf('tengu', 1), f2 = wxOf('tengu', 2); advanceTime(); if (wxNow('tengu') !== f1) bad++; advanceTime(); if (wxNow('tengu') !== f2) bad++; } return bad; });
  eq(r, 0, '予報が外れた'); eq(s.errors, []); await s.close();
});
T('T1: 各町で天気の割合が表の±3%以内(昼)', async () => {
  const s = await open();
  const r = await s.ev(() => { const out = []; state.time = 1; for (const t of Object.keys(WX_TBL)) { const tb = WX_TBL[t], tot = Object.values(tb).reduce((a, b) => a + b, 0) - (tb.hoshi || 0), N = 4000, cnt = {};
    for (let i = 0; i < N; i++) { dayAt(i); const w = wxOf(t); cnt[w] = (cnt[w] || 0) + 1; }
    for (const id of WXK) { const exp = id === 'hoshi' ? 0 : (tb[id] || 0) / tot, got = (cnt[id] || 0) / N; if (Math.abs(exp - got) > .03) out.push(`${t}:${id} ${got.toFixed(3)} vs ${exp.toFixed(3)}`); } } return out; });
  eq(r, [], '割合のずれ'); await s.close();
});
T('T1: 天気の偏り: どの町でも、各天気が7日のうちに少なくとも1回は出る(星降りは夜だけなので14日で)', async () => {
  const s = await open();
  const r = await s.ev(() => {
    const D = 2000, bad = [], worst = {}, R = Date.now.bind(Date), tab = {};
    for (const t of Object.keys(WX_TBL)) { tab[t] = []; for (let d = 0; d < D; d++) { dayAt(d); const row = []; for (let tm = 0; tm < 4; tm++) { state.time = tm; row.push(wxOf(t)); } tab[t].push(row); } }
    dayAt(0);
    for (const t of Object.keys(WX_TBL)) for (const w of WXK) { if (!WX_TBL[t][w]) continue; const win = w === 'hoshi' ? 14 : 7; let miss = 0, n = 0;
      for (let d = 0; d + win <= D; d++) { n++; if (!tab[t].slice(d, d + win).some(row => row.includes(w))) miss++; }
      worst[t + ':' + w] = +(miss / n * 100).toFixed(1); if (miss / n > (w === 'hoshi' ? .05 : .06)) bad.push(`${t}:${w} ${(miss / n * 100).toFixed(1)}%`); }
    /* 昼の時間帯(0..2)にも、天候限定種が出る日がある: 町ごとの全探索先で、各 天気タグの種が出る日が 20日に1回以上 */
    return { bad, max: Math.max(...Object.values(worst)) };
  });
  eq(r.bad, [], '7日のうちに一度も出ない天気が多い町がある'); console.log(`      7日で欠ける確率の最大 ${r.max}%`); eq(s.errors, []); await s.close();
});
T('T1: 星降りは夜だけ。天候限定の7体はその天気の時だけ出現表に入る', async () => {
  const s = await open();
  const r = await s.ev(() => {
    const lim = { amayadori: ['komorebi', 'aze', 'ame', null], kirigarasu: ['tengu', 'sando', 'kiri', null], nijimimizu: ['kasumi', 'biru', 'ame', null], yukiwata: ['ryuhyo', 'genseirin', 'yuki', null], haikagura: ['hinoshima', 'kokusa', 'hai', null], kumozumi: ['shiomi', 'gyokou', 'kumo', 3], hoshikuzume: ['komorebi', 'aze', 'hoshi', null] };
    const bad = [], hit = [];
    for (const [sp, [tw, fid, wx, nt]] of Object.entries(lim)) { const f = TOWN[tw].fields.find(x => x.id === fid);
      for (const w of WXK) for (let tm = 0; tm < 4; tm++) { const has = wxTable(f.table, tm, w).some(x => x.s === sp), want = w === wx && (sp === 'kumozumi' ? tm >= 2 : true); if (has !== want) bad.push(`${sp} ${w} t${tm} has=${has}`); if (has) hit.push(sp); } }
    let star = 0; state.time = 0; for (let i = 0; i < 500; i++) { dayAt(i); if (wxOf('komorebi') === 'hoshi') star++; }
    let starN = 0; state.time = 3; for (let i = 0; i < 500; i++) { dayAt(i); if (wxOf('komorebi') === 'hoshi') starN++; }
    return { bad, n: new Set(hit).size, star, starN, spl: SPL.slice(-8, -1).map(x => x.id), last: SPL[SPL.length - 1].id };
  });
  eq(r.bad, [], '出現のずれ'); eq(r.n, 7); eq(r.star, 0, '昼に星降り'); ok(r.starN > 0, '夜に星降りが出ない');
  eq(r.spl, ['amayadori', 'kirigarasu', 'nijimimizu', 'yukiwata', 'haikagura', 'kumozumi', 'hoshikuzume'], 'S() の末尾に追加されていない'); eq(r.last, 'mabonokoshou', 'T8 の新種が末尾でない'); await s.close();
});
T('T1: 既存の n/d タグは時間だけで決まる(天気に左右されない)', async () => {
  const s = await open();
  const r = await s.ev(() => { const bad = []; for (const w of WXK) for (let tm = 0; tm < 4; tm++) { if (tagOK('n', tm, w) !== (tm >= 2)) bad.push('n' + tm + w); if (tagOK('d', tm, w) !== (tm <= 1)) bad.push('d' + tm + w); if (!tagOK(null, tm, w)) bad.push('null'); }
    return { bad, old: timeOK('n', 3, 'ame'), t: [tagOK('nR', 3, 'ame'), tagOK('nR', 1, 'ame'), tagOK('nR', 3, 'hare')] }; });
  eq(r.bad, []); eq(r.t, [true, false, false]); await s.close();
});
T('T1: 全7体の絵が描け、目が入っている(例外なし・透明でない)', async () => {
  const s = await open();
  const r = await s.ev(async () => { const out = []; for (const id of SPL.slice(-8, -1).map(x => x.id)) { const u = sprite(id), im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, 192, 192).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; out.push([id, n]); } return out; });
  for (const [id, n] of r) ok(n > 1500, id + ' が小さい/空: ' + n); await s.close();
});
T('T1: 屋外だけ画面効果、霧は5マスの見える範囲、雨は遭遇率1.15倍、音のフック', async () => {
  const s = await open(); await goMap(s, 'komorebi');
  const r = await s.ev(() => { const m = owMap(); const out = { outdoor: owWxOutdoor(m), indoor: owWxOutdoor({ ground: 'floor' }) || owWxOutdoor({ dim: 1 }) || owWxOutdoor({ cave: 1 }) };
    state.wxN = 0; for (let i = 0; i < 200; i++) { dayAt(i); if (wxNow('komorebi') === 'kiri') break; } out.kiri = wxNow('komorebi') === 'kiri'; out.limK = owTapLimit(m);
    for (let i = 0; i < 200; i++) { dayAt(i); if (wxNow('komorebi') === 'hare') break; } out.limH = owTapLimit(m);
    for (let i = 0; i < 200; i++) { dayAt(i); if (wxNow('komorebi') === 'ame') break; }
    const a = []; window.ambStart = n => a.push('amb:' + n); window.ambStop = () => a.push('stop'); window.bgmSetMood = o => a.push(JSON.stringify(o)); OWC.wxAk = null; owWxAudio(true); out.audio = a; return out; });
  ok(r.outdoor && !r.indoor, '屋外判定'); ok(r.kiri, '霧が見つからない'); eq(r.limK, 5); eq(r.limH, 99);
  ok(r.audio.includes('amb:rain') && r.audio.some(x => x.includes('"rain":true')), '雨の音: ' + r.audio.join(','));
  eq(s.errors, []); await s.close();
});
T('T1: 画面効果の7種がすべてエラーなく描け、1フレームが軽い(owDraw)', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(500);
  const r = await s.ev(() => { const out = {}; const m = owMap(); const orig = wxNow; for (const w of WXK) { window.wxNow = () => w; const T0 = performance.now(); for (let i = 0; i < 60; i++) owDraw(); out[w] = +((performance.now() - T0) / 60).toFixed(2); } window.wxNow = orig; return out; });
  console.log('      owDraw 1フレーム(ms):', JSON.stringify(r));
  for (const [w, ms] of Object.entries(r)) ok(ms < 12, w + ' が重い: ' + ms); eq(s.errors, []); await s.close();
});
T('T3: きらりは遭遇タイルに1つだけ(6〜14マス)・90歩で消える・踏むと必ず戦闘', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  const r = await s.ev(async () => {
    const m = owMap(), o = state.ow; state.kirari = null; OWC.kMap = o.map;
    let okSp = 0, dist = [], onEnc = 0; for (let i = 0; i < 30; i++) { state.kirari = null; if (owKirariSpawn(m, o)) { okSp++; const k = state.kirari; dist.push(Math.abs(k.x - o.x) + Math.abs(k.y - o.y)); if ((m.enc || 'T').includes(m.rows[k.y][k.x])) onEnc++; } }
    state.kirari = null; owKirariSpawn(m, o); const k0 = { ...state.kirari };
    const one = typeof state.kirari === 'object' && !Array.isArray(state.kirari);
    let steps = 0; const save0 = state.kirari.ttl; for (let i = 0; i < 100 && state.kirari; i++) { OWC.kSteps = 1; owKirariTick(m, o); steps++; if (state.kirari && steps === 5) steps = steps; }
    const gone = state.kirari === null, st = steps;
    /* 踏む */
    state.kirari = { map: o.map, x: k0.x, y: k0.y, ttl: 50 }; state.ow = { map: o.map, x: k0.x, y: k0.y, dir: 'down' }; OWC.kMap = o.map; OWC.stuck = 0;
    owArrive(); await new Promise(r => setTimeout(r, 900));
    return { okSp, min: Math.min(...dist), max: Math.max(...dist), onEnc, one, gone, st, ttl0: save0, battle: !!B, kirNull: state.kirari === null, rare: B && B.enemies[0].rare };
  });
  ok(r.okSp > 25, '出ない'); ok(r.min >= 6 && r.max <= 14, `距離 ${r.min}-${r.max}`); eq(r.onEnc, r.okSp, '遭遇タイル以外'); ok(r.one); eq(r.ttl0, 90);
  ok(r.gone && r.st >= 88 && r.st <= 91, '90歩前後で消えない: ' + r.st); ok(r.battle, '踏んでも戦闘にならない'); ok(r.kirNull, '踏んでも消えない'); ok(r.rare, 'レア札なし');
  eq(s.errors, []); await s.close();
});
T('T3: きらりの1体目の配分(1万回): 50/30/20 ±2%、色違い率 通常1/150・きらり1/30・星降りきらり1/15', async () => {
  const s = await open(); await goMap(s, 'komorebi');
  const r = await s.ev(() => { const f = TOWN.komorebi.fields.find(x => x.id === 'aze'); state.time = 3; let wxn = 0; for (let i = 0; i < 500; i++) { dayAt(i); if (wxNow('komorebi') === 'ame') { wxn = i; break; } }
    state.wxN = wxn; const c = { low: 0, metal: 0, wx: 0 }, N = 10000; for (let i = 0; i < N; i++) c[owKirariFoe(f, 'ame', 0, Math.random())[2]]++;
    const hit = (p, n) => { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k / n; };
    return { low: c.low / N, metal: c.metal / N, wx: c.wx / N, n: hit(owShinyP('hare', false), 60000), k: hit(owShinyP('hare', true), 30000), h: hit(owShinyP('hoshi', true), 20000), p: [owShinyP('hare', false), owShinyP('hare', true), owShinyP('hoshi', true)] }; });
  ok(Math.abs(r.low - .5) < .02 && Math.abs(r.metal - .3) < .02 && Math.abs(r.wx - .2) < .02, JSON.stringify(r));
  ok(Math.abs(r.n - 1 / 150) < .0025 && Math.abs(r.k - 1 / 30) < .008 && Math.abs(r.h - 1 / 15) < .012, JSON.stringify(r)); await s.close();
});
T('T3: 色違いが当たると前兆(七色)のあとで戦闘が始まる。opt.shiny が反映される', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  const r = await s.ev(async () => { const real = Math.random; let cap = null; const sb = startBattle; window.startBattle = (f, o) => { cap = o; sb(f, o); };
    Math.random = () => 0.0001; owEncounter('aze', false); const omen = !!OWC.omen && OWC.omen.sh, tst = ui.toast;
    await new Promise(r => setTimeout(r, 900)); Math.random = real; window.startBattle = sb;
    return { omen, tst, started: !!B, shiny: B && B.enemies.some(c => c.mon.shiny), log0: B && B.log[0] && B.log[0].t || (B && JSON.stringify(B.log[0])), seen: B && state.shinySeen[B.enemies[0].mon.sp] }; });
  ok(r.omen, '前兆なし'); ok(r.tst.includes('七色'), r.tst); ok(r.started && r.shiny, '色違いで戦闘に入らない'); ok(String(r.log0).includes('★ 色違い'), 'ログ: ' + r.log0);
  eq(s.errors, []); await s.close();
});
T('T3: メタルに逃げられると「勝利」でなく逃げられた扱い、30歩以内にきらりが1回出る', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  const r = await s.ev(() => { const w0 = state.wins; startBattle([['haganetsubu', 3]], { field: 'x' }); B.enemies[0].gone = true; B.enemies[0].fled = true; win();
    const res = { win: B.result.win, flee: B.result.flee, head: B.result.rw.head, wins: state.wins - w0, due: state.kirariDue }; B = null; ui.result = null;
    const m = owMap(), o = state.ow; state.kirari = null; OWC.kMap = o.map; let n = 0; while (state.kirariDue > 0 && n < 40) { OWC.kSteps = 1; owKirariTick(m, o); n++; } res.spawned = !!state.kirari; res.steps = n; res.due2 = state.kirariDue; return res; });
  eq(r.win, false); eq(r.flee, true); eq(r.head, '逃げられた……'); eq(r.wins, 0); eq(r.due, 30); ok(r.spawned && r.steps <= 30 && r.due2 === 0, JSON.stringify(r)); await s.close();
});
T('T3: 新キー(wxN/wxLog/kirari/kirariDue)が旧セーブに補われ、state.v は1のまま', async () => {
  const s = await open(); await makeOldSave(s, 1);
  await s.page.reload(); await s.page.waitForFunction(() => typeof state !== 'undefined' && state); await wait(600);
  const r = await s.ev(() => { const a = JSON.stringify(state); migrate(); migrate(); return { v: state.v, wxN: state.wxN, wxLog: state.wxLog, kirari: state.kirari, due: state.kirariDue, same: a === JSON.stringify(state) }; });
  eq(r.v, 1); eq(r.wxN, 0); eq(typeof r.wxLog, 'object'); eq(r.kirari, null); eq(r.due, 0); ok(r.same, 'migrate が冪等でない'); eq(s.errors, []); await s.close();
});
T('T1: 駅のみちくさ便りが出て、予報どおり(3コマ)', async () => {
  const s = await open(); await goMap(s, 'komorebi'); await wait(300);
  const r = await s.ev(() => { ui.station = true; render(); const el = document.querySelector('.wxnews'); return { has: !!el, cells: el ? el.querySelectorAll('.wxc').length : 0, txt: el ? el.textContent : '' }; });
  ok(r.has && r.cells === 3, 'みちくさ便りなし'); eq(s.errors, []); await s.close();
});

/* ---- T8 まぼろし駅 ---- */
const T8_STAGE = s => s.ev(() => { H.starter({ id: 'ibote' }); ui.dlg = null; state.bgm = false; state.sound = false; state.boss = { komorebi: true, kasumi: true }; state.town = 'kasumi'; state.time = 3; window.wxNow = () => 'kiri'; ui.tab = 'map'; ui.station = false; ui.inside = null; ui.toast = ''; state.ow = null; owEnsureState(); render(); });
const T8_ENTER = s => s.ev(() => { ui.station = true; render(); H.mabo(); ui.dlg = null; document.querySelectorAll('.mabo-fx').forEach(e => e.remove()); });
const T8_CLOCK = s => s.ev(() => { window.__rd = Date.now.bind(Date); window.__fix = true; window.__T = 0; Date.now = () => window.__fix ? window.__T : window.__rd(); });
T('T8: 初めて着くまで、駅の札も路線図も「？？駅へ行く」(名前を明かさない)。着いたあとは「まぼろし駅へ行く」', async () => {
  const s = await open(); await T8_STAGE(s);
  const r = await s.ev(() => { const o = {}; ui.station = true; render(); const txt = () => [...document.querySelectorAll('[data-act="mabo"]')].map(e => e.textContent + '|' + (e.getAttribute('aria-label') || '')).join(' ## ');
    o.before = txt(); ui.station = false; ui.tab = 'map'; render(); o.beforeMap = txt(); state.flags.mabo = true; ui.station = true; render(); o.after = txt(); ui.station = false; render(); o.afterMap = txt(); return o; });
  ok(/？？駅へ行く/.test(r.before) && !/まぼろし/.test(r.before), '初回の駅の札で名前を明かしている: ' + r.before); ok(!/まぼろし/.test(r.beforeMap), '初回の路線図で名前を明かしている: ' + r.beforeMap);
  ok(/まぼろし駅へ行く/.test(r.after), '着いたあとの札: ' + r.after); eq(s.errors, []); await s.close();
});
T('T2: 区画番号は変えていない(旧セーブの foot ビットがそのまま読める)', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => { state.foot = { urayama: '1' + 'f'.repeat(4) }; const fi = footInfo('urayama'); const same = footBit('urayama', 0) && !footBit('urayama', 1) && footBit('urayama', 4) && footBit('urayama', 19) && !footBit('urayama', 20);
    const a = JSON.stringify(state.foot); migrate(); migrate(); return { same, idem: a === JSON.stringify(state.foot), pct: footShow('urayama'), n: footCount('urayama'), nb: fi.nb }; });
  ok(r.same, '区画番号とビットの対応が変わった'); ok(r.idem, 'migrate が foot を変えた'); eq(s.errors, []); await s.close();
});
T('T8: 入口は 霧×夜×霞ヶ丘撃破 のときだけ(路線図と駅に出る/ほかでは出ない)', async () => {
  const s = await open(); await T8_STAGE(s);
  const r = await s.ev(() => {
    const bad = []; let n = 0;
    for (const boss of [true, false]) for (const w of WXK) for (let tm = 0; tm < 4; tm++) {
      state.boss = boss ? { komorebi: true, kasumi: true } : { komorebi: true }; state.time = tm; window.wxNow = () => w; ui.station = true; render();
      const open = maboOpen(), want = boss && w === 'kiri' && tm === 3, rail = !!document.querySelector('.rail .station.mabo'), note = !!document.querySelector('.mabo-note');
      if (open !== want || rail !== want || note !== want) bad.push(`${boss} ${w} t${tm}: open=${open} rail=${rail} note=${note}`); if (want) n++;
    }
    state.boss = { komorebi: true, kasumi: true }; state.time = 3; window.wxNow = () => 'kiri'; ui.station = true; render();
    const rail = [...document.querySelectorAll('.rail .station')].map(e => e.className.split(' ').filter(c => ['cur', 'mabo', 'locked'].includes(c)).join('+'));
    return { bad, n, rail, sw: document.documentElement.scrollWidth };
  });
  eq(r.bad, [], '出る/出ないがずれた'); eq(r.n, 1); eq(r.rail[1], 'cur'); eq(r.rail[2], 'mabo', '現在の駅の次に ？？ が出ない'); ok(r.sw <= 390, '横にはみ出す');
  eq(s.errors, []); await s.close();
});
T('T8: 乗ると着く(flags.mabo・ジングル・演出)。保存→再読み込みでも、歩いて駅へ戻れる', async () => {
  const s = await open(); await T8_STAGE(s);
  const r = await s.ev(() => {
    const o = {}; const jn = []; const j0 = window.jingle; window.jingle = n => { jn.push(n); }; o.before = state.flags.mabo; ui.station = true; render(); H.mabo(); window.jingle = j0;
    o.after = state.flags.mabo; o.jingle = jn; o.map = state.ow.map; o.town = state.town; o.fx = !!document.querySelector('.mabo-fx'); o.fxFirst = !!document.querySelector('.mabo-fx.first'); o.owActive = owActive(); o.walk = !!document.getElementById('owc');
    o.stateTown = TOWNS.some(t => t.id === state.town); return o;
  });
  eq(r.before, undefined); eq(r.after, true); eq(r.jingle, ['station']); eq(r.map, 'maboroshi'); eq(r.town, 'kasumi'); ok(r.fx && r.fxFirst, '到着演出がない'); ok(r.owActive && r.walk, '歩けない'); ok(r.stateTown);
  await wait(300); await s.ev(() => { state.time = 3; save(); }); await s.page.reload(); await s.page.waitForFunction(() => typeof state !== 'undefined' && state); await wait(600);
  const r2 = await s.ev(() => { window.wxNow = () => 'hare'; state.time = 1; owEnsureState(); const o = { map: state.ow.map, town: state.town, flag: state.flags.mabo, open: maboOpen() };
    ui.tab = 'map'; ui.station = false; render(); o.active = owActive();
    owBackToTown(); o.ask = ui.owBack; owBackToTown(); o.back = state.ow.map; o.sameStation = state.ow.x === MAPS.kasumi.station.x && state.ow.y === MAPS.kasumi.station.y; return o; });
  eq(r2.map, 'maboroshi', '再読み込みで中にいる'); eq(r2.town, 'kasumi'); eq(r2.flag, true); eq(r2.open, false, '天気が変わっても戻りは使える(入口は閉じてよい)'); ok(r2.active); eq(r2.ask, true); eq(r2.back, 'kasumi'); ok(r2.sameStation);
  eq(s.errors, []); await s.close();
});
T('T8: ホームの端・終点の鐘からも駅へ戻れ、中で負けても町の銭湯側へ戻る(閉じ込めない)', async () => {
  const s = await open(); await T8_STAGE(s); await T8_ENTER(s);
  const r = await s.ev(() => {
    const o = {};
    for (const k of Object.keys(MAPS.maboroshi.warps)) { const [x, y] = k.split(',').map(Number); state.ow = { map: 'maboroshi', x, y, dir: 'right' }; OWC.mv = null; owArrive(); o[k] = [state.ow.map, state.ow.x === MAPS.kasumi.station.x]; ui.dlg = null; ui.station = false; }
    state.ow = { map: 'maboroshi', x: 30, y: 30, dir: 'down' }; ui.station = false; render();
    startBattle([['dokudamin', 5]], { field: 'まぼろし駅・夢の野原', scene: 'subway' }); lose(); o.lose = state.ow.map; o.loseTown = state.town; B = null; ui.result = null; return o;
  });
  eq(r['1,44'], ['kasumi', true]); eq(r['56,5'], ['kasumi', true]); eq(r.lose, 'kasumi'); eq(r.loseTown, 'kasumi'); eq(s.errors, []); await s.close();
});
T('T8: 60x50。入口から全ての重要地点(落とし物5つ・出口・終点・新種のT)へ行け、改札はレバーの先・どの足場も岸が近く・いつでも戻れる(BFS)', async () => {
  const s = await open();
  const D = await s.ev(() => { const m = MAPS.maboroshi; return { rows: m.rows, objs: m.objs, items: m.items, npcs: m.npcs, warps: m.warps, spawn: m.spawn, goal: m.goal, solid: OW_SOLID }; });
  const W = D.rows[0].length, H = D.rows.length; eq([W, H], [60, 50]); ok(D.rows.every(r => r.length === 60), '行の長さがそろっていない');
  const tile = (x, y) => (D.rows[y] || '')[x]; const solidObj = new Set(); const lever = D.objs.find(o => o[0] === 'lever'), shutters = D.objs.filter(o => o[0] === 'shutter');
  for (const [k, x, y, w = 1, h = 1] of D.objs) { if (k === 'shutter') continue; for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) solidObj.add((x + a) + ',' + (y + b)); }
  for (const k in D.items) solidObj.add(k); D.npcs.forEach(n => solidObj.add(n.x + ',' + n.y));
  const walk = (x, y, gate, fog) => { const c = tile(x, y); if (c === undefined || x < 0 || y < 0) return false; if (D.solid.includes(c)) return false; if (c === 'f' && fog) return false; if (solidObj.has(x + ',' + y)) return false; if (!gate && shutters.some(o => o[1] === x && o[2] === y)) return false; return true; };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const bfs = (gate, fog, from) => { const seen = new Set([from.join(',')]), q = [from]; while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (!seen.has(k) && walk(nx, ny, gate, fog)) { seen.add(k); q.push([nx, ny]); } } } return seen; };
  const near = (set, x, y) => D4.some(([dx, dy]) => set.has((x + dx) + ',' + (y + dy)));
  const sp = [D.spawn.x, D.spawn.y], closed = bfs(false, false, sp), reach = bfs(true, false, sp);
  ok(closed.has(sp.join(',')));
  ok(near(closed, lever[1], lever[2]), 'レバーに行けない(改札があかない)');
  ok(shutters.every(o => !closed.has(o[1] + ',' + o[2])), '改札が最初から通れる'); ok(reach.has(D.goal.x + ',' + D.goal.y), '改札をあけても終点に行けない'); ok(!closed.has(D.goal.x + ',' + D.goal.y), 'レバーなしで終点に行ける');
  for (const k in D.items) { const [x, y] = k.split(',').map(Number); ok(near(reach, x, y), `落とし物 ${D.items[k]} (${k}) に行けない`); }
  eq(Object.keys(D.items).length, 5); ok(['saino', 'tenpu'].every(i => Object.values(D.items).includes(i)), '才能のかけら・天賦の宝珠');
  for (const k in D.warps) ok(reach.has(k), `出口 ${k} に行けない`);
  for (const n of D.npcs) ok(near(reach, n.x, n.y), n.id + ' に話しかけられない');
  let T = 0, Tin = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tile(x, y) === 'T') { T++; if (reach.has(x + ',' + y)) Tin++; } ok(Tin >= 450 && Tin === T, `遭遇するT(新種の出現場所)に行けない: ${Tin}/${T}`);
  const back = bfs(true, false, [1, 44]); eq([...reach].filter(k => !back.has(k)), [], '出口に戻れないマスがある');
  for (const fog of [true, false]) { const f = bfs(true, fog, sp); ok(f.has('1,44') && f.has(sp.join(',')), '霧のときに入口ホームが閉じる'); }
  const foggy = bfs(true, true, sp); ok(![...foggy].some(k => tile(...k.split(',').map(Number)) === 'f'), '霧のときに足場に立てる');
  const fs_ = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tile(x, y) === 'f') fs_.push([x, y]); ok(fs_.length >= 20, '足場が少ない');
  const isLand = (x, y) => walk(x, y, true, true); let worstExit = 0, worstCross = 0;
  for (const [fx, fy] of fs_) { const d = new Map([[fx + ',' + fy, 0]]), q = [[fx, fy]]; let ex = null; while (q.length) { const [x, y] = q.shift(); const dd = d.get(x + ',' + y); for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (d.has(k)) continue; if (isLand(nx, ny)) { if (ex === null) ex = dd + 1; continue; } if (tile(nx, ny) === 'f') { d.set(k, dd + 1); q.push([nx, ny]); } } } ok(ex !== null, `足場 ${fx},${fy} から岸に出られない`); worstExit = Math.max(worstExit, ex); }
  const comps = []; { const seen = new Set(); for (const [fx, fy] of fs_) { if (seen.has(fx + ',' + fy)) continue; const c = [[fx, fy]], q = [[fx, fy]]; seen.add(fx + ',' + fy); while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of D4) { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && tile(x + dx, y + dy) === 'f') { seen.add(k); c.push([x + dx, y + dy]); q.push([x + dx, y + dy]); } } } comps.push(c); } }
  for (const c of comps) { const lands = new Map(); for (const [x, y] of c) for (const [dx, dy] of D4) if (isLand(x + dx, y + dy)) lands.set((x + dx) + ',' + (y + dy), [x, y]); const ks = [...lands.keys()]; ok(ks.length >= 2, '行きどまりだけの足場の群れ');
    for (const a of ks) { const st = lands.get(a), d = new Map([[st.join(','), 1]]), q = [st]; while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of D4) { const k = (x + dx) + ',' + (y + dy); if (!d.has(k) && tile(x + dx, y + dy) === 'f') { d.set(k, d.get(x + ',' + y) + 1); q.push([x + dx, y + dy]); } } }
      for (const b of ks) if (b !== a) { const [bx, by] = lands.get(b); const dd = d.get(bx + ',' + by); if (dd) worstCross = Math.max(worstCross, dd + 1); } } }
  console.log(`      足場 ${fs_.length}マス / ${comps.length}群 / 岸までの最大 ${worstExit}歩 / 岸から岸の最大 ${worstCross}歩 / 到達できる遭遇マス ${Tin} / 歩けるマス ${reach.size}`);
  ok(worstExit <= 6, '岸まで遠い足場'); ok(worstCross <= 12, '1回の晴れ間で渡りきれない足場');
  eq(s.errors, []); await s.close();
});
T('T8: 幽霊列車 — 踏切の行だけが危険・島は安全・走らない時間がある・はねられると岸へ戻る', async () => {
  const s = await open();
  const D = await s.ev(() => { const m = MAPS.maboroshi; return { rows: m.rows, g: m.ghost, solid: OW_SOLID }; });
  const rowsY = [...new Set(D.g.lines.map(l => l.y))]; ok(!rowsY.includes(23), '島の行を列車が走る');
  for (const y of rowsY) { const walkX = []; for (let x = 0; x < 60; x++) if (!D.solid.includes(D.rows[y][x])) walkX.push(x); eq(walkX, D.g.cross, `行${y}で、踏切以外に歩けるマスがある`); }
  for (const cx of D.g.cross) for (let y = 21; y <= 25; y++) ok(!D.solid.includes(D.rows[y][cx]), `踏切 ${cx},${y} が通れない`);
  ok(D.rows[23].slice(D.g.cross[0] - 2, D.g.cross[0] + 3).split('').every(c => !D.solid.includes(c)), '島がない');
  const sim = await s.ev(() => { const m = MAPS.maboroshi, G = m.ghost, out = { calm: 0, best: 0, run: 0 }; let cur = 0;
    for (let t = 0; t < 1200000; t += 100) { const busy = G.lines.some(L => owGhostState(G, L, t, 60).st === 'run'); if (busy) { cur = 0; out.run++; } else { cur += 100; out.calm++; out.best = Math.max(out.best, cur); } }
    out.share = out.calm / (out.calm + out.run); return out; });
  ok(sim.best >= 1500, `わたれる時間が短い: ${sim.best}ms`); ok(sim.share > .3 && sim.share < .95, `列車の混み具合: ${sim.share}`); console.log(`      列車が走っていない時間 ${(sim.share * 100).toFixed(0)}% / 最長 ${(sim.best / 1000).toFixed(1)}秒`);
  await T8_STAGE(s); await T8_ENTER(s); await T8_CLOCK(s);
  const r = await s.ev(() => { const o = {}; const m = MAPS.maboroshi, G = m.ghost;
    const find = (row, x) => { for (let t = 0; t < 60000; t += 20) { const run = G.lines.map(l => owGhostState(G, l, t, 60)); if (G.lines.some((l, i) => l.y === row && owGhostOver(G, run[i], x)) && !G.lines.some((l, i) => l.y !== row && run[i].st === 'run')) return t; } return -1; };
    const t22 = find(22, 14), t24 = find(24, 14); o.t = [t22 >= 0, t24 >= 0];
    for (const [row, T] of [[22, t22], [24, t24]]) { window.__T = T; state.ow = { map: 'maboroshi', x: 14, y: row, dir: 'up' }; OWC.mv = null; OWC.lastSafe = { map: 'maboroshi', x: 14, y: row === 22 ? 21 : 25 }; OWC.ghostT = 0; ui.dlg = null; const mx = calc(state.party[0]).hp; state.party[0].hp = mx;
      const hit = owMaboStep(m); o['hit' + row] = [hit, state.ow.x, state.ow.y, state.party[0].hp < mx]; ui.dlg = null; }
    window.__T = t22; state.ow = { map: 'maboroshi', x: 14, y: 23, dir: 'up' }; OWC.mv = null; OWC.ghostT = 0; o.island = owMaboStep(m); o.islandPos = [state.ow.x, state.ow.y]; o.stamp = !!state.stamps['g:ghost']; return o; });
  eq(r.t, [true, true], '走る時刻が見つからない'); eq(r.hit22.slice(0, 3), [true, 14, 21]); eq(r.hit24.slice(0, 3), [true, 14, 25]); ok(r.hit22[3] && r.hit24[3], 'HP が減らない'); eq(r.island, false); eq(r.islandPos, [14, 23]); ok(r.stamp, '島で待つスタンプ');
  eq(s.errors, []); await s.close();
});
T('T8: 霧の足場 — 晴れ間だけ立てる・足場の上で霧が戻ると岸へ戻される(どの足場でも)・渡るとスタンプ', async () => {
  const s = await open(); await T8_STAGE(s); await T8_ENTER(s); await T8_CLOCK(s);
  const r = await s.ev(() => { const o = { phases: [], stuck: [] }; const m = MAPS.maboroshi;
    for (const t of [0, 6999, 7000, 8499, 8500, 12499, 12500, 13999, 14000, 14999, 15000]) { window.__T = t; o.phases.push([t, owMiPhase(m), owMiWalk(), owSolid(m, 28, 40)]); }
    const fts = []; for (let y = 0; y < 50; y++) for (let x = 0; x < 60; x++) if (m.rows[y][x] === 'f') fts.push([x, y]);
    const land = (x, y) => { const c = m.rows[y][x]; return !OW_SOLID.includes(c) && c !== 'f' && c !== 'H'; };
    const real = Math.random; Math.random = () => .999; let moved = 0; const sx = m.spawn.x, sy = m.spawn.y;
    for (const [fx, fy] of fts) {
      window.__T = 10000; const q = [[sx, sy]], pr = new Map([[sx + ',' + sy, null]]); let found = false;
      while (q.length && !found) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (pr.has(k) || owSolid(m, nx, ny)) continue; pr.set(k, [x, y]); if (nx === fx && ny === fy) { found = true; break; } q.push([nx, ny]); } }
      if (!found) { o.stuck.push(['unreach', fx, fy]); continue; }
      const path = []; for (let c = [fx, fy]; c; c = pr.get(c[0] + ',' + c[1])) path.unshift(c);
      state.ow = { map: 'maboroshi', x: sx, y: sy, dir: 'right' }; OWC.lastSafe = null; for (const [x, y] of path) { state.ow.x = x; state.ow.y = y; OWC.mv = null; state.owSteps = 0; owArrive(); ui.dlg = null; B = null; }
      if (state.ow.x !== fx || state.ow.y !== fy) { o.stuck.push(['warped', fx, fy]); continue; }
      window.__T = 3000; OWC.mv = null; const fell = owMaboStep(m); ui.dlg = null; const p = state.ow; const ok2 = fell && land(p.x, p.y) && !owSolid(m, p.x, p.y); if (!ok2) o.stuck.push(['no-return', fx, fy, p.x, p.y]); else moved++;
    }
    Math.random = real; o.n = fts.length; o.moved = moved; o.stamp = !!state.stamps['g:fog']; return o; });
  eq(r.phases.map(p => p[1]), ['fog', 'fog', 'dawn', 'dawn', 'clear', 'clear', 'dusk', 'dusk', 'fog', 'fog', 'fog']); eq(r.phases.map(p => p[2]), [false, false, false, false, true, true, true, true, false, false, false]);
  eq(r.phases[0][3], false, '岸は霧でも通れる'); eq(r.stuck, [], '足場から戻れない/たどりつけない'); eq(r.moved, r.n); ok(r.stamp, '霧の足場スタンプ'); eq(s.errors, []); await s.close();
});
T('T8: 改札のレバー→シャッターが開く・終点で流星石★20(1回だけ)・落とし物5つが取れる', async () => {
  const s = await open(); await T8_STAGE(s); await T8_ENTER(s);
  const r = await s.ev(() => { const o = {}; const m = MAPS.maboroshi; const sh = m.objs.find(q => q[0] === 'shutter'), lv = m.objs.find(q => q[0] === 'lever');
    o.closed = owSolid(m, sh[1], sh[2]); state.ow = { map: 'maboroshi', x: lv[1], y: lv[2] + 1, dir: 'up' }; OWC.mv = null; owA(); ui.dlg = null; o.opened = !owSolid(m, sh[1], sh[2]); o.flag = owFlag('mabo_k');
    const s0 = state.stars; state.ow = { map: 'maboroshi', x: m.goal.x, y: m.goal.y, dir: 'right' }; OWC.mv = null; owArrive(); ui.dlg = null; const s1 = state.stars; owArrive(); ui.dlg = null; o.stars = [s1 - s0, state.stars - s1];
    const got = {}; for (const k in m.items) { const [x, y] = k.split(',').map(Number); const it = m.items[k]; const before = state.items[it] || 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!owSolid(m, x + dx, y + dy)) { state.ow = { map: 'maboroshi', x: x + dx, y: y + dy, dir: { '1,0': 'left', '-1,0': 'right', '0,1': 'up', '0,-1': 'down' }[dx + ',' + dy] }; break; }
      OWC.mv = null; owA(); ui.dlg = null; got[it] = (state.items[it] || 0) - before; }
    o.got = got; return o; });
  eq(r.closed, true); eq(r.opened, true); eq(r.flag, true); eq(r.stars, [20, 0]); eq(r.got, { kai: 1, saino: 1, tenpu: 1, kirakira: 1, makimono: 1 }); eq(s.errors, []); await s.close();
});
T('T8: 敵Lv=撃破したぬしの最大Lv+3・出るのは天候限定7体+新種(全員)・新種は末尾で目がある・図鑑の最後の地域とコンプ報酬', async () => {
  const s = await open(); await T8_STAGE(s);
  const r = await s.ev(async () => { const o = {}; const f = TOWN.mabo.fields[0];
    o.lv1 = [maboLv(), Math.max(...TOWN.komorebi.boss.foes.map(x => x[1]), ...TOWN.kasumi.boss.foes.map(x => x[1])) + 3]; state.boss = { komorebi: true, kasumi: true, shiomi: true }; o.lv2 = [maboLv(), Math.max(...TOWN.shiomi.boss.foes.map(x => x[1])) + 3]; state.boss = { komorebi: true, kasumi: true };
    ui.station = true; render(); H.mabo(); ui.dlg = null; document.querySelectorAll('.mabo-fx').forEach(e => e.remove());
    owEncounter('mabo'); o.field = B && B.field; o.lvs = B ? B.enemies.map(c => c.mon.lv) : []; B = null; ui.result = null;
    const tb = wxTable(f.table, 3, 'kiri'); const got = new Set(); for (let i = 0; i < 3000; i++) got.add(wpick(tb).s); o.got = [...got].sort();
    o.sp = { fam: SP.mabonokoshou.fam, last: SPL[SPL.length - 1].id, no: SPL.indexOf(SP.mabonokoshou) + 1, n: SPL.length };
    const u = sprite('mabonokoshou'), im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, 192, 192).data; let n = 0, iris = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) n++; if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 120 && d[i + 3] > 200) iris++; } o.px = n; o.iris = iris;
    o.reg = regList('mabo').map(q => q.s).sort(); return o; });
  eq(r.lv1[0], r.lv1[1]); eq(r.lv2[0], r.lv2[1]); ok(r.lv2[0] > r.lv1[0]); ok(r.field && r.field.includes('まぼろし駅'), String(r.field)); ok(r.lvs.length >= 1 && r.lvs.every(l => l === r.lv1[0]), '敵Lvがずれた: ' + r.lvs + ' / ' + r.lv1[0]);
  eq(r.got, ['amayadori', 'haikagura', 'hoshikuzume', 'kirigarasu', 'kumozumi', 'mabonokoshou', 'nijimimizu', 'yukiwata']); eq(r.reg, r.got); eq(r.sp.fam, 'myst'); eq(r.sp.last, 'mabonokoshou'); eq(r.sp.no, r.sp.n); ok(r.px > 1500, '絵が小さい'); ok(r.iris > 8, '目の虹彩が入っていない: ' + r.iris);
  ok(GAME_SRC.includes('ART(T8)'), 'ART(T8) の印がない');
  const r2 = await s.ev(() => { const o = {}; state.flags.mabo = true; ui.station = false; ui.tab = 'dex'; ui.dexMode = 'reg'; render(); const g = [...document.querySelectorAll('.dexgroup.reg')]; o.groups = g.length; o.lastHead = g[g.length - 1].querySelector('h4').textContent;
    o.before = regClaim('mabo'); regList('mabo').forEach(x => { state.owned[x.s] = true; state.seen[x.s] = true; }); const s0 = state.stars, t0 = state.items.tenpu || 0; o.a = regClaim('mabo'); o.b = regClaim('mabo'); o.stars = state.stars - s0; o.tenpu = (state.items.tenpu || 0) - t0; o.stamp = state.stamps['reg:mabo']; return o; });
  eq(r2.groups, 10); ok(r2.lastHead.includes('まぼろし駅')); eq([r2.before, r2.a, r2.b], [false, true, false]); eq(r2.stars, 10); eq(r2.tenpu, 1); eq(r2.stamp, 2); eq(s.errors, []); await s.close();
});
T('T8: 旧セーブは読めて、中で保存した状態も 引き継ぎコードで往復できる。state.v は1のまま', async () => {
  const s = await open(); await makeOldSave(s, 2);
  await s.page.reload(); await s.page.waitForFunction(() => typeof state !== 'undefined' && state); await wait(600);
  const r = await s.ev(() => { const o = { v: state.v, flag: state.flags.mabo }; window.wxNow = () => 'kiri'; state.time = 3; ui.station = true; render(); H.mabo(); ui.dlg = null; document.querySelectorAll('.mabo-fx').forEach(e => e.remove()); save(); const code = saveCode(); const b = readCode(code);
    o.inside = [state.ow.map, b.ow.map, b.flags.mabo, b.town]; o.same = JSON.stringify(b) === JSON.stringify(state); const a = JSON.stringify(state); migrate(); migrate(); o.idem = a === JSON.stringify(state);
    state = load(); owEnsureState(); o.reload = state.ow.map; o.song = bgmWanted(); return o; });
  eq(r.v, 1); eq(r.flag, undefined); ok(r.same, '引き継ぎコードの往復'); ok(r.idem, 'migrate が冪等でない'); eq(r.inside, ['maboroshi', 'maboroshi', true, 'shiomi']); eq(r.reload, 'maboroshi'); eq(r.song, 'mabo');
  eq(s.errors, []); await s.close();
});
T('T8: 足場・列車・夜の霧が、各地点でエラーなく描け、1フレームが軽い', async () => {
  const s = await open(); await T8_STAGE(s); await T8_ENTER(s); await T8_CLOCK(s);
  const r = await s.ev(() => { const o = {}; const out = [];
    for (const [x, y, T] of [[14, 25, 3000], [36, 40, 10000], [36, 40, 3000], [29, 13, 0], [50, 5, 0], [12, 44, 0]]) { state.ow = { map: 'maboroshi', x, y, dir: 'up' }; window.__T = T; OWC.mv = null; const t0 = performance.now(); for (let i = 0; i < 20; i++) owDraw(); out.push((performance.now() - t0) / 20); } o.ms = out.map(v => +v.toFixed(2)); return o; });
  console.log('      owDraw(ms) ' + JSON.stringify(r.ms)); ok(Math.max(...r.ms) < 30, '重い: ' + r.ms);
  eq(s.errors, []); await s.close();
});

(async () => {
  await new Promise(r => server.listen(0, r)); port = server.address().port;
  browser = await chromium.launch();
  let pass = 0, fail = 0; const t0 = Date.now();
  for (const [name, fn] of tests) {
    if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) continue;   /* 例: ONLY='T8' node tools/test/run.js */
    try { await fn(); pass++; console.log('  PASS ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n')[0]); }
  }
  await browser.close(); server.close();
  console.log(`\n${fail ? 'NG' : 'OK'}: ${pass} passed, ${fail} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(fail ? 1 : 0);
})();
