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

  S.newGame = function (starter, o = {}) {
    state = fresh(); migrate(); ui.dlg = null; B = null;
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
  S.walkToEncounter = function (max = 5000) {
    for (let i = 1; i <= max; i++) { owArrive(); if (B) return i; }
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
      foes, boss, win: !!(B && B.result && B.result.win), turns: B.turn, fled: B.enemies.some(c => c.fled),
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
      owEncounter('aze');
      if (!B) { out.push(null); continue; }
      const r = await S.fight();
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
        const steps = S.walkToEncounter(); if (steps < 0) break;
        const lvB = state.party[0].lv; const r = await S.fight();
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
      S.newGame(starter, { lv, party: o.party, time: o.time }); healAll(); S.place(mapId);
      const st = S.walkToEncounter(); if (st < 0) continue;
      const y0 = state.yen; const r = await S.fight(); ok++;
      if (r.win) { win++; exp += r.exp; yen += state.yen - y0; } else { const k = r.foes.map(f => f.sp).join('+'); lost[k] = (lost[k] || 0) + 1; }
      sec += r.sec; turns += r.turns; leadHp += r.leadHp;
    }
    return { win: win / ok, n: ok, sec: sec / ok, turns: turns / ok, exp: exp / ok, yen: yen / ok, leadHp: leadHp / ok, lost };
  };
  /* 4. 経済: 仮想時間 hours 時間ぶん草むらで戦い続けたときの経験値・円・遭遇数 */
  S.income = async function (starter, mapId, lv, hours, seed, o = {}) {
    S.seed(seed); S.newGame(starter, { lv, party: o.party, time: o.time }); S.place(mapId);
    let T = 0, exp = 0, enc = 0, wins = 0, losses = 0, steps = 0, bsec = 0, rests = 0, shiny = 0, metal = 0, foes = 0;
    const lv0 = state.party.map(m => m.lv); const y0 = state.yen;
    while (T < hours * 3600) {
      const st = S.walkToEncounter(); if (st < 0) break; steps += st; T += st / P.GRASS * P.STEP_S;
      const r = await S.fight(); enc++; exp += r.exp; bsec += r.sec; T += r.sec; r.win ? wins++ : losses++;
      r.foes.forEach(f => { foes++; if (f.shiny) shiny++; if (f.metal) metal++; });
      if (afterFight(r)) { rests++; T += P.REST_S; }
      if (!r.win) S.place(mapId);
      /* 経験値は敵側で決まるので、先頭のLvを固定して測る(HPの割合は保つ) */
      state.party.forEach((m, i) => { const L = lv0[i], hpf = m.hp / calc(m).hp; m.lv = L; m.exp = 0; const s = calc(m); m.hp = Math.max(m.hp > 0 ? 1 : 0, Math.floor(s.hp * hpf)); m.mp = s.mp; });
    }
    return { hours: T / 3600, exp, yenNet: state.yen - y0, enc, wins, losses, steps, battleSec: bsec, rests, shiny, metal, foes };
  };
  /* 5. 遭遇だけ大量に(戦わない): 色違い・メタル・種族の出現割合 */
  S.encounters = function (starter, mapId, N, seed, time) {
    S.seed(seed); S.newGame(starter, { time }); S.place(mapId); if (time != null) state.time = time;
    let steps = 0, enc = 0, foes = 0, shiny = 0, metal = 0, encMetal = 0, encShiny = 0; const sp = {};
    for (let i = 0; i < N; i++) {
      state.party[0].hp = calc(state.party[0]).hp;
      const st = S.walkToEncounter(); if (st < 0) break; steps += st; enc++;
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
      while (!done && T < 6 * 3600 && battles < 800) {
        if (state.party.some(m => m.lv >= thr)) {
          tries++; healAll(); T += P.REST_S;
          H.boss(); const r = await S.fight(); battles++; T += r.sec;
          if (firstTry == null) { firstTry = r.win; levelAtTry = lead.lv; }
          if (r.win) { done = true; break; }
          T += P.REST_S; loses++;
          thr = Math.max(thr, lead.lv) + 2; /* 負けたら、さらに2Lv上げてから再挑戦 */
        }
        S.place(lead.lv >= 6 ? 'urayama' : 'komorebi');
        const st = S.walkToEncounter(); if (st < 0) break; T += st / P.GRASS * P.STEP_S;
        const r = await S.fight(); battles++; T += r.sec;
        if (afterFight(r)) { rests++; T += P.REST_S; }
        if (!r.win) loses++;
      }
      res.push({ done, T, battles, tries, firstTry, levelAtTry, lv: lead.lv, rests, loses });
    }
    return res;
  };
  window.SIM = S;
})();
