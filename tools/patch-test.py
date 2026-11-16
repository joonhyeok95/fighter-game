p = 'tools/test.mjs'
s = open(p, encoding='utf-8').read()
a = s.index("await test('타격감: 무거운 기술일수록 히트스톱이 길다")
b = s.index("await test('타격감: 피격자 흔들림")
new = """await test('타격감: 히트스톱(슬로우) 없음 — 맞아도 때려도 멈추지 않고, 무거운 기술일수록 흔들림만 커진다', () => {
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
"""
open(p, 'w', encoding='utf-8', newline='\n').write(s[:a] + new + s[b:])
