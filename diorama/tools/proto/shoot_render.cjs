// 描画の試作のスクショを撮り、renderer.info の数字を docs/shots/phase0_render_stats.json に残す。
//   cd diorama && python3 -m http.server 8102 &   node tools/proto/shoot_render.cjs [名前の絞りこみ]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8102/tools/proto/render.html';
const OUT = path.join(__dirname, '../../docs/shots');
const SIZES = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
// name, quality, at(l,x,z), 回転(Q/E の回数), 傾き [yaw, pitch]
const SHOTS = [
  ['outside', 'mid', '0,19,16', 0, [0, 0]],
  ['inside_home', 'mid', '0,5,6', 0, [0, 0]],
  ['inside_chief_1f', 'mid', '0,33,25', 0, [0, 0]],
  ['inside_chief_2f', 'mid', '1,33,24', 0, [0, 0]],
  ['rotate_e', 'mid', '0,19,16', 1, [0, 0]],
  ['rotate_tilt', 'mid', '0,12,15', -1, [-12, 10]],
  ['behind_wall', 'mid', '0,33,1', 0, [0, 0]],
  ['q_low', 'low', '0,19,16', 0, [0, 0]],
  ['q_high', 'high', '0,19,16', 0, [0, 0]],
];

(async () => {
  const filter = process.argv[2];
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const statsPath = path.join(OUT, 'phase0_render_stats.json');
  const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, 'utf8')) : {};
  for (const [orient, vp] of Object.entries(SIZES)) {
    for (const [name, q, at, rot, tilt] of SHOTS) {
      const id = `${name}_${orient}`;
      if (filter && !filter.split(',').some((f) => id.includes(f))) continue;
      const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
      p.on('pageerror', (e) => console.log('[err]', id, e.message));
      await p.goto(`${BASE}?q=${q}&at=${at}`);
      await p.waitForFunction(() => window.__debug?.ready, null, { timeout: 30000 });
      await p.evaluate(([rot, tilt]) => { for (let i = 0; i < Math.abs(rot); i++) window.__debug.rotate(Math.sign(rot)); window.__debug.tilt(tilt[0], tilt[1]); }, [rot, tilt]);
      await p.waitForTimeout(500);
      await p.evaluate(() => window.__debug.snap());
      await p.waitForTimeout(3500);   // 屋根・切り抜き・はがれる床の動きが落ち着くまで
      const s = await p.evaluate(() => window.__debug.stats());
      const file = `phase0_render_${id}.png`;
      await p.screenshot({ path: path.join(OUT, file) });
      stats[id] = { file, quality: s.quality, triangles: s.triangles, calls: s.calls, geometries: s.geometries, textures: s.textures, programs: s.programs, open: s.open, player: s.player };
      console.log(id, JSON.stringify(stats[id]));
      await p.close();
    }
  }
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 1));
  await b.close();
})();
