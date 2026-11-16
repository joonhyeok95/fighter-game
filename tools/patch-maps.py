import re
p='src/fighter.ts'; s=open(p,encoding='utf-8').read()
i=s.index("  physics(world: World) {"); j=s.index("  animate() {")
new='''  physics(world: World) {
    const p = this.pos; const map = MAP.cur; const ox = p.x, oz = p.z;
    if (this.state === 'thrown') return;
    // gravity: real acceleration, semi-implicit Euler
    if (!this.grounded) { const fm = this.vel.y < 0 && this.state === 'air' ? FALL_MUL : this.state === 'launched' && this.float ? FLOAT_MUL : 1; this.vel.y = Math.max(-MAX_FALL, this.vel.y - GRAVITY * fm * DT); if (this.state === 'launched') { this.vel.x *= 0.995; this.vel.z *= 0.995; } }
    p.addScaledVector(this.vel, DT);
    // edge of the walkable area: blocks normal movement; flying fighters go over it if the map lets them
    const flyingNow = this.state === 'launched' || this.state === 'fallout';
    const q = PQ.copy(p); const out = map.confine(q, 0.3);
    if (out && (!flyingNow || !map.confine(PO.set(ox, 0, oz), 0.25))) {
      const vOut = this.vel.x * out.x + this.vel.z * out.z;
      const passes = flyingNow && map.railH !== Infinity && (map.railH === 0 || p.y - map.floor(q.x, q.z) > map.railH * 0.6 || vOut > 6.5);
      if (!passes) {
        p.x = q.x; p.z = q.z;
        if (vOut > 0) { const k = flyingNow ? 1.5 : 1; this.vel.x -= out.x * vOut * k; this.vel.z -= out.z * vOut * k; if (flyingNow && vOut > 3) world.onRailHit(this); }
      }
    }
    const h = map.floor(p.x, p.z); const floorHere = h > -1e3;
    if (floorHere && this.grounded && this.vel.y <= 0 && Math.abs(p.y - h) <= 0.62) {
      // walking across steps: follow the ground instead of snapping
      p.y += Math.max(-0.09, Math.min(0.09, h - p.y)); this.vel.y = 0;
    } else if (floorHere && p.y <= h && this.vel.y <= 0 && p.y > h - 0.75) {
      const impact = -this.vel.y / VS; // normalised to the unscaled speeds used by thresholds/effects
      p.y = h;
      if (!this.grounded) {
        if (this.state === 'launched' && !this.bounced && impact > 4) {
          // one small ground bounce on hard landings: sells the weight of the hit
          this.bounced = true; this.vel.y = impact * 0.28 * VS; this.vel.x *= 0.6; this.vel.z *= 0.6; world.onBounce(this, impact);
        } else { this.vel.y = 0; this.grounded = true; this.bounced = false; this.float = false; world.onLand(this, impact); }
      } else this.vel.y = 0;
    } else if (floorHere && p.y < h && p.y > h - 0.75) { p.y = h; // rising into the face of a step: pop on top of it
    } else if (!floorHere && this.grounded) {
      this.grounded = false; this.invuln = 0; if (this.state !== 'fallout') { this.setState('fallout'); this.play('Hit_Knockback', { loop: false }); }
    } else if (p.y > h + 0.01) this.grounded = false;
    const below = floorHere ? p.y < h - 0.75 : p.y < map.floor(q.x, q.z);
    if (below && this.state !== 'fallout' && this.state !== 'out') {
      this.invuln = 0; this.move = undefined; this.setState('fallout'); this.play('Hit_Knockback', { loop: false });
    }
    if (p.y < -14 && this.state !== 'out') world.onRingOut(this);
    this.root.rotation.y = this.yaw;
  }

  /** keep a fighter that is standing on the stage inside the walkable area (used after body pushes) */
  clampToRail() {
    if (this.state === 'launched' || this.state === 'fallout' || this.state === 'thrown' || this.state === 'out') return;
    MAP.cur.confine(this.pos, 0.3);
  }
'''
s=s[:i]+new+s[j:]
s=s.replace("export const ARENA_R = 9;","import { MAP } from './maps';\nconst PQ = new THREE.Vector3(), PO = new THREE.Vector3();\nexport const ARENA_R = 9;",1)
a="if (this.state === 'launched' && this.pos.y > 0.05) {"; assert a in s
s=s.replace(a,"if (this.state === 'launched' && !this.grounded) {")
open(p,'w',encoding='utf-8').write(s)

p='src/ai.ts'; s=open(p,encoding='utf-8').read()
a="const nearEdge = tR > ARENA_R - 3.2 && r() < this.p.ringout;"; assert a in s
s=s.replace(a,"const edge = MAP.cur.edge(seen.x, seen.z); const nearEdge = edge.d < 3.2 && r() < this.p.ringout;")
a="if (nearEdge) { const out = tp.clone().normalize(); goal = tp.clone().addScaledVector(out, -1.1); }"; assert a in s
s=s.replace(a,"if (nearEdge) goal = tp.clone().addScaledVector(edge.out, -1.1);")
s=s.replace("import { Fighter, Ctrl, emptyCtrl, ARENA_R } from './fighter';","import { Fighter, Ctrl, emptyCtrl } from './fighter';\nimport { MAP } from './maps';")
open(p,'w',encoding='utf-8').write(s)

p='src/game.ts'; s=open(p,encoding='utf-8').read()
s,n=re.subn(r"\.pos\.clone\(\)\.setY\(([0-9.]+)\)", r".pos.clone().add(new THREE.Vector3(0, \1, 0))", s); print('setY',n)
s=s.replace("r.position.copy(f.pos).setY(0.5);","r.position.copy(f.pos); r.position.y += 0.5;")
a="import { buildStage } from './stage';"; assert a in s
s=s.replace(a,a+"\nimport { MAP, MAPS } from './maps';")
a="export interface MatchCfg { ai: number; difficulty: Difficulty; wins: number; practice: boolean }"; assert a in s
s=s.replace(a,"export interface MatchCfg { ai: number; difficulty: Difficulty; wins: number; practice: boolean; map?: string }")
a="    this.stage = buildStage(this.scene, this.A);\n"; assert a in s
s=s.replace(a,"    this.setMap(this.match.map ?? 'court');\n")
a="  setupAttract() {"; assert a in s
s=s.replace(a,'''  /** swap the arena: collision layout + scenery */
  setMap(id: string) {
    if (!MAPS[id]) id = 'court';
    if (this.stage && MAP.cur.id === id) return;
    MAP.cur = MAPS[id]; this.match.map = id;
    if (this.stage) {
      this.scene.remove(this.stage);
      this.stage.traverse((o: any) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material ?? [])) { (m as any).map?.dispose?.(); (m as any).dispose?.(); } });
    }
    this.stage = buildStage(this.scene, this.A, id);
    for (const f of this.fighters) { MAP.cur.confine(f.pos, 0.5); f.pos.y = Math.max(0, MAP.cur.floor(f.pos.x, f.pos.z)); }
  }
'''+a)
a="    const n = this.match.practice ? 1 : this.match.ai;"; assert a in s
s=s.replace(a,"    const n = this.match.practice || MAP.cur.duel ? 1 : this.match.ai;")
a="      const a = (i / n) * Math.PI * 2 + Math.PI; const r = this.match.practice ? 2 : 5;\n      f.pos.set(Math.sin(a) * r, 0, Math.cos(a) * r); f.vel.set(0, 0, 0); f.yaw = a + Math.PI;"; assert a in s
s=s.replace(a,"      const [sx, sz] = MAP.cur.spawn(i, n, this.match.practice);\n      f.pos.set(sx, MAP.cur.floor(sx, sz), sz); f.vel.set(0, 0, 0); f.yaw = Math.atan2(-sx, -sz);")
a="f.pos.set(t.pos.x + b.x, Math.max(0, t.pos.y), t.pos.z + b.z);\n      const r = Math.hypot(f.pos.x, f.pos.z); const max = ARENA_R - 0.45;\n      if (r > max) { f.pos.x *= max / r; f.pos.z *= max / r; } // keep the destination on the stage"; assert a in s
s=s.replace(a,"f.pos.set(t.pos.x + b.x, t.pos.y, t.pos.z + b.z);\n      MAP.cur.confine(f.pos, 0.45); f.pos.y = Math.max(f.pos.y, MAP.cur.floor(f.pos.x, f.pos.z)); // keep the destination on the stage")
a="f.pos.addScaledVector(fw, 3); const r = Math.hypot(f.pos.x, f.pos.z), max = ARENA_R - 0.45; if (r > max) { f.pos.x *= max / r; f.pos.z *= max / r; } }"; assert a in s
s=s.replace(a,"f.pos.addScaledVector(fw, 3); MAP.cur.confine(f.pos, 0.45); f.pos.y = Math.max(f.pos.y, MAP.cur.floor(f.pos.x, f.pos.z)); }")
a="focus.y = Math.max(0, p.pos.y * 0.4) + 0.9;"; assert a in s
s=s.replace(a,"const gy = Math.max(-2, MAP.cur.floor(p.pos.x, p.pos.z)); focus.y = (p.pos.y > gy ? gy + (p.pos.y - gy) * 0.4 : p.pos.y) + 0.9;")
s=s.replace("import { Fighter, World, DT, ARENA_R, VS,","import { Fighter, World, DT, VS,")
open(p,'w',encoding='utf-8').write(s)

p='src/stage.ts'; s=open(p,encoding='utf-8').read()
a="export function buildStage(scene: THREE.Scene, A: Assets) {"; assert a in s
s=s.replace(a,"export function buildStage(scene: THREE.Scene, A: Assets, id = 'court') { return id === 'stairs' ? buildStairs(scene, A) : id === 'cave' ? buildCave(scene, A) : buildCourt(scene, A); }\nfunction buildCourt(scene: THREE.Scene, A: Assets) {")
a="scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x4a3470, 1.2));"; assert a in s
s=s.replace(a,"g.add(new THREE.HemisphereLight(0xb9c4ff, 0x4a3470, 1.2));")
a="scene.add(key); scene.add(key.target);"; assert a in s
s=s.replace(a,"g.add(key); g.add(key.target);")
a="back.position.set(-6, 5, -12); scene.add(back);"; assert a in s
s=s.replace(a,"back.position.set(-6, 5, -12); g.add(back);")
s=s.replace("import { toon } from './character';","import { toon } from './character';\nimport { buildStairs, buildCave } from './stages2';")
s=s.replace("\nfunction rng(","\nexport function rng(").replace("\nfunction outlined(","\nexport function outlined(").replace("\nfunction glow(","\nexport function glow(")
open(p,'w',encoding='utf-8').write(s)
print('ok')
