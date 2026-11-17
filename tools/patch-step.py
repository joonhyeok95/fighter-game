import re
def must(s, a, b):
    assert a in s, a[:80]; return s.replace(a, b, 1)
p = 'src/fighter.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "    if (m.lunge && t < lastTo) {", """    if (m.step && this.grounded && t < lastTo) {
      // advancing strike: walks the attack forward, but pulls up at striking distance instead of running through the target
      const f = this.forward(); let sp = m.step; const tgt = world.nearestEnemy(this, 3);
      if (tgt && first) {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length() || 1; const want = first.limb.startsWith('foot') ? 0.92 : 0.76;
        if ((d.x * f.x + d.z * f.z) / dist > 0.6) sp = dist > want ? Math.min(m.step, (dist - want) * 8) : 0;
      }
      this.vel.x = f.x * sp; this.vel.z = f.z * sp;
    }
    else if (m.lunge && t < lastTo) {""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'src/moves.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "reach?: number; lunge?: number;", "reach?: number; lunge?: number; /** forward travel (m/s) that stops at striking distance */ step?: number;")
a = s.index("  jt_punch: M("); b = s.index("  tk_tornado: M(")
blk = s[a:b].replace('lunge:', 'step:')
blk = blk.replace("step: 1.6", "step: 2.4").replace("step: 1.2", "step: 2.2").replace("kb: [1.2, 0], reach: 0.15, step: 2.4", "kb: [2.4, 0], reach: 0.15, step: 4.2").replace("kb: [1.4, 0], reach: 0.15, step: 2.6", "kb: [2.8, 0], reach: 0.15, step: 4.4").replace("step: 2.2, weight: 3", "step: 4.0, weight: 3").replace("reach: 0.2, step: 2.6", "reach: 0.2, step: 4.4").replace("kb: [0.7, 0]", "kb: [1.4, 0]").replace("kb: [1.0, 0], step", "kb: [1.8, 0], step")
s = s[:a] + blk + s[b:]
open(p, 'w', encoding='utf-8', newline='\n').write(s)
