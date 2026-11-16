// Quick look at every screen: node tools/shot-ui.mjs [prefix]  -> shots/n_*.jpg
import { chromium } from 'playwright-core';
const pre = process.argv[2] || 'n'; const only = process.argv[3];
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const want = (n) => !only || only.split(',').includes(n);
const shot = async (n) => { if (!want(n)) return; await p.waitForTimeout(400); await p.screenshot({ path: `shots/${pre}_${n}.jpg`, type: 'jpeg', quality: 85 }); console.log('shot', n); };
await p.waitForTimeout(1500); await shot('title');
await p.evaluate(() => window.__sa.go('menu')); await p.waitForTimeout(800); await shot('menu');
await p.evaluate(() => window.__sa.go('setup')); await shot('setup');
await p.evaluate(() => window.__sa.go('select')); await p.waitForTimeout(800); await shot('select');
await p.evaluate(() => window.__sa.go('moves')); await shot('moves');
await p.evaluate(() => window.__sa.go('settings')); await shot('settings');
if (want('battle') || want('round') || want('result') || want('pause')) {
  await p.evaluate(() => {
    const g = window.__sa; g.manual = true; g.match = { ai: 3, difficulty: 'hard', wins: 2, practice: false };
    g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'taekwondo' }; g.autopilot = true; g.startMatch();
    let t = 0; const P = g.player;
    while (t < 3000) { g.tick(); t++; if (t < 300) continue; if (P.state === 'attack' && P.freeze > 3 && P.combo >= 2) break; }
    g.tick(); g.render();
  });
  await shot('battle');
  await p.evaluate(() => { const g = window.__sa; g.go('pause'); g.render(); }); await shot('pause');
  await p.evaluate(() => { const g = window.__sa; g.roundWinner = g.fighters[1]; g.go('round'); g.render(); }); await shot('round');
  await p.evaluate(() => { const g = window.__sa; g.go('result'); g.render(); }); await shot('result');
}
await b.close();
