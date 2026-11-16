// Combo lab: measures every technique and every combo route of every fighting style in the
// real game (Edge + Playwright) and writes docs/styles.json + docs/styles.md.
//  - technique data: limb, startup/total frames, damage, hit count, reaction, properties
//  - every route in the combo tree (depth <= 4): hits, damage, ending, and whether it is a TRUE
//    combo (the opponent never regains control between the first and the last hit)
//  - after every launcher: which follow-ups (jump + air attack, ground strikes) still connect
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });

await p.evaluate(async () => { const m = await import('/src/moves.ts'); window.__styleDefs = m.STYLES; });
if (process.env.LAB_DEBUG) await p.evaluate((d) => { window.__labDebug = d; window.__labTrace = []; }, JSON.parse(process.env.LAB_DEBUG));

const result = await p.evaluate(() => {
  const g = window.__sa; const MOVES = window.__moves; const STYLES = window.__styleDefs;
  const E = () => ({ mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false });
  const FREE = ['idle', 'move', 'guard', 'blockstun', 'land'];
  const tick = (ca, n = 1) => { for (let i = 0; i < n; i++) { g.tickN++; for (const x of g.fighters) { x.animate(); x.root.updateMatrixWorld(true); } g.fighters.forEach((x, k) => { x.ctrl = { ...E(), ...(k === 0 ? ca : {}) }; x.update(g); }); g.separate(); g.updateSmokes(); g.fx.update(); } };
  function duel(style, dist) {
    g.manual = true; g.autopilot = false; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false };
    g.pcfg.style = style; g.startMatch(); g.introT = 0; g.ai.clear();
    const [a, v] = g.fighters; v.opts.style = 'kickboxing';
    a.pos.set(0, 0, 0); v.pos.set(0, 0, dist); a.yaw = 0; v.yaw = Math.PI;
    for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); f.buf = {}; f.hp = f.maxHp = 1e6; }
    tick({}, 2); return [a, v];
  }
  // stricter true-combo check: record the victim's state every tick and see whether it was free between hits
  function runStrict(style, steps, dash = false) {
    const [a, v] = duel(style, dash ? 2.6 : 1.1);
    // each next input is pressed once the previous technique has actually started (so it is
    // buffered as that technique's follow-up, never overwriting an earlier queued input)
    let si = 0, hits = 0, dmg = 0, poison = 0, lastHp = v.hp, lastCombo = 0, waitFor = null, inMove = 0, air = 0; const timeline = [];
    let maxY = 0; const states = new Set(); let floated = false;
    for (let t = 0; t < 480; t++) {
      const c = {};
      if (dash && si === 0) { c.mz = 1; c.dash = true; }
      if (si < steps.length) {
        const k = steps[si];
        if (waitFor === 'pending' && a.state === 'attack') { waitFor = a.move; inMove = 0; }
        if (a.state === 'attack' && a.move === waitFor) inMove++;
        const prevStarted = waitFor && waitFor !== 'pending' && a.move && a.move !== waitFor;
        const cm = a.move; const cLast = cm?.hits?.[cm.hits.length - 1]?.to ?? 0.3;
        if (k === 'cut' || k === 'jc') {
          // standing juggle: 'J' right after a launcher cancels it into the first punch; 'cut' = 끊치 (late X restarts the punch)
          const ready = a.state === 'attack' && a.hitDone.size > 0 && t - (timeline.cutT ?? -99) > 12 &&
            (k === 'cut' ? cm.id === STYLES[style].J && a.animTime() > cLast + (8 / 60) * cm.speed : a.animTime() >= cLast);
          if (ready) { c.J = true; si++; waitFor = 'next'; timeline.cutT = t; }
        }
        else if (k === 'jump') { if (!a.grounded && a.state === 'air') { si++; air = 1; waitFor = null; } else c.jump = (t % 2 === 0); }
        else if (air > 0) { if (++air >= 10) { c[k] = true; si++; air = 0; waitFor = 'pending'; } }
        else if (si === 0) { if (!dash || t >= 10) { c[k] = true; si++; waitFor = 'pending'; } }
        else if (a.state === 'attack' && a.move === waitFor && inMove >= 4) { c[k] = true; si++; waitFor = 'next'; }
        else if (waitFor === 'next' && (a.state === 'attack' || a.state === 'grab' || a.state === 'throwing')) { /* previous queued technique */ }
        if (waitFor === 'next' && a.state === 'attack' && a.move && (a.move !== timeline.lastMove || a.stateT <= 1)) { waitFor = a.move; inMove = 0; }
        void prevStarted;
      }
      timeline.lastMove = a.move;
      if (window.__labTrace) window.__labTrace.push(`${t} si=${si} c=${Object.keys(c).filter((k) => c[k]).join('')} a=${a.state}/${a.stateT} ay=${a.pos.y.toFixed(2)} v=${v.state} vy=${v.pos.y.toFixed(2)} d=${a.pos.distanceTo(v.pos).toFixed(2)} hp=${v.hp} ap=${a.pos.z.toFixed(2)} vp=${v.pos.z.toFixed(2)}`);
      tick(c);
      const hit = a.combo > lastCombo || (a.combo > 0 && a.combo < lastCombo); lastCombo = a.combo;
      const drop = lastHp - v.hp; lastHp = v.hp;
      if (hit) { hits++; dmg += drop; } else if (drop > 0) poison += drop;
      timeline.push({ hit, free: FREE.includes(v.state) }); if (v.float) floated = true;
      if (v.state !== 'idle') states.add(v.state); maxY = Math.max(maxY, v.pos.y);
      if (si >= steps.length && t > 150 && timeline.slice(-100).every((x) => !x.hit)) break;
    }
    const idx = timeline.map((x, i) => (x.hit ? i : -1)).filter((i) => i >= 0);
    let trueCombo = idx.length > 0;
    if (idx.length > 1) for (let i = idx[0]; i < idx[idx.length - 1]; i++) if (timeline[i].free) { trueCombo = false; break; }
    const end = states.has('thrown') ? '던지기' : maxY > 0.8 || floated ? (states.has('down') ? '띄우기→다운' : '띄우기') : states.has('down') || states.has('launched') ? '다운' : '경직';
    return { hits, dmg, poison, trueCombo, maxY: +maxY.toFixed(2), end };
  }
  if (window.__labDebug) return window.__labDebug.map(([sid, keys]) => ({ sid, keys, r: runStrict(sid, keys, false) }));
  const out = {};
  for (const [sid, st] of Object.entries(STYLES)) {
    // ---- technique table
    const used = new Set(); const moves = [];
    const addMove = (id, input) => {
      if (!MOVES[id]) return; const m = MOVES[id]; const clip = g.A.clips.get(m.anim);
      const startup = Math.round((m.hits[0].t / m.speed) * 60); const total = Math.round((clip.duration / m.speed) * 60);
      const kind = m.special ? '특수' : m.hits.every((h) => h.limb.startsWith('hand')) ? '손' : m.hits.every((h) => h.limb.startsWith('foot')) ? '발' : '손발';
      if (!used.has(id)) { used.add(id); moves.push({ id, input, name: m.name, kind, limbs: [...new Set(m.hits.map((h) => h.limb))], hits: m.hits.length, dmg: m.dmg, total_dmg: m.dmg * (m.hits.length || 1), type: m.type, startup, total, armor: !!m.armor, guardBreak: !!m.guardBreak, low: !!m.low, invuln: m.invuln || 0, lunge: m.lunge || 0, special: m.special || '', reach: m.reach || 0, charge: !!m.charge }); }
    };
    // ---- enumerate routes through the tree
    const routes = [];
    const walk = (id, keys, names, depth, dash) => {
      const m = MOVES[id]; if (!m) return;
      addMove(id, (dash ? '대시 ' : '') + keys.map((k) => (k === 'S' ? 'H' : k)).join(' '));
      routes.push({ keys: [...keys], names: [...names], dash });
      if (depth >= 4 || !m.next) return;
      for (const [k, n] of Object.entries(m.next)) if (!names.includes(MOVES[n].name) || depth < 2) walk(n, [...keys, k], [...names, MOVES[n].name], depth + 1, dash);
    };
    walk(st.J, ['J'], [MOVES[st.J].name], 1, false); walk(st.K, ['K'], [MOVES[st.K].name], 1, false); walk(st.S, ['S'], [MOVES[st.S].name], 1, false);
    walk(st.dashJ, ['J'], [MOVES[st.dashJ].name], 1, true); walk(st.dashK, ['K'], [MOVES[st.dashK].name], 1, true); walk(st.dashS, ['S'], [MOVES[st.dashS].name], 1, true);
    addMove(st.air, '점프 중 C'); addMove('jumppunch', '점프 중 X');
    if (st.comboGrab) for (const r of routes.filter((r) => !r.dash && r.keys.length <= 2 && r.keys[0] !== 'S')) routes.push({ keys: [...r.keys, 'grab'], names: [...r.names, '잡기 캔슬'], dash: false });
    const measured = routes.map((r) => ({ ...r, ...runStrict(sid, r.keys, r.dash) }));
    // ---- follow-ups after every launcher route
    const follow = [];
    const launchers = measured.filter((r) => (r.end.startsWith('띄우기') || r.end === '던지기') && r.trueCombo);
    const cands = [['jc', 'cut', 'cut', 'J', 'K'], ['jc', 'cut', 'cut', 'J', 'J'], ['jc', 'cut', 'J', 'K'], ['jc', 'J', 'K'], ['jc', 'J', 'J'], ['jump', 'K'], ['jump', 'J'], ['J'], ['K'], ['S'], ['jump', 'K', 'jump', 'K']];
    for (const L of launchers) {
      for (const f of cands) {
        if (f.length === 4 && !st.doubleJump) continue;
        const keys = [...L.keys, ...f]; const r = runStrict(sid, keys, L.dash);
        if (r.hits > L.hits && r.trueCombo) follow.push({ launcher: L, follow: f, ...r, extraHits: r.hits - L.hits, extraDmg: r.dmg - L.dmg });
      }
    }
    out[sid] = { name: st.name, concept: st.concept, desc: st.desc, traits: st.traits, stats: st.stats, moves, routes: measured, follow };
  }
  return out;
});
if (process.env.LAB_DEBUG) { console.log((await p.evaluate(() => window.__labTrace)).slice(+(process.env.LAB_FROM || 0), +(process.env.LAB_TO || 90)).join(String.fromCharCode(10))); console.log(JSON.stringify(result, null, 1)); await b.close(); process.exit(0); }
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/styles.json', JSON.stringify(result, null, 1));
for (const [sid, s] of Object.entries(result)) {
  console.log(`\n### ${s.name}: ${s.moves.length} moves, ${s.routes.length} routes (${s.routes.filter((r) => r.trueCombo).length} true), ${s.follow.length} follow-ups`);
  for (const r of s.routes) console.log(`  ${r.dash ? '대시 ' : ''}${r.keys.join(' ')} | ${r.names.join(' > ')} | ${r.hits}타 ${r.dmg} | ${r.trueCombo ? '확정' : '비확정'} | ${r.end}`);
  for (const f of s.follow) console.log(`  [띄운 후] ${f.launcher.keys.join(' ')} + ${f.follow.join(' ')} | +${f.extraHits}타 +${f.extraDmg} | 총 ${f.hits}타 ${f.dmg}`);
}
await b.close();
