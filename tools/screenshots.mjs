// Capture real in-game screenshots (Edge + Playwright) into shots/*.jpg
//   node tools/screenshots.mjs            -> all
//   node tools/screenshots.mjs 04,10      -> only shots whose name starts with these prefixes
import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('shots', { recursive: true });
const only = process.argv[2];
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const shot = async (name) => { await p.waitForTimeout(150); await p.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 86 }); console.log('shot', name); };
const want = (n) => !only || only.split(',').some((o) => n.startsWith(o));
const ev = (fn, arg) => p.evaluate(fn, arg);

await ev(() => {
  const g = window.__sa;
  const E = () => ({ mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false });
  window.S = {
    g,
    clean() { document.querySelectorAll('.banner,.dmg,.pop').forEach((e) => e.remove()); },
    duel(style = 'kickboxing', vStyle = 'taekwondo', dist = 1.15) {
      g.manual = true; g.autopilot = false;
      g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false };
      g.pcfg.style = style; g.startMatch(); g.introT = 0; g.ai.clear();
      const [a, v] = g.fighters; v.opts.style = vStyle;
      a.pos.set(0, 0, 0); v.pos.set(0, 0, dist); a.yaw = 0; v.yaw = Math.PI;
      for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.buf = {}; }
      this.clean(); this.run({}, {}, 3); return [a, v];
    },
    run(ca, cv, n, stop) {
      const fs = g.fighters;
      for (let i = 0; i < n; i++) {
        g.tickN++; for (const x of fs) { x.animate(); x.root.updateMatrixWorld(true); }
        fs.forEach((x, k) => { const c = k === 0 ? ca : k === 1 ? cv : {}; x.ctrl = { ...E(), ...(typeof c === 'function' ? c(i) : c) }; x.update(g); g.trail(x); });
        g.separate(); g.updateSmokes(); g.fx.update();
        if (stop && stop(i)) break;
      }
      for (const x of fs) { x.animate(); x.root.updateMatrixWorld(true); }
      g.render();
    },
    seq(keys, gap = 14) { return (i) => { const k = keys[Math.floor(i / gap)]; return i % gap === 0 && k ? { [k]: true } : {}; }; },
    cam(pos, look) { const V = (a) => g.cam.position.clone().set(...a); g.camOverride = { pos: V(pos), look: V(look) }; g.cam.position.set(...pos); g.cam.lookAt(...look); g.render(); },
    side(f, d = 3.2, h = 1.45, z = 0.6) { this.cam([f.pos.x + d, h, f.pos.z + z], [f.pos.x, 1.0, f.pos.z + z]); },
  };
});

// ---------------------------------------------------------------- UI screens (real time)
if (want('01')) { await p.waitForTimeout(2500); await shot('01_title'); }
if (want('02')) { await p.keyboard.press('Enter'); await p.waitForTimeout(1200); await shot('02_menu'); }
if (want('03')) {
  await ev(() => { const g = window.__sa; g.match.practice = false; g.pcfg = { body: 'male', suit: 0xd8433b, style: 'taekwondo' }; g.go('select'); });
  await p.waitForFunction(() => { const f = window.__sa.fighters[0]; return f && f.state === 'attack' && f.move?.hits && f.animTime() > f.move.hits[0].t - 0.02; }, null, { timeout: 30000 }).catch(() => {});
  await ev(() => { window.__sa.manual = true; }); await shot('03_select_styles'); await ev(() => { window.__sa.manual = false; });
}
if (want('04')) {
  await ev(() => { window.__sa.go('moves'); });
  await ev(() => { document.querySelector('.tabs span[data-id="kickboxing"]').click(); }); await shot('04_moves_kickboxing');
  await ev(() => { document.querySelector('.tabs span[data-id="jujutsu"]').click(); }); await shot('04b_moves_jujutsu');
}

// ---------------------------------------------------------------- live battle with HUD (AI drives the player too)
if (want('05') || want('06')) {
  await ev(() => { const g = window.__sa; g.manual = false; g.match = { ai: 3, difficulty: 'hard', wins: 2, practice: false }; g.pcfg = { body: 'male', suit: 0x2f6fdb, style: 'kickboxing' }; g.autopilot = true; g.startMatch(); });
  await p.waitForFunction(() => { const g = window.__sa; const P = g.player; return P.combo >= 2 && P.state === 'attack' && P.cancelWindow() && P.hitT > 0; }, null, { timeout: 90000, polling: 16 }).catch(() => console.log('no combo moment'));
  await ev(() => { window.__sa.manual = true; }); if (want('05')) await shot('05_battle_combo_guide'); await ev(() => { window.__sa.manual = false; });
  await p.waitForFunction(() => { const g = window.__sa; return g.fighters.some((f) => f.state === 'launched' && f.pos.y > 0.9 && f.pos.distanceTo(g.player.pos) < 6); }, null, { timeout: 90000, polling: 16 }).catch(() => console.log('no launch moment'));
  await ev(() => { window.__sa.manual = true; }); if (want('06')) await shot('06_battle_juggle'); await ev(() => { window.__sa.manual = false; window.__sa.autopilot = false; });
}

// ---------------------------------------------------------------- hit-feel close-ups (deterministic)
if (want('07')) { // heavy hit: hit-stop frame with shockwave, flash, sparks
  await ev(() => { const [a, v] = S.duel('kickboxing'); S.run(S.seq(['K', 'K']), {}, 120, () => a.move?.id === 'kb_high' && a.hitDone.size > 0); S.run({}, {}, 1); S.side(a, 3.0, 1.5, 0.55); });
  await shot('07_hitstop_highkick');
}
if (want('08')) { // taekwondo 540 tornado kick
  await ev(() => { const [a, v] = S.duel('taekwondo', 'kickboxing', 1.25); S.run((i) => ({ S: i === 0 }), {}, 120, () => a.move && a.animTime() >= a.move.hits[0].t - 0.03); S.cam([-2.6, 1.5, 2.4], [0, 1.1, 0.6]); });
  await shot('08_tkd_tornado');
}
if (want('09')) { // taekwondo 나래차기 juggle in the air
  await ev(() => { const [a, v] = S.duel('taekwondo'); S.run(S.seq(['K', 'J']), {}, 160, () => a.move?.id === 'tk_double' && a.hitDone.size >= 2); S.run({}, {}, 4); S.side(a, 3.3, 1.6, 0.7); });
  await shot('09_tkd_double_juggle');
}
if (want('10')) { // jujutsu hip throw (unblockable)
  await ev(() => { const [a, v] = S.duel('jujutsu', 'kickboxing', 1.3); S.run((i) => ({ S: i === 2 }), { guard: true }, 160, () => a.state === 'throwing' && a.stateT >= 18); S.cam([2.8, 1.7, 2.6], [0, 1.1, 0.5]); });
  await shot('10_jujutsu_hipthrow');
}
if (want('11')) { // ninjutsu blink behind + strike
  await ev(() => { const [a, v] = S.duel('ninjutsu', 'kickboxing', 4.5); S.run((i) => ({ S: i === 0 }), {}, 30); S.run(S.seq(['J', 'J']), {}, 60, () => a.move?.id === 'nj_b' && a.hitDone.size > 0); S.run({}, {}, 1); S.cam([v.pos.x - 2.6, 1.6, v.pos.z + 2.4], [v.pos.x, 1.0, v.pos.z - 0.4]); });
  await shot('11_ninjutsu_blink');
}
if (want('12')) { // smoke cloud: confused enemy + veiled caster + poison
  await ev(() => { const [a, v] = S.duel('smoke', 'kickboxing', 1.3); S.run((i) => ({ S: i === 0 }), {}, 70); S.run(S.seq(['J', 'J', 'K']), {}, 120, () => a.move?.id === 'sm_round' && a.hitDone.size > 0); S.run({}, {}, 2); S.cam([3.6, 2.4, 3.8], [0, 0.9, 0.6]); });
  await shot('12_smoke_cloud');
}
if (want('13')) { // freefight super-armor power straight through a hit
  await ev(() => { const [a, v] = S.duel('freefight', 'kickboxing'); S.run((i) => ({ S: i === 0 }), (i) => ({ J: i === 2 }), 120, () => a.move?.id === 'ff_power' && a.hitDone.size > 0); S.run({}, {}, 1); S.side(a, 3.0, 1.5, 0.55); });
  await shot('13_freefight_armor');
}
if (want('14')) { // kickboxing flying knee launch
  await ev(() => { const [a, v] = S.duel('kickboxing', 'taekwondo', 3.2); S.run((i) => ({ mz: 1, dash: true, S: i === 6 }), {}, 120, () => a.move?.id === 'kb_flyknee' && a.hitDone.size > 0); S.run({}, {}, 1); S.side(a, 3.2, 1.6, 0.6); });
  await shot('14_kickboxing_flyknee');
}
if (want('15')) { // ring out
  await ev(() => { const [a, v] = S.duel('taekwondo', 'kickboxing'); a.pos.set(0, 0, 7.2); v.pos.set(0, 0, 8.3); S.run({}, {}, 1);
    S.run(S.seq(['K', 'K', 'K']), {}, 300, () => Math.hypot(v.pos.x, v.pos.z) > 9.1 || v.state === 'out'); S.run({}, {}, 5); S.cam([5.2, 2.2, 6.0], [0, 0.6, 9.6]); });
  await ev(() => { const d = document.createElement('div'); d.className = 'banner ringout'; d.textContent = 'RING OUT!'; d.style.animation = 'none'; document.getElementById('ui').appendChild(d); });
  await shot('15_ring_out'); await ev(() => S.clean());
}
if (want('16')) { // practice mode with hitboxes on a multi-hit move
  await ev(() => { const g = window.__sa; g.manual = true; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: true }; g.pcfg = { body: 'female', suit: 0x2fae5e, style: 'kickboxing' };
    g.startMatch(); g.settings.showHitboxes = true; const [a, v] = g.fighters; a.pos.set(0, 0, 0); v.pos.set(0.2, 0, 1.15); a.yaw = 0; v.yaw = Math.PI; g.camYaw = -2.3; g.camPitch = 0.3; g.camDist = 5;
    S.run((i) => ({ S: i === 0 }), {}, 120, () => a.move?.id === 'kb_onetwo' && a.hitDone.size >= 2); });
  await shot('16_practice_hitbox'); await ev(() => { window.__sa.settings.showHitboxes = false; });
}
if (want('17')) { // full AI match to the end (player on autopilot)
  await ev(() => { const g = window.__sa; g.manual = true; g.match = { ai: 5, difficulty: 'hard', wins: 2, practice: false }; g.pcfg = { body: 'female', suit: 0x2f6fdb, style: 'ninjutsu' }; g.autopilot = true; g.startMatch(); });
  const r = await ev(() => { const g = window.__sa; let guard = 0; while (g.screen !== 'result' && guard++ < 8) { if (g.screen === 'round') { g.round++; g.startRound(); g.manual = true; } let n = 0; while (g.screen === 'game' && n < 60 * 120) { g.tick(); n++; } } S.clean(); g.render(); return g.fighters.map((f) => `${f.name}(${f.style.name}):${f.roundWins}승/콤보${f.stats.maxCombo}`).join(' '); });
  console.log('match:', r); await shot('17_match_result');
}
await b.close();
