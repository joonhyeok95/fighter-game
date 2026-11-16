// Practice mode: guide panel + partner modes. node tools/test-practice.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, x); if (!c) process.exitCode = 1; };
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const start = async (style) => {
  await p.evaluate((style) => { const g = window.__sa; g.go('menu'); g.match = { ai: 1, difficulty: 'easy', wins: 2, practice: true }; g.pcfg = { body: 'male', suit: 0x2f6fdb, style }; g.startMatch(); }, style);
  await p.waitForFunction(() => window.__sa.player && window.__sa.screen === 'game'); await p.waitForTimeout(1200);
};
const st = () => p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; return { dummy: g.dummy, open: g.guideOpen, ps: P.state, ds: D.state, php: P.hp, dhp: D.hp, d: Math.hypot(P.pos.x - D.pos.x, P.pos.z - D.pos.z), panel: getComputedStyle(document.querySelector('#practice .pguide')).display, title: document.querySelector('#practice .nm').textContent, bar: getComputedStyle(document.querySelector('#practice')).display }; });
await start('taekwondo');
let s = await st(); ok('panel shown with style how-to', s.bar === 'block' && s.panel === 'flex' && s.title.includes('태권도'), s.title);
await p.screenshot({ path: 'shots/practice_guide_tk.jpg', type: 'jpeg', quality: 86 });
await p.click('#practice .pguide .x'); await p.waitForTimeout(150); s = await st(); ok('close button hides it', s.panel === 'none' && !s.open);
await p.keyboard.press('KeyH'); await p.waitForTimeout(150); s = await st(); ok('H opens it again', s.panel === 'flex');
// attack mode: partner walks in and lands single hits
await p.click('#practice [data-mode="attack"]'); s = await st(); ok('attack button on', s.dummy === 'attack');
const seen = new Set(); let hits = 0, maxCombo = 0, last = '';
for (let i = 0; i < 70; i++) { await p.waitForTimeout(100); const r = await p.evaluate(() => { const g = window.__sa; return { ps: g.player.state, m: g.fighters[1].move?.id ?? '', c: g.fighters[1].combo }; }); seen.add(r.m); if (r.ps === 'hitstun' && last !== 'hitstun') hits++; last = r.ps; maxCombo = Math.max(maxCombo, r.c); }
ok('partner attacks with single hits', hits >= 3 && maxCombo <= 1 && seen.size === 2, `hits ${hits}, combo ${maxCombo}, moves ${[...seen].join('/')}`);
await p.screenshot({ path: 'shots/practice_attack.jpg', type: 'jpeg', quality: 86 });
// counter it: hold the counter chord right as the next strike starts
let countered = false;
for (let i = 0; i < 120 && !countered; i++) { await p.waitForTimeout(16); const a = await p.evaluate(() => { const g = window.__sa; return g.fighters[1].state === 'attack' && g.fighters[1].stateT < 4 && g.player.state === 'idle'; }); if (a) { await p.keyboard.down('KeyZ'); await p.keyboard.down('KeyC'); await p.waitForTimeout(700); await p.keyboard.up('KeyC'); await p.keyboard.up('KeyZ'); const r = await p.evaluate(() => window.__sa.fighters[1].state); countered = ['thrown', 'launched', 'down', 'getup', 'hitstun'].includes(r); break; } }
ok('player can counter the single strike', countered);
// guard mode
await p.keyboard.press('F4'); await p.waitForTimeout(2500); s = await st(); ok('guard mode: partner holds guard', s.dummy === 'guard' && s.ds === 'guard', s.ds);
await p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; P.pos.set(D.pos.x + 1.0, D.pos.y, D.pos.z); P.faceToward(D.pos, 1); });
await p.keyboard.down('KeyX'); await p.waitForTimeout(350); s = await st(); ok('guard blocks strikes', s.ds === 'blockstun' || s.ds === 'guard', s.ds); await p.keyboard.up('KeyX'); await p.waitForTimeout(900);
await p.screenshot({ path: 'shots/practice_guard.jpg', type: 'jpeg', quality: 86 });
await p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; P.pos.set(D.pos.x + 0.9, D.pos.y, D.pos.z); P.faceToward(D.pos, 1); });
await p.keyboard.down('KeyZ'); await p.keyboard.down('KeyX'); let thrown = false;
for (let i = 0; i < 40 && !thrown; i++) { await p.waitForTimeout(25); thrown = await p.evaluate(() => ['grabbed', 'thrown', 'launched'].includes(window.__sa.fighters[1].state) || !!window.__sa.player.holding); }
await p.keyboard.up('KeyX'); await p.keyboard.up('KeyZ'); ok('grab beats the guarding partner', thrown);
await p.waitForTimeout(4000); s = await st(); ok('partner guards again after getting up', s.ds === 'guard', s.ds);
await p.keyboard.press('F2'); await p.waitForTimeout(400); s = await st(); ok('F2 back to idle', s.dummy === 'idle' && s.ds === 'idle', s.ds);
await start('ironbone'); s = await st(); ok('ironbone guide', s.title.includes('철골권'));
await p.screenshot({ path: 'shots/practice_guide_ib.jpg', type: 'jpeg', quality: 86 });
await p.evaluate(() => window.__sa.go('pause')); await p.waitForTimeout(200); ok('hidden outside the fight', (await st()).bar === 'none');
// phone
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const m = await ctx.newPage(); await m.goto('http://localhost:5173/?touch'); await m.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await m.evaluate(() => { const g = window.__sa; g.go('menu'); g.match = { ai: 1, difficulty: 'easy', wins: 2, practice: true }; g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'taekwondo' }; g.startMatch(); });
await m.waitForTimeout(1500); ok('phone: guide closed by default', await m.evaluate(() => !window.__sa.guideOpen));
await m.screenshot({ path: 'shots/practice_phone.jpg', type: 'jpeg', quality: 86 });
await m.tap('#practice [data-guide]'); await m.tap('#practice [data-mode="guard"]'); await m.waitForTimeout(600);
ok('phone: taps work', await m.evaluate(() => window.__sa.guideOpen && window.__sa.dummy === 'guard'));
await m.screenshot({ path: 'shots/practice_phone_open.jpg', type: 'jpeg', quality: 86 });
await b.close();
