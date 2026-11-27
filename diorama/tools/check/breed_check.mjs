// 配合表の検査: 表がすべて埋まっているか / 配合でしか生まれない4種へ、体験版のどの時点で道があるか
// 使い方: node tools/check/breed_check.mjs   (問題があれば終了コード1)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f)));
const br = J('breed.json'), mo = J('monsters.json'), sk = J('skills.json');
const S = Object.fromEntries(mo.species.map((s) => [s.id, s]));
const SK = new Set(sk.skills.map((s) => s.id));
let bad = 0;
const ng = (m) => { bad++; console.log('NG:', m); };

// 1. 表が埋まっているか
for (const a of br.order) for (const b of br.order) { const c = br.material[a]?.[b]; if (!br.order.includes(c)) ng(`material[${a}][${b}] = ${c}`); }
for (const a of br.bodyOrder) for (const b of br.bodyOrder) {
  const c = br.body[a]?.[b]; if (!br.bodyOrder.includes(c)) ng(`body[${a}][${b}] = ${c}`);
  if (br.body[a][b] !== br.body[b][a]) ng(`body が左右で食いちがう ${a}/${b}`);
}
for (const m of br.order) for (const b of br.bodyOrder) {
  const c = br.species[m]?.[b];
  if (!S[c]) ng(`species[${m}][${b}] = ${c}`);
  else if (S[c].mat !== m) ng(`species[${m}][${b}] = ${c} は素材がちがう(${S[c].mat})`);
  else if (S[c].boss) ng(`species[${m}][${b}] にぬし ${c}`);
}
// 2. わざ・パーツの参照
if (sk.skills.length < 30 || sk.skills.length > 40) ng(`わざの数 ${sk.skills.length}(30〜40)`);
for (const s of mo.species) {
  if (s.learn.length < 4 || s.learn.length > 6) ng(`${s.id} 覚えるわざ ${s.learn.length} 個`);
  for (const [lv, k] of s.learn) { if (!SK.has(k)) ng(`${s.id} のわざ ${k} がない`); if (lv > 30) ng(`${s.id} Lv${lv}`); }
  for (const [slot, pt] of Object.entries(s.parts)) {
    if (!['head', 'back', 'tail'].includes(slot)) ng(`${s.id} パーツの場所 ${slot}`);
    if (!pt.label) ng(`${s.id}.${slot} に名前がない`);
    if (pt.skill && !SK.has(pt.skill)) ng(`${s.id}.${slot} のパーツわざ ${pt.skill} がない`);
    if (pt.trait && !mo.traits[pt.trait]) ng(`${s.id}.${slot} の特性 ${pt.trait} がない`);
  }
}
for (const sp of br.special) for (const k of [sp.a, sp.b, sp.child]) if (!k.startsWith('*') && !S[k]) ng(`special の ${k} がない`);

// 3. 子の種族を決める関数(ゲーム本体と同じ規則)
const match = (pat, id) => pat === '*' || pat === id || (pat.startsWith('*') && S[id].mat === pat.slice(1));
export function child(p1, p2, flags = {}, parts = []) {
  // p1 = 左の台、p2 = 右の台。parts = 親が付けているパーツ ['tsumiking.head', ...]
  for (const sp of br.special) {
    if (sp.needFlag && !flags[sp.needFlag]) continue;
    if (sp.needPart && !parts.includes(sp.needPart)) continue;
    if ((match(sp.a, p1) && match(sp.b, p2)) || (match(sp.a, p2) && match(sp.b, p1))) return { id: sp.child, special: sp };
  }
  const m = br.material[S[p1].mat][S[p2].mat];
  const b = br.body[S[p1].body][S[p2].body];
  return { id: br.species[m][b], m, b };
}
const parents = mo.species.filter((s) => !s.noBreed).map((s) => s.id);
for (const a of parents) for (const b of parents) { const c = child(a, b, { beatKageboushi: true }); if (!S[c.id]) ng(`${a}×${b} の子がない`); }

// 4. 進み具合ごとに、手に入る種族から配合でどこまで行けるか(パーツ「つみきの冠」の受けつぎも見る)
const stages = [
  { name: '①つみき野をクリア(最初の3体はネジコを選んだ場合)', wild: ['nejiko', 'koroishi', 'watabou', 'matchbo', 'perari'], flags: { clearTsumiki: 1 } },
  { name: '②ランプの森(ぬし前)', wild: ['inky', 'origarasu', 'jarihebi', 'felton', 'hotarubin'], flags: {} },
  { name: '③カゲボウシを倒し、ピンセットを得た', wild: ['haribote'], flags: { beatKageboushi: 1, gotTweezers: 1 } },
  { name: '④ゼンマイ時計塔', wild: ['zenmainu', 'rousokun', 'tsumiking', 'kamishibai'], flags: {} },
];
const target = mo.species.filter((s) => s.breedOnly).map((s) => s.id);
const have = new Map(); // key 'id' or 'id+crown' -> 道筋
const flags = {};
const rows = [];
for (const st of stages) {
  Object.assign(flags, st.flags);
  for (const w of st.wild) have.set(w, { how: 'スカウト', gen: 0 });
  let grew = true;
  while (grew) {
    grew = false;
    const cur = [...have.entries()];
    for (const [ka, va] of cur) for (const [kb, vb] of cur) {
      const [a, ca] = ka.split('+'), [b, cb] = kb.split('+');
      const parts = [ca, cb].filter(Boolean).map(() => 'tsumiking.head');
      const r = child(a, b, flags, parts);
      const gen = Math.max(va.gen, vb.gen) + 1;
      const how = `${ka}×${kb}`;
      const add = (k) => { const old = have.get(k); if (!old || old.gen > gen) { have.set(k, { how, gen, from: [ka, kb] }); grew = true; } };
      add(r.id);
      // 親がツミキングなら、子は「つみきの冠」を受けつげる
      if (a === 'tsumiking' || b === 'tsumiking' || ca || cb) add(r.id + '+crown');
    }
  }
  const got = target.map((t) => {
    if (!have.has(t)) return `${t}: まだ無理`;
    const path = (k, d = 0) => { const v = have.get(k); if (!v.from) return k; return `(${path(v.from[0], d + 1)} × ${path(v.from[1], d + 1)})`; };
    return `${t}: ${have.get(t).gen}代目 ${path(t)}`;
  });
  const all = mo.species.filter((s) => have.has(s.id)).length;
  rows.push({ stage: st.name, all, got });
}
for (const r of rows) { console.log(`\n${r.stage} — 手に入る種族 ${r.all}/20`); for (const g of r.got) console.log('  ' + g.replace(/\+crown/g, '〈冠つき〉')); }
const finalMissing = mo.species.filter((s) => !s.noBreed && !have.has(s.id)).map((s) => s.id);
if (finalMissing.length) ng('最後まで作れない種族: ' + finalMissing.join(','));
for (const t of target) if (!have.has(t)) ng(`配合のみの ${t} への道がない`);
// 5. 組み合わせ表(19×19)の子の内訳
const count = {};
for (const a of parents) for (const b of parents) { const c = child(a, b, { beatKageboushi: true, clearTsumiki: true }).id; count[c] = (count[c] || 0) + 1; }
console.log('\n19×19=361 通り(左右の順を区別)の子の内訳:');
console.log('  ' + Object.entries(count).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${S[k].name}${v}`).join(' '));
console.log(bad ? `\n問題 ${bad} 件` : '\nOK: 表はすべて埋まっていて、配合でしか生まれない4種すべてに道がある');
process.exit(bad ? 1 : 0);
