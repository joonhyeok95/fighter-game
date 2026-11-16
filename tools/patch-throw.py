OUT = {}
def must(s, a, b):
    assert a in s, a[:90]; return s.replace(a, b, 1)

p = 'src/fighter.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "throwKind: 'normal' | 'hip' | 'counter' = 'normal';", "throwKind: 'normal' | 'over' | 'hip' | 'counter' = 'normal';\n  /** the current attack was aimed with the stick, so it does not auto-face a target */\n  steered = false;\n  /** over-the-shoulder throws: the opponent is carried up and dropped behind */\n  get overThrow() { return this.throwKind === 'hip' || this.throwKind === 'over'; }")
s = must(s, "const lift = this.throwKind === 'hip' ? Math.min(0.8, this.stateT * 0.04)", "const lift = this.overThrow ? Math.min(0.8, this.stateT * 0.04)")
s = must(s, "if (this.stateT === (this.throwKind === 'hip' ? 22 : 26)) world.releaseThrow(this, v);", "if (this.stateT === (this.overThrow ? 22 : 26)) world.releaseThrow(this, v);")
s = must(s, """    const tgt = world.nearestEnemy(this, 4);
    if (tgt && m.special !== 'teleport') this.faceToward(tgt.pos, 1);
    this.setState('attack');""", """    // a follow-up attack can be steered: holding a direction turns it up to 45 degrees from where the last one pointed
    const sl = Math.hypot(this.ctrl.mx, this.ctrl.mz);
    this.steered = this.state === 'attack' && sl > 0.3 && !m.nanmu && !m.special;
    if (this.steered) {
      let diff = Math.atan2(this.ctrl.mx, this.ctrl.mz) - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += Math.max(-STEER_MAX, Math.min(STEER_MAX, diff));
    } else {
      const tgt = world.nearestEnemy(this, 4);
      if (tgt && m.special !== 'teleport') this.faceToward(tgt.pos, 1);
    }
    this.setState('attack');""")
s = must(s, """      if (tgt) {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length();
        this.faceToward(tgt.pos, 0.2);""", """      if (this.steered) { const f = this.forward(); this.vel.x = f.x * 1.6; this.vel.z = f.z * 1.6; } // aimed by hand: step where it points, no homing
      else if (tgt) {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length();
        this.faceToward(tgt.pos, 0.2);""")
s = must(s, "export const emptyCtrl", "/** how far one follow-up attack can be turned with the stick */\nexport const STEER_MAX = Math.PI / 4;\nexport const emptyCtrl")
s = must(s, "      case 'guard': {\n", "      case 'guard': {\n        // a guard is committed to the direction it was raised in: to face elsewhere, drop it, turn, and guard again\n")
OUT[p] = s

p = 'src/game.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "startThrow(f: Fighter, v: Fighter, kind: 'normal' | 'hip' | 'counter') {", "startThrow(f: Fighter, v: Fighter, kind: 'normal' | 'over' | 'hip' | 'counter') {\n    if (kind === 'normal' && !f.style.comboGrab) kind = 'over'; // the basic grab is a shoulder throw: the opponent goes over and lands behind")
s = must(s, "f.play(kind === 'hip' ? 'pull_throw' : 'OverhandThrow', { speed: kind === 'hip' ? 1.3 : 1.5, loop: false });", "const over = kind === 'hip' || kind === 'over';\n    f.play(over ? 'pull_throw' : 'OverhandThrow', { speed: over ? 1.3 : 1.5, loop: false });")
s = must(s, "    else if (f.style.comboGrab) v.vel.set(fw.x * 0.9", "    else if (kind === 'over') { v.pos.set(f.pos.x + fw.x * 0.1, f.pos.y + 1.05, f.pos.z + fw.z * 0.1); v.vel.set(-fw.x * 5.2 * KB_DOWN, 1.6 * VS, -fw.z * 5.2 * KB_DOWN); } // 엎어치기: over the shoulder and away behind\n    else if (f.style.comboGrab) v.vel.set(fw.x * 0.9")
s = must(s, "v.launch(kind !== 'hip'); v.freeze = 0;", "v.launch(kind !== 'hip' && kind !== 'over'); v.freeze = 0;")
s = must(s, "this.fx.hit(v.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 'heavy', fw, 3);\n  }", "this.fx.hit(v.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 'heavy', kind === 'over' ? fw.clone().negate() : fw, 3);\n  }")
s = must(s, "cmd ? '업어치기!' : combo ? '잡기 캔슬!' : '잡기!'", "cmd ? '업어치기!' : combo ? '잡기 캔슬!' : f.style.comboGrab ? '잡기!' : '엎어치기!'")
OUT[p] = s

p = 'src/practice.ts'; s = open(p, encoding='utf-8').read()
a = s.index("  if (g.dummy === 'guard') {"); b = s.index("  // attack: walk into range")
s = s[:a] + """  if (g.dummy === 'guard') {
    // come to the player and guard facing them. A raised guard cannot turn, so when the player steps
    // around it (or away) the guard is dropped, the partner turns / follows, and guards again.
    let off = Math.atan2(dx, dz) - f.yaw; off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
    if (f.state === 'guard' || f.state === 'blockstun') { c.guard = d < 1.9 && off < 0.8; return c; }
    if (!free) return c;
    if (d > 1.25) { c.mx = dx / d; c.mz = dz / d; return c; }
    if (off > 0.2) { f.faceToward(P.pos, 0.35); return c; }
    c.guard = true; return c;
  }
""" + s[b:]
s = must(s, "['guard', '가드', '계속 막고 있는다 — Z+X 잡기 연습']", "['guard', '가드', '다가와서 계속 막는다 — Z+X 잡기(엎어치기) 연습']")
s = must(s, "'Z+X 잡기 · Z+C 반격 · X+C 회피'", "'Z+X 잡기(엎어치기: 뒤로 던짐) · Z+C 반격 · X+C 회피', '가드 중에는 방향을 바꿀 수 없다 (풀고 → 돌고 → 다시 가드)', '공격 중 방향키: 다음 공격을 최대 45° 꺾는다'")
OUT[p] = s

p = 'src/ui.ts'; s = open(p, encoding='utf-8').read()
s = must(s, """      const el = h(`<div class="screen select">${sheet('FIGHTER', '캐릭터 · 비전서', `
""", """      const el = h(`<div class="screen select">${sheet('FIGHTER', '캐릭터 · 비전서', `
        ${g.match.practice ? '<div class="field"><label>맵</label><div class="seg wrap" id="pmap"></div></div>' : ''}
""")
s = must(s, "      const body = el.querySelector('#body')!;", "      const pm = el.querySelector('#pmap');\n      if (pm) for (const m of Object.values(MAPS)) { const s2 = h(`<span class=\"${MAP.cur.id === m.id ? 'on' : ''}\">${m.name}</span>`); s2.onclick = () => { click(); g.setMap(m.id); g.refreshSelect(); this.select(); }; pm.append(s2); }\n      const body = el.querySelector('#body')!;")
s = must(s, "<li>X+C 회피기(라운드당 2회) · Z+X 잡기 ·", "<li>X+C 회피기(라운드당 2회) · Z+X 잡기(엎어치기: 뒤로 던짐) ·")
OUT[p] = s

p = 'src/style.css'; s = open(p, encoding='utf-8').read()
s += "\n.seg.wrap { flex-wrap: wrap; row-gap: 6px; }\n"
OUT[p] = s
for p, s in OUT.items(): open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
