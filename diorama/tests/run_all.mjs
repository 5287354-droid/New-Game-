// `node --test tests/` の入口。このフォルダの *.test.mjs を全部読みこむ(各班のテストも自動で入る)
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter((f) => /\.test\.(mjs|js)$/.test(f)).sort()) await import(pathToFileURL(`${dir}/${f}`).href);
