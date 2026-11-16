def must(s, a, b):
    assert a in s, a[:80]; return s.replace(a, b, 1)
p = 'src/fighter.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "    this.steered = this.state === 'attack' && sl > 0.3 && !m.nanmu && !m.special;\n    if (this.steered) {", "    // the player aims by hand: no strike turns toward an enemy by itself (난무 and specials still seek their target)\n    this.steered = this.isPlayer && !world.autopilot && !m.nanmu && !m.special;\n    if (this.steered && !(this.state === 'attack' && sl > 0.3)) { /* keeps pointing where it already points */ }\n    else if (this.steered) {")
s = must(s, "      if (this.steered) { const f = this.forward(); this.vel.x = f.x * 1.6; this.vel.z = f.z * 1.6; } // aimed by hand: step where it points, no homing",
"""      if (this.steered) { // aimed by hand: step where it points, never turn; only stop short of someone already straight ahead
        const f = this.forward(); let sp = 1.6;
        if (tgt) { const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length() || 1; if ((d.x * f.x + d.z * f.z) / dist > 0.7) sp = dist > want ? Math.min(4.5, (dist - want) * 8) : 0; }
        this.vel.x = f.x * sp; this.vel.z = f.z * sp;
      }""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'src/practice.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "'공격 중 방향키: 다음 공격을 최대 45° 꺾는다'", "'공격은 바라보는 방향으로 나간다 (자동 조준 없음)', '공격 중 방향키: 다음 공격을 최대 45° 꺾는다'")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'tools/test-rules.mjs'; s = open(p, encoding='utf-8').read()
s = must(s, "ok('첫 타는 여전히 가까운 적을 본다', r.d < 0.2, `오차 ${deg(r.d)}°`);", "ok('첫 타도 자동으로 적을 보지 않는다', Math.abs(r.yaw - 1.2) < 1e-6 && r.dmg === 0, `yaw ${deg(r.yaw)}°, 피해 ${r.dmg}`);")
s = must(s, "a.yaw = 1.2; T.run((i) => ({ J: i === 0 }), {}, 6); let d", "a.yaw = 1.2; const hp0 = v.hp; T.run((i) => ({ J: i === 0 }), {}, 40); let d")
s = must(s, "return { d: Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) }; });", "return { d: Math.abs(Math.atan2(Math.sin(d), Math.cos(d))), yaw: a.yaw, dmg: hp0 - v.hp }; });")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
