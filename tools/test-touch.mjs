// Touch controls with real touch points: node tools/test-touch.mjs
import { chromium } from 'playwright-core';
const W = 844, H = 390;
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, x); if (!c) process.exitCode = 1; };
// tap the title -> menu, touch mode on
await touch('touchStart', [{ x: 400, y: 200, id: 1 }]); await touch('touchEnd', []); await p.waitForTimeout(400);
ok('tap starts, touch mode on', await p.evaluate(() => document.body.classList.contains('touch') && window.__sa.screen === 'menu'));
await p.evaluate(() => { const g = window.__sa; g.match = { ai: 1, difficulty: 'easy', wins: 2, practice: true }; g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'taekwondo' }; g.startMatch(); });
await p.waitForFunction(() => window.__sa.player && window.__sa.player.state === 'idle' && window.__sa.screen === 'game', null, { timeout: 20000 });
await p.waitForTimeout(2500);
const pos = () => p.evaluate(() => { const P = window.__sa.player; return { x: P.pos.x, z: P.pos.z, st: P.state, dash: window.__sa.dashing, move: P.move?.id ?? null, y: P.pos.y }; });
const a = await pos();
await touch('touchStart', [{ x: 150, y: 280, id: 1 }]); await touch('touchMove', [{ x: 215, y: 280, id: 1 }]); await p.waitForTimeout(600);
const m1 = await pos(); const d1 = Math.hypot(m1.x - a.x, m1.z - a.z);
ok('stick walks', d1 > 0.5 && !m1.dash, d1.toFixed(2));
await touch('touchEnd', []); await p.waitForTimeout(120);
await touch('touchStart', [{ x: 150, y: 280, id: 1 }]); await touch('touchMove', [{ x: 215, y: 280, id: 1 }]); await p.waitForTimeout(600);
const m2 = await pos(); const d2 = Math.hypot(m2.x - m1.x, m2.z - m1.z);
ok('double flick runs', m2.dash && d2 > d1 * 1.2, d2.toFixed(2) + ' ' + m2.dash);
await touch('touchEnd', []); await p.waitForTimeout(500);
const m3 = await pos(); ok('release stops', !m3.dash && (await p.evaluate(() => window.__sa.keys.size)) === 0);
const centre = (sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, sel);
for (const [sel, name, test] of [['#touch .hand', 'hand', (s) => s.st === 'attack'], ['#touch .foot', 'foot', (s) => s.st === 'attack'], ['#touch .jump', 'jump', (s) => s.y > 0.05 || s.st === 'jump' || s.st === 'air'], ['#touch .guard', 'guard', (s) => s.st === 'guard']]) {
  const c = await centre(sel); await touch('touchStart', [{ x: c.x, y: c.y, id: 3 }]); await p.waitForTimeout(160);
  const s = await pos(); ok('button ' + name, test(s), `${s.st} ${s.move ?? ''} size ${Math.round(c.w)}px`);
  await touch('touchEnd', []); await p.waitForTimeout(1100);
}
// two fingers: stick + button
await touch('touchStart', [{ x: 150, y: 280, id: 1 }]); await touch('touchMove', [{ x: 215, y: 280, id: 1 }]);
const hc = await centre('#touch .hand'); await touch('touchStart', [{ x: 215, y: 280, id: 1 }, { x: hc.x, y: hc.y, id: 2 }]); await p.waitForTimeout(160);
ok('stick + button together', (await pos()).st === 'attack'); await touch('touchEnd', []); await p.waitForTimeout(800);
// camera drag in the free area on the right
const y0 = await p.evaluate(() => window.__sa.camYaw);
await touch('touchStart', [{ x: 520, y: 150, id: 5 }]); await touch('touchMove', [{ x: 600, y: 150, id: 5 }]); await touch('touchEnd', []);
ok('camera drag', Math.abs((await p.evaluate(() => window.__sa.camYaw)) - y0) > 0.2);
const pc = await centre('#touch .pause'); await touch('touchStart', [{ x: pc.x, y: pc.y, id: 6 }]); await touch('touchEnd', []); await p.waitForTimeout(200);
ok('pause button', await p.evaluate(() => window.__sa.screen === 'pause' && !document.querySelector('#touch').classList.contains('show')));
// overlap check of the buttons at a few phone sizes
for (const [w, h] of [[667, 375], [844, 390], [932, 430], [1180, 820]]) {
  await p.setViewportSize({ width: w, height: h }); await p.evaluate(() => { const g = window.__sa; g.screen === 'pause' && g.go('game'); }); await p.waitForTimeout(250);
  const r = await p.evaluate(() => { const bs = [...document.querySelectorAll('#touch .tb')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return { n: e.dataset.id, x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 }; }); const bad = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y) < bs[i].r + bs[j].r - 1) bad.push(bs[i].n + '/' + bs[j].n); const out = bs.filter((q) => q.x - q.r < 0 || q.x + q.r > innerWidth || q.y - q.r < 0 || q.y + q.r > innerHeight).map((q) => q.n); return { bad, out, min: Math.round(Math.min(...bs.map((q) => q.r * 2))) }; });
  ok(`layout ${w}x${h}`, r.bad.length === 0 && r.out.length === 0, JSON.stringify(r));
}
await b.close();
