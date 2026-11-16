// Mid-fight screenshots: N AI fighters (player on autopilot), captured right after a clean hit near the camera focus.
import { chromium } from 'playwright-core';
const out = process.argv[2] || 'shots/battle.jpg'; const ai = +(process.argv[3] || 3); const minTicks = +(process.argv[4] || 300);
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const info = await p.evaluate(({ ai, minTicks }) => {
  const g = window.__sa; g.manual = true; g.match = { ai, difficulty: 'hard', wins: 2, practice: false };
  g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'kickboxing' }; g.autopilot = true; g.startMatch();
  let t = 0; const P = g.player;
  while (t < 3000) { g.tick(); t++; if (t < minTicks) continue;
    const near = g.fighters.filter((f) => f !== P && f.alive && f.pos.distanceTo(P.pos) < 3).length;
    if (P.state === 'attack' && P.hitT > 0 && near >= 1 && P.combo >= 2) break; }
  for (let i = 0; i < 1; i++) g.tick();
  document.querySelectorAll('.banner,.dmg,.pop').forEach((e) => e.remove()); g.render(); return { t, combo: g.player.combo };
}, { ai, minTicks });
await p.waitForTimeout(200); await p.screenshot({ path: out, type: 'jpeg', quality: 86 }); console.log('saved', out, JSON.stringify(info));
await b.close();
