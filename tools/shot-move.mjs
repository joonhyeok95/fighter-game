// usage: node tools/shot-move.mjs <moveId> <out.jpg> [frames=4]
// Captures a contact sheet of a technique: the attacker performs it on a dummy, frames sampled across the move.
import { chromium } from 'playwright-core';
const [, , moveId, out, n = '4'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 520 } });
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const shots = [];
const total = await p.evaluate((id) => {
  const g = window.__sa; g.manual = true; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: true }; g.pcfg.style = 'taekwondo'; g.startMatch();
  g.introT = 0; g.ai.clear();
  const [a, v] = g.fighters; a.pos.set(0, 0, 0); v.pos.set(0, 0, 1.15); a.yaw = 0; v.yaw = Math.PI;
  for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); }
  document.querySelectorAll('.screen').forEach((e) => (e.style.display = 'none'));
  const V = g.cam.position.constructor; g.camOverride = { pos: new V(2.6, 1.5, 0.6), look: new V(0, 0.95, 0.6) };
  window.__f = a; a.startMove(id, g);
  return Math.round((a.cur.getClip().duration / a.move.speed) * 60) + 20;
}, moveId);
const step = Math.max(1, Math.floor(total / +n));
for (let i = 0; i < +n; i++) {
  await p.evaluate((k) => { const g = window.__sa; for (let j = 0; j < k; j++) { g.tick(); } g.render(); }, i === 0 ? Math.floor(step * 0.6) : step);
  shots.push(await p.screenshot({ type: 'jpeg', quality: 80 }));
}
// stitch side by side
const html = `<body style="margin:0;display:flex;background:#000">${shots.map((s) => `<img style="width:${100 / shots.length}vw" src="data:image/jpeg;base64,${s.toString('base64')}">`).join('')}</body>`;
const q = await b.newPage({ viewport: { width: 640 * shots.length / 2, height: 260 } });
await q.setContent(html); await q.waitForTimeout(200);
await q.screenshot({ path: out, type: 'jpeg', quality: 85 });
await b.close();
console.log('saved', out, 'ticks', total);
