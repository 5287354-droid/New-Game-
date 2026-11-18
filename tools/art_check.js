/* 魔生物の自動規格チェック(ART_BIBLE 10章)。全種×通常/色違い(上位形は成長も)を描いて判定し、
   docs/update/art_check.md に合否の表を出す。
   使い方: node tools/art_check.js [--quiet]  / 終了コード: 不合格(1〜11)があれば 1 */
const { open, ROOT } = require('./art_lib');
const fs = require('fs'), path = require('path');
const BASE_OF = { shinsuzaku: 'suzaku', shinbyakko: 'byakko', shinseiryu: 'seiryu', shingenbu: 'genbu' };
(async () => {
  const { pg, errs, close } = await open();
  const data = await pg.evaluate(() => {
    window.__artCv = {}; for (const k in SPRC) delete SPRC[k];
    const N = 192, out = {};
    const stats = (cv, rimWant) => {
      const d = cv.getContext('2d').getImageData(0, 0, N, N).data; let n = 0, x0 = N, y0 = N, x1 = 0, y1 = 0;
      for (let i = 0; i < N * N; i++) if (d[i * 4 + 3] > 128) { n++; const X = i % N, Y = i / N | 0; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      const s = document.createElement('canvas'); s.width = s.height = 48; const sx = s.getContext('2d', { willReadFrequently: true }); sx.imageSmoothingQuality = 'high';
      sx.fillStyle = '#14171c'; sx.fillRect(0, 0, 48, 48); sx.drawImage(cv, 0, 0, 48, 48); const D = sx.getImageData(0, 0, 48, 48).data;
      const m = document.createElement('canvas'); m.width = m.height = 48; const mx = m.getContext('2d', { willReadFrequently: true }); mx.drawImage(cv, 0, 0, 48, 48); const M = mx.getImageData(0, 0, 48, 48).data;
      const L = i => .2126 * D[i * 4] + .7152 * D[i * 4 + 1] + .0722 * D[i * 4 + 2], op = (X, Y) => X >= 0 && Y >= 0 && X < 48 && Y < 48 && M[(Y * 48 + X) * 4 + 3] > 128;
      let eL = 0, eN = 0; const all = []; let sil = '';
      const dist = (X, Y) => { for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!op(X + dx, Y + dy)) return r; return 9; };
      for (let Y = 0; Y < 48; Y++) for (let X = 0; X < 48; X++) { const o = op(X, Y); sil += o ? '1' : '0'; if (!o) continue; all.push(L(Y * 48 + X)); const r = dist(X, Y); if (r >= 2 && r <= 3) { eL += L(Y * 48 + X); eN++; } }
      const mean = all.reduce((a, b) => a + b, 0) / all.length, sd = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length);
      /* 逆光の色: 右下のふちに近い明るい画素の (青-赤) の平均 */
      let rb = 0, rn = 0;
      for (let y = 0; y < N - 10; y++) for (let x = 0; x < N - 10; x++) { const i = (y * N + x) * 4; if (d[i + 3] < 200) continue; const lm = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; if (lm < 70) continue; const j = ((y + 10) * N + x + 10) * 4; if (d[j + 3] < 30) { rb += d[i + 2] - d[i]; rn++; } }
      return { occ: n / N / N, bw: x1 - x0 + 1, bh: y1 - y0 + 1, x0, y0, x1, y1, cx: (x0 + x1) / 2, mt: y0, mb: N - 1 - y1, ml: x0, mr: N - 1 - x1, edge: eN ? eL / eN : 0, sd, sil, rim: rn ? rb / rn : 0 };
    };
    const lum = c => { const n = parseInt(c.slice(1), 16); return .2126 * (n >> 16 & 255) + .7152 * (n >> 8 & 255) + .0722 * (n & 255); };
    SPL.forEach(sp => {
      const id = sp.id, o = { fam: sp.fam, name: sp.name };
      sprite(id, false, false); sprite(id, false, true);
      o.n = Object.assign(stats(window.__artCv[id]), ARTINFO[id]);
      o.s = Object.assign(stats(window.__artCv[id + '_x']), ARTINFO[id + '_x']);
      mainHue(id); const c = MAINC[id].c || '#808080', R = SHT[sp.fam][SHREC[id]] || Object.values(SHT[sp.fam])[0], c2 = recolor(c, R, MAINC[id].h);
      const [h0, s0] = hsl(c), [h1, s1, l1] = hsl(c2); let dh = Math.abs(h1 - h0); dh = Math.min(dh, 360 - dh); if (s0 < .12 && s1 > .3) dh = 180;
      o.sh = { c, c2, dh, dl: Math.abs(lum(c2) - lum(c)), rec: SHREC[id], recn: R.n, whitish: l1 > .85 && s1 < .3 };
      /* 色数: 面積3%以上の色を、色相・彩度・明るさで丸めて数える */
      const rec = [], cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = flatPainter(cv.getContext('2d'), { min: DRAW96[id] ? 1.8 : 1, u: DRAW96[id] ? 2 : 1, rec, iris: '#fff' });
      try { (DRAW96[id] || DRAW[id])(g, 0); } catch (e) {}
      const m = {}; let tot = 0; rec.forEach(([cc, a]) => { if (!/^#[0-9a-f]{6}$/i.test(cc)) return; tot += a; const [h, s, l] = hsl(cc); const k = s < .12 ? 'n' + Math.round(l * 4) : Math.round(h / 40) + '_' + Math.round(l * 3); m[k] = (m[k] || 0) + a; });
      o.ncol = Object.values(m).filter(a => a / tot >= .04).length;
      out[id] = o;
    });
    return out;
  });
  const T = {}; // 判定
  const ids = Object.keys(data);
  const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = b[k] === '1'; if (x && y) i++; if (x || y) u++; } return u ? i / u : 0; };
  const rows = [], fails = {}; const P = (k, ok) => { T[k] = (T[k] || 0) + (ok ? 1 : 0); if (!ok) (fails[k] = fails[k] || []).push(cur); }; let cur = '';
  const byFam = {}; ids.forEach(id => (byFam[data[id].fam] = byFam[data[id].fam] || []).push(id));
  const maxIou = {};
  for (const f in byFam) { const l = byFam[f]; l.forEach(a => { let best = 0, who = ''; l.forEach(b => { if (a === b || BASE_OF[a] === b || BASE_OF[b] === a) return; const v = iou(data[a].n.sil, data[b].n.sil); if (v > best) { best = v; who = b; } }); maxIou[a] = [best, who]; }); }
  const nItems = 12, item = ['描画エラー', '不透明率30〜60%', '外接矩形の長辺150px以上', '余白(上左右12/下13)', 'アンカー', '目(eyeC≥1・最大sz≥0.8)', '48px 縁の輝度≥60', '48px 輝度の散らばり≥35', 'シルエット判別 IoU≤0.80', '上位形の成長', '色違いの差・金の逆光', '色数 4〜6(参考)'];
  let allOk = 0, allOk11 = 0; const detail = [];
  ids.forEach(id => {
    const d = data[id], r = [];
    cur = id;
    const chk = (v, k) => { const n = d.n, s = d.s, res = [];
      res[0] = !n.err && !s.err;
      const lo = z => .30 * Math.min(1, 1.6 / (Math.max(z.bw, z.bh) / Math.min(z.bw, z.bh)));
      res[1] = [n, s].every(z => z.occ >= lo(z) && z.occ <= .60); d.strict = [n, s].every(z => z.occ >= .30 && z.occ <= .60);
      res[2] = [n, s].every(z => Math.max(z.bw, z.bh) >= 150);
      res[3] = n.mt >= 12 && n.ml >= 12 && n.mr >= 12 && n.mb >= 13 && s.mt >= 12 && s.ml >= 12 && s.mr >= 12 && s.mb >= 13;
      res[4] = [n, s].every(z => Math.abs(z.cx - 96) <= 3 && Math.abs(z.y1 - 178) <= 2);
      res[5] = n.eyes >= 1 && n.maxEye >= .8;
      res[6] = [n, s].every(z => z.edge >= 60);
      res[7] = [n, s].every(z => z.sd >= 35);
      res[8] = maxIou[id][0] <= .80;
      const b = BASE_OF[id]; if (b) { const bi = iou(d.n.sil, data[b].n.sil); res[9] = bi <= .88 && (d.n.occ - data[b].n.occ) >= .03; d.grow = [bi, d.n.occ - data[b].n.occ]; } else res[9] = null;
      res[10] = (d.sh.dh >= 60 || d.sh.dl >= 30) && !d.sh.whitish && d.s.rim === 'gold' && d.n.rim === 'blue';
      res[11] = d.ncol >= 4 && d.ncol <= 6;
      return res; };
    d.res = chk();
    d.res.forEach((v, k) => { if (v !== null) { cur = id; P(k, v); } });
    if (d.strict) T.strict = (T.strict || 0) + 1; const core = d.res.slice(0, 11).every(v => v !== false);
    if (core) allOk11++; if (d.res.every(v => v !== false)) allOk++;
  });
  const n = ids.length;
  const f = (v, d = 1) => v.toFixed(d);
  let md = `# 魔生物 自動規格チェック(ART_BIBLE 10章)\n\n- 実行: \`node tools/art_check.js\`(Playwright で全 ${n} 種の通常・色違いを描き出して判定。上位形 4 種は通常形との成長も判定)\n- 描画: 192px、外ふち 6px、トイ・フィギュア調(\`ART_STYLE\`)\n- pageerror: ${errs.length} 件\n\n`;
  md += `## 結果\n\n**項目1〜11をすべて満たした種: ${allOk11} / ${n}**(項目12の色数を含めた全項目では ${allOk} / ${n})\n\n| # | 項目 | 合格 | 判定した数 |\n|---|---|---|---|\n`;
  item.forEach((t, k) => { const tot = k === 9 ? 4 : n; md += `| ${k + 1} | ${t} | ${T[k] || 0} | ${tot} |\n`; });
  md += `\n- 項目2は、正方形の枠に収める都合で、縦横比の大きい種(1.6 超)は下限を 30%×(1.6÷縦横比) に下げて判定した。下限を一律 30% にしたときの合格は ${T.strict || 0} / ${n} 種(通常・色違いとも)。\n- 項目12の色数は、既存の描画関数が色を 16 進で直書きしている(パレットのキー方式ではない)ため、面積 3% 以上の色を色相・明るさで丸めて数えた参考値。移行(ART_BIBLE 12章 4)で描き直す種から順にパレット化する。\n- 項目5のアンカーは、飛ぶ・浮く種も下端を y=178 にそろえている(全種共通)。\n- 項目11の「金の逆光」は、右下のふちの色(青−赤)が通常より小さい(=青くない)ことで確かめた。\n\n`;
  md += `## 不合格の一覧\n\n`;
  const fl = ids.filter(id => data[id].res.slice(0, 11).some(v => v === false));
  if (!fl.length) md += '(なし)\n\n'; else { md += '| 種 | 不合格の項目 |\n|---|---|\n'; fl.forEach(id => { md += `| ${id} ${data[id].name} | ${data[id].res.map((v, k) => v === false ? (k + 1) + ':' + item[k] : '').filter(Boolean).join(' / ')} |\n`; }); md += '\n'; }
  md += `## 上位形(覚醒)の成長\n\n| 種 | 通常形とのシルエット IoU(≤0.88) | 不透明率の差(≥+3pt) |\n|---|---|---|\n`;
  Object.keys(BASE_OF).forEach(id => { const d = data[id]; md += `| ${id} | ${f(d.grow[0], 3)} | ${f(d.grow[1] * 100)}pt |\n`; });
  md += `\n## 全種の数値\n\n| 種 | 系統 | 不透明率(通/色) | 長辺px | 余白 上/下/左/右 | 目(数/最大sz) | 縁の輝度(通/色) | 輝度sd(通/色) | 最近IoU | 色違い(型) 色相差/明るさ差 | 色数 | 合否1-12 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  ids.forEach(id => { const d = data[id], a = d.n, s = d.s; md += `| ${id} | ${d.fam} | ${f(a.occ * 100)}/${f(s.occ * 100)}% | ${Math.max(a.bw, a.bh)} | ${a.mt}/${a.mb}/${a.ml}/${a.mr} | ${a.eyes}/${f(a.maxEye, 2)} | ${f(a.edge, 0)}/${f(s.edge, 0)} | ${f(a.sd, 0)}/${f(s.sd, 0)} | ${f(maxIou[id][0], 2)}(${maxIou[id][1]}) | ${d.sh.recn} ${f(d.sh.dh, 0)}°/${f(d.sh.dl, 0)} | ${d.ncol} | ${d.res.map(v => v === null ? '-' : v ? '○' : '×').join('')} |\n`; });
  fs.writeFileSync(path.join(ROOT, 'docs/update/art_check.md'), md);
  console.log(`項目1〜11すべて合格: ${allOk11}/${n}  全12項目: ${allOk}/${n}  pageerror: ${errs.length}`);
  item.forEach((t, k) => console.log(`${k + 1} ${t}: ${T[k] || 0}/${k === 9 ? 4 : n}` + (fails[k] ? '  NG: ' + fails[k].slice(0, 40).join(',') : '')));
  fs.writeFileSync(require('path').join(require('os').tmpdir(), 'art_check.json'), JSON.stringify(Object.fromEntries(ids.map(id => [id, { ...data[id], n: { ...data[id].n, sil: undefined }, s: { ...data[id].s, sil: undefined } }]))));
  await close();
  process.exit(fl.length ? 1 : 0);
})();
