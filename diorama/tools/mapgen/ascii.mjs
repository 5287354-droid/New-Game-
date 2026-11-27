// マップ JSON を文字の図にする(確かめ用)。使い方: node tools/mapgen/ascii.mjs <area> [階]
import { loadArea } from '../solver/solver.mjs';
import * as G from '../../src/core/grid.js';
const SYM = { chest: '$', shelf: '$', npc: '@', handle: 'h', dial: 'O', item: 'i', socket: 'o', boss: '!', goal: 'G', exit: 'E', stairs: '^', sign: '?', tree: 'T', lampStation: '*', pendulum: 'P', post: '|', clockface: 'O', bed: 'b', counter: '=', statue: 'S' };
const a = loadArea(process.argv[2]);
const gs = G.newGimmickState(a);
const only = process.argv[3] != null ? +process.argv[3] : null;
a.levels.forEach((L, l) => {
  if (only != null && l !== only) return;
  console.log(`L${l}`);
  for (let z = 0; z < L.d; z++) {
    let row = String(z).padStart(2) + ' ';
    for (let x = 0; x < L.w; x++) {
      const c = G.cell(a, gs, l, x, z);
      const o = c.objs.find((q) => SYM[q.type]);
      if (o) row += SYM[o.type];
      else if (!G.walkable(c)) row += { w: '~', W: 'W', X: 'X', x: ' ', e: '#', C: 'c', v: '_' }[c.t] || '#';
      else row += c.h >= 2 && a.id !== 'forest' ? String(c.h) : c.t === 'c' ? ':' : '.';
    }
    console.log(row);
  }
});
