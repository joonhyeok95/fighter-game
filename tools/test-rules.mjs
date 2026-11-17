// Shoulder throw, locked guard facing, attack steering, practice map + guard partner. node tools/test-rules.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, x); if (!c) process.exitCode = 1; };
await p.evaluate(() => {
  const g = window.__sa;
  const E = () => ({ mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false });
  window.T = {
    duel(style = 'kickboxing', dist = 1.1) {
      g.manual = true; g.autopilot = false; g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false, map: 'court' };
      g.pcfg.style = style; g.startMatch(); const [a, v] = g.fighters; g.ai.clear(); g.introT = 0;
      a.pos.set(0, 0, 0); v.pos.set(0, 0, dist); a.yaw = 0; v.yaw = Math.PI;
      for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); f.buf = {}; }
      g.player = a; g.keys.clear(); this.run({}, {}, 2); return [a, v];
    },
    run(ca, cv, n, onTick) {
      const fs = g.fighters;
      for (let i = 0; i < n; i++) {
        g.tickN++; for (const x of fs) { x.animate(); x.root.updateMatrixWorld(true); }
        fs.forEach((x, k) => { const c = k === 0 ? ca : cv; x.ctrl = { ...E(), ...(typeof c === 'function' ? c(i) : c) }; x.update(g); });
        g.separate(); g.updateSmokes(); g.fx.update(); if (onTick) onTick(i);
      }
      g.render();
    },
  };
});
const deg = (r) => Math.round(r * 180 / Math.PI);

// 1. the basic grab throws the opponent behind the thrower
let r = await p.evaluate(() => {
  const [a, v] = T.duel(); const hp0 = v.hp; let kind = '', maxY = 0, rel = null;
  T.run((i) => ({ grab: i === 2 }), { guard: true }, 150, () => { if (a.state === 'throwing') kind = a.throwKind; maxY = Math.max(maxY, v.pos.y); });
  return { kind, dmg: hp0 - v.hp, z: v.pos.z - a.pos.z, maxY, vs: v.state, yaw: a.yaw };
});
ok('잡기 = 엎어치기: 상대가 뒤로 떨어진다', r.kind === 'over' && r.z < -1.2 && r.dmg === 90 && r.maxY > 0.9, `kind ${r.kind}, 피해 ${r.dmg}, 뒤로 ${(-r.z).toFixed(2)}m, 최고 ${r.maxY.toFixed(2)}m, ${r.vs}`);
r = await p.evaluate(() => { const [a, v] = T.duel('jujutsu'); let kind = ''; T.run((i) => ({ grab: i === 2 }), { guard: true }, 40, () => { if (a.state === 'throwing') kind = a.throwKind; }); return { kind }; });
ok('유술 잡기는 그대로 (띄우기)', r.kind === 'normal', r.kind);

// 2. guard cannot turn
r = await p.evaluate(() => {
  const [a] = T.duel('kickboxing', 6); const y0 = a.yaw;
  T.run({ guard: true, mx: 1, mz: 0 }, {}, 40); const g1 = a.yaw, s1 = a.state, moved = Math.hypot(a.pos.x, a.pos.z);
  T.run({ mx: 1, mz: 0 }, {}, 30); const y2 = a.yaw;
  T.run({ guard: true }, {}, 10);
  return { y0, g1, s1, moved, y2, s3: a.state, y3: a.yaw };
});
ok('가드 중 방향키: 방향이 바뀌지 않는다', r.s1 === 'guard' && Math.abs(r.g1 - r.y0) < 1e-6 && r.moved < 0.05, `${deg(r.y0)}° → ${deg(r.g1)}°`);
ok('가드를 풀고 돌아서 다시 가드', Math.abs(r.y2 - Math.PI / 2) < 0.15 && r.s3 === 'guard' && Math.abs(r.y3 - r.y2) < 1e-6, `풀고 ${deg(r.y2)}°, 재가드 ${deg(r.y3)}°`);
r = await p.evaluate(() => {
  const [a, v] = T.duel(); a.yaw = Math.PI; const hp0 = a.hp; // guarding with the back to the attacker
  T.run({ guard: true }, (i) => ({ J: i === 4 }), 40); return { dmg: hp0 - a.hp, yaw: a.yaw };
});
ok('등 돌린 가드는 막지 못한다', r.dmg > 0, `피해 ${r.dmg}`);

// 3. steering the next attack
r = await p.evaluate(() => {
  const out = {};
  for (const [name, mx, mz] of [['none', 0, 0], ['right', 1, 0], ['back', 0, -1], ['slight', 0.35, 0.94]]) {
    const [a] = T.duel('kickboxing', 9); const yaws = []; let last = '';
    T.run((i) => ({ J: i === 0 || i === 10 || i === 28, mx: i >= 6 ? mx : 0, mz: i >= 6 ? mz : 0 }), {}, 60, () => { const id = a.move?.id ?? ''; if (id && id !== last) { yaws.push(a.yaw); last = id; } });
    out[name] = yaws;
  }
  return out;
});
const d1 = (y) => y.length >= 2 ? y[1] - y[0] : NaN, d2 = (y) => y.length >= 3 ? y[2] - y[1] : NaN;
ok('조향 없음: 방향 그대로', Math.abs(d1(r.none)) < 1e-6, `${r.none.map(deg)}`);
ok('옆으로 조향: 다음 공격 +45° (누적 90°)', Math.abs(d1(r.right) - Math.PI / 4) < 1e-6 && Math.abs(d2(r.right) - Math.PI / 4) < 1e-6, `${r.right.map(deg)}`);
ok('뒤로 조향해도 최대 45°', Math.abs(Math.abs(d1(r.back)) - Math.PI / 4) < 1e-6, `${r.back.map(deg)}`);
ok('살짝 조향: 입력 각도만큼만', Math.abs(d1(r.slight) - Math.atan2(0.35, 0.94)) < 1e-3, `${r.slight.map(deg)}`);
r = await p.evaluate(() => {
  const [a, v] = T.duel('kickboxing', 1.1); const hp0 = v.hp;
  T.run((i) => ({ J: i === 0 || i === 10, mx: 0, mz: 1 }), {}, 50); return { dmg: hp0 - v.hp, combo: a.stats.maxCombo };
});
ok('앞으로 누른 채 연타: 콤보 유지', r.combo >= 2, `${r.combo}타 ${r.dmg}`);
r = await p.evaluate(() => { const [a, v] = T.duel('kickboxing', 1.1); a.yaw = 1.2; const hp0 = v.hp; T.run((i) => ({ J: i === 0 }), {}, 40); let d = Math.atan2(v.pos.x - a.pos.x, v.pos.z - a.pos.z) - a.yaw; return { d: Math.abs(Math.atan2(Math.sin(d), Math.cos(d))), yaw: a.yaw, dmg: hp0 - v.hp }; });
ok('첫 타도 자동으로 적을 보지 않는다', Math.abs(r.yaw - 1.2) < 1e-6 && r.dmg === 0, `yaw ${deg(r.yaw)}°, 피해 ${r.dmg}`);

// 3b. 진태권도: the five routes, kick travel, delayed follow-ups
r = await p.evaluate(() => {
  const out = {};
  const play = (keys, gap, style = 'jintk', dist = 1.0) => {
    const [a, v] = T.duel(style, dist); const hp0 = v.hp; const ids = []; const st = new Set();
    T.run((i) => { const k = keys[i / gap]; return i % gap === 0 && k ? { [k]: true } : {}; }, {}, keys.length * gap + 90, () => { const id = a.move?.id; if (id && ids[ids.length - 1] !== id) ids.push(id); st.add(v.state); });
    return { ids: ids.join('>'), dmg: hp0 - v.hp, combo: a.stats.maxCombo, down: st.has('launched') || st.has('down'), z: a.pos.z };
  };
  out.pp = play(['J', 'J'], 12); out.kk = play(['K', 'K'], 16); out.kkk = play(['K', 'K', 'K'], 16);
  out.ppk = play(['J', 'J', 'K'], 12); out.pkkk = play(['J', 'K', 'K', 'K'], 16);
  out.late = play(['K', 'K', 'K'], 40); out.tkLate = play(['K', 'K', 'K'], 40, 'taekwondo');
  out.far = play(['K'], 16, 'jintk', 2.1); out.tkFar = play(['K'], 16, 'taekwondo', 2.1);
  return out;
});
const J = (o) => `${o.ids} · ${o.combo}타 ${o.dmg}`;
ok('진태권도 X X: 정권 연속', r.pp.ids === 'jt_punch>jt_punch2' && r.pp.combo === 2, J(r.pp));
ok('진태권도 C C: 연속 발차기', r.kk.ids === 'jt_front>jt_round' && r.kk.combo === 2, J(r.kk));
ok('진태권도 C C C: 3단 발차기 (다운)', r.kkk.ids === 'jt_front>jt_round>jt_spin' && r.kkk.combo === 3 && r.kkk.down, J(r.kkk));
ok('진태권도 X X C: 정권 후 옆차기 (다운)', r.ppk.ids === 'jt_punch>jt_punch2>jt_side' && r.ppk.combo === 3 && r.ppk.down, J(r.ppk));
ok('진태권도 X C C C: 정권 후 연속 발차기 (다운)', r.pkkk.ids === 'jt_punch>jt_front>jt_round>jt_spin' && r.pkkk.combo === 4 && r.pkkk.down, J(r.pkkk));
ok('진태권도: 발차기 전진 거리가 태권도보다 길다', r.far.dmg > 0 && r.tkFar.dmg === 0 && r.far.z > r.tkFar.z + 0.15, `2.1m 밖에서 C: 진태권도 ${r.far.z.toFixed(2)}m 전진·피해 ${r.far.dmg} / 태권도 ${r.tkFar.z.toFixed(2)}m·피해 ${r.tkFar.dmg}`);
ok('진태권도: 텀을 두고 눌러도 이어진다 (태권도는 끊김)', r.late.ids === 'jt_front>jt_round>jt_spin' && !r.tkLate.ids.includes('tk_round'), `${r.late.ids} / ${r.tkLate.ids}`);

// 4. practice: map picker on the select screen
await p.evaluate(() => { const g = window.__sa; g.manual = false; g.go('menu'); g.match = { ai: 1, difficulty: 'easy', wins: 2, practice: true }; g.go('select'); });
await p.waitForTimeout(500);
const names = await p.$$eval('#pmap span', (e) => e.map((x) => x.textContent));
ok('연습 선택 화면에 맵 선택', names.length >= 2, names.join(' / '));
await p.screenshot({ path: 'shots/practice_map_select.jpg', type: 'jpeg', quality: 86 });
const target = names[names.length - 1];
await p.click(`#pmap span:nth-child(${names.length})`); await p.waitForTimeout(600);
r = await p.evaluate(() => ({ on: document.querySelector('#pmap span.on')?.textContent, n: document.querySelectorAll('#pmap span.on').length }));
ok('맵을 고르면 표시된다', r.on === target && r.n === 1, r.on);
await p.screenshot({ path: 'shots/practice_map_select2.jpg', type: 'jpeg', quality: 86 });
await p.evaluate(() => window.__sa.startMatch()); await p.waitForFunction(() => window.__sa.player && window.__sa.screen === 'game'); await p.waitForTimeout(1500);
r = await p.evaluate(() => ({ map: window.__sa.match.map, practice: window.__sa.match.practice, fy: window.__sa.player.pos.y }));
ok('고른 맵에서 연습 시작', r.practice && !!r.map && r.map !== 'court', r.map);
await p.screenshot({ path: 'shots/practice_map_game.jpg', type: 'jpeg', quality: 86 });
await p.evaluate(() => { const g = window.__sa; g.go('menu'); g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false }; g.go('select'); }); await p.waitForTimeout(300);
ok('대전 선택 화면에는 없음 (대전 설정에서 고름)', (await p.$$('#pmap span')).length === 0);

// 5. practice guard partner walks up to the player, and cannot turn while guarding
await p.evaluate(() => { const g = window.__sa; g.go('menu'); g.match = { ai: 1, difficulty: 'easy', wins: 2, practice: true, map: 'court' }; g.pcfg.style = 'kickboxing'; g.startMatch(); });
await p.waitForFunction(() => window.__sa.player && window.__sa.screen === 'game'); await p.waitForTimeout(1200);
const ds = () => p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; let o = Math.atan2(P.pos.x - D.pos.x, P.pos.z - D.pos.z) - D.yaw; return { s: D.state, d: Math.hypot(P.pos.x - D.pos.x, P.pos.z - D.pos.z), off: Math.abs(Math.atan2(Math.sin(o), Math.cos(o))), yaw: D.yaw }; });
const d0 = (await ds()).d;
await p.keyboard.press('F4'); await p.waitForTimeout(3000); r = await ds();
ok('가드 모드: 다가와서 가드', r.s === 'guard' && r.d < 1.5 && r.off < 0.3 && d0 > 2, `${d0.toFixed(1)}m → ${r.d.toFixed(2)}m, ${r.s}, 각도차 ${deg(r.off)}°`);
await p.screenshot({ path: 'shots/practice_guard_near.jpg', type: 'jpeg', quality: 86 });
// step to its side: the guard must not swivel — it is dropped, the partner turns, then guards again
const y0 = r.yaw; let turnedInGuard = 0, dropped = false, prev = y0;
await p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; const s = { x: Math.cos(D.yaw), z: -Math.sin(D.yaw) }; P.pos.set(D.pos.x + s.x * 1.1, D.pos.y, D.pos.z + s.z * 1.1); });
for (let i = 0; i < 60; i++) { await p.waitForTimeout(25); const q = await ds(); if (q.s === 'guard' || q.s === 'blockstun') turnedInGuard = Math.max(turnedInGuard, Math.abs(q.yaw - prev) > 1e-6 && prev !== y0 && dropped ? 0 : Math.abs(q.yaw - (dropped ? q.yaw : y0))); else dropped = true; prev = q.yaw; }
r = await ds();
ok('옆으로 돌면: 가드를 풀고 돌아서 다시 가드', dropped && turnedInGuard < 1e-6 && r.s === 'guard' && r.off < 0.3, `풀림 ${dropped}, 가드 중 회전 ${deg(turnedInGuard)}°, 지금 ${r.s} 각도차 ${deg(r.off)}°`);
// walk away: it follows
await p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; P.pos.set(D.pos.x > 0 ? D.pos.x - 4 : D.pos.x + 4, D.pos.y, D.pos.z); });
await p.waitForTimeout(3000); r = await ds();
ok('멀어지면 따라와서 다시 가드', r.s === 'guard' && r.d < 1.5, `${r.d.toFixed(2)}m ${r.s}`);
// throw it over the shoulder
await p.evaluate(() => { const g = window.__sa, P = g.player, D = g.fighters[1]; P.faceToward(D.pos, 1); });
const before = await p.evaluate(() => { const g = window.__sa, P = g.player; return { x: P.pos.x, z: P.pos.z, yaw: P.yaw }; });
await p.keyboard.down('KeyZ'); await p.keyboard.down('KeyX'); let held = false;
for (let i = 0; i < 40 && !held; i++) { await p.waitForTimeout(25); held = await p.evaluate(() => !!window.__sa.player.holding); }
await p.keyboard.up('KeyX'); await p.keyboard.up('KeyZ');
await p.waitForTimeout(180); await p.screenshot({ path: 'shots/throw_over_1.jpg', type: 'jpeg', quality: 86 });
await p.waitForTimeout(260); await p.screenshot({ path: 'shots/throw_over_2.jpg', type: 'jpeg', quality: 86 });
await p.waitForTimeout(600); await p.screenshot({ path: 'shots/throw_over_3.jpg', type: 'jpeg', quality: 86 });
r = await p.evaluate((b0) => { const g = window.__sa, P = g.player, D = g.fighters[1]; const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); return { along: (D.pos.x - P.pos.x) * fx + (D.pos.z - P.pos.z) * fz, s: D.state }; }, before);
ok('연습 상대를 엎어치기: 내 뒤에 떨어진다', held && r.along < -0.8, `앞뒤 ${r.along.toFixed(2)}m (${r.s})`);
await b.close();
