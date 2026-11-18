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
