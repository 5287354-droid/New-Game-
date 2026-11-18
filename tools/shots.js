/* ミチクサ鉄道 主要画面スクショ撮影。
 * 使い方: node tools/shots.js [出力ディレクトリ] [開くHTML(既定 index.html)]
 *   例: node tools/shots.js docs/update/before
 *       node tools/shots.js docs/update/after
 * リポジトリルートを一時HTTPサーバで配信し、390x844 @2x で撮る。
 * 状態づくりは page.evaluate で内部のグローバル(state/ui/H/B…)を直接触る。
 * 画面名=ファイル名は固定(before/after を並べて比較できる)。コンソールエラーは errors.txt に出す。 */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/update/shots'));
const PAGE = process.argv[3] || 'index.html';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => errors.push('[requestfailed] ' + r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));
  const names = [];
  const shot = async (name, ms = 350) => { await wait(ms); await page.screenshot({ path: path.join(OUT, name + '.png') }); names.push(name); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`[script:${name}] ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]); } };

  await page.goto(`http://localhost:${port}/${PAGE}`);
  await page.waitForFunction(() => typeof state !== 'undefined' && state);
  await wait(800);
  await ev(() => { localStorage.clear(); });

  await step('title', async () => { await shot('01_title'); await ev(() => { const m = document.getElementById('main'); if (m) m.scrollTop = 520; }); await shot('01b_title_starters'); await ev(() => { const m = document.getElementById('main'); if (m) m.scrollTop = 0; }); await ev(() => { ui.transfer = true; render(); }); await shot('02_title_transfer'); await ev(() => { ui.transfer = false; render(); }); });

  // ゲーム開始(しゃべる相棒を選ぶ)
  await step('start', async () => {
    await page.click('[data-act="starter"][data-id="ibote"]');
    await shot('03_after_starter');
    for (let i = 0; i < 12 && await ev(() => !!ui.dlg); i++) { if (i === 0) await shot('04_intro_dialog'); await page.click('[data-act="dlgNext"]'); await wait(150); }
    await ev(() => { state.bgm = false; state.sound = false; ui.toast = ''; render(); });
  });
  await step('map', async () => {
    await shot('05_map_komorebi_day');
    // 歩く: 十字キー押しっぱなし
    await ev(() => { OWC.held = 'right'; }); await wait(900); await ev(() => { OWC.held = 'down'; }); await wait(700); await ev(() => { OWC.held = null; });
    await shot('06_map_walked');
  });
  await step('battle', async () => {
    const fid = await ev(() => TOWN[state.town].fields[0].id);   // 最初の草むら(田んぼのあぜ道)
    await ev(fid => { owEncounter(fid); }, fid);
    await shot('07_battle_start', 900);
    await ev(() => { B.lockUntil = 0; render(); });
    await shot('08_battle_command', 700);
    await page.click('[data-act="cmenu"]').catch(e => errors.push('[script] cmenu ' + e.message.split('\n')[0]));
    await shot('09_battle_skillmenu');
    await ev(() => { B.menu = null; render(); });
    await page.click('[data-act="catk"]').catch(() => {});
    await shot('10_battle_turn', 600);
    await shot('11_battle_turn_later', 1500);
    // 終わるまで自動戦闘。途中と決着の画面を撮る
    let n = 0;
    for (let i = 0; i < 60 && await ev(() => !!B); i++) {
      await ev(() => { if (B && B.phase === 'input') { B.auto = true; autoTurn(); } });
      await wait(500);
      if (i === 5) await shot('12_battle_auto_mid', 0);
      const ended = await ev(() => { const b = document.querySelector('[data-act="bend"],[data-act="bendStop"]'); return !!b; });
      if (ended && !n++) await shot('13_battle_end_panel', 200);
      await ev(() => { const b = document.querySelector('[data-act="bend"],[data-act="bendStop"]'); if (b) b.click(); });
    }
    await ev(() => { if (B) B = null; ui.dlg = null; ui.toast = ''; render(); });
    if (await ev(() => !!ui.result)) await shot('13b_result', 200);
    await ev(() => { ui.result = null; ui.toast = ''; render(); });
    await shot('14_battle_after_map');
  });
  await step('battle_win', async () => {
    // 勝利画面を撮るため仲間を強くして再戦(スカウト成功率も見る)
    await ev(() => { state.party[0].lv = 12; healAll(); const fid = TOWN[state.town].fields[0].id; owEncounter(fid); B.lockUntil = 0; render(); });
    await shot('15_battle_strong', 900);
    for (let i = 0; i < 60 && await ev(() => !!B); i++) {
      await ev(() => { if (B && B.phase === 'input') { B.auto = true; autoTurn(); } });
      await wait(500);
      const ended = await ev(() => !!document.querySelector('[data-act="bend"],[data-act="bendStop"]'));
      if (ended) { await shot('16_battle_win_panel', 200); }
      await ev(() => { const b = document.querySelector('[data-act="bend"],[data-act="bendStop"]'); if (b) b.click(); });
    }
    await ev(() => { if (B) B = null; ui.dlg = null; ui.toast = ''; render(); });
    if (await ev(() => !!ui.result)) await shot('17_result', 200);
    await ev(() => { ui.result = null; ui.toast = ''; render(); });
  });
  await step('menus', async () => {
    await ev(() => { ui.tab = 'party'; ui.detailOpen = false; render(); }); await shot('20_party');
    await ev(() => { ui.sel = state.party[0].uid; ui.detailOpen = true; render(); }); await shot('21_party_detail');
    await ev(() => { ui.detailOpen = false; ui.tab = 'breed'; render(); }); await shot('22_breed');
    await ev(() => { ui.tab = 'dex'; render(); }); await shot('23_dex');
    await ev(() => { ui.dexSel = 'ibote'; render(); }); await shot('24_dex_detail');
    await ev(() => { ui.dexSel = null; ui.tab = 'shop'; state.yen = 5000; render(); }); await shot('25_shop');
    await ev(() => { ui.tab = 'gacha'; render(); }); await shot('26_gacha');
    await ev(() => { ui.tab = 'tower'; render(); }); await shot('27_tower');
  });
  await step('breed', async () => {
    // 配合: 仲間を増やして2体を選ぶ
    await ev(() => { ['happadanuki', 'chunta', 'dokudamin'].forEach(id => { const m = newMon(id, 12, { talent: randTalent(5, 12) }); m.gen = 0; addMon(m); }); state.party.concat(state.box).forEach(m => { m.lv = Math.max(m.lv, 12); }); ui.tab = 'breed'; ui.btab = 'pick'; render(); });
    await shot('28_breed_pick');
    await ev(() => { const a = state.party[0], b = state.party[1] || state.box[0]; H.bset({ a: a.uid, b: b.uid }); });
    await shot('29_breed_set');
    await ev(() => { window.scrollTo(0, 0); const m = document.getElementById('main'); if (m) m.scrollTop = 600; });
    await shot('30_breed_set_lower');
  });
  await step('town', async () => {
    await ev(() => { ui.tab = 'map'; ui.result = null; ui.toast = ''; render(); });
    await shot('40_map_back');
    await ev(() => { ui.station = true; render(); }); await shot('41_station');
    await ev(() => { ui.station = false; ui.inside = 'sauna'; render(); }); await shot('42_inside_sauna');
    await ev(() => { ui.inside = 'board'; render(); }); await shot('43_inside_board');
    await ev(() => { ui.inside = null; render(); });
    // 別の町(霞ヶ丘)
    await ev(() => { state.boss.komorebi = true; ui.station = false; H.town({ id: 'kasumi' }); ui.dlg = null; ui.toast = ''; state.town = 'kasumi'; render(); });
    await shot('44_map_kasumi_day');
    await ev(() => { ui.inside = 'dome'; render(); }); await shot('45_inside_dome');
    await ev(() => { ui.inside = null; render(); });
    await ev(() => { ui.toast = ''; state.time = 3; render(); }); await shot('46_map_kasumi_night');
    await ev(() => { OWC.held = 'down'; }); await wait(800); await ev(() => { OWC.held = null; }); await shot('47_map_kasumi_night_walk');
    const fid = await ev(() => { const t = TOWN[state.town]; return t.fields[0].id; });
    await ev(fid => owEncounter(fid), fid); await shot('48_battle_night', 1000);
    await ev(() => { B = null; ui.dlg = null; state.time = 2; render(); }); await shot('49_map_kasumi_evening');
    await ev(() => { state.town = 'shiomi'; state.ow = { map: 'shiomi', x: MAPS.shiomi.station.x, y: MAPS.shiomi.station.y, dir: MAPS.shiomi.station.dir }; state.time = 1; render(); });
    await shot('50_map_shiomi_day');
    await ev(() => { state.town = 'komorebi'; state.ow = { map: 'komorebi', x: MAPS.komorebi.station.x, y: MAPS.komorebi.station.y, dir: 'down' }; state.time = 3; ui.toast = ''; render(); });
    await shot('51_map_komorebi_night');
  });
  // T2 みちくさ踏破 / T4 地域図鑑
  await step('t2t4', async () => {
    await ev(() => { state.town = 'komorebi'; state.time = 1; ui.tab = 'map'; ui.station = false; ui.inside = null; ui.toast = ''; B = null; ui.dlg = null;
      const id = 'urayama', m = MAPS[id]; state.ow = { map: id, x: m.spawn.x, y: m.spawn.y, dir: 'up' }; state.detour = 3; state.detourN = 34; owFoot(); render(); });
    await shot('60_map_foot_detour');
    await ev(() => { ui.stampQ = []; ui.stampCur = null; delete state.stamps['g:warm']; owStamp('g:warm'); });
    await shot('61_stamp_get', 450);
    await wait(2200);
    await ev(() => { state.detour = 3; healAll(); startBattle([['dokudamin', 6]], { field: 'こもれび町・裏山', scene: 'mori' }); B.enemies.forEach(c => c.hp = 0); win(); B.lockUntil = 0; render(); });
    await shot('62_result_detour_bonus', 2800);
    await ev(() => { B = null; ui.dlg = null; state.mpt = 230; state.mptAll = 640; ['g:warm', 'g:trash', 'g:signal', 'g:fish', 'g:ring'].forEach(k => state.stamps[k] = 1); state.ow = { map: 'komorebi', x: MAPS.komorebi.station.x, y: MAPS.komorebi.station.y, dir: 'down' }; owFoot(); render(); });
    await shot('63_map_hub_mchi_chip');
    await ev(() => { H.mchi(); }); await shot('64_mchi');
    await ev(() => { const m = document.getElementById('main'); if (m) m.scrollTop = 700; }); await shot('65_mchi_stamps');
    await ev(() => { const m = document.getElementById('main'); if (m) m.scrollTop = 99999; }); await shot('66_mchi_foot');
    await ev(() => { H.owLeave(); regList('komorebi').slice(0, 15).forEach(x => { state.seen[x.s] = true; }); regList('komorebi').slice(0, 9).forEach(x => { state.owned[x.s] = true; }); ui.tab = 'dex'; ui.dexMode = 'reg'; ui.dexSel = null; render(); });
    await shot('67_dex_region');
    await ev(() => { ui.dexSel = 'dokudamin'; render(); const m = document.getElementById('main'); if (m) m.scrollTop = 0; }); await shot('68_dex_detail_seenat');
    await ev(() => { ui.dexSel = null; ui.dexMode = 'fam'; render(); document.querySelector('details.rules').open = true; }); await shot('69_dex_milestones');
  });

  await browser.close(); server.close();
  const uniq = [...new Set(errors)];
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.length ? uniq.map(e => e + ' x' + errors.filter(q => q === e).length).join('\n') + '\n' : '(コンソールエラーなし)\n');
  console.log(`done: ${names.length} shots, ${errors.length} errors -> ${OUT}`);
  if (errors.length) console.log(errors.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
