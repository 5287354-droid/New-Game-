// data/*.json を引きやすい形にまとめる。JSON の読みこみは呼ぶ側(ブラウザは fetch、node は readFileSync)。
//   const db = makeDB({ monsters, skills, breed, items })
// ほかの core のモジュールは、すべて db を第1引数にとる。

export const SLOTS = ['head', 'back', 'tail'];
export const STATS = ['hp', 'mp', 'atk', 'def', 'spd', 'int'];
export const MAX_LV = 30;

export function makeDB({ monsters, skills, breed, items }) {
  const species = Object.fromEntries(monsters.species.map((s) => [s.id, s]));
  const skillMap = Object.fromEntries(skills.skills.map((s) => [s.id, s]));
  const itemMap = Object.fromEntries(items.items.map((s) => [s.id, s]));
  const beats = Object.fromEntries(Object.entries(monsters.materials).map(([k, v]) => [k, v.beats]));
  return {
    raw: { monsters, skills, breed, items },
    species, skills: skillMap, items: itemMap,
    materials: monsters.materials, traits: monsters.traits, bodies: monsters.bodies,
    statuses: skills.statuses, breed, shop: items.shop || [],
    beats,
    sp(id) { const s = species[id]; if (!s) throw new Error(`種族がない: ${id}`); return s; },
    sk(id) { const s = skillMap[id]; if (!s) throw new Error(`わざがない: ${id}`); return s; },
    it(id) { const s = itemMap[id]; if (!s) throw new Error(`道具がない: ${id}`); return s; },
  };
}

// node 用: diorama/data から読む(テスト・シミュレーター)
export async function loadDBNode(dataDir) {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const J = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
  return makeDB({ monsters: J('monsters.json'), skills: J('skills.json'), breed: J('breed.json'), items: J('items.json') });
}

// ブラウザ用: fetch で読む
export async function loadDBFetch(base = './data/') {
  const J = async (f) => (await fetch(base + f)).json();
  const [monsters, skills, breed, items] = await Promise.all(['monsters.json', 'skills.json', 'breed.json', 'items.json'].map(J));
  return makeDB({ monsters, skills, breed, items });
}
