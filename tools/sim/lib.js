const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const params = require('./params');
const ROOT = path.resolve(__dirname, '../..');

async function open(gameFile) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.route(u => !u.toString().startsWith('file:'), r => r.abort());
  const g = gameFile || process.env.SIM_GAME || params.GAME;
  await page.goto('file://' + path.resolve(ROOT, g));
  await page.evaluate(p => { window.__SIM_PARAMS = p; }, params);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8') });
  return { browser, page };
}
module.exports = { open, params, ROOT };
