import re
def rw(p, f):
    s = open(p, encoding='utf-8').read(); s2 = f(s); open(p, 'w', encoding='utf-8', newline='\n').write(s2)
def must(s, a, b):
    assert s.count(a) >= 1, a[:70]; return s.replace(a, b)

def moves(s):
    s = must(s, "export type Limb = 'hand_l' | 'hand_r' | 'foot_l' | 'foot_r';", "export type Limb = 'hand_l' | 'hand_r' | 'foot_l' | 'foot_r' | 'calf_l' | 'calf_r' | 'lowerarm_l' | 'lowerarm_r' | 'upperarm_l' | 'upperarm_r';")
    s = must(s, "// Hit timing is detected from the animation itself (when the striking limb is furthest out),\n// so visuals and hit frames always match. Multi-hit moves get one hit window per detected peak.", "// Hit timing comes from the animation itself (every clip marks its impact frames), so visuals and hit frames\n// always match. Clips are authored at game speed: speed 1 is the intended weight.")
    rm = {'ib_palm': 'uppercut', 'ib_burst': 'charge_punch', 'ib_elbow': 'elbow_drop', 'ib_bash': 'Shield_Dash_RM', 'ib_k3': 'stomp_kick', 'jumppunch': 'air_punch', 'jumpkick': 'air_kick', 'ff_power': 'charge_punch'}
    out = []
    for line in s.split('\n'):
        m = re.search(r"^\s+(\w+): M\(\{", line)
        if m:
            id = m.group(1)
            sp = 1.2 if id == 'nm_0' else 1.1 if id == 'nm_9' else 1.45 if id.startswith('nm_') else 1.6 if id == 'nj_blink' else 1
            line = re.sub(r"speed: [\d.]+", "speed: %s" % sp, line)
            if id in rm: line = re.sub(r"anim: '\w+'", "anim: '%s'" % rm[id], line)
        out.append(line)
    return '\n'.join(out)
rw('src/moves.ts', moves)

def fighter(s):
    s = must(s, "import { MOVES, MoveDef, STYLES, Limb } from './moves';", "import { MOVES, MoveDef, STYLES, Limb } from './moves';\nimport { META } from './anims';")
    s = must(s, "['pelvis', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'spine_03', 'index_01_r', 'pinky_01_r']", "['pelvis', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'calf_l', 'calf_r', 'lowerarm_l', 'lowerarm_r', 'upperarm_l', 'upperarm_r', 'spine_03', 'index_01_r', 'pinky_01_r', 'tail']")
    s = must(s, "  limbPos(limb: Limb, out = new THREE.Vector3()) { return this.bones[limb].getWorldPosition(out); }",
"""  /** world position of a striking point: knuckles, ball of the foot, or the knee / elbow / shoulder joint itself */
  limbPos(limb: Limb, out = new THREE.Vector3()) {
    const b = this.bones[limb]; b.updateWorldMatrix(true, false);
    if (limb.startsWith('hand')) out.set(0, -0.07, 0); else if (limb.startsWith('foot')) out.set(0, -0.03, 0.07); else out.set(0, 0, 0);
    return out.applyMatrix4(b.matrixWorld);
  }""")
    s = must(s, "hi.y = this.pos.y + 1.45;", "hi.y = this.pos.y + 1.2;")
    s = must(s, "a.y = Math.max(this.pos.y + 0.12, p.y - 0.65);\n    h.y += 0.12; // top of the head", "a.y = Math.max(this.pos.y + 0.12, p.y - 0.4);\n    h.y += 0.3; // centre of the (big) head")
    s = must(s, "const holdAt = first.from * 0.5; // arm cocked back", "const holdAt = META[m.anim]?.wind ?? first.from * 0.5; // arm cocked back")
    a = s.index("    // weight: load up slowly"); b = s.index("    // movement during the move"); s = s[:a] + s[b:]
    s = must(s, "const want = first.limb.startsWith('foot') ? 1.05 : 0.8;", "const want = first.limb.startsWith('foot') ? 0.88 : first.limb.startsWith('hand') ? 0.74 : 0.62;")
    s = must(s, "Math.min(1.1, this.stateT * 0.05) : Math.min(0.6, this.stateT * 0.02)", "Math.min(0.8, this.stateT * 0.04) : Math.min(0.45, this.stateT * 0.016)")
    s = must(s, "    this.play('Hit_Knockback', { loop: false, speed: 0.75, fade: 0.04 });", "    this.play(face ? 'Hit_Knockface' : 'Hit_Knockback', { loop: false, speed: 0.8, fade: 0.04 });")
    a = s.index("    // air techniques: the mocap clip"); b = s.index("    // double jump: forward somersault")
    s = s[:a] + """    this.model.position.y *= 0.7;
    // struck: the body squashes for a few frames, then springs back
    if (this.squash > 0) { const k = Math.sin((this.squash / 8) * Math.PI) * 0.16; this.model.scale.set(1 + k * 0.8, 1 - k, 1 + k * 0.8); if (this.freeze <= 0) this.squash--; } else this.model.scale.set(1, 1, 1);
    // ponytail: a damped spring dragged by the body's motion
    const tail = this.bones.tail;
    if (tail) {
      const f = this.forward(PQ); const want = THREE.MathUtils.clamp((this.vel.x * f.x + this.vel.z * f.z) * 0.09 - this.vel.y * 0.06, -0.5, 1.1);
      this.tailV += (want - this.tailA) * 0.12; this.tailV *= 0.8; this.tailA += this.tailV; tail.rotation.x = this.tailA;
    }
""" + s[b:]
    s = must(s, "piv = 0.85;", "piv = 0.6;")
    s = must(s, "  nanmu = 1; dashLock = false; tumbleT = -1;", "  nanmu = 1; dashLock = false; tumbleT = -1; squash = 0; tailA = 0; tailV = 0;")
    return s
rw('src/fighter.ts', fighter)

def ui(s):
    s = must(s, "head.y += 0.45;", "head.y += 0.72;"); s = must(s, "head.y += 0.7;", "head.y += 0.9;"); return s
rw('src/ui.ts', ui)

def game(s):
    s = must(s, "import { loadAssets, cloneCharacter, Assets } from './assets';", "import { loadAssets, Assets } from './assets';\nimport { META } from './anims';")
    s = must(s, "buildChibi(opts.body === 'female' ? this.A.female : this.A.male, lookFor(", "buildChibi(lookFor(")
    s = must(s, "this.locoSpeed = analyzeMoves(this.A);", "this.locoSpeed = analyzeMoves();")
    s = must(s, "const HITSTOP = [0, 6, 9, 13];", "const HITSTOP = [0, 6, 10, 15];")
    s = must(s, "cam.position.set(head.x + 0.35, head.y + 0.25, head.z + 1.5); cam.lookAt(head.x, head.y + 0.16, head.z);", "cam.position.set(head.x + 0.4, head.y + 0.36, head.z + 1.75); cam.lookAt(head.x, head.y + 0.25, head.z);")
    s = must(s, "at.y > v.pos.y + 1.35 ? 'Hit_Head'", "at.y > v.pos.y + 0.85 ? 'Hit_Head'")
    s = must(s, "v.flashColor.setRGB(1, 1, 1); v.flash = 6;", "v.flashColor.setRGB(1, 1, 1); v.flash = 6; v.squash = 8;")
    s = s.replace("new THREE.Vector3(0, 1, 0)", "new THREE.Vector3(0, 0.7, 0)").replace("new THREE.Vector3(0, 1.1, 0)", "new THREE.Vector3(0, 0.75, 0)").replace("new THREE.Vector3(0, 1.2, 0)", "new THREE.Vector3(0, 0.85, 0)").replace("new THREE.Vector3(0, 0.9, 0)", "new THREE.Vector3(0, 0.65, 0)").replace("setY(v.pos.y + 1)", "setY(v.pos.y + 0.7)")
    s = must(s, "fw.x * 0.2, 1.4, f.pos.z", "fw.x * 0.2, f.pos.y + 1.0, f.pos.z")
    s = must(s, "  trail(f: Fighter) {\n", "  trail(f: Fighter) {\n    if (f.state === 'move' && f.ctrl.dash && f.grounded && (this.tickN + f.id * 3) % 9 === 0 && Math.hypot(f.vel.x, f.vel.z) > 5) this.fx.dust(f.pos, 0.28); // sprint dust\n")
    a = s.index("/**\n * Per move: find the striking limb"); b = s.index("let game: Game;")
    s = s[:a] + """/** Per move: take the impact frames the clip was authored with and open a short hit window around each. */
function analyzeMoves(): Record<string, number> {
  for (const m of Object.values(MOVES)) {
    const meta = META[m.anim]; if (!meta) { console.warn('no anim for move', m.id, m.anim); m.hits = []; continue; }
    const hits: HitPoint[] = meta.hits.map((h) => ({ limb: h.limb, t: h.t, from: Math.max(0, h.t - 0.035), to: h.t + 0.07 }));
    // rush techniques are active for the whole dash, so a fast lunge cannot pass through a target
    if ((m.lunge ?? 0) >= 6 && hits.length === 1) hits[0].from = Math.min(hits[0].from, 0.06);
    m.hits = hits; m.limb = hits[0]?.limb; m.peak = hits[hits.length - 1]?.t ?? 0.2; m.activeFrom = hits[0]?.from; m.activeTo = hits[hits.length - 1]?.to;
  }
  const loco: Record<string, number> = {};
  for (const [n, meta] of Object.entries(META)) if (meta.loco) loco[n] = meta.loco;
  return loco;
}

""" + s[b:]
    return s
rw('src/game.ts', game)
print('ok')
