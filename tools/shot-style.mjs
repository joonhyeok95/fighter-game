// Style sheet images for docs/styles/<id>/: node tools/shot-style.mjs <styleId> <out.jpg> '<json {"tick":"J"}>' '<json [ticks]>' [cols]
// Plays a timed input sequence against a standing opponent, clean side camera, no HUD, and stitches the frames.
import { chromium } from 'playwright-core';
const [, , style, out, seqJson = '{}', capJson = '[1]', cols = '4'] = process.argv;
const seq = JSON.parse(seqJson), caps = JSON.parse(capJson);
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 760, height: 520 } });
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await p.addStyleTag({ content: '#ui, #practice, .hud, .screen, .touch-ui { display: none !important; }' });
await p.evaluate((style) => {
  const g = window.__sa; g.manual = true; g.autopilot = false; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false, map: 'court' };
  g.pcfg = { body: 'male', suit: 0xc8ccd6, style }; g.startMatch(); g.introT = 0; g.ai.clear();
  const [a, v] = g.fighters; a.pos.set(0, 0, 0); v.pos.set(0, 0, 1.1); a.yaw = 0; v.yaw = Math.PI; g.player = a;
  for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); f.buf = {}; }
}, style);
const shots = []; let t = 0;
for (const c of caps) {
  await p.evaluate(([from, to, seq]) => {
    const g = window.__sa; const E = { mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false };
    const [a, v] = g.fighters;
    for (let i = from; i < to; i++) {
      g.tickN++; for (const x of g.fighters) { x.animate(); x.root.updateMatrixWorld(true); }
      g.fighters.forEach((x, k) => { x.ctrl = { ...E, ...(k === 0 && seq[i] ? Object.fromEntries(seq[i].split(',').map((q) => [q, true])) : {}) }; x.update(g); g.trail?.(x); });
      g.separate(); g.updateSmokes(); g.fx.update();
    }
    for (const x of g.fighters) { x.animate(); x.root.updateMatrixWorld(true); }
    document.querySelectorAll('.banner,.dmg,.pop').forEach((e) => e.remove());
    const z = a.pos.z + 0.75; const V = (x, y, zz) => g.cam.position.clone().set(x, y, zz);
    g.camOverride = { pos: V(-3.5, 1.35, z + 0.9), look: V(0, 0.85, z) }; g.cam.position.copy(g.camOverride.pos); g.cam.lookAt(g.camOverride.look); g.render();
  }, [t, c, seq]);
  t = c; shots.push(await p.screenshot({ type: 'jpeg', quality: 90 }));
}
const n = +cols, rows = Math.ceil(shots.length / n);
const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${n},1fr);gap:4px;background:#0b0b14;padding:4px">${shots.map((s, i) => `<div style="position:relative"><img style="width:100%;display:block" src="data:image/jpeg;base64,${s.toString('base64')}"><b style="position:absolute;left:8px;top:6px;font:700 20px sans-serif;color:#fff;text-shadow:0 0 4px #000">${'①②③④⑤⑥⑦⑧⑨⑩'[i] ?? i + 1}</b></div>`).join('')}</body>`;
const W = Math.min(1900, 480 * n); const q = await b.newPage({ viewport: { width: W, height: 100 } });
await q.setContent(html); await q.waitForTimeout(200); await q.screenshot({ path: out, type: 'jpeg', quality: 88, fullPage: true });
await b.close(); console.log('saved', out);
