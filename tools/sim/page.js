/* ブラウザの中で動く側。ゲーム本物の関数(newMon/H.starter/owArrive/owEncounter/startBattle/autoTurn/win/scoutP 等)を使う。
   render/save/talk/sfx は空にし、setTimeout は即時にして待ち時間だけ数える。ゲームのソースは書き換えない。 */
(function () {
  const P = window.__SIM_PARAMS;
  const S = { waitMs: 0 };
  const origST = window.setTimeout.bind(window);
  const isNative = f => /\[native code\]/.test(Function.prototype.toString.call(f));
  window.setTimeout = function (f, ms, ...a) {
    if (typeof f !== 'function') return origST(f, ms, ...a);
    if (isNative(f)) S.waitMs += (ms || 0); /* wait() の Promise 解決だけ数える */
    if (typeof B !== 'undefined' && B && B.turn > 150) B.auto = false; /* 決着のつかない戦闘の安全弁 */
    Promise.resolve().then(() => f(...a));
    return 0;
  };
  const tick = () => new Promise(r => origST(r, 0));
  window.render = () => {}; window.save = () => {}; window.sfx = () => {}; window.talk = () => {};
  window.bshake = () => {}; window.scrollTop0 = () => {};
  window.cutIn = async () => {};
  S.seed = function (n) {
    let a = n >>> 0;
    Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };

  /* 天気は実際の日付で決まる。シミュレーションでは日付をずらして(S.dayOff)、時間帯が1周するたびに1日進める(1日に4時間帯ぶん遊ぶ、少なめの見積もり) */
  S.dayOff = 0; const realNow = Date.now.bind(Date); Date.now = () => realNow() + S.dayOff * 864e5;
  const advOrig = window.advanceTime; window.advanceTime = function () { advOrig(); if (state.time === 0) S.dayOff++; };
  S.newGame = function (starter, o = {}) {
    state = fresh(); migrate(); ui.dlg = null; B = null;
    S.dayOff = o.wx === undefined ? Math.floor(Math.random() * 1e6) : o.wx; /* 天気は日付+町+時間帯で決まるので、ゲームごとに日付を乱数でずらす(天気の割合が実際のプレイと同じになる) */
    H.starter({ id: starter }); ui.dlg = null;
    state.town = 'komorebi'; state.ow = { map: 'komorebi', ...MAPS.komorebi.station };
    const lead = state.party[0];
    if (o.lv) { lead.lv = o.lv; lead.exp = 0; const s = calc(lead); lead.hp = s.hp; lead.mp = s.mp; }
    if (o.talent) { lead.talent = randTalent(o.talent[0], o.talent[1]); const s = calc(lead); lead.hp = s.hp; lead.mp = s.mp; }
    if (o.party > 1) {
      const f = TOWN.komorebi.fields[0];
      for (let i = 1; i < o.party; i++) {
        const sp = wpick(f.table.filter(([, , tm]) => timeOK(tm, state.time)).map(([s, w]) => ({ w, s }))).s;
        state.party.push(newMon(sp, Math.max(1, (o.lv || 3) - 1)));
      }
    }
    if (o.time != null) state.time = o.time;
    return { lead: lead.sp };
  };
  S.place = function (mapId) {
    const m = MAPS[mapId], enc = m.enc || 'T'; let pos = null;
    for (let y = 0; y < m.rows.length && !pos; y++) for (let x = 0; x < m.rows[y].length; x++) if (enc.includes(m.rows[y][x]) && !(m.warps && m.warps[x + ',' + y])) { pos = { x, y }; break; }
    state.town = m.town; state.ow = { map: mapId, x: pos.x, y: pos.y, dir: 'down' }; state.owSteps = 0;
  };
  /* 草むらで1歩ずつ owArrive(本物の遭遇判定)。遭遇するまでの歩数を返す */
  /* 色違い・きらりの遭遇は owBattleGo が setTimeout で戦闘を始めるので、omen が立ったら待つ */
  S.settle = async function () { for (let i = 0; i < 5 && !B; i++) await tick(); };
  S.walkToEncounter = async function (max = 5000, o = {}) {
    for (let i = 1; i <= max; i++) {
      owArrive();
      if (B || (typeof OWC !== 'undefined' && OWC.omen)) { await S.settle(); S.lastKirari = false; return i; }
      /* きらりが出たら、すぐ歩いて行って踏む(歩数だけ数える) */
      if (o.kirari && state.kirari && state.kirari.map === state.ow.map) {
        const k = state.kirari, d = Math.abs(k.x - state.ow.x) + Math.abs(k.y - state.ow.y); S.kSteps = (S.kSteps || 0) + d; S.kCount = (S.kCount || 0) + 1;
        state.ow.x = k.x; state.ow.y = k.y; owKirariHit(owMap()); await S.settle(); S.lastKirari = true; return i + d;
      }
    }
    return -1;
  };
  const foeInfo = () => B.enemies.map(c => ({ sp: c.mon.sp, lv: c.mon.lv, shiny: !!c.mon.shiny, metal: !!has(c, 'metalbody'), rank: SP[c.mon.sp].rank }));
  /* 進行中の戦闘 B をオートで最後まで回す */
  S.fight = async function () {
    const foes = foeInfo(), w0 = S.waitMs, boss = B.boss, nAlly = B.allies.length;
    let guard = 0;
    B.auto = true; /* runTurn が自分で次のターンを予約する(setTimeout は即時なので1回の tick で終わる) */
    while (B && B.phase !== 'end' && guard++ < 50) { if (B.phase === 'input') autoTurn(); await tick(); }
    const rec = {
      foes, boss, win: !!(B && B.result && B.result.win), turns: B.turn, fled: B.enemies.some(c => c.fled), flee: !!(B.result && B.result.flee),
      dead: B.enemies.filter(c => c.hp <= 0 && !c.gone).length, leadHp: B.allies[0] ? Math.max(0, B.allies[0].hp) / B.allies[0].st.hp : 0,
      alive: B.allies.filter(c => c.hp > 0).length, nAlly
    };
    const m = B.result && B.result.lines[0] && B.result.lines[0].match(/(\d+)の経験値と(\d+)円/);
    rec.exp = m ? +m[1] : 0; rec.yenGot = m ? +m[2] : 0;
    rec.sec = (S.waitMs - w0) / 1000 + rec.turns * P.AUTO_TURN_S + P.BATTLE_OVERHEAD_S;
    B = null;
    return rec;
  };
  const afterFight = rec => { /* 回復が要るか(要るなら回復して true) */
    if (!rec.win) return true;
    if (state.party.some(m => m.hp < calc(m).hp * P.REST_HP)) { healAll(); return true; }
    return false;
  };
  S.afterFight = afterFight;

  /* 1. 最初の草むら: 新規ゲーム→最初の遭遇→オート戦闘 */
  S.opening = async function (starter, N, seed, talent) {
    S.seed(seed); const out = [];
    for (let i = 0; i < N; i++) {
      S.newGame(starter, { talent }); S.place('komorebi');
      owEncounter('aze'); await S.settle();
      if (!B) { out.push(null); continue; }
      const r = await S.fight();
      if (r.flee) { out.push(null); continue; } /* メタルに逃げられた戦闘は勝ち負けに数えない */
      out.push({ win: r.win, foes: r.foes.map(f => f.sp + ':' + f.lv).join(','), n: r.foes.length, turns: r.turns, leadHp: r.leadHp, sec: r.sec });
    }
    return out;
  };
  /* 2. 続けて戦う: 勝ち数ごとの勝率。草むらを歩いて本物の遭遇、HPが減ったら回復 */
  S.sequence = async function (starter, N, K, seed, party) {
    S.seed(seed); const games = [];
    for (let g = 0; g < N; g++) {
      S.newGame(starter, { party }); S.place('komorebi'); const bs = []; let wins = 0;
      for (let k = 0; k < K; k++) {
        const steps = await S.walkToEncounter(); if (steps < 0) break;
        const lvB = state.party[0].lv; const r = await S.fight();
        if (r.flee) { afterFight({ win: true }); continue; }
        bs.push({ w: wins, win: r.win, lv: lvB, sec: r.sec, steps, exp: r.exp });
        if (r.win) wins++;
        afterFight(r);
        if (!r.win) S.place('komorebi');
      }
      games.push(bs);
    }
    return games;
  };
  /* 3. 指定Lvの先頭で、指定マップを測る。満タンで1戦ずつ */
  S.fieldWin = async function (starter, mapId, lv, N, seed, o = {}) {
    S.seed(seed); let win = 0, sec = 0, turns = 0, exp = 0, yen = 0, leadHp = 0, ok = 0; const lost = {};
    for (let i = 0; i < N; i++) {
      S.newGame(starter, { lv, party: o.party, time: o.time }); state.wins = 99; healAll(); S.place(mapId); /* 序盤補正は外して、場所そのものの強さを測る */
      const st = await S.walkToEncounter(); if (st < 0) continue;
      const y0 = state.yen; const r = await S.fight(); if (r.flee) continue; ok++;
      if (r.win) { win++; exp += r.exp; yen += state.yen - y0; } else { const k = r.foes.map(f => f.sp).join('+'); lost[k] = (lost[k] || 0) + 1; }
      sec += r.sec; turns += r.turns; leadHp += r.leadHp;
    }
    return { win: win / ok, n: ok, sec: sec / ok, turns: turns / ok, exp: exp / ok, yen: yen / ok, leadHp: leadHp / ok, lost };
  };
  /* 4. 経済: 仮想時間 hours 時間ぶん草むらで戦い続けたときの経験値・円・遭遇数
     o.detour=寄り道の段(0〜5、負けると0に戻り、RAMP_S 秒かけて元の段に戻す) / o.kirari=きらりが出たら踏みに行く
     o.boss=こもれび町のぬしを倒したあと(負けの罰が働く) / o.oldPenalty=負けると円が半分になる旧ルールで測る */
  S.income = async function (starter, mapId, lv, hours, seed, o = {}) {
    S.seed(seed); S.newGame(starter, { lv, party: o.party, time: o.time }); S.place(mapId);
    if (o.boss) state.boss.komorebi = true;
    state.wins = 99; /* 序盤補正は外す(序盤は opening/sequence で測る) */
    const D = o.detour || 0; state.detour = D;
    let T = 0, exp = 0, enc = 0, wins = 0, losses = 0, steps = 0, bsec = 0, rests = 0, shiny = 0, metal = 0, foes = 0, yenLost = 0;
    let kEnc = 0, shinyN = 0, shinyK = 0, shinyH = 0, hoshiEnc = 0, flee = 0, yenGot = 0; S.kSteps = 0; S.kCount = 0;
    const lv0 = state.party.map(m => m.lv); const y0 = state.yen;
    while (T < hours * 3600) {
      const st = await S.walkToEncounter(5000, { kirari: o.kirari }); if (st < 0) break; steps += st; T += st / P.GRASS * P.STEP_S;
      const kir = S.lastKirari, wxh = wxNow() === 'hoshi';
      const yb = state.yen; const r = await S.fight(); enc++; exp += r.exp; bsec += r.sec; T += r.sec; r.win ? wins++ : r.flee ? flee++ : losses++;
      if (kir) kEnc++; if (wxh) hoshiEnc++;
      if (r.win) yenGot += r.yenGot;
      if (!r.win && !r.flee) {
        if (o.oldPenalty) state.yen = yb - Math.floor(yb / 2); /* 旧ルール: 所持金が半分 */
        yenLost += yb - state.yen;
      }
      r.foes.forEach((f, i) => { foes++; if (f.shiny) { shiny++; if (kir && i === 0) shinyK++; else if (wxh) shinyH++; else shinyN++; } if (f.metal) metal++; });
      if (afterFight(r)) { rests++; T += P.REST_S; }
      if (!r.win && !r.flee) { S.place(mapId); state.detour = D; if (D) T += P.RAMP_S; }
      /* 経験値は敵側で決まるので、先頭のLvを固定して測る(HPの割合は保つ) */
      state.party.forEach((m, i) => { const L = lv0[i], hpf = m.hp / calc(m).hp; m.lv = L; m.exp = 0; const s = calc(m); m.hp = Math.max(m.hp > 0 ? 1 : 0, Math.floor(s.hp * hpf)); m.mp = s.mp; });
    }
    return { hours: T / 3600, exp, yenNet: state.yen - y0, yenGot, yenLost, enc, wins, losses, flee, steps, battleSec: bsec, rests, shiny, shinyN, shinyK, shinyH, kEnc, kSteps: S.kSteps, hoshiEnc, metal, foes };
  };
  /* 5. 遭遇だけ大量に(戦わない): 色違い・メタル・種族の出現割合 */
  S.encounters = async function (starter, mapId, N, seed, time) {
    S.seed(seed); S.newGame(starter, { time }); S.place(mapId); if (time != null) state.time = time;
    let steps = 0, enc = 0, foes = 0, shiny = 0, metal = 0, encMetal = 0, encShiny = 0; const sp = {};
    for (let i = 0; i < N; i++) {
      state.party[0].hp = calc(state.party[0]).hp;
      const st = await S.walkToEncounter(); if (st < 0) break; steps += st; enc++;
      let m = false, s = false;
      B.enemies.forEach(c => { foes++; sp[c.mon.sp] = (sp[c.mon.sp] || 0) + 1; if (c.mon.shiny) { shiny++; s = true; } if (has(c, 'metalbody')) { metal++; m = true; } });
      if (m) encMetal++; if (s) encShiny++;
      B = null; if (time != null) state.time = time;
    }
    return { steps, enc, foes, shiny, metal, encMetal, encShiny, sp };
  };
  /* 6. メタル系との戦闘: 逃げる率・倒せる率 */
  S.metalFight = async function (starter, spId, lv, foeLv, N, seed) {
    S.seed(seed); let fled = 0, killed = 0, lose = 0, sec = 0;
    for (let i = 0; i < N; i++) {
      S.newGame(starter, { lv }); healAll(); S.place('komorebi');
      startBattle([[spId, foeLv]], { field: 'x', scene: 'inaka' });
      const r = await S.fight(); sec += r.sec; if (r.fled) fled++; else if (r.win) killed++; else lose++;
    }
    return { fled: fled / N, killed: killed / N, lose: lose / N, sec: sec / N };
  };
  /* 7. スカウト成功率: 本物の scoutP。敵の残りHP割合ごと */
  S.scout = function (starter, fieldId, leadLv, time) {
    S.newGame(starter, { lv: leadLv, time });
    const f = TOWN.komorebi.fields.find(x => x.id === fieldId);
    const tb = f.table.filter(([, , tm]) => timeOK(tm, time)), tot = tb.reduce((s, x) => s + x[1], 0);
    const rows = [];
    for (const [sp, w] of tb) {
      const lv = Math.round((f.lv[0] + f.lv[1]) / 2);
      startBattle([[sp, lv]], { field: 'x', scene: 'inaka' });
      const t = B.enemies[0], o = { sp, name: SP[sp].name, rank: SP[sp].rank, w: w / tot, lv, p: {} };
      for (const r of [1, .75, .5, .25, .1]) { t.hp = Math.max(1, Math.floor(t.st.hp * r)); B.onigiri = false; o.p[r] = scoutP(t); B.onigiri = true; o.p[r + 'o'] = scoutP(t); }
      rows.push(o); B = null;
    }
    return rows;
  };
  /* 8a. ぬし戦だけ: 先頭Lvと仲間の数ごとの勝率(仲間は先頭Lv-1にそろえる) */
  S.bossWin = async function (starter, lv, party, N, seed) {
    S.seed(seed); let w = 0, turns = 0;
    for (let i = 0; i < N; i++) {
      S.newGame(starter, { lv, party }); state.party.forEach(m => { if (m.lv < lv - 1) { m.lv = lv - 1; learn(m); } }); healAll();
      H.boss(); const r = await S.fight(); if (r.win) w++; turns += r.turns;
    }
    return { win: w / N, turns: turns / N };
  };
  /* 8. ぬしまで: 草むらで戦い、先頭Lvが閾値に達したらぬしに挑戦 */
  S.toBoss = async function (starter, N, seed, thr0, party) {
    S.seed(seed); const res = [];
    for (let g = 0; g < N; g++) {
      S.newGame(starter, { party }); S.place('komorebi');
      let thr = thr0, T = 0, battles = 0, tries = 0, done = false, firstTry = null, levelAtTry = 0, rests = 0, loses = 0;
      const lead = state.party[0];
      while (!done && T < 6 * 3600 && battles < 800) { S.dbg = { g, T, battles, tries, lv: lead.lv, ph: B && B.phase, turn: B && B.turn, auto: B && B.auto, boss: B && B.boss };
        if (state.party.some(m => m.lv >= thr)) {
          tries++; healAll(); T += P.REST_S;
          H.boss(); const r = await S.fight(); battles++; T += r.sec;
          if (firstTry == null) { firstTry = r.win; levelAtTry = lead.lv; }
          if (r.win) { done = true; break; }
          T += P.REST_S; loses++;
          thr = Math.max(thr, lead.lv) + 2; /* 負けたら、さらに2Lv上げてから再挑戦 */
        }
        S.place(lead.lv >= 6 ? 'urayama' : 'komorebi');
        const st = await S.walkToEncounter(); if (st < 0) break; T += st / P.GRASS * P.STEP_S;
        const r = await S.fight(); battles++; T += r.sec;
        if (afterFight(r)) { rests++; T += P.REST_S; }
        if (!r.win) loses++;
      }
      res.push({ done, T, battles, tries, firstTry, levelAtTry, lv: lead.lv, rests, loses });
    }
    return res;
  };
  /* 9. 天候限定種に出会うまでの時間。target=true: 予報を見て、その種が出る天気・時間帯になるまで歩いて時間を送り、出る時間帯だけ戦う。
        target=false: 天気は気にせず、その探索先でひたすら戦う。戦闘は実際には戦わず、1戦の秒数(battleS)と回復の往復(0.1回ぶん)を足す。 */
  S.wxFind = async function (sp, townId, fieldId, target, N, seed, battleS) {
    S.seed(seed); const out = [];
    const mapId = Object.keys(MAPS).find(id => MAPS[id].town === townId && MAPS[id].field === fieldId);
    if (!mapId) return null;
    const f = TOWN[townId].fields.find(x => x.id === fieldId);
    MAPS[mapId].cold = 0; /* 寒さ・暑さの消耗は測らない(凍える・倒れる処理を切る。出会いの回数だけを見る) */
    for (let g = 0; g < N; g++) {
      S.newGame('ibote', { time: Math.floor(Math.random() * 4) }); state.wins = 99; state.boss.komorebi = true; S.place(mapId); state.owSteps = Math.floor(Math.random() * 120);
      let T = 0, enc = 0, found = false, waits = 0;
      const here = () => wxTable(f.table, state.time, wxNow(townId)).some(x => x.s === sp);
      while (T < 6 * 3600 && !found) {
        if (target && !here()) { /* 時間を送る: 草むらの外を歩く(残りの歩数ぶん) */
          const rest = 120 - (state.owSteps || 0); T += rest * P.STEP_S; state.owSteps = 0; advanceTime(); waits++; continue; }
        let i = 0; for (; i < 5000; i++) { owArrive(); if (B || OWC.omen) break; }
        T += (i + 1) * P.STEP_S;
        await S.settle();
        if (!B) { continue; }
        enc++; if (B.enemies.some(c => c.mon.sp === sp)) found = true;
        B = null; T += battleS + 0.1 * P.REST_S;
      }
      out.push({ T, enc, found, waits });
    }
    return out;
  };
  /* 10. 足あと: 1マップの全区画を、いちばん近い未踏の区画へ順に歩いて回ったときの歩数。
        区画の到達判定は本物の footInfo。歩ける・歩けないは footInfo と同じ規則。 */
  S.footTour = function (id) {
    const m = MAPS[id], fi = footInfo(id), R = m.rows.length, C = Math.max(...m.rows.map(r => r.length));
    const ok = (x, y) => fi.ok(x, y) || (m.rows[y] || '')[x] === '+'; /* 通れるかは footInfo と同じ規則。線路(+)はトロッコ・カヌーで運ばれるので、歩いた距離の代わりに数える */
    const enc = m.enc || 'T'; let cur = m.spawn || m.station; if (!cur) return null;
    const blockOf = (x, y) => (y >> 2) * fi.bw + (x >> 2);
    const done = new Uint8Array(fi.nb); let left = fi.total, steps = 0, encSteps = 0;
    if (fi.valid[blockOf(cur.x, cur.y)]) { done[blockOf(cur.x, cur.y)] = 1; left--; }
    let x0 = cur.x, y0 = cur.y; const dist = new Int32Array(R * C), par = new Int32Array(R * C);
    while (left > 0) {
      dist.fill(-1); const q = [y0 * C + x0]; dist[q[0]] = 0; par[q[0]] = -1; let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h], x = c % C, y = (c / C) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R || !ok(nx, ny)) continue; const n = ny * C + nx; if (dist[n] >= 0) continue; dist[n] = dist[c] + 1; par[n] = c; q.push(n); const b = blockOf(nx, ny); if (fi.valid[b] && !done[b]) { hit = n; break; } }
      }
      if (hit < 0) break; /* 歩いて行けない区画(ワープ先など)は数えない */
      for (let c = hit; c >= 0 && par[c] >= 0; c = par[c]) { const x = c % C, y = (c / C) | 0; steps++; if (enc.includes(m.rows[y][x])) encSteps++; const b = blockOf(x, y); if (fi.valid[b] && !done[b]) { done[b] = 1; left--; } }
      x0 = hit % C; y0 = (hit / C) | 0;
    }
    return { id, name: m.name, town: m.town, blocks: fi.total, missed: left, steps, encSteps, rate: m.rate || .11, hub: id === m.town, stampMax: 0 };
  };
  S.mapList = () => Object.keys(MAPS).map(id => ({ id, town: MAPS[id].town, name: MAPS[id].name, field: MAPS[id].field || null }));
  /* 11. 地域コンプ(その町の出現表と釣り場の全種を仲間にするまで)。
        いまの時間・天気で出る種の重みがいちばん多い探索先で戦い、出ない時間帯は歩いて時間を送る(予報を見て狙う)。
        新しい種に出会ったらスカウト成功率 q で仲間になる(失敗したらまた出会うのを待つ)。戦闘1回ぶんは battleS 秒＋回復の往復。 */
  S.regionTime = function (tid, N, seed, q, battleS) {
    S.seed(seed); const out = [], L = regList(tid).filter(x => tid === 'komorebi' || x.sp !== 'hoshikuzume' && x.s !== 'hoshikuzume'), need = new Set(L.map(x => x.s)); /* ホシクズメは全町の最初の探索先に出るが、1体仲間にすればどの町の分も済む(こもれび町でだけ数える) */
    const t = TOWN[tid]; const places = t.fields.map(f => ({ f, max: f.max, cost: P.STEP_S * 9.2 + battleS + .1 * P.REST_S }));
    for (const id in MAPS) { const m = MAPS[id]; if (m.town === tid && m.fish && m.fish.table) places.push({ f: { table: m.fish.table, max: 1 }, max: 1, cost: 8 + battleS + .1 * P.REST_S }); }
    for (let g = 0; g < N; g++) {
      state = fresh(); migrate(); state.town = tid; S.dayOff = Math.floor(Math.random() * 1e6); state.time = Math.floor(Math.random() * 4);
      const miss = new Set(need); let T = 0, enc = 0, stepsInPeriod = 0, periods = 0, wasted = 0;
      while (miss.size && T < 300 * 3600) {
        const wx = wxNow(tid);
        /* いまの時間・天気で、まだ足りない種の重みがいちばん多い場所 */
        let best = null, bw = 0;
        for (const pl of places) { const tb = wxTable(pl.f.table, state.time, wx), tot = tb.reduce((a, x) => a + x.w, 0); const w = tb.filter(x => miss.has(x.s)).reduce((a, x) => a + x.w, 0) / (tot || 1); if (w > bw) { bw = w; best = { pl, tb }; } }
        if (!best) { advanceTime(); T += 120 * P.STEP_S; periods++; stepsInPeriod = 0; continue; } /* 出る種がいない時間帯: 草むらの外を120歩歩いて時間を送る */
        /* 時間帯は120歩で変わる。1戦ぶんの歩数を数えて進める */
        const { pl, tb } = best, n = Math.min(pl.max, wpick([{ w: 6, v: 1 }, { w: 3, v: 2 }, { w: 1, v: 3 }]).v);
        enc++; T += pl.cost; stepsInPeriod += 9.2;
        for (let i = 0; i < n; i++) { const sp = wpick(tb).s; if (miss.has(sp) && Math.random() < q) miss.delete(sp); else if (miss.has(sp)) wasted++; }
        if (stepsInPeriod >= 120) { advanceTime(); stepsInPeriod = 0; periods++; }
      }
      out.push({ T, enc, periods, left: miss.size });
    }
    return { n: L.length, runs: out, list: L.map(x => x.s + (x.tm ? ':' + x.tm : '')) };
  };
  window.SIM = S;
})();
