// テスト共通: data/*.json を読んで db を作る
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDB } from '../src/core/db.js';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
export const db = makeDB({ monsters: J('monsters.json'), skills: J('skills.json'), breed: J('breed.json'), items: J('items.json') });
export const fixture = (f) => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', f), 'utf8'));
