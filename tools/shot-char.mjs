// Character turnaround (player male + female, front / side / back): node tools/shot-char.mjs -> shots/char_*.jpg
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
for (const body of ['male', 'female']) {
  await p.evaluate((body) => {
    const g = window.__sa; g.manual = true; g.setMap('court'); g.pcfg = { body, suit: body === 'female' ? 0xd8333b : 0xc8ccd6, style: 'taekwondo' };
    g.match = { ai: 2, difficulty: 'normal', wins: 2, practice: false, map: 'court' }; g.startMatch(); g.introT = 0; g.ai.clear();
    document.querySelectorAll('.screen').forEach((e) => (e.style.display = 'none')); document.querySelectorAll('.banner').forEach((e) => e.remove());
    const P = g.fighters[0]; g.fighters.forEach((f, i) => { if (i) f.pos.set(40, 0, 40 + i); });
    P.pos.set(0, 0, 0); window.__zoom = false; window.__turn = (yaw) => { P.yaw = yaw; P.setState('idle'); P.play('Idle_Loop', { fade: 0 }); const V = g.cam.position.constructor; g.camOverride = window.__zoom ? { pos: new V(0, 1.75, 1.7), look: new V(0, 1.65, 0) } : { pos: new V(0, 1.3, 4.2), look: new V(0, 1.05, 0) }; for (let i = 0; i < 4; i++) g.tick(); g.render(); };
  }, body);
  for (const [n, yaw] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI], ['q', 0.6], ['head', 0.01], ['headq', 0.7]]) {
    await p.evaluate(([y, z]) => { window.__zoom = z; window.__turn(y); }, [yaw, n.startsWith('head')]); await p.waitForTimeout(150);
    await p.screenshot({ path: `shots/char_${body}_${n}.jpg`, type: 'jpeg', quality: 90, clip: { x: 390, y: 0, width: 500, height: 700 } });
  }
}
await b.close();
