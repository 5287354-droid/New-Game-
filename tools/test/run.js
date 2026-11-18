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
T('T6: 相棒の才能が8以上、はじめの3勝は敵1体・Lv-1、ぬし後は補正なし', async () => {
  const s = await open();
  const r = await s.ev(() => {
    H.starter({ id: 'happadanuki' }); ui.dlg = null; const talent = Object.values(state.party[0].talent);
    const lead = state.party[0]; lead.lv = 5; state.wins = 0; state.boss = {};
    const a = owEarly([['ibote', 9], ['ibote', 9], ['ibote', 9]]);
    state.wins = 3; const b = owEarly([['ibote', 9], ['ibote', 9]]);
    state.wins = 0; state.boss = { komorebi: true }; const c = owEarly([['ibote', 9], ['ibote', 9]]);
    state.boss = {}; lead.lv = 1; const d = owEarly([['ibote', 9]]);
    return { min: Math.min(...talent), a, b, c, d };
  });
  ok(r.min >= 8, '才能 ' + r.min); eq(r.a, [['ibote', 4]]); eq(r.b.length, 2); eq(r.c.length, 2); eq(r.d, [['ibote', 1]]);
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
T('T2: 全マップで踏破100%が到達可能(歩ける区画が1つ以上、区画に番号がつく)', async () => {
  const s = await open(); await startGame(s);
  const r = await s.ev(() => { const bad = [], skipped = []; for (const id in MAPS) { const m = MAPS[id], fi = footInfo(id); if (!fi.total) bad.push(id);
      let any = 0; for (let y = 0; y < m.rows.length; y++) for (let x = 0; x < m.rows[y].length; x++) if (!OW_SOLID.includes(m.rows[y][x])) { const i = (y >> 2) * fi.bw + (x >> 2); if (!fi.valid[i]) any++; } if (any) skipped.push(id + ':' + any); } return { n: Object.keys(MAPS).length, bad, skipped }; });
  eq(r.bad, [], '歩ける区画がないマップ'); console.log(`      ${r.n}マップ / 到達判定で外れたマスがあるマップ: ${r.skipped.length}件 ${r.skipped.slice(0, 8).join(' ')}`);
  eq(s.errors, []); await s.close();
});
T('T2: しかけスタンプ16種がすべて取れる(関数を呼ぶ + ソースにフックがある)', async () => {
  const s = await open(); await startGame(s);
  const ids = await s.ev(() => OW_STAMPS.map(d => d[0])); eq(ids.length, 16);
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
    for (const id of ['g:power', 'g:ride', 'g:geyser', 'g:float', 'g:ring', 'g:mirror']) { owStamp(id); mark(id); }
    return { got, n: OW_STAMPS.filter(d => state.stamps[d[0]]).length, mpt: state.mpt };
  });
  const miss = Object.entries(r.got).filter(([, v]) => !v).map(([k]) => k); eq(miss, [], '取れないスタンプ');
  eq(r.n, 16); ok(r.mpt >= 80, 'しかけ16種で +5点ずつ'); eq(s.errors.filter(e => !/owPedGreen|assign to const/.test(e)), []); await s.close();
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
    const o = {}; state.mpt = 10; o.poor = mexBuy('kirakira'); state.mpt = 600; state.items.kirakira = 0; state.items.kai = 0; state.items.saino = 0; state.items.tenpu = 0; const st0 = state.stars;
    o.k = mexBuy('kirakira'); o.kai = mexBuy('kai'); o.s1 = mexBuy('saino'); o.s2 = mexBuy('saino'); o.st1 = mexBuy('star'); o.st2 = mexBuy('star'); o.t1 = mexBuy('tenpu'); o.t2 = mexBuy('tenpu');
    o.items = [state.items.kirakira, state.items.kai, state.items.saino, state.items.tenpu]; o.stars = state.stars - st0; o.mpt = state.mpt;
    state.mptAll = 999; o.t0 = mchiTitle(); state.mptAll = 1000; o.t1x = mchiTitle();
    H.mchi(); o.inside = ui.inside; o.html = document.querySelector('.mex') ? document.querySelectorAll('.mex').length : 0; o.stamps = document.querySelectorAll('.mst').length;
    return o;
  });
  eq(r.poor, false); eq([r.k, r.kai, r.s1, r.s2, r.st1, r.st2, r.t1, r.t2], [true, true, true, false, true, false, true, false]);
  eq(r.items, [1, 1, 1, 1]); eq(r.stars, 10); eq(r.mpt, 600 - 15 - 40 - 80 - 50 - 400);
  eq(r.t0, ''); eq(r.t1x, 'みちくさ名人'); eq(r.inside, 'mchi'); eq(r.html, 5); eq(r.stamps, 16);
  eq(s.errors, []); await s.close();
});
T('T2: 画面(みちくさ帳)は390pxでもはみ出さず、ボタンが44px以上', async () => {
  const s = await open(); await startGame(s);
  await s.ev(() => { state.mpt = 999; state.mptAll = 1200; for (const d of OW_STAMPS.slice(0, 5)) state.stamps[d[0]] = 1; H.mchi(); });
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
  eq(r.a, ['kasumi', 3, null]); eq(r.b, ['kasumi', 3, null], '上書きされた'); ok(r.text.includes('霞ヶ丘') && r.text.includes('夜'), r.text); ok(r.none.includes('記録なし')); eq(s.errors, []); await s.close();
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

(async () => {
  await new Promise(r => server.listen(0, r)); port = server.address().port;
  browser = await chromium.launch();
  let pass = 0, fail = 0; const t0 = Date.now();
  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log('  PASS ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n')[0]); }
  }
  await browser.close(); server.close();
  console.log(`\n${fail ? 'NG' : 'OK'}: ${pass} passed, ${fail} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(fail ? 1 : 0);
})();
