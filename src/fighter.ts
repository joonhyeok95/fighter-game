import * as THREE from 'three';
import { MOVES, MoveDef, STYLES, Limb } from './moves';
import { META } from './anims';

export const DT = 1 / 60;
import { MAP } from './maps';
const PQ = new THREE.Vector3(), PO = new THREE.Vector3();
export const ARENA_R = 9;        // railing radius
export const FLOOR_R = 9.25;     // edge of the island floor (just outside the railing)
export const RAIL_H = 0.55;
/**
 * Game gravity. Real 9.81 m/s² reads floaty at fighter scale, so gravity is scaled by GRAV_K and every
 * vertical launch speed by sqrt(GRAV_K): heights stay the same, airtime shrinks (snappier, heavier).
 */
export const GRAV_K = 1.8;
export const VS = Math.sqrt(GRAV_K);
export const GRAVITY = 9.81 * GRAV_K;
/** extra gravity while falling from a voluntary jump: quick rise, heavy drop */
const FALL_MUL = 1.35;
/** gravity multiplier while juggled after a launcher (~9 m/s²: low, slow hang for standing juggles) */
export const FLOAT_MUL = 0.5;
export const JUMP_V = 4.9 * VS;       // apex ~1.2 m, ~0.75 s airtime
export const AIR_JUMP_V = 4.2 * VS;
const MAX_FALL = 30;             // terminal velocity (m/s)

export interface Ctrl {
  mx: number; mz: number; dash: boolean; guard: boolean;
  J: boolean; K: boolean; S: boolean; jump: boolean; Jh?: boolean; grab: boolean; counter: boolean; transform: boolean; s1: boolean; s2: boolean;
}
/** how far one follow-up attack can be turned with the stick */
/** how long a 텀 연계 style can sit on the end of a landed attack before the chain is lost, in ticks */
export const HOLD_MAX = 14;
export const STEER_MAX = Math.PI / 4;
export const emptyCtrl = (): Ctrl => ({ mx: 0, mz: 0, dash: false, guard: false, J: false, K: false, S: false, jump: false, grab: false, counter: false, transform: false, s1: false, s2: false });
const BUFFERED: (keyof Ctrl)[] = ['J', 'K', 'S', 'jump', 'grab', 'counter', 'transform', 's1', 's2'];

export type State = 'idle' | 'move' | 'air' | 'land' | 'attack' | 'guard' | 'blockstun' | 'grab' | 'throwing' | 'thrown' | 'counter' | 'counterhit'
  | 'hitstun' | 'launched' | 'down' | 'roll' | 'getup' | 'transform' | 'ko' | 'fallout' | 'victory' | 'out';

export interface FighterOpts { name: string; team: number; body: 'male' | 'female'; suit: number; joints: number; style: string; isPlayer?: boolean }

export class Fighter {
  id: number; opts: FighterOpts; name: string; team: number; isPlayer: boolean;
  root = new THREE.Group(); model: THREE.Object3D; mixer: THREE.AnimationMixer;
  actions = new Map<string, THREE.AnimationAction>(); cur?: THREE.AnimationAction; curName = '';
  bones: Record<string, THREE.Object3D> = {}; mats: THREE.MeshStandardMaterial[] = []; outlines: THREE.Material[] = [];
  vel = new THREE.Vector3(); yaw = 0; grounded = true; airJumps = 0; bounced = false; juggle = 0;
  /** juggle float: a launched fighter hangs in the air so standing attacks keep hitting (ground juggles) */
  float = false;
  /** charge (hold) moves: ticks charged so far (-1 = not charging), and whether the release is a full charge */
  chargeT = -1; charged = false;
  hp = 1000; maxHp = 1000; mp = 300; maxMp = 300; gauge = 0; evades = 2; transformT = 0;
  /** 난무 uses left this round · dash is locked after a dash attack until the run input is released · double-jump somersault timer */
  nanmu = 1; dashLock = false; tumbleT = -1; squash = 0; tailA = 0; tailV = 0;
  state: State = 'idle'; stateT = 0; move?: MoveDef; hitDone = new Set<string>(); queued?: string; queuedGrab = false; specialDone = false;
  freeze = 0; hitT = 0; shake = 0; flash = 0; flashColor = new THREE.Color(1, 1, 1); invuln = 0; combo = 0; comboDmg = 0; comboT = 0;
  lastHitBy?: Fighter; lastHitAt = -999; koPending = false; stunFor = 20; downFace = false;
  poisonT = 0; poisonBy?: Fighter; confuseT = 0; veilT = 0;
  grabbedBy?: Fighter; holding?: Fighter; throwKind: 'normal' | 'over' | 'hip' | 'counter' = 'normal';
  /** the current attack was aimed with the stick, so it does not auto-face a target */
  steered = false;
  /** ticks spent holding the end of an attack, waiting for a late follow-up */
  holdT = 0;
  /** over-the-shoulder throws: the opponent is carried up and dropped behind */
  get overThrow() { return this.throwKind === 'hip' || this.throwKind === 'over'; }
  ctrl: Ctrl = emptyCtrl(); prev: Ctrl = emptyCtrl(); buf: Partial<Record<keyof Ctrl, number>> = {};
  stats = { dmg: 0, taken: 0, kos: 0, ringouts: 0, maxCombo: 0 };
  roundWins = 0; alive = true; aura?: THREE.Object3D; blade?: THREE.Mesh; hpView = 1000;
  locoSpeed: Record<string, number> = {};

  constructor(id: number, opts: FighterOpts, model: THREE.Object3D, clips: Map<string, THREE.AnimationClip>, locoSpeed: Record<string, number>) {
    this.id = id; this.opts = opts; this.name = opts.name; this.team = opts.team; this.isPlayer = !!opts.isPlayer;
    this.model = model; this.root.add(model); this.locoSpeed = locoSpeed;
    this.mixer = new THREE.AnimationMixer(model);
    for (const [n, c] of clips) this.actions.set(n, this.mixer.clipAction(c));
    for (const b of ['pelvis', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'calf_l', 'calf_r', 'lowerarm_l', 'lowerarm_r', 'upperarm_l', 'upperarm_r', 'spine_03', 'index_01_r', 'pinky_01_r', 'tail']) this.bones[b] = model.getObjectByName(b)!;
    model.traverse((m: any) => { if (!m.isMesh) return; if (m.material.userData?.outline) this.outlines.push(m.material); else if (m.material.emissive) this.mats.push(m.material); });
    this.play('Idle_Loop');
  }

  get pos() { return this.root.position; }
  get style() { return STYLES[this.opts.style]; }
  forward(v = new THREE.Vector3()) { return v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  controllable() { return this.state === 'idle' || this.state === 'move'; }
  isDownish() { return ['down', 'getup', 'ko', 'out', 'fallout', 'thrown'].includes(this.state); }
  hasArmor() { const m = this.move; return this.state === 'attack' && !!m?.armor && this.animTime() <= (m.activeTo ?? 0) + 0.05; }

  play(name: string, o: { loop?: boolean; speed?: number; fade?: number; at?: number } = {}) {
    const a = this.actions.get(this.style.anims?.[name] ?? name); if (!a) { console.warn('no anim', name); return; } // each style may bring its own stance
    const loop = o.loop ?? /_Loop$|guard_pose/.test(name);
    if (this.cur === a && loop) { a.timeScale = o.speed ?? 1; return; }
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
    a.timeScale = o.speed ?? 1; a.time = o.at ?? 0; a.enabled = true; a.setEffectiveWeight(1); a.play();
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.08, false);
    this.cur = a; this.curName = name;
  }
  animTime() { return this.cur ? this.cur.time : 0; }
  animDone() { return !!this.cur && this.cur.time >= this.cur.getClip().duration - 1e-3; }
  setState(s: State, t = 0) {
    if (this.state === 'throwing' && s !== 'throwing' && this.holding) {
      // interrupted mid-throw (e.g. hit by a third fighter): let go of the opponent
      const v = this.holding; this.holding = undefined;
      if (v.grabbedBy === this) { v.grabbedBy = undefined; if (v.state === 'thrown') { v.vel.set(0, 2 * VS, 0); v.launch(); } }
    }
    this.state = s; this.stateT = t;
  }
  /** ticks spent continuously in hit reactions (multi-attacker stun-lock protection) */
  stunChain = 0;
  /** world position of a striking point: knuckles, ball of the foot, or the knee / elbow / shoulder joint itself */
  limbPos(limb: Limb, out = new THREE.Vector3()) {
    const b = this.bones[limb]; b.updateWorldMatrix(true, false);
    if (limb.startsWith('hand')) out.set(0, -0.07, 0); else if (limb.startsWith('foot')) out.set(0, -0.03, 0.07); else out.set(0, 0, 0);
    return out.applyMatrix4(b.matrixWorld);
  }
  hurtSegment(): [THREE.Vector3, THREE.Vector3] {
    const p = this.bones.pelvis.getWorldPosition(new THREE.Vector3());
    // airborne after a hit: the body is tumbling, so use an upright capsule around it that standing strikes can reach
    if (this.state === 'launched' && !this.grounded) { const lo = p.clone(); lo.y = this.pos.y + 0.05; const hi = p.clone(); hi.y = this.pos.y + 1.2; return [lo, hi]; }
    const h = this.bones.Head.getWorldPosition(new THREE.Vector3());
    const a = p.clone(); a.y = Math.max(this.pos.y + 0.12, p.y - 0.4);
    h.y += 0.3; // centre of the (big) head
    return [a, h];
  }
  faceToward(p: THREE.Vector3, rate = 1) {
    const d = p.clone().sub(this.pos); if (d.lengthSq() < 1e-4) return;
    let diff = Math.atan2(d.x, d.z) - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * rate;
  }
  /** buffered press (kept ~10 ticks, survives hit-stop); consumed when read */
  pressed(k: keyof Ctrl) { if ((this.buf[k] ?? 0) > 0) { this.buf[k] = 0; return true; } return false; }
  peek(k: keyof Ctrl) { return (this.buf[k] ?? 0) > 0; }
  private bufferInputs() {
    for (const k of BUFFERED) { if (this.ctrl[k] && !this.prev[k]) this.buf[k] = 10; else if ((this.buf[k] ?? 0) > 0 && this.freeze === 0) this.buf[k]!--; } // presses don't expire during hit-stop
  }

  startMove(id: string, world: World) {
    const m = MOVES[id]; if (!m) return;
    if (m.mp) { if (this.mp < m.mp) return; this.mp -= m.mp; }
    this.move = m; this.holdT = 0; this.hitDone.clear(); this.queued = undefined; this.queuedGrab = false; this.specialDone = false;
    this.chargeT = m.charge ? 0 : -1; this.charged = false;
    if (this.ctrl.dash) this.dashLock = true; // a running attack ends the run
    // a follow-up attack can be steered: holding a direction turns it up to 45 degrees from where the last one pointed
    const sl = Math.hypot(this.ctrl.mx, this.ctrl.mz);
    // the player aims by hand: no strike turns toward an enemy by itself (난무 and specials still seek their target)
    this.steered = this.isPlayer && !world.autopilot && !m.nanmu && !m.special;
    if (this.steered && !(this.state === 'attack' && sl > 0.3)) { /* keeps pointing where it already points */ }
    else if (this.steered) {
      let diff = Math.atan2(this.ctrl.mx, this.ctrl.mz) - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += Math.max(-STEER_MAX, Math.min(STEER_MAX, diff));
    } else {
      const tgt = world.nearestEnemy(this, 4);
      if (tgt && m.special !== 'teleport') this.faceToward(tgt.pos, 1);
    }
    this.setState('attack');
    this.play(m.anim, { speed: m.speed, loop: false, fade: 0.05 });
    if (m.invuln) this.invuln = m.invuln;
    if (m.special === 'teleport') world.teleportBehind(this);
    world.onMoveStart(this, m);
  }

  inputMove(): string | undefined {
    const st = this.style;
    if (this.transformT > 0) {
      if (this.pressed('s1') && this.mp >= MOVES.skill1.mp!) return 'skill1';
      if (this.pressed('s2') && this.mp >= MOVES.skill2.mp!) return 'skill2';
      if (this.pressed('J')) return 'sword_a';
    }
    if (this.peek('J') && this.peek('K') && this.evades > 0 && this.grounded) { this.pressed('J'); this.pressed('K'); this.evades--; return 'evade'; }
    const dashing = this.ctrl.dash && this.state === 'move';
    if (!this.grounded) { if (this.pressed('K')) return st.air; if (this.pressed('J')) return 'jumppunch'; return; }
    if (this.pressed('S')) { if (this.nanmu > 0) { this.nanmu--; return st.S; } return; } // 난무: once per round
    if (this.pressed('J')) return dashing ? st.dashJ : st.J;
    if (this.pressed('K')) return dashing ? st.dashK : st.K;
  }

  update(world: World) {
    this.bufferInputs();
    if (this.freeze > 0) { this.freeze--; this.prev = { ...this.ctrl }; return; }
    this.stateT++; if (this.invuln > 0) this.invuln--;
    if (this.comboT > 0 && --this.comboT === 0) { this.combo = 0; this.comboDmg = 0; }
    if (this.confuseT > 0) { this.confuseT--; this.ctrl.mx = -this.ctrl.mx; this.ctrl.mz = -this.ctrl.mz; }
    if (this.veilT > 0 && --this.veilT === 0) { for (const m of this.mats) { m.transparent = false; m.opacity = 1; } for (const m of this.outlines) { m.transparent = false; m.opacity = 1; m.visible = true; } }
    if (this.state === 'hitstun' || this.state === 'launched') this.stunChain++; else if (this.state !== 'blockstun') this.stunChain = 0;
    if (this.poisonT > 0) { this.poisonT--; if (this.poisonT % 10 === 0 && this.alive) world.poisonTick(this); }
    this.mp = Math.min(this.maxMp, this.mp + 12 * DT);
    if (this.transformT > 0) { this.transformT -= DT; if (this.transformT <= 0) world.endTransform(this); }
    const c = this.ctrl;
    if (!c.dash) this.dashLock = false; else if (this.dashLock) c.dash = false;
    const speed = (c.dash ? 7.0 : 4.2) * (this.style.moveSpeed ?? 1);

    switch (this.state) {
      case 'idle': case 'move': {
        if (this.pressed('transform') && this.gauge >= 100 && this.transformT <= 0) { world.beginTransform(this); break; }
        const mv = this.inputMove(); if (mv) { this.startMove(mv, world); break; }
        if (this.pressed('grab')) { this.startGrab(); break; }
        if (this.pressed('counter')) { this.setState('counter'); this.play('Sword_Block', { speed: 1.4, loop: false }); break; }
        if (c.guard) { this.setState('guard'); this.play('guard_pose', { speed: 0.4 }); this.vel.x = this.vel.z = 0; break; }
        if (this.pressed('jump')) { this.jump(JUMP_V, world); break; }
        const len = Math.hypot(c.mx, c.mz);
        if (len > 0.1) {
          const k = Math.min(1, len);
          const tx = (c.mx / len) * speed * k, tz = (c.mz / len) * speed * k;
          // acceleration instead of instant velocity (no ice, no teleport-start)
          this.vel.x += (tx - this.vel.x) * 0.25; this.vel.z += (tz - this.vel.z) * 0.25;
          this.faceToward(this.pos.clone().add(new THREE.Vector3(c.mx, 0, c.mz)), 0.22);
          const anim = c.dash ? 'Sprint_Loop' : 'Jog_Fwd_Loop';
          if (this.state !== 'move' || this.curName !== anim) { this.setState('move'); this.play(anim, { fade: 0.12 }); }
          // match the stride to the real ground speed (no foot sliding)
          const hs = Math.hypot(this.vel.x, this.vel.z);
          if (this.cur) this.cur.timeScale = THREE.MathUtils.clamp(hs / (this.locoSpeed[anim] || 3), 0.4, 1.6);
        } else {
          this.vel.x *= 0.7; this.vel.z *= 0.7;
          if (this.state !== 'idle') { this.setState('idle'); this.play('Idle_Loop', { fade: 0.15 }); }
        }
        break;
      }
      case 'air': {
        if (this.airJumps === 0 && this.pressed('jump')) { this.airJumps = 1; this.jump(AIR_JUMP_V * (this.style.doubleJump ? 1.15 : 1), world); break; } // 2단 점프 (인술은 더 높게)
        const mv = this.inputMove(); if (mv) { this.startMove(mv, world); break; }
        const len = Math.hypot(c.mx, c.mz);
        if (len > 0.1) { this.vel.x += (c.mx / len * speed - this.vel.x) * 0.04; this.vel.z += (c.mz / len * speed - this.vel.z) * 0.04; }
        break;
      }
      case 'land': this.vel.x *= 0.6; this.vel.z *= 0.6; if (this.stateT > 6) this.toNeutral(); break;
      case 'attack': this.updateAttack(world); break;
      case 'guard': {
        // a guard is committed to the direction it was raised in: to face elsewhere, drop it, turn, and guard again
        this.vel.x *= 0.6; this.vel.z *= 0.6;
        if (!c.guard) this.toNeutral(); else if (this.pressed('grab')) this.startGrab(); else if (this.pressed('counter')) { this.setState('counter'); this.play('Sword_Block', { speed: 1.4, loop: false }); }
        break;
      }
      case 'blockstun': this.vel.x *= 0.85; this.vel.z *= 0.85; if (this.stateT > 14) { if (c.guard) this.setState('guard'); else this.toNeutral(); } break;
      case 'grab': this.vel.x *= 0.7; this.vel.z *= 0.7; if (this.stateT === 6) world.tryGrab(this, false); if (this.stateT > 36) this.toNeutral(); break;
      case 'throwing': {
        const v = this.holding;
        if (v && v.state === 'thrown') {
          const f = this.forward(); const lift = this.overThrow ? Math.min(0.8, this.stateT * 0.04) : Math.min(0.45, this.stateT * 0.016);
          // shoulder throw: the opponent is hauled from the front, up over the shoulder, to behind
          const k = this.throwKind === 'over' ? Math.min(1, Math.max(0, (this.stateT - 8) / 14)) : 0; const off = 0.7 - 1.1 * k * k; const ly = this.throwKind === 'over' ? lift + 0.25 * k : lift;
          v.pos.set(this.pos.x + f.x * off, this.pos.y + ly, this.pos.z + f.z * off); v.yaw = this.yaw + Math.PI; v.vel.set(0, 0, 0);
          if (this.stateT === (this.overThrow ? 22 : 26)) world.releaseThrow(this, v);
        }
        // jujutsu: after the release the throw can be jump-cancelled to chase the tossed opponent
        if (this.style.comboGrab && this.throwKind !== 'hip' && this.stateT > 27 && this.pressed('jump')) {
          const tgt = this.holding; this.holding = undefined; this.jump(JUMP_V, world);
          if (tgt) this.chase(tgt);
          break;
        }
        if (this.stateT > 46) { this.holding = undefined; this.toNeutral(); }
        break;
      }
      case 'thrown': if (!this.grabbedBy || this.grabbedBy.state !== 'throwing') { this.grabbedBy = undefined; this.launch(); } break;
      case 'counter': this.vel.x *= 0.6; this.vel.z *= 0.6; if (this.stateT > 40) this.toNeutral(); break;
      case 'counterhit': if (this.animDone() || this.stateT > 34) this.toNeutral(); break;
      case 'hitstun': this.vel.x *= 0.86; this.vel.z *= 0.86; if (this.stateT >= this.stunFor) this.toNeutral(); break;
      case 'launched': break;
      case 'down': {
        this.vel.x *= 0.82; this.vel.z *= 0.82;
        if (this.stateT === 1) this.invuln = 999;
        const wait = this.koPending ? 1e9 : 32;
        if (!this.koPending && this.stateT > 14 && this.pressed('K')) { this.startMove('wakeup', world); break; } // C: wake-up attack (땅긋기)
        if (!this.koPending && this.stateT > 14 && Math.hypot(c.mx, c.mz) > 0.5) { // 구르기
          this.setState('roll'); this.invuln = 34; this.faceToward(this.pos.clone().add(new THREE.Vector3(c.mx, 0, c.mz)), 1);
          this.play('Roll', { speed: 1.1, loop: false, fade: 0.05 }); break;
        }
        if (this.stateT > wait || (this.stateT > 14 && (this.pressed('J') || this.pressed('jump')))) {
          this.setState('getup'); const name = this.downFace ? 'getup_face' : 'getup_back';
          this.play(name, { speed: name === 'getup_face' ? 2.4 : 1.7, loop: false, fade: 0.05 });
        }
        break;
      }
      case 'roll': {
        const f = this.forward(); const sp = this.stateT < 26 ? 4.2 : 0; this.vel.x = f.x * sp; this.vel.z = f.z * sp;
        if (this.stateT > 44) this.toNeutral(); // long recovery after the roll
        break;
      }
      case 'getup': this.invuln = 6; if (this.animDone()) { this.invuln = 20; this.toNeutral(); } break;
      case 'transform': this.vel.set(0, this.vel.y, 0); if (this.stateT === 22) this.play('Spell_Simple_Shoot', { loop: false }); if (this.stateT > 44) this.toNeutral(); break;
      case 'ko': this.vel.x *= 0.9; this.vel.z *= 0.9; break;
      case 'victory': this.vel.set(0, this.vel.y, 0); break;
    }
    this.physics(world);
    this.prev = { ...this.ctrl };
  }

  updateAttack(world: World) {
    const m = this.move!; const t = this.animTime(); const hits = m.hits || [];
    const last = hits[hits.length - 1]; const first = hits[0];
    const lastTo = last ? last.to : 0.3;
    // charge: hold X to freeze just before the strike (up to 1 s). 20F+ = full charge (guard crush, x1.6)
    if (m.charge && this.chargeT >= 0 && first) {
      const holdAt = META[m.anim]?.wind ?? first.from * 0.5; // arm cocked back
      if (t >= holdAt && this.ctrl.Jh && this.chargeT < 60) {
        if (this.cur) { this.cur.time = holdAt; this.cur.timeScale = 0; }
        this.chargeT++; this.vel.x *= 0.7; this.vel.z *= 0.7; if (this.chargeT >= 20 && this.chargeT % 4 === 0) this.shake = 2; world.onCharge(this, this.chargeT); return;
      }
      if (t >= holdAt) { this.charged = this.chargeT >= 20; this.chargeT = -1; if (this.cur) this.cur.timeScale = m.speed; }
    }
    // movement during the move
    if (m.step && this.grounded && t < lastTo) {
      // advancing strike: walks the attack forward, but pulls up at striking distance instead of running through the target
      const f = this.forward(); let sp = m.step; const tgt = world.nearestEnemy(this, 3);
      if (tgt && first) {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length() || 1; const want = first.limb.startsWith('foot') ? 0.98 : 0.84;
        if ((d.x * f.x + d.z * f.z) / dist > 0.6) sp = dist > want ? Math.min(m.step, (dist - want) * 8) : 0;
      }
      this.vel.x = f.x * sp; this.vel.z = f.z * sp;
    }
    else if (m.lunge && t < lastTo) { const f = this.forward(); this.vel.x = f.x * m.lunge; this.vel.z = f.z * m.lunge; }
    else if (this.grounded && first && t < first.from && !m.radial && !m.special) {
      // homing step: close the gap to a target in front so strikes connect
      const tgt = world.nearestEnemy(this, 2.6); const want = first.limb.startsWith('foot') ? 0.88 : first.limb.startsWith('hand') ? 0.74 : 0.62;
      if (this.steered) { // aimed by hand: step where it points, never turn; only stop short of someone already straight ahead
        const f = this.forward(); let sp = 1.6;
        if (tgt) { const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length() || 1; if ((d.x * f.x + d.z * f.z) / dist > 0.7) sp = dist > want ? Math.min(4.5, (dist - want) * 8) : 0; }
        this.vel.x = f.x * sp; this.vel.z = f.z * sp;
      }
      else if (tgt) {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length();
        this.faceToward(tgt.pos, 0.2);
        const sp = dist > want ? Math.min(4.5, (dist - want) * 8) : 0; const f = this.forward(); this.vel.x = f.x * sp; this.vel.z = f.z * sp;
      } else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    } else if (this.grounded) { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    // combo inputs (buffered): J / K / S branch, U = grab cancel (jujutsu)
    // chain window: from the first active frame until ~10F after the last hit. Later presses don't chain;
    // a late X instead cuts the recovery into a fresh first punch ("끊치": repeated single jabs)
    const chainOpen = m.nanmu || t <= lastTo + ((this.hitDone.size > 0 ? 13 + (this.style.chainHold ?? 0) : 6) / 60) * m.speed; // a landed hit keeps the follow-up window open longer (there is no hit-stop to think in)
    const jabChain = m.id === this.style.J || MOVES[this.style.J]?.next?.J === m.id;
    if (!chainOpen && this.grounded && !this.queued && jabChain && this.hitDone.size > 0 && this.pressed('J')) { this.startMove(this.style.J, world); return; }
    // one queued follow-up per move; an extra press stays buffered for the move after it (fast mashing works)
    if (m.next && !this.queued && chainOpen) {
      if (m.next.J && this.pressed('J')) this.queued = m.next.J;
      else if (m.next.K && this.pressed('K')) this.queued = m.next.K;
      else if (m.next.S && (!m.nanmu || this.hitDone.size > 0) && this.pressed('S')) this.queued = m.next.S; // 난무 only continues on hit
    }
    if (this.style.comboGrab && this.hitDone.size > 0 && this.pressed('grab')) this.queuedGrab = true;
    if (this.transformT > 0 && m.id.startsWith('sword') && m.next?.J && this.pressed('J')) this.queued = m.next.J;
    // specials
    if (m.special === 'smoke' && !this.specialDone && t >= (m.peak ?? 0.2)) { this.specialDone = true; world.spawnSmoke(this); }
    if (m.special === 'cmdgrab' && !this.specialDone && t >= (first?.from ?? 0.2)) { this.specialDone = true; world.tryGrab(this, true); }
    if (this.state !== 'attack') return;
    // cancel into the next technique once the last hit has come out
    if (t >= lastTo && m.type === 'launch' && this.hitDone.size > 0 && this.grounded && this.pressed('jump')) {
      // jump-cancel: chase the launched opponent into the air
      const tgt = world.nearestEnemy(this, 3.5); this.move = undefined; this.jump(JUMP_V, world);
      if (tgt) this.chase(tgt);
      return;
    }
    // launcher → standing juggle: once the launcher has connected, X cancels its recovery into the first punch
    if (t >= lastTo && m.type === 'launch' && this.hitDone.size > 0 && this.grounded && this.pressed('J')) { this.startMove(this.style.J, world); return; }
    if (t >= lastTo) {
      if (this.queuedGrab) { this.queuedGrab = false; this.startGrab(true); world.tryGrab(this, false, true); return; }
      if (this.queued) { const q = this.queued; this.queued = undefined; this.startMove(q, world); return; }
    }
    if (!m.special) hits.forEach((h, i) => { if (t >= h.from && t <= h.to) world.checkHits(this, m, i); });
    if (this.animDone()) {
      // 텀 연계 (chainHold styles): after a landed hit the stance is held a moment longer, so the follow-up can come late
      const hold = !!this.style.chainHold && this.hitDone.size > 0 && !!m.next && this.grounded && !this.ctrl.guard && !this.ctrl.jump && !this.ctrl.dash;
      if (!hold || ++this.holdT > HOLD_MAX) this.toNeutral();
    }
  }

  /** whether the "next input" window is open (for the on-screen combo guide) */
  cancelWindow() {
    if (this.state !== 'attack' || !this.move?.next) return false;
    const h = this.move.hits || []; const t = this.animTime();
    return h.length > 0 && t >= h[0].from && !this.animDone();
  }

  /** air chase: jump toward a launched opponent, matching their drift so the air attack connects */
  chase(tgt: Fighter) {
    this.faceToward(tgt.pos, 1);
    const d = tgt.pos.clone().sub(this.pos); d.y = 0; const dist = d.length(); d.normalize();
    const drift = Math.max(0, tgt.vel.x * d.x + tgt.vel.z * d.z);
    const sp = Math.min(4.5, drift + Math.max(0, dist - 0.75) * 2.5);
    this.vel.x = d.x * sp; this.vel.z = d.z * sp;
  }
  startGrab(instant = false) { this.setState('grab', instant ? 7 : 0); this.play('Push_Loop', { speed: 2.2, loop: false }); this.move = undefined; }

  jump(v: number, world: World) {
    this.vel.y = v; this.grounded = false; this.setState('air');
    this.play(this.airJumps > 0 ? 'NinjaJump_Idle_Loop' : 'Jump_Loop', { fade: 0.08 });
    this.tumbleT = this.airJumps > 0 ? 0 : -1; // 2단 점프 = 덤블링
    world.onJump(this);
  }

  toNeutral() {
    this.move = undefined; this.queued = undefined; this.queuedGrab = false; this.charged = false; this.chargeT = -1;
    if (!this.grounded) { this.setState('air'); this.play('Jump_Loop', { fade: 0.12 }); return; }
    this.setState('idle'); this.play('Idle_Loop', { fade: 0.15 });
  }

  launch(face = false) {
    // a fighter hit again while already airborne keeps its bounce flag (no fresh re-launch after a bounce)
    if (this.state !== 'launched') this.bounced = false;
    this.setState('launched'); this.grounded = false; this.move = undefined;
    this.downFace = face;
    this.play(face ? 'Hit_Knockface' : 'Hit_Knockback', { loop: false, speed: 0.8, fade: 0.04 });
  }

  physics(world: World) {
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
  animate() {
    if (this.freeze <= 0) this.mixer.update(DT);
    // hit-stop shake of the victim + flash
    this.model.position.x = this.shake > 0 ? (this.shake % 2 ? 1 : -1) * 0.06 * Math.min(1, this.shake / 4) : 0;
    if (this.shake > 0) this.shake--; if (this.hitT > 0) this.hitT--;
    this.model.position.y *= 0.7;
    // struck: the body squashes for a few frames, then springs back
    if (this.squash > 0) { const k = Math.sin((this.squash / 8) * Math.PI) * 0.16; this.model.scale.set(1 + k * 0.8, 1 - k, 1 + k * 0.8); if (this.freeze <= 0) this.squash--; } else this.model.scale.set(1, 1, 1);
    // ponytail: a damped spring dragged by the body's motion
    const tail = this.bones.tail;
    if (tail) {
      const f = this.forward(PQ); const want = THREE.MathUtils.clamp((this.vel.x * f.x + this.vel.z * f.z) * 0.09 - this.vel.y * 0.06, -0.5, 1.1);
      this.tailV += (want - this.tailA) * 0.12; this.tailV *= 0.8; this.tailA += this.tailV; tail.rotation.x = this.tailA;
    }
    // double jump: forward somersault around the body centre
    if (this.tumbleT >= 0 && (this.state !== 'air' || this.grounded)) this.tumbleT = -1;
    if (this.tumbleT >= 0) {
      if (this.freeze <= 0) this.tumbleT++;
      const k = Math.min(1, this.tumbleT / 22), a = Math.PI * 2 * k * k * (3 - 2 * k), piv = 0.6;
      this.model.rotation.x = a; this.model.position.y = piv * (1 - Math.cos(a)); this.model.position.z = -piv * Math.sin(a);
      if (k >= 1) this.tumbleT = -1;
    } else if (this.model.rotation.x !== 0 || this.model.position.z !== 0) { this.model.rotation.x = 0; this.model.position.z = 0; }
    const f = this.flash > 0 ? this.flash / 6 : 0; if (this.flash > 0) this.flash--;
    const veil = this.veilT > 0 ? 0.3 : 1;
    for (const m of this.mats) {
      m.emissive.copy(this.flashColor).multiplyScalar(f * 0.1);
      if (this.poisonT > 0 && f === 0) { const k = 0.06 + 0.05 * Math.sin(this.poisonT * 0.25); m.emissive.setRGB(k * 0.8, 0, k); }
      m.transparent = veil < 1; m.opacity = veil;
    }
    for (const m of this.outlines) { m.transparent = veil < 1; m.opacity = veil; m.visible = veil > 0.5; }
  }
}

export interface World {
  /** demo mode: the player character is driven by the AI and aims like one */
  autopilot?: boolean;
  nearestEnemy(f: Fighter, maxD?: number): Fighter | undefined;
  checkHits(f: Fighter, m: MoveDef, hitIndex: number): void;
  tryGrab(f: Fighter, cmd: boolean, combo?: boolean): boolean;
  releaseThrow(f: Fighter, v: Fighter): void;
  onLand(f: Fighter, impact: number): void;
  onBounce(f: Fighter, impact: number): void;
  onRailHit(f: Fighter): void;
  onJump(f: Fighter): void;
  onRingOut(f: Fighter): void;
  onMoveStart(f: Fighter, m: MoveDef): void;
  onCharge(f: Fighter, t: number): void;
  beginTransform(f: Fighter): void;
  endTransform(f: Fighter): void;
  teleportBehind(f: Fighter): void;
  spawnSmoke(f: Fighter): void;
  poisonTick(f: Fighter): void;
}
