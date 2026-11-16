// usage: node tools/shot-seq.mjs <out.jpg> '<json: {"0":"K","17":"J",...}>' '<json: [ticks to capture]>'
// Plays a timed input sequence (taekwondo vs dummy) and stitches the captured frames side by side.
import { chromium } from 'playwright-core';
const [, , out, seqJson, capJson] = process.argv;
const seq = JSON.parse(seqJson); const caps = JSON.parse(capJson);
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await p.evaluate((st) => { window.__style = st; }, process.env.STYLE || 'taekwondo');
await p.evaluate(() => {
  const g = window.__sa; g.manual = true; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: true }; g.pcfg.style = window.__style || 'taekwondo'; g.startMatch();
  g.introT = 0; g.ai.clear();
  const [a, v] = g.fighters; a.pos.set(0, 0, 0); v.pos.set(0, 0, 1.1); a.yaw = 0; v.yaw = Math.PI;
  for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); f.buf = {}; }
  document.querySelectorAll('.screen').forEach((e) => (e.style.display = 'none'));
  const V = g.cam.position.constructor; g.camOverride = { pos: new V(3.4, 1.7, 1.2), look: new V(0, 0.9, 1.2) };
  window.__tick = 0;
});
const E = { mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false };
const shots = []; let t = 0;
for (const c of caps) {
  await p.evaluate(([from, to, seq, E]) => {
    const g = window.__sa;
    for (let i = from; i < to; i++) {
      g.tickN++; for (const x of g.fighters) { x.animate(); x.root.updateMatrixWorld(true); }
      g.fighters.forEach((x, k) => { x.ctrl = { ...E, ...(k === 0 && seq[i] ? Object.fromEntries(seq[i].split(',').map((q) => [q, true])) : {}) }; x.update(g); });
      g.separate(); g.fx.update();
      const [a, v] = g.fighters; g.camOverride.look.z = (a.pos.z + v.pos.z) / 2; g.camOverride.pos.z = g.camOverride.look.z;
    }
    g.render();
  }, [t, c, seq, E]);
  t = c;
  shots.push(await p.screenshot({ type: 'jpeg', quality: 80 }));
}
const html = `<body style="margin:0;display:flex;flex-wrap:wrap;background:#000">${shots.map((s) => `<img style="width:25vw" src="data:image/jpeg;base64,${s.toString('base64')}">`).join('')}</body>`;
const rows = Math.ceil(shots.length / 4);
const q = await b.newPage({ viewport: { width: 1600, height: 300 * rows } });
await q.setContent(html); await q.waitForTimeout(200);
await q.screenshot({ path: out, type: 'jpeg', quality: 85, fullPage: true });
await b.close();
console.log('saved', out);
