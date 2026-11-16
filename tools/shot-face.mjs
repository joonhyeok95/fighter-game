import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await p.evaluate(() => {
  const g = window.__sa; g.manual = true; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: true }; g.startMatch(); g.introT = 0; g.ai.clear();
  const [a, v] = g.fighters; a.pos.set(-0.5, 0, 0); v.pos.set(0.5, 0, 0); a.yaw = 0; v.yaw = 0;
  for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); }
  document.querySelectorAll('.screen').forEach((e) => (e.style.display = 'none'));
  const V = g.cam.position.constructor; g.camOverride = { pos: new V(0, 1.5, 2.6), look: new V(0, 1.0, 0) };
  for (let i = 0; i < 5; i++) g.tick(); g.render();
});
await p.screenshot({ path: process.argv[2] || 'shots/face.jpg', type: 'jpeg', quality: 90 });
await b.close();
