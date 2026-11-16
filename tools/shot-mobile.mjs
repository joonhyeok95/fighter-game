// Phone screenshots: node tools/shot-mobile.mjs [w=844] [h=390] [prefix=m]
import { chromium } from 'playwright-core';
const [w = '844', h = '390', prefix = 'm'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/?touch'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `shots/${prefix}_${n}.jpg`, type: 'jpeg', quality: 86 }); console.log(`shots/${prefix}_${n}.jpg`); };
await shot('title');
for (const s of ['menu', 'setup', 'select', 'moves', 'settings']) {
  try { await p.evaluate((s) => window.__sa.go(s), s); await shot(s); } catch (e) { console.log('skip', s, String(e).slice(0, 80)); }
}
const info = await p.evaluate(() => {
  const g = window.__sa; g.manual = true; g.match = { ai: 3, difficulty: 'hard', wins: 2, practice: false };
  g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'kickboxing' }; g.autopilot = true; g.startMatch();
  let t = 0; const P = g.player;
  while (t < 2500) { g.tick(); t++; if (t < 300) continue; if (P.state === 'attack' && P.freeze > 3 && P.combo >= 2) break; }
  g.render(); return { t, screen: g.screen, show: document.querySelector('#touch').className, lay: getComputedStyle(document.querySelector('#ui')).transform };
});
console.log(JSON.stringify(info));
await shot('battle');
// drive the joystick and a button with real touch points
const cdp = await ctx.newCDPSession(p);
const res = await p.evaluate(() => { const g = window.__sa; g.autopilot = false; g.manual = false; return 1; });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: +w * 0.18, y: +h * 0.7, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: +w * 0.18 + 60, y: +h * 0.7, id: 1 }] });
await p.waitForTimeout(250);
const a = await p.evaluate(() => { const g = window.__sa; return { stick: document.querySelector('#touch .stick').className, st: g.player.state, vx: +g.player.vel.x.toFixed(2), vz: +g.player.vel.z.toFixed(2) }; });
const hb = await p.evaluate(() => { const r = document.querySelector('#touch .hand').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: +w * 0.18 + 60, y: +h * 0.7, id: 1 }, { x: hb.x, y: hb.y, id: 2 }] });
await p.waitForTimeout(120);
const c = await p.evaluate(() => { const g = window.__sa; return { keys: [...g.keys], st: g.player.state, move: g.player.move?.id ?? g.player.moveId ?? null }; });
await shot('touching');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(100);
for (const s of ['pause', 'round', 'result']) { await p.evaluate((s) => { const g = window.__sa; if (s === 'round') g.roundWinner = g.fighters[1]; g.go(s); g.render(); }, s); await shot(s); }
const d = await p.evaluate(() => ({ keys: [...window.__sa.keys] }));
console.log('stick', JSON.stringify(a), 'press', JSON.stringify(c), 'released', JSON.stringify(d));
await b.close();
