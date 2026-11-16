// Soak test: N full matches in the real game with per-tick invariant checks.
//   node tools/soak.mjs [runs=20] [seed=1]
// Each run varies styles / fighter count / difficulty / mode, and drives the player either by the
// AI (autopilot) or by random button mashing (fuzz), plus UI flow (pause, menus, rematch).
import { chromium } from 'playwright-core';
const RUNS = +(process.argv[2] || 20); const SEED = +(process.argv[3] || 1);
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) pageErrors.push(m.text()); if (m.type() === 'warning') pageErrors.push('warn: ' + m.text()); });
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });

const report = [];
const ONLY = process.argv[4] ? +process.argv[4] : 0;
for (let run = 1; run <= RUNS; run++) {
  if (ONLY && run !== ONLY) continue;
  const errBefore = pageErrors.length;
  const r = await p.evaluate(({ run, SEED }) => {
    const g = window.__sa; const STY = window.__styles;
    let s = (SEED * 1000003 + run * 7919) >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const cfg = {
      style: pick(STY), body: rnd() < 0.5 ? 'male' : 'female', ai: pick([1, 2, 3, 5, 7]),
      difficulty: pick(['easy', 'normal', 'hard']), practice: rnd() < 0.15, mode: rnd() < 0.5 ? 'autopilot' : 'fuzz', wins: pick([1, 2]),
    };
    const issues = []; const seen = new Set();
    const issue = (kind, msg) => { if (seen.has(kind)) return; seen.add(kind); issues.push(`${kind}: ${msg}`); };
    // ---- start
    g.manual = true; g.go('menu'); g.match = { ai: cfg.ai, difficulty: cfg.difficulty, wins: cfg.wins, practice: cfg.practice };
    g.pcfg = { body: cfg.body, suit: 0x2f6fdb, style: cfg.style }; g.go('select');
    for (let i = 0; i < 30; i++) g.tick();
    g.autopilot = cfg.mode === 'autopilot'; g.startMatch();
    const solid = () => g.scene.children.filter((o) => !o.isSprite).length; const sceneBase = solid(); const domBase = document.querySelectorAll('#ui *').length;
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyH', 'KeyL', 'KeyU', 'KeyI', 'KeyO', 'Space', 'ShiftLeft', 'Digit1', 'Digit2'];
    const stuck = new Map(); let ticks = 0; let rounds = 0; let maxParts = 0; let paused = 0;
    const LIMIT = { attack: 300, hitstun: 120, blockstun: 60, grab: 60, throwing: 120, thrown: 90, counter: 60, counterhit: 60, launched: 400, getup: 300, transform: 90, land: 30, air: 600 };
    const t0 = performance.now();
    while (ticks < 60 * 60 * 8) { // hard cap: 8 simulated minutes per match
      ticks++;
      if (cfg.mode === 'fuzz' && g.screen === 'game') {
        if (rnd() < 0.25) { const k = pick(KEYS); if (g.keys.has(k)) g.keys.delete(k); else g.keys.add(k); }
        if (rnd() < 0.02) g.keys.clear();
        if (g.player && rnd() < 0.002) g.player.gauge = 100; // exercise transformation
      }
      // UI flow: occasionally pause/resume mid-fight
      if (g.screen === 'game' && rnd() < 0.0008) { g.go('pause'); g.render(); paused++; g.go('game'); }
      g.tick();
      if (ticks % 600 === 0) g.render();
      // ---- invariants
      for (const f of g.fighters) {
        const v = [f.pos.x, f.pos.y, f.pos.z, f.vel.x, f.vel.y, f.vel.z, f.yaw, f.hp];
        if (v.some((x) => !Number.isFinite(x))) issue('NaN', `${f.name}(${f.style.name}) state=${f.state} pos=${f.pos.toArray()} vel=${f.vel.toArray()}`);
        if (f.hp < 0 || (f.hp > f.maxHp + 1 && !cfg.practice)) issue('hp-range', `${f.name} hp=${f.hp}/${f.maxHp}`);
        if (f.mp < -0.01 || f.mp > f.maxMp + 0.01) issue('mp-range', `${f.name} mp=${f.mp}`);
        if (f.gauge < 0 || f.gauge > 100) issue('gauge-range', `${f.name} gauge=${f.gauge}`);
        if (f.evades < 0) issue('evades', `${f.name} evades=${f.evades}`);
        const key = f.id; const st = stuck.get(key) || { state: '', n: 0, move: null };
        if (st.state === f.state && st.move === f.move) st.n++; else { st.state = f.state; st.n = 0; st.move = f.move; }
        stuck.set(key, st);
        if (LIMIT[f.state] && f.stateT > LIMIT[f.state] && f.freeze === 0) issue('stuck-' + f.state, `${f.name}(${f.style.name}) ${f.state}/${f.move?.id || ''} for ${f.stateT} ticks, y=${f.pos.y.toFixed(2)} grounded=${f.grounded} anim=${f.curName}@${f.animTime().toFixed(2)}`);
        (f._hist ||= []).push(`${f.state}${f.grounded ? '' : '^'}${f.pos.y.toFixed(1)}`); if (f._hist.length > 220) f._hist.shift();
        if (f.alive && f.stunChain > 240) issue('stunlock', `${f.name} in hit reactions for ${f.stunChain} ticks: ${f._hist.filter((_, i) => i % 6 === 0).join(' ')}`);
        if (f.freeze > 40) issue('freeze-long', `${f.name} freeze=${f.freeze}`);
        if (f.state === 'down' && !f.koPending && f.stateT > 200) issue('down-forever', `${f.name} down ${st.n}`);
        if (f.state === 'thrown' && (!f.grabbedBy || f.grabbedBy.holding !== f)) issue('thrown-orphan', `${f.name} thrown without holder (holder state=${f.grabbedBy?.state})`);
        if (f.holding && f.state !== 'throwing') issue('holding-leak', `${f.name} state=${f.state} still holding ${f.holding.name}`);
        if (f.pos.y < -0.8 && !['fallout', 'out', 'launched', 'thrown'].includes(f.state)) issue('under-floor', `${f.name} y=${f.pos.y.toFixed(2)} state=${f.state} r=${Math.hypot(f.pos.x, f.pos.z).toFixed(2)}`);
        if (f.pos.y > 8) issue('sky-high', `${f.name} y=${f.pos.y.toFixed(2)} state=${f.state} vy=${f.vel.y.toFixed(2)}`);
        if (Math.hypot(f.pos.x, f.pos.z) > 9.4 && f.grounded && f.state !== 'out') issue('outside-grounded', `${f.name} r=${Math.hypot(f.pos.x, f.pos.z).toFixed(2)} state=${f.state}`);
        if (f.state === 'out' && f.alive && !cfg.practice) issue('out-alive', `${f.name}`);
        if (f.alive && f.hp <= 0 && !cfg.practice) issue('alive-0hp', `${f.name} state=${f.state}`);
        if (f.invuln > 200 && !['down', 'getup', 'ko'].includes(f.state)) issue('invuln-stuck', `${f.name} invuln=${f.invuln} state=${f.state}`);
        if (f.veilT === 0 && f.mats.some((m) => m.opacity < 1)) issue('veil-stuck', `${f.name} transparent while not veiled`);
        if (f.transformT <= 0 && (f.aura || f.blade)) issue('transform-leak', `${f.name} aura/blade after transform ended`);
      }
      maxParts = Math.max(maxParts, g.fx.parts.length);
      if (g.screen === 'round') { rounds++; if (g.fighters.some((f) => f.roundWins >= g.match.wins)) issue('round-after-champion', 'round screen although someone reached the win count'); g.round++; g.startRound(); }
      if (g.screen === 'result') break;
      if (cfg.practice && ticks > 60 * 60) break; // practice has no end: 1 minute
    }
    const ms = performance.now() - t0;
    if (!cfg.practice && g.screen !== 'result') issue('no-result', `match did not finish (screen=${g.screen}, round=${g.round}, timer=${g.timer}, alive=${g.fighters.filter((f) => f.alive).map((f) => f.name + ':' + f.state).join(',')})`);
    if (g.screen === 'result') {
      const champ = g.fighters.slice().sort((a, b) => b.roundWins - a.roundWins)[0];
      if (champ.roundWins < g.match.wins) issue('result-early', `champion ${champ.name} has ${champ.roundWins}/${g.match.wins}`);
    }
    // leaks: let effects die out, then compare
    g.go('menu'); for (let i = 0; i < 120; i++) g.tick(); g.render();
    const sceneNow = solid(); const domNow = document.querySelectorAll('#ui *').length;
    if (g.fx.parts.length > 50) issue('fx-leak', `${g.fx.parts.length} particles alive after 2s in menu`);
    if (sceneNow > sceneBase + 20) issue('scene-leak', `scene children ${sceneBase} -> ${sceneNow}`);
    if (document.querySelectorAll('.tag').length > g.fighters.length) issue('tag-leak', `${document.querySelectorAll('.tag').length} name tags for ${g.fighters.length} fighters`);
    void domBase; void domNow;
    g.keys.clear(); g.autopilot = false;
    return { cfg, ticks, secs: (ticks / 60).toFixed(0), rounds: rounds + 1, ms: Math.round(ms), maxParts, paused, issues, winner: g.fighters.slice().sort((a, b) => b.roundWins - a.roundWins)[0]?.name, combos: Math.max(...g.fighters.map((f) => f.stats.maxCombo)) };
  }, { run, SEED });
  // floating texts are removed by real-time timers: give them a moment, then check
  await p.waitForTimeout(1200);
  const floaters = await p.evaluate(() => document.querySelectorAll('.dmg,.pop').length);
  if (floaters > 0) r.issues.push(`dom-leak: ${floaters} floating texts still on screen 1.2s later`);
  const errs = pageErrors.slice(errBefore);
  if (errs.length) r.issues.push('page-error: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  report.push(r);
  console.log(`#${String(run).padStart(2)} ${r.cfg.mode.padEnd(9)} ${r.cfg.style.padEnd(10)} AI${r.cfg.ai} ${r.cfg.difficulty.padEnd(6)} ${r.cfg.practice ? 'practice' : 'wins' + r.cfg.wins} | ${r.secs}s sim, ${r.rounds} rounds, ${r.ms}ms, maxCombo ${r.combos}, fx ${r.maxParts} | ${r.issues.length ? '✘ ' + r.issues.join(' ; ') : '✔ OK'}`);
}
const bad = report.filter((r) => r.issues.length);
console.log(`\n${RUNS - bad.length}/${RUNS} runs clean`);
const kinds = {}; for (const r of bad) for (const i of r.issues) { const k = i.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; }
if (bad.length) console.log('issue kinds:', kinds);
await b.close();
