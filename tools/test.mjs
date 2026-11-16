// Automated gameplay tests: drives the real game in a browser (Edge) through window.__sa.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); if (m.type() === 'warning' && m.text().includes('no anim')) errors.push(m.text()); });
await p.goto('http://localhost:5173/');
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });

await p.evaluate(() => {
  const g = window.__sa;
  const E = () => ({ mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false });
  window.T = {
    g,
    duel(styleA = 'kickboxing', styleB = 'kickboxing', dist = 1.1) {
      g.manual = true; g.autopilot = false;
      g.match = { ai: 1, difficulty: 'normal', wins: 2, practice: false };
      g.pcfg.style = styleA; g.startMatch();
      const [a, v] = g.fighters; v.opts.style = styleB;
      g.ai.clear(); g.introT = 0;
      a.pos.set(0, 0, 0); v.pos.set(0, 0, dist); a.yaw = 0; v.yaw = Math.PI;
      for (const f of g.fighters) { f.setState('idle'); f.play('Idle_Loop', { fade: 0 }); f.vel.set(0, 0, 0); f.buf = {}; }
      g.player = a; g.keys.clear(); this.run({}, {}, 2);
      return [a, v];
    },
    /** run n ticks; ca/cv = controller for fighter 0/1 (object or fn(i)) */
    run(ca, cv, n, onTick) {
      const fs = g.fighters;
      for (let i = 0; i < n; i++) {
        g.tickN++; for (const x of fs) { x.animate(); x.root.updateMatrixWorld(true); }
        fs.forEach((x, k) => { const c = k === 0 ? ca : k === 1 ? cv : {}; x.ctrl = { ...E(), ...(typeof c === 'function' ? c(i) : c) }; x.update(g); });
        g.separate(); g.updateSmokes(); g.fx.update();
        if (onTick) onTick(i);
      }
      g.render();
    },
    /** press a sequence of buttons, one every `gap` ticks, starting at tick 0 */
    seq(keys, gap = 12) { return (i) => { const k = keys[Math.floor(i / gap)]; return i % gap === 0 && k ? { [k]: true } : {}; }; },
  };
});

const results = [];
async function test(name, fn, arg) {
  try { const r = await p.evaluate(fn, arg); results.push([r.ok ? 'PASS' : 'FAIL', name, r.msg]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}

// ---------------- physics
await test('중력: 점프 정점 높이 = v²/2g, 체공시간 = v/g·(1+1/√낙하배율) (오차 5% 이내)', () => {
  const [a] = T.duel(); let apex = 0, ticks = 0, landed = false;
  const K = 1.8, g = 9.81 * K, v0 = 4.9 * Math.sqrt(K), FM = 1.35;
  T.run((i) => ({ jump: i === 0 }), {}, 120, () => { if (!landed) { apex = Math.max(apex, a.pos.y); if (!a.grounded) ticks++; else if (ticks > 5) landed = true; } });
  const hExp = v0 * v0 / (2 * g), tExp = (v0 / g) * (1 + 1 / Math.sqrt(FM)), t = ticks / 60;
  return { ok: Math.abs(apex - hExp) / hExp < 0.05 && Math.abs(t - tExp) / tExp < 0.05, msg: `정점 ${apex.toFixed(3)}m (이론 ${hExp.toFixed(3)}), 체공 ${t.toFixed(3)}s (이론 ${tExp.toFixed(3)})` };
});
await test('띄우기 후 체공: 띄운 상대는 절반 중력으로 떠 있다 (9.81×1.8×0.5 m/s²)', () => {
  const [a, v] = T.duel('kickboxing'); const ys = [];
  T.run(T.seq(['J', 'K', 'J'], 14), {}, 90, () => { if (v.state === 'launched') ys.push(v.vel.y); });
  // finite difference of vertical velocity while airborne (excluding hit frames)
  const acc = []; for (let i = 1; i < ys.length; i++) { const d = (ys[i] - ys[i - 1]) * 60; if (d < 0 && d > -30) acc.push(-d); }
  const avg = acc.reduce((s, x) => s + x, 0) / Math.max(1, acc.length);
  return { ok: acc.length >= 8 && Math.abs(avg - 9.81 * 1.8 * 0.5) < 0.4, msg: `측정 가속도 ${avg.toFixed(2)} m/s² (${acc.length}프레임)` };
});

// ---------------- hit feel
await test('타격감: 히트스톱(슬로우) 없음 — 맞아도 때려도 멈추지 않고, 무거운 기술일수록 흔들림만 커진다', () => {
  const out = {}; let frozen = 0;
  for (const [name, keys] of [['잽', ['J']], ['미들킥', ['J', 'J', 'K']], ['하이킥', ['K', 'K']]]) {
    const [a, v] = T.duel('kickboxing'); let maxF = 0, lastMove = '';
    T.run(T.seq(keys, 14), {}, 120, () => { frozen = Math.max(frozen, a.freeze, v.freeze); if (a.move) lastMove = a.move.id; if (a.hitT > maxF && (lastMove === { 잽: 'kb_jab', 미들킥: 'kb_mid', 하이킥: 'kb_high' }[name])) maxF = a.hitT; });
    out[name] = maxF;
  }
  return { ok: frozen === 0 && out['잽'] > 0 && out['잽'] < out['미들킥'] && out['미들킥'] < out['하이킥'], msg: `정지 ${frozen}F / 흔들림 ` + Object.entries(out).map(([k, v]) => `${k} ${v}`).join(' < ') };
});
await test('비전서 개성: 태권도 정권은 철골권 직권보다 3배 빠르고 가볍다 · 전용 대기 자세', () => {
  const r = {};
  for (const st of ['taekwondo', 'ironbone']) {
    const [a, v] = T.duel(st); const hp = v.hp; let hitAt = -1, t = 0; const idle = a.curName + '>' + (a.style.anims?.Idle_Loop ?? '-');
    T.run(T.seq(['J'], 14), {}, 80, () => { t++; if (hitAt < 0 && v.hp < hp) hitAt = t; });
    r[st] = { hitAt, dmg: hp - v.hp, idle };
  }
  const tk = r.taekwondo, ib = r.ironbone;
  return { ok: tk.hitAt > 0 && ib.hitAt >= tk.hitAt * 2.5 && ib.dmg >= tk.dmg * 2 && tk.idle.includes('tk_idle') && ib.idle.includes('ib_idle'), msg: `태권도 ${tk.hitAt}F ${tk.dmg}dmg / 철골권 ${ib.hitAt}F ${ib.dmg}dmg` };
});
await test('타격감: 피격자 흔들림·번쩍임·카메라 흔들림 발생', () => {
  const [a, v] = T.duel('kickboxing'); let shake = 0, flash = 0, cam = 0;
  T.run(T.seq(['K', 'K'], 14), {}, 60, () => { shake = Math.max(shake, v.shake); flash = Math.max(flash, v.flash); cam = Math.max(cam, T.g.camShake); });
  return { ok: shake > 0 && flash > 0 && cam > 0.1, msg: `흔들림 ${shake}F, 번쩍임 ${flash}F, 카메라 ${cam.toFixed(2)}` };
});
await test('다단 히트: 원투쓰리는 판정 3개(애니메이션에서 자동 검출)', () => {
  const m = window.__moves.kb_onetwo;
  return { ok: m.hits.length === 3, msg: `판정 ${m.hits.length}개 @ ${m.hits.map((h) => h.t.toFixed(2) + 's ' + h.limb).join(', ')}` };
});

// ---------------- core rules
await test('가드는 공격을 막는다', () => { const [a, v] = T.duel(); const hp0 = v.hp; T.run((i) => ({ J: i === 0 }), { guard: true }, 40); return { ok: v.hp === hp0, msg: `HP ${hp0} → ${v.hp}` }; });
await test('잡기는 가드를 이긴다', () => { const [a, v] = T.duel(); const hp0 = v.hp; T.run((i) => ({ grab: i === 2 }), { guard: true }, 80); return { ok: v.hp < hp0, msg: `잡기 피해 ${hp0 - v.hp}` }; });
await test('반격은 공격을 이긴다', () => { const [a, v] = T.duel(); const hA = a.hp, hV = v.hp; T.run((i) => ({ J: i === 1 }), (i) => ({ counter: i === 0 }), 50); return { ok: a.hp < hA && v.hp === hV, msg: `공격자 ${hA}→${a.hp}, 반격자 ${hV}→${v.hp}` }; });
await test('공격은 잡기를 이긴다', () => { const [a, v] = T.duel(); const hA = a.hp; T.run((i) => ({ grab: i === 4 }), (i) => ({ J: i === 0 }), 50); return { ok: a.hp < hA && a.state !== 'throwing', msg: `잡기 시도자 ${hA}→${a.hp}` }; });
await test('난간 근처 강공격 → 링아웃', () => {
  const [a, v] = T.duel('taekwondo'); a.pos.set(0, 0, 7.2); v.pos.set(0, 0, 8.3);
  T.run(T.seq(['J', 'J', 'K'], 14), {}, 260); return { ok: v.state === 'out', msg: `상대 상태=${v.state}, 링아웃=${a.stats.ringouts}` };
});

// ---------------- each fighting style (비전서)
const styleTests = [
  ['킥복싱 J J J: 잽·크로스·훅 → 다운', 'kickboxing', ['J', 'J', 'J'], (a, v, s) => s.has('launched') || s.has('down')],
  ['킥복싱 J K J: 잽·로우킥·니킥 → 띄우기', 'kickboxing', ['J', 'K', 'J'], (a, v, s, maxY) => maxY > 0.45],
  ['태권도 K K K: 앞차기·돌려차기·뒤후려차기 → 다운', 'taekwondo', ['K', 'K', 'K'], (a, v, s) => s.has('down')],
  ['태권도 K J: 나래차기 2타 띄우기', 'taekwondo', ['K', 'J'], (a, v, s, maxY) => maxY > 0.45],
  ['유술 J J U: 타격 후 잡기 캔슬 → 던지기', 'jujutsu', ['J', 'J', 'grab'], (a, v, s) => s.has('thrown')],
  ['인술 J J J K: 수도 3연타·선풍각 → 다운', 'ninjutsu', ['J', 'J', 'J', 'K'], (a, v, s) => s.has('down') || s.has('launched')],
  ['연막류 J J K: 독 + 다운', 'smoke', ['J', 'J', 'K'], (a, v, s) => (s.has('down') || s.has('launched')) && a.stats.dmg > 140],
  ['자유격투 K K: 니킥·플라잉 니 → 띄우기', 'freefight', ['K', 'K'], (a, v, s, maxY) => maxY > 0.45],
];
for (const [name, style, keys, check] of styleTests) {
  await test(name, ([style, keys, checkSrc]) => {
    const check = eval(checkSrc); const [a, v] = T.duel(style); const hp0 = v.hp; const s = new Set(); let maxY = 0;
    T.run(T.seq(keys, 17), {}, 170, () => { s.add(v.state); maxY = Math.max(maxY, v.pos.y); });
    return { ok: !!check(a, v, s, maxY) && v.hp < hp0, msg: `피해 ${hp0 - v.hp} (+독 포함), 최대 높이 ${maxY.toFixed(2)}m, 상태 ${[...s].filter((x) => x !== 'idle').join('→')}` };
  }, [style, keys, check.toString()]);
}
await test('유술 반격 → 관절 던지기', () => { const [a, v] = T.duel('jujutsu'); const s = new Set(); T.run((i) => ({ counter: i === 0 }), (i) => ({ J: i === 1 }), 80, () => s.add(v.state)); return { ok: s.has('thrown'), msg: `상대 상태 ${[...s].join('→')}` }; });
await test('인술 2단 점프: 공중에서 한 번 더 점프', () => { const [a] = T.duel('ninjutsu'); let apex = 0; T.run((i) => ({ jump: i === 0 || i === 20 }), {}, 140, () => (apex = Math.max(apex, a.pos.y))); return { ok: apex > 1.6, msg: `최고 높이 ${apex.toFixed(2)}m (1단 점프 이론 1.22m)` }; });
await test('철골권 C X(홀드): 기 모은 붕권은 가드를 뚫고, 짧게 누르면 막힌다', () => {
  const run = (hold) => {
    const [a, v] = T.duel('ironbone'); const hp0 = v.hp; let maxCharge = 0;
    T.run((i) => ({ K: i === 0, J: i === 14, Jh: i >= 14 && i < 14 + hold }), { guard: true }, 160, () => { maxCharge = Math.max(maxCharge, a.chargeT); });
    return { dmg: hp0 - v.hp, maxCharge };
  };
  const full = run(60), tap = run(3);
  return { ok: full.dmg > 80 && full.maxCharge >= 20 && tap.dmg === 0, msg: `홀드: 피해 ${full.dmg} (충전 ${full.maxCharge}F) / 짧게: 피해 ${tap.dmg}` };
});
await test('공중 콤보: 띄우기 → 정권 → 끊치 2회 → 두번·세번지르기 → 옆차기 (8타)', () => {
  const [a, v] = T.duel('taekwondo'); const at = [0, 17, 80, 98, 104, 112, 122]; const keys = ['K','J','J','J','J','J','K']; const log = [];
  T.run((i) => { const k = at.indexOf(i); return k >= 0 ? { [keys[k]]: true } : {}; }, {}, 260, () => { log.push((a.move?.id ?? a.state) + ':' + a.combo + ':' + v.state + ':' + v.pos.y.toFixed(1)); });
  
  return { ok: a.stats.maxCombo >= 8, msg: `최대 콤보 ${a.stats.maxCombo}타` + (typeof L === "string" ? L : "") };
});
await test('끊치: 늦게 누른 X는 다음 기술이 아니라 첫 주먹을 다시 낸다', () => {
  const [a, v] = T.duel('taekwondo'); const ids = [];
  T.run((i) => ({ J: i === 0 || i === 44 }), {}, 90, () => { if (a.move && ids[ids.length - 1] !== a.move.id + a.stateT) { if (a.stateT === 0) ids.push(a.move.id); } });
  return { ok: ids.length >= 2 && ids[1] === 'tk_punch', msg: ids.join(' → ') };
});
await test('구르기: 다운 중 방향키 → 무적 구르기', () => {
  const [a] = T.duel('taekwondo'); a.setState('down'); a.play('fall_face', { loop: false }); let rolled = false, inv = 0; const z0 = a.pos.z;
  T.run((i) => (i > 16 && i < 20 ? { mz: -1 } : {}), {}, 60, () => { if (a.state === 'roll') { rolled = true; inv = Math.max(inv, a.invuln); } });
  return { ok: rolled && inv > 20 && Math.abs(a.pos.z - z0) > 1, msg: `구르기=${rolled}, 무적 ${inv}F, 이동 ${Math.abs(a.pos.z - z0).toFixed(2)}m` };
});
await test('공통 2단 점프: 킥복싱도 공중에서 한 번 더 점프', () => { const [a] = T.duel('kickboxing'); let apex = 0; T.run((i) => ({ jump: i === 0 || i === 18 }), {}, 140, () => (apex = Math.max(apex, a.pos.y))); return { ok: apex > 1.6, msg: `최고 높이 ${apex.toFixed(2)}m` }; });
await test('기상 공격: 다운 중 C(발)로 일어나며 공격', () => {
  const [a, v] = T.duel('kickboxing', 'kickboxing', 1.0); a.setState('down'); a.play('fall_face', { loop: false }); const hp0 = v.hp; let used = false;
  T.run((i) => ({ K: i === 18 }), {}, 70, () => { if (a.move?.id === 'wakeup') used = true; });
  return { ok: used && v.hp < hp0, msg: `기상공격=${used}, 상대 피해 ${hp0 - v.hp}` };
});
await test('대시: 같은 방향키 두 번 → 대시, 손을 떼면 해제', () => {
  const g = T.g; const read = (frames) => frames.map((ks) => { g.keys.clear(); ks.forEach((k) => g.keys.add(k)); g.tickN++; return g.readPlayer().dash; });
  const single = read([['ArrowRight'], ['ArrowRight'], ['ArrowRight'], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]);
  const dbl = read([['ArrowRight'], [], [], ['ArrowRight'], ['ArrowRight'], ['ArrowRight'], [], []]);
  const ok = !single.some(Boolean) && dbl[3] && dbl[5] && !dbl[7];
  return { ok, msg: `한 번=${single.some(Boolean)}, 두 번=${dbl.map(Number).join('')}` };
});
await test('키 설정: X 손 · C 발 · Z+X 잡기 · Z+C 반격 · X+C 회피 · Z 가드', () => {
  const g = T.g; const read = (frames) => { const out = []; for (const ks of frames) { g.keys.clear(); ks.forEach((k) => g.keys.add(k)); g.tickN++; out.push(g.readPlayer()); } return out; };
  const any = (cs, f) => cs.some(f);
  const x = read([['KeyX'], ['KeyX'], ['KeyX'], ['KeyX'], [], []]);
  const zx = read([['KeyZ'], ['KeyZ', 'KeyX'], ['KeyZ', 'KeyX'], [], [], []]);
  const zc = read([['KeyC'], ['KeyZ', 'KeyC'], [], [], []]);
  const xc = read([['KeyX', 'KeyC'], [], [], []]);
  const z = read([['KeyZ'], ['KeyZ']]);
  const ok = any(x, (c) => c.J) && !any(x, (c) => c.K || c.grab) && any(zx, (c) => c.grab) && !any(zx, (c) => c.J) && any(zc, (c) => c.counter) && !any(zc, (c) => c.K)
    && any(xc, (c) => c.J && c.K) && z.every((c) => c.guard);
  return { ok, msg: ok ? '모든 조합 정상' : JSON.stringify({ x: x.map((c) => +c.J), zx: zx.map((c) => +c.grab), zc: zc.map((c) => +c.counter), xc: xc.map((c) => +(c.J && c.K)) }) };
});
await test('난무: V 연타 → 돌진 후 10연타, 마지막 타 다운', () => {
  const [a, v] = T.duel('taekwondo', 'kickboxing', 3); const hp0 = v.hp; const ids = []; const st = new Set();
  T.run((i) => ({ S: i % 5 === 0 }), {}, 420, () => { if (a.move && ids[ids.length - 1] !== a.move.id) ids.push(a.move.id); st.add(v.state); });
  return { ok: ids.length === 10 && ids[9] === 'nm_9' && a.stats.maxCombo >= 10 && (st.has('down') || st.has('launched')) && hp0 - v.hp > 250, msg: `${ids.length}타, 최대 콤보 ${a.stats.maxCombo}, 피해 ${hp0 - v.hp}, 상태 ${[...st].filter((x) => x !== 'idle').join('→')}` };
});
await test('난무: 판당 1회 — 두 번째 V는 무효, 다음 라운드에 충전', () => {
  const [a, v] = T.duel('kickboxing', 'kickboxing', 3); T.run((i) => ({ S: i % 5 === 0 }), {}, 420); const left = a.nanmu;
  for (const f of T.g.fighters) { f.setState('idle'); f.vel.set(0, 0, 0); } a.pos.set(0, 0, 0); v.pos.set(0, 0, 3); a.move = null;
  let att = false; T.run((i) => ({ S: i % 5 === 0 }), {}, 60, () => { if (a.state === 'attack') att = true; });
  T.g.startRound(); const refill = T.g.fighters[0].nanmu;
  return { ok: left === 0 && !att && refill === 1, msg: `사용 후 ${left}회, 재시도 공격=${att}, 새 라운드 ${refill}회` };
});
await test('난무: 헛치면 돌진 1타로 끝난다', () => {
  const [a, v] = T.duel('ninjutsu', 'kickboxing', 8); v.pos.set(8, 0, -8); const ids = [];
  T.run((i) => ({ S: i % 5 === 0 }), {}, 120, () => { if (a.move && ids[ids.length - 1] !== a.move.id) ids.push(a.move.id); });
  return { ok: ids.join() === 'nm_0', msg: `발동 ${ids.join(',')}` };
});
for (const [k, id, nm] of [['J', 'dash_armor', '아머 어택'], ['K', 'dash_fly', '날라차기']]) {
  await test(`대시 ${k === 'J' ? 'X' : 'C'} ${nm}: 한 방에 다운 + 이후 달리기 해제(걷기)`, ([k, id]) => {
    const [a, v] = T.duel('kickboxing', 'kickboxing', 3.2); const hp0 = v.hp; const st = new Set(); let got = ''; let sp = 0;
    T.run((i) => ({ mz: 1, dash: true, [k]: i === 12 }), {}, 150, (i) => { if (a.move) got = a.move.id; st.add(v.state); if (i > 100) sp = Math.max(sp, Math.hypot(a.vel.x, a.vel.z)); });
    return { ok: got === id && (st.has('down') || st.has('launched')) && v.hp < hp0 && a.dashLock && sp < 5, msg: `${got}, 피해 ${hp0 - v.hp}, 상태 ${[...st].filter((x) => x !== 'idle').join('→')}, 이후 속도 ${sp.toFixed(1)}` };
  }, [k, id]);
}
await test('아머 어택: 맞아도 멈추지 않음 (슈퍼아머)', () => {
  const [a, v] = T.duel('freefight', 'kickboxing', 3.2); const hpV = v.hp, hpA = a.hp;
  T.run((i) => ({ mz: 1, dash: true, J: i === 12 }), (i) => ({ J: i === 16 || i === 22 || i === 28 }), 120);
  return { ok: v.hp < hpV, msg: `공격자 ${hpA}→${a.hp}, 상대 피해 ${hpV - v.hp}` };
});
await test('2단 점프: 덤블링(앞구르기 회전) 후 자세 복귀', () => {
  const [a] = T.duel('kickboxing', 'kickboxing', 9); let mx = 0; T.run((i) => ({ jump: i === 0 || i === 16 }), {}, 100, () => { mx = Math.max(mx, a.model.rotation.x); });
  return { ok: mx > 5.5 && a.model.rotation.x === 0 && a.model.position.z === 0, msg: `최대 회전 ${(mx * 57.3).toFixed(0)}°, 착지 후 ${a.model.rotation.x}` };
});
await test('변신: 정령검 공격', () => { const [a, v] = T.duel(); a.gauge = 100; T.run((i) => ({ transform: i === 0 }), {}, 60); const tr = a.transformT > 0; const hp0 = v.hp; T.run((i) => ({ J: i === 0 }), {}, 40); return { ok: tr && v.hp < hp0, msg: `변신=${tr}, 피해 ${hp0 - v.hp}` }; });
await test('점프킥: 공중에서 맞힌다', () => { const [a, v] = T.duel('kickboxing', 'kickboxing', 1.6); const hp0 = v.hp; T.run((i) => ({ jump: i === 0, K: i === 10, mz: i < 20 ? 0.5 : 0 }), {}, 90); return { ok: v.hp < hp0, msg: `피해 ${hp0 - v.hp}` }; });

// ---------------- AI
for (const lvl of ['easy', 'normal', 'hard']) {
  await test(`AI(${lvl}) 6인 난투 25초 (비전서 혼합)`, (lvl) => {
    const g = T.g; g.manual = true; g.match = { ai: 5, difficulty: lvl, wins: 2, practice: false }; g.startMatch(); g.player.hp = g.player.maxHp = 1e9;
    const dec = {};
    for (let i = 0; i < 25 * 60; i++) { g.tick(); for (const c of g.ai.values()) { const k = c.lastDecision.split(':')[0] + (c.lastDecision.startsWith('special') ? ':' + c.lastDecision.split(':')[1] : ''); dec[k] = (dec[k] || 0) + 0; } }
    for (const c of g.ai.values()) dec[c.lastDecision] = (dec[c.lastDecision] || 0) + 1;
    const dmg = g.fighters.filter((f) => !f.isPlayer).reduce((s, f) => s + f.stats.dmg, 0);
    const maxCombo = Math.max(...g.fighters.map((f) => f.stats.maxCombo));
    return { ok: dmg > 300, msg: `AI 총 피해 ${dmg}, 최대 콤보 ${maxCombo}, 마지막 판단: ${Object.keys(dec).join(', ')}` };
  }, lvl);
}

console.log('\n=== 테스트 결과 ===');
for (const [s, n, m] of results) console.log(`${s === 'PASS' ? '✔' : '✘'} ${s}  ${n}  — ${m}`);
console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} 통과`);
if (errors.length) console.log('페이지 오류:', [...new Set(errors)].slice(0, 8));
await b.close();
