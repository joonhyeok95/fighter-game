// AI = a virtual controller. It only produces the same inputs a human could press.
// Perception (delayed view of opponents) -> Decision (utility scores) -> Execution (inputs + mistakes).
import * as THREE from 'three';
import { Fighter, Ctrl, emptyCtrl } from './fighter';
import { MAP } from './maps';
import { MOVES, STYLES } from './moves';

export type Difficulty = 'easy' | 'normal' | 'hard';
export interface AIParams { reaction: number; read: number; completion: number; mistake: number; ringout: number; learn: boolean; label: string }
export const AI_LEVELS: Record<Difficulty, AIParams> = {
  easy: { label: '쉬움', reaction: 30, read: 0.15, completion: 0.3, mistake: 0.2, ringout: 0, learn: false },
  normal: { label: '보통', reaction: 18, read: 0.4, completion: 0.65, mistake: 0.08, ringout: 0.4, learn: false },
  hard: { label: '어려움', reaction: 10, read: 0.7, completion: 0.95, mistake: 0.02, ringout: 1, learn: true },
};

interface Snap { state: string; x: number; z: number; moveId?: string }

export class AIController {
  p: AIParams; me: Fighter; rnd: () => number;
  history: Map<Fighter, Snap[]> = new Map();
  target?: Fighter; retargetT = 0;
  plan: (keyof Ctrl)[] = []; planWait = 0; holdGuard = 0; readDone = new WeakSet<object>();
  strafe = 0; strafeT = 0; habits = { attack: 1, guard: 1, grab: 1 };
  lastDecision = '';
  /** air-combo routine: launcher → punch → 끊치 ×2 → ground-combo finisher. -1 = not juggling */
  jugglePunches = -1; tk = 0; chargeGoal = 0;

  /** walk the style's combo tree (J/K/S branches) to build an input sequence */
  pickCombo(nearEdge: boolean): (keyof Ctrl)[] {
    const st = this.me.style; const r = this.rnd;
    if (this.me.nanmu > 0 && r() < 0.1) return Array(22).fill('S'); // 난무: mash V
    let key: 'J' | 'K' = nearEdge ? 'K' : r() < 0.5 ? 'J' : 'K';
    let id = st[key]; const seq: (keyof Ctrl)[] = [key];
    for (let i = 0; i < 4; i++) {
      const nx = MOVES[id]?.next; if (!nx) break;
      const opts = (Object.keys(nx) as ('J' | 'K' | 'S')[]).filter((k) => k !== 'S');
      if (!opts.length) break;
      // near the edge prefer branches that end in a knockdown (ring-out)
      const k = nearEdge && opts.includes('K') ? 'K' : opts[Math.floor(r() * opts.length)];
      seq.push(k); id = nx[k]!;
    }
    if (st.comboGrab && r() < 0.35 && seq.length >= 2) { seq.length = 2; seq.push('grab'); }
    return seq;
  }

  constructor(me: Fighter, level: Difficulty, rnd: () => number) { this.me = me; this.p = AI_LEVELS[level]; this.rnd = rnd; }

  observe(all: Fighter[]) {
    for (const f of all) {
      if (f === this.me) continue;
      let h = this.history.get(f); if (!h) this.history.set(f, (h = []));
      h.push({ state: f.state, x: f.pos.x, z: f.pos.z, moveId: f.move?.id });
      if (h.length > 40) h.shift();
      if (this.p.learn && f.isPlayer && h.length > 1) {
        const prev = h[h.length - 2];
        if (prev.state !== f.state) {
          if (f.state === 'attack') this.habits.attack++;
          if (f.state === 'guard') this.habits.guard++;
          if (f.state === 'grab') this.habits.grab++;
        }
      }
    }
  }
  /** What the AI "sees" of f: the snapshot from `reaction` ticks ago. */
  perceive(f: Fighter): Snap | undefined {
    const h = this.history.get(f); if (!h || !h.length) return;
    return h[Math.max(0, h.length - 1 - this.p.reaction)];
  }

  think(all: Fighter[]): Ctrl {
    const me = this.me; const c = emptyCtrl(); const r = this.rnd;
    this.observe(all);
    if (!me.alive || ['ko', 'out', 'fallout', 'victory'].includes(me.state)) return c;
    // --- target selection
    if (--this.retargetT <= 0 || !this.target || !this.target.alive) {
      let best: Fighter | undefined, bd = 1e9;
      for (const f of all) if (f !== me && f.alive && f.team !== me.team && !(f.veilT > 0 && f.pos.distanceTo(me.pos) > 1.8)) { const d = f.pos.distanceTo(me.pos) + (f.isPlayer ? -1.5 : 0); if (d < bd) { bd = d; best = f; } }
      this.target = best; this.retargetT = 90 + Math.floor(r() * 60);
    }
    const t = this.target; if (!t) return c;
    const seen = this.perceive(t); if (!seen) return c;
    const tp = new THREE.Vector3(seen.x, 0, seen.z);
    const to = tp.clone().sub(me.pos); to.y = 0; const d = to.length(); const dir = to.clone().normalize();

    // --- charge moves: keep holding X for a random time (full charge more often on higher levels)
    if (me.state === 'attack' && me.move?.charge && me.chargeT >= 0) {
      if (me.chargeT === 0) this.chargeGoal = r() < 0.3 + this.p.completion * 0.5 ? 22 + Math.floor(r() * 14) : Math.floor(r() * 8);
      c.Jh = me.chargeT < this.chargeGoal;
    }
    // --- wake-up choice: 땅긋기 (C) / 구르기 (direction) / normal getup
    if (me.state === 'down' && me.stateT === 18) {
      const q = r();
      if (q < 0.35) { c.K = true; this.lastDecision = 'wakeup'; return c; }
      if (q < 0.65) { const away = me.pos.clone().sub(t.pos).setY(0).normalize(); c.mx = away.x; c.mz = away.z; this.lastDecision = 'roll'; return c; }
    }
    // --- air combo (standing juggle) after our launcher connects
    const jm = me.move; const tog = (this.tk++ & 1) === 0;
    if (jm && me.state === 'attack' && t.state === 'launched' && me.grounded) {
      if (jm.type === 'launch' && me.hitDone.size > 0 && this.jugglePunches < 0 && r() < 0.3 + this.p.completion * 0.7) { this.jugglePunches = 0; this.plan = []; }
      if (this.jugglePunches >= 0) {
        const st = me.style;
        if (jm.id === st.J && me.stateT <= 1) this.jugglePunches++;
        const lastTo = jm.hits?.[jm.hits.length - 1]?.to ?? 0.3; const late = me.animTime() > lastTo + (8 / 60) * jm.speed;
        if (jm.type === 'launch' && me.hitDone.size > 0) { c.J = tog; this.lastDecision = 'juggle'; return c; }
        if (jm.id === st.J && me.hitDone.size > 0) {
          if (this.jugglePunches < 3) { if (late) c.J = tog; return c; }            // 끊치
          // finish with the ground combo that follows the first punch (e.g. X X C / X X X)
          const fin: (keyof Ctrl)[] = []; let id = MOVES[st.J]?.next?.J;
          if (id) { fin.push('J'); const nx = MOVES[id]?.next; if (nx?.K) fin.push('K'); else if (nx?.J) fin.push('J'); }
          this.plan = fin; this.planWait = 1; this.jugglePunches = -1;
        }
      }
    } else if (t.state !== 'launched') this.jugglePunches = -1;
    // continue a planned button sequence (combo)
    if (this.plan.length) {
      if (--this.planWait <= 0) {
        const k = this.plan.shift()!; (c as any)[k] = true; this.planWait = 9;
        if (this.rnd() > this.p.completion) this.plan = [];
      }
      if (me.state === 'attack' || this.plan.length) { c.mx = dir.x * 0.01; c.mz = dir.z * 0.01; return c; }
    }
    if (this.holdGuard > 0) { this.holdGuard--; c.guard = true; return c; }
    if (!me.controllable() && me.state !== 'guard' && me.state !== 'air') return c;

    // --- transformation / skills
    if (me.gauge >= 100 && me.transformT <= 0) {
      const want = this.p.label === '쉬움' ? r() < 0.01 : this.p.label === '보통' ? me.hp < me.maxHp * 0.6 : d < 4;
      if (want) { c.transform = true; this.lastDecision = 'transform'; return c; }
    }
    if (me.transformT > 0 && d < 3 && r() < 0.04) { if (me.mp >= 120 && r() < 0.5) c.s2 = true; else if (me.mp >= 80) c.s1 = true; if (c.s1 || c.s2) return c; }

    // --- defence: read an incoming attack
    const threat = seen.state === 'attack' && d < 2.8;
    const tAttack = t.move; // identity of the attack instance (one roll per attack)
    if (threat && tAttack && !this.readDone.has(tAttack as object)) {
      this.readDone.add(tAttack as object);
      if (r() < this.p.read) {
        if (me.evades > 0 && me.hp < me.maxHp * 0.35 && r() < 0.35) { c.J = true; c.K = true; this.lastDecision = 'evade'; return c; }
        const counterBias = this.p.learn ? 0.45 : 0.15;
        if (r() < counterBias) { c.counter = true; this.lastDecision = 'counter'; return c; }
        this.holdGuard = 18; c.guard = true; this.lastDecision = 'guard'; return c;
      }
    }

    // --- mistakes
    if (r() < this.p.mistake * 0.1) { const ks: (keyof Ctrl)[] = ['J', 'K', 'jump', 'grab']; (c as any)[ks[Math.floor(r() * ks.length)]] = true; this.lastDecision = 'mistake'; return c; }

    // --- offence
    const tR = Math.hypot(seen.x, seen.z);
    const edge = MAP.cur.edge(seen.x, seen.z); const nearEdge = edge.d < 3.2 && r() < this.p.ringout;
    if (d < 1.7 && me.controllable()) {
      const tGuarding = seen.state === 'guard' || seen.state === 'blockstun';
      const grabW = (tGuarding ? 0.6 : 0.05) * (this.p.learn ? this.habits.guard / (this.habits.attack + this.habits.guard + this.habits.grab) * 3 : 1);
      if (r() < grabW * 0.25) { c.grab = true; this.lastDecision = 'grab'; return c; }
      if (r() < 0.12) {
        const seq = this.pickCombo(nearEdge);
        (c as any)[seq[0]] = true; this.plan = seq.slice(1); this.planWait = 9;
        if (me.transformT > 0) { c.J = true; c.K = false; c.S = false; this.plan = ['J', 'J']; }
        this.lastDecision = 'combo:' + seq.join('');
        c.mx = dir.x * 0.01; c.mz = dir.z * 0.01;
        return c;
      }
      // small footsies
      if (--this.strafeT <= 0) { this.strafe = r() < 0.5 ? -1 : 1; this.strafeT = 30 + r() * 40; }
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafe * 0.6);
      c.mx = side.x + dir.x * 0.2; c.mz = side.z + dir.z * 0.2;
      return c;
    }
    // approach (ring-out aware: come from the centre side so hits push outward)
    let goal = tp.clone();
    if (nearEdge) goal = tp.clone().addScaledVector(edge.out, -1.1);
    const g = goal.sub(me.pos); g.y = 0; const gl = g.length();
    if (gl > 0.2) { c.mx = g.x / gl; c.mz = g.z / gl; }
    c.dash = d > 5;
    const st = me.style;
    if (me.controllable() && r() < 0.012 * (1 + this.p.completion)) {
      if (me.nanmu > 0 && d > 1.8 && d < 4.2 && me.state !== 'air') { c.S = true; this.plan = Array(22).fill('S'); this.planWait = 6; this.lastDecision = 'nanmu'; return c; }
    }
    if (d > 2.6 && d < 3.6 && r() < 0.012) { c.jump = true; this.plan = ['K']; this.planWait = 16; }
    if (c.dash && d < 4.5 && r() < 0.03) { c.K = r() < 0.5; c.J = !c.K; }
    return c;
  }
}
