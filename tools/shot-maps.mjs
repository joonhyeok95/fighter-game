// Soak + screenshots of every map: node tools/shot-maps.mjs [prefix] [maps]  -> shots/<prefix>_<map>_*.jpg
import { chromium } from 'playwright-core';
const pre = process.argv[2] || 'm'; const maps = (process.argv[3] || 'stairs,cave,court').split(',');
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await p.waitForTimeout(1000);
for (const id of maps) {
  await p.evaluate((id) => {
    const g = window.__sa; g.manual = true; g.match = { ai: 3, difficulty: 'hard', wins: 3, practice: false, map: id };
    g.setMap(id); g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'taekwondo' }; g.autopilot = true; g.startMatch();
    for (let t = 0; t < 200; t++) g.tick(); g.render();
  }, id);
  await p.waitForTimeout(500); await p.screenshot({ path: `shots/${pre}_${id}_1.jpg`, type: 'jpeg', quality: 85 });
  for (let k = 2; k <= 3; k++) {
    await p.evaluate(() => {
      const g = window.__sa; const P = g.player; let t = 0;
      while (t < 2500) { g.tick(); t++; if (t > 240 && P && P.state === 'attack' && P.freeze > 2) break; }
      g.render();
    });
    await p.waitForTimeout(300); await p.screenshot({ path: `shots/${pre}_${id}_${k}.jpg`, type: 'jpeg', quality: 85 });
  }
  // long soak: count how rounds end, look for broken positions
  const res = await p.evaluate(() => {
    const g = window.__sa; const st = { ticks: 0, nan: 0, maxY: 0, minYAlive: 0, n: g.fighters.length, screens: {}, ring: 0, kos: 0, stuck: 0 };
    let idle = 0; let lastScreen = '';
    for (let t = 0; t < 40000; t++) {
      g.tick(); st.ticks++;
      const sc = g.screen ?? g.state ?? '?'; if (sc !== lastScreen) { st.screens[sc] = (st.screens[sc] || 0) + 1; lastScreen = sc; }
      for (const f of g.fighters) {
        if (!isFinite(f.pos.x + f.pos.y + f.pos.z)) st.nan++;
        st.maxY = Math.max(st.maxY, f.pos.y);
        if (f.grounded && f.state !== 'out') st.minYAlive = Math.min(st.minYAlive, f.pos.y);
      }
      if (sc === 'round') { st.rounds = (st.rounds || 0) + 1; g.round++; g.startRound(); } else if (sc === 'result') { st.rounds = (st.rounds || 0) + 1; for (const f of g.fighters) { st.ring += f.stats.ringouts; st.kos += f.stats.kos; } g.startMatch(); }
    }
    for (const f of g.fighters) { st.ring += f.stats.ringouts; st.kos += f.stats.kos; }
    st.final = g.fighters.map((f) => `${f.name}:${f.state}:${f.pos.x.toFixed(1)},${f.pos.y.toFixed(1)},${f.pos.z.toFixed(1)}:w${f.roundWins}`);
    return st;
  });
  console.log(id, JSON.stringify(res));
}
await b.close();
