// Hand-authored fighting animation for the chibi rig.
// Every clip is a short list of key poses (joint Euler angles in degrees, YXZ) at explicit 60 fps frame numbers.
// Strikes are built for weight: coil -> 2-3 frame snap -> overshoot -> held impact -> slow recovery, with the striking
// fist / foot swelling for a frame ("smear"). Poses are sampled to ordinary THREE.AnimationClips at load time; the
// pelvis height is solved so the lowest body point rests on the ground, and each clip carries its exact hit frames.
//
// Conventions (model space: +z forward, +x = the fighter's left, limbs hang down at rest):
//   arm/leg rx<0 swings forward · lowerarm rx<0 bends the elbow · calf rx>0 bends the knee · spine rx>0 leans forward
//   ry>0 turns left · left limb rz>0 / right limb rz<0 lifts it out to the side
import * as THREE from 'three';
import { JOINT_NAMES, makeSkeleton, HEAD_UP, HEAD_R, SOLE, V3 } from './rig';

export type StrikeNode = 'hand_l' | 'hand_r' | 'foot_l' | 'foot_r' | 'calf_l' | 'calf_r' | 'lowerarm_l' | 'lowerarm_r' | 'upperarm_l' | 'upperarm_r';
export interface ClipMeta { hits: { limb: StrikeNode; t: number }[]; wind?: number; loco?: number }
export const META: Record<string, ClipMeta> = {};
export const CLIPS = new Map<string, THREE.AnimationClip>();

type Pose = Record<string, any>;
type Ease = 'lin' | 'in' | 'out' | 'io';
type Key = [number, Pose, Ease?, StrikeNode?];

const SHORT: Record<string, string> = {
  pelvis: 'pel', spine_01: 's1', spine_03: 's3', neck_01: 'nk', Head: 'hd', upperarm_l: 'uaL', lowerarm_l: 'laL', hand_l: 'hL',
  upperarm_r: 'uaR', lowerarm_r: 'laR', hand_r: 'hR', thigh_l: 'thL', calf_l: 'cL', foot_l: 'fL', thigh_r: 'thR', calf_r: 'cR', foot_r: 'fR',
};
const SCALED = ['hand_l', 'hand_r', 'foot_l', 'foot_r'];
const v3 = (v: any): V3 => (v === undefined ? [0, 0, 0] : typeof v === 'number' ? [v, 0, 0] : v);
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const clamp = THREE.MathUtils.clamp;

/** keep the eyes on the opponent: turn (and level) the head against whatever the body is doing */
function look(p: Pose): Pose {
  const pel = v3(p.pel), s1 = v3(p.s1), s3 = v3(p.s3);
  const yaw = clamp(-wrap(pel[1] + s1[1] + s3[1]), -85, 85), pitch = pel[0] + s1[0] + s3[0], k = Math.cos((yaw * Math.PI) / 180);
  return { ...p, nk: [clamp(-pitch * 0.2 * k, -25, 25), yaw * 0.35, 0], hd: [clamp(-pitch * 0.45 * k, -35, 35), yaw * 0.65, 0] };
}

// fighting stance: left side leading, knees bent, fists up
const ST: Pose = look({
  pel: [0, -30, 0], s1: [6, 8, 0], s3: [4, 10, 0],
  uaL: [-50, -10, 14], laL: -100, uaR: [-25, 10, -18], laR: -125,
  thL: [-28, 25, 10], cL: 34, fL: -6, thR: [14, -15, -14], cR: 30, fR: -30,
});
/** pose on top of the stance (head follows the target unless the pose sets it) */
const S = (o: Pose = {}): Pose => { const q = { ...ST, ...o }; return 'hd' in o ? q : look(q); };
/** pose from the neutral rest (lying, tumbling, reactions): nothing automatic */
const Z = (o: Pose = {}): Pose => ({ ...o });
/** airborne pose: pelvis at a fixed height above the root instead of resting on the ground */
const A = (o: Pose = {}): Pose => look({ abs: 0.5, ...o });
const mir = (p: Pose): Pose => {
  const q: Pose = {};
  for (const [k, v] of Object.entries(p)) {
    const kk = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
    if (k === 'p') q.p = [-v[0], v[1], v[2]];
    else if (k === 'sc') q.sc = Object.fromEntries(Object.entries(v).map(([a, b]) => [a.endsWith('L') ? a.slice(0, -1) + 'R' : a.slice(0, -1) + 'L', b]));
    else if (k === 'abs') q.abs = v;
    else { const a = v3(v); q[kk] = [a[0], -a[1], -a[2]]; }
  }
  return q;
};
/** push a pose past itself along the way it came from (follow-through) */
function over(from: Pose, to: Pose, k: number): Pose {
  const q: Pose = { ...to };
  for (const s of Object.values(SHORT)) { const a = v3(from[s]), b = v3(to[s]); q[s] = [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k, b[2] + (b[2] - a[2]) * k]; }
  const a = v3(from.p), b = v3(to.p); q.p = [b[0] + (b[0] - a[0]) * k, b[1], b[2] + (b[2] - a[2]) * k];
  return q;
}
const SC: Record<string, string> = { hand_l: 'hL', hand_r: 'hR', foot_l: 'fL', foot_r: 'fR', calf_l: 'fL', calf_r: 'fR', lowerarm_l: 'hL', lowerarm_r: 'hR', upperarm_l: 'hL', upperarm_r: 'hR' };
/** the impact: snap into the hit pose (limb swollen), overshoot, hold */
function imp(f: number, from: Pose, hit: Pose, limb: StrikeNode, hold = 6, smear = 1.5): Key[] {
  const s = SC[limb];
  return [[f, { ...hit, sc: { [s]: smear } }, 'in', limb], [f + 2, { ...over(from, hit, 0.07), sc: { [s]: 1 + (smear - 1) * 0.4 } }, 'out'], [f + hold, hit, 'io']];
}

// ------------------------------------------------------------------ sampling
const sk = makeSkeleton();
const CONTACT: [string, V3, number][] = [
  ['foot_l', [0, -SOLE, -0.05], 0], ['foot_l', [0, -SOLE, 0.15], 0], ['foot_r', [0, -SOLE, -0.05], 0], ['foot_r', [0, -SOLE, 0.15], 0],
  ['calf_l', [0, 0, 0], 0.09], ['calf_r', [0, 0, 0], 0.09], ['pelvis', [0, -0.01, 0], 0.13], ['spine_03', [0, 0.065, 0], 0.15],
  ['Head', [0, HEAD_UP, 0], HEAD_R], ['hand_l', [0, -0.07, 0], 0.08], ['hand_r', [0, -0.07, 0], 0.08], ['lowerarm_l', [0, 0, 0], 0.055], ['lowerarm_r', [0, 0, 0], 0.055],
];
const D2R = Math.PI / 180, tv = new THREE.Vector3();
interface Full { r: number[]; p: V3; abs: number | null; sc: number[] }
function full(p: Pose): Full {
  const r: number[] = [];
  for (const j of JOINT_NAMES) r.push(...v3(p[SHORT[j]]));
  return { r, p: v3(p.p), abs: p.abs ?? null, sc: SCALED.map((n) => p.sc?.[SC[n]] ?? 1) };
}
const EASE: Record<Ease, (u: number) => number> = { lin: (u) => u, in: (u) => u * u * u, out: (u) => 1 - (1 - u) ** 3, io: (u) => u * u * (3 - 2 * u) };

function build(name: string, keys: Key[], loop: boolean) {
  const K = keys.map(([f, p, e, h]) => ({ f, q: full(p), e: e ?? 'io', h }));
  const N = K[K.length - 1].f; const times = new Float32Array(N + 1);
  const quat: number[][] = JOINT_NAMES.map(() => []); const pos: number[] = []; const scl: number[][] = SCALED.map(() => []);
  const prev = JOINT_NAMES.map(() => new THREE.Quaternion()); const q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
  let seg = 0;
  for (let f = 0; f <= N; f++) {
    while (seg < K.length - 2 && f > K[seg + 1].f) seg++;
    const a = K[seg], b = K[seg + 1]; const u = EASE[b.e](clamp((f - a.f) / Math.max(1, b.f - a.f), 0, 1));
    times[f] = f / 60;
    JOINT_NAMES.forEach((j, i) => {
      const x = a.q.r[i * 3] + (b.q.r[i * 3] - a.q.r[i * 3]) * u, y = a.q.r[i * 3 + 1] + (b.q.r[i * 3 + 1] - a.q.r[i * 3 + 1]) * u, z = a.q.r[i * 3 + 2] + (b.q.r[i * 3 + 2] - a.q.r[i * 3 + 2]) * u;
      q.setFromEuler(eu.set(x * D2R, y * D2R, z * D2R)); if (f > 0 && q.dot(prev[i]) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prev[i].copy(q); quat[i].push(q.x, q.y, q.z, q.w); sk.nodes[j].quaternion.copy(q);
    });
    const px = a.q.p[0] + (b.q.p[0] - a.q.p[0]) * u, lift = a.q.p[1] + (b.q.p[1] - a.q.p[1]) * u, pz = a.q.p[2] + (b.q.p[2] - a.q.p[2]) * u;
    // rest the lowest point of the body on the ground
    sk.nodes.pelvis.position.set(px, 0, pz); sk.root.updateMatrixWorld(true);
    let low = Infinity;
    for (const [n, o, rad] of CONTACT) low = Math.min(low, tv.set(o[0], o[1], o[2]).applyMatrix4(sk.nodes[n].matrixWorld).y - rad);
    const g = -low + lift; const ya = a.q.abs ?? g, yb = b.q.abs ?? g;
    pos.push(px, ya + (yb - ya) * u, pz);
    SCALED.forEach((_, i) => { const s = a.q.sc[i] + (b.q.sc[i] - a.q.sc[i]) * u; scl[i].push(s, s, s); });
  }
  const tracks: THREE.KeyframeTrack[] = JOINT_NAMES.map((j, i) => new THREE.QuaternionKeyframeTrack(`${j}.quaternion`, times as any, quat[i]));
  tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', times as any, pos));
  SCALED.forEach((n, i) => tracks.push(new THREE.VectorKeyframeTrack(`${n}.scale`, times as any, scl[i])));
  CLIPS.set(name, new THREE.AnimationClip(name, N / 60, tracks));
  META[name] = { hits: K.filter((k) => k.h).map((k) => ({ limb: k.h!, t: k.f / 60 })) };
  void loop;
}
const def = (name: string, keys: Key[], meta: Partial<ClipMeta> = {}) => { build(name, keys, false); Object.assign(META[name], meta); };

// ================================================================== locomotion
def('Idle_Loop', [[0, ST], [30, S({ s1: [9, 8, 0], uaL: [-46, -10, 15], laL: -104, uaR: [-22, 10, -19], laR: -128, thL: [-34, 25, 10], cL: 46, fL: -12, thR: [17, -15, -14], cR: 38, fR: -34 })], [60, ST]]);

function runCycle(name: string, n: number, th: number, lean: number, arm: number, bounce: number, loco: number) {
  const body = { pel: [lean * 0.45, -9, 0], s1: [lean * 0.55, 5, 0], s3: [0, 12, 0] };
  const con = look({ ...body, thL: [-th, 0, 3], cL: th * 0.3, fL: 8, thR: [th * 0.8, 0, -3], cR: 35 + th * 0.6, fR: 35, uaR: [-arm, 0, -12], laR: -100, uaL: [arm * 0.9, 0, 14], laL: -80 });
  const pas = look({ pel: [lean * 0.45, 0, 0], s1: [lean * 0.55, 0, 0], thL: [-6, 0, 3], cL: 26, fL: -20 - lean * 0.45, thR: [-th * 0.75, 0, -3], cR: 105, fR: 15, uaR: [-8, 0, -12], laR: -95, uaL: [-8, 0, 12], laL: -95, p: [0, bounce, 0] });
  def(name, [[0, con, 'lin'], [n / 4, pas, 'lin'], [n / 2, mir(con), 'lin'], [(3 * n) / 4, mir(pas), 'lin'], [n, con, 'lin']], { loco });
}
runCycle('Walk_Loop', 36, 26, 6, 25, 0.01, 1.6);
runCycle('Jog_Fwd_Loop', 22, 46, 18, 55, 0.04, 4.2);
runCycle('Sprint_Loop', 18, 62, 42, 80, 0.07, 7.0);

const AIR1 = A({ pel: [6, -15, 0], s1: [8, 5, 0], uaL: [-20, 0, 55], laL: -60, uaR: [-10, 0, -60], laR: -70, thL: [-70, 10, 6], cL: 95, fL: 25, thR: [-15, -5, -8], cR: 70, fR: 35 });
def('Jump_Loop', [[0, AIR1], [20, A({ pel: [2, -15, 0], s1: [4, 5, 0], uaL: [-10, 0, 70], laL: -45, uaR: [0, 0, -72], laR: -55, thL: [-58, 10, 6], cL: 85, fL: 25, thR: [-5, -5, -8], cR: 55, fR: 35 })], [40, AIR1]]);
const TUCK = Z({ abs: 0.56, pel: [20, 0, 0], s1: [28, 0, 0], s3: [22, 0, 0], nk: [15, 0, 0], hd: [20, 0, 0], uaL: [-75, -15, 8], laL: -95, uaR: [-75, 15, -8], laR: -95, thL: [-125, 0, 6], cL: 135, fL: 20, thR: [-125, 0, -6], cR: 135, fR: 20 });
def('NinjaJump_Idle_Loop', [[0, TUCK], [20, { ...TUCK, s1: [32, 0, 0] }], [40, TUCK]]);
const CROUCH = S({ pel: [10, -30, 0], s1: [22, 8, 0], uaL: [-30, -10, 30], laL: -70, uaR: [-10, 10, -35], laR: -80, thL: [-78, 25, 12], cL: 112, fL: -44, thR: [-30, -15, -16], cR: 100, fR: -50 });
def('NinjaJump_Land', [[0, CROUCH], [5, S({ ...CROUCH, s1: [26, 8, 0] }), 'out'], [24, ST]]);

// ================================================================== defence, grabs, utility
const GUARD = S({ pel: [4, -24, 0], s1: [14, 6, 0], s3: [8, 8, 0], uaL: [-78, 22, 8], laL: -132, uaR: [-74, -14, -8], laR: -134, thL: [-38, 20, 10], cL: 52, fL: -14, thR: [10, -18, -14], cR: 46, fR: -40 });
def('guard_pose', [[0, GUARD], [30, S({ ...GUARD, s1: [17, 6, 0] })], [60, GUARD]]);
const PARRY = S({ pel: [0, -48, 0], s1: [4, 0, 0], s3: [2, 0, 0], uaL: [-70, 40, 50], laL: -95, uaR: [40, 0, -10], laR: -115, thL: [-40, 45, 10], cL: 54, fL: -14, thR: [16, 3, -14], cR: 38, fR: -34 });
def('Sword_Block', [[0, ST], [7, PARRY, 'out'], [44, S({ ...PARRY, uaL: [-66, 36, 54] })], [58, ST]]);
const REACH = S({ pel: [8, -8, 0], s1: [18, 4, 0], s3: [10, 4, 0], uaL: [-82, 14, 6], laL: -22, uaR: [-80, -14, -6], laR: -22, thL: [-46, 6, 8], cL: 50, fL: -4, thR: [28, -10, -10], cR: 22, fR: -46, p: [0, 0, 0.14] });
def('Push_Loop', [[0, ST], [11, REACH, 'in'], [15, over(ST, REACH, 0.05), 'out'], [48, S({ ...REACH, uaL: [-70, 10, 8], laL: -50, uaR: [-68, -10, -8], laR: -50 })], [72, ST]]);
const HOLD = S({ pel: [4, -10, 0], s1: [10, 4, 0], uaL: [-70, 10, 8], laL: -55, uaR: [-68, -8, -8], laR: -55, thL: [-36, 8, 10], cL: 46, fL: -10, thR: [14, -10, -12], cR: 34, fR: -36 });
def('pull_throw', [[0, HOLD], [14, S({ pel: [10, 130, 0], s1: [16, 10, 0], s3: [6, 10, 0], uaL: [-130, -30, 10], laL: -100, uaR: [-140, -10, -10], laR: -110, thL: [-52, 0, 12], cL: 78, fL: -30, thR: [-40, 0, -12], cR: 72, fR: -30, hd: [0, 30, 0] }), 'io'],
  [28, S({ pel: [46, 150, 0], s1: [34, 6, 0], s3: [20, 4, 0], uaL: [-40, -20, 10], laL: -30, uaR: [-50, 10, -10], laR: -30, thL: [-66, 0, 12], cL: 40, fL: -20, thR: [-56, 0, -12], cR: 36, fR: -20, hd: [-30, 20, 0] }), 'in'],
  [40, S({ pel: [40, 150, 0], s1: [30, 6, 0], s3: [18, 4, 0], uaL: [-30, -20, 10], laL: -30, uaR: [-40, 10, -10], laR: -30, thL: [-62, 0, 12], cL: 44, fL: -22, thR: [-52, 0, -12], cR: 40, fR: -22, hd: [-30, 20, 0] })], [62, S({ pel: [0, 330, 0] })]]);
def('OverhandThrow', [[0, HOLD], [22, S({ pel: [-10, -40, 0], s1: [-12, 0, 0], s3: [-10, 0, 0], uaL: [-150, 0, 14], laL: -50, uaR: [-160, 0, -14], laR: -60, thL: [-20, 35, 10], cL: 30, fL: -10, thR: [-10, -5, -14], cR: 50, fR: -30 }), 'io'],
  [38, S({ pel: [14, 10, 0], s1: [26, 4, 0], s3: [16, 4, 0], uaL: [-50, 10, 12], laL: -15, uaR: [-56, -10, -12], laR: -15, thL: [-50, -12, 8], cL: 56, fL: -8, thR: [30, -30, -10], cR: 24, fR: -48, p: [0, 0, 0.14] }), 'in'],
  [50, S({ pel: [12, 10, 0], s1: [22, 4, 0], s3: [14, 4, 0], uaL: [-40, 10, 12], laL: -20, uaR: [-46, -10, -12], laR: -20, thL: [-48, -12, 8], cL: 54, fL: -8, thR: [28, -30, -10], cR: 24, fR: -46, p: [0, 0, 0.12] })], [72, ST]]);

// lying, rolling, getting up
const ON_BACK = Z({ pel: [-88, 0, 0], nk: [14, 0, 0], hd: [20, 0, 0], uaL: [0, 0, 68], laL: -28, uaR: [0, 0, -68], laR: -28, thL: [4, 0, 14], cL: 12, thR: [4, 0, -14], cR: 12 });
const ON_FACE = Z({ pel: [88, 0, 0], nk: [-12, 0, 0], hd: [-22, 40, 0], uaL: [-148, 0, 38], laL: -50, uaR: [-148, 0, -38], laR: -50, thL: [0, 0, 10], cL: 6, fL: 62, thR: [0, 0, -10], cR: 6, fR: 62 });
const BALL = Z({ pel: [30, 0, 0], s1: [30, 0, 0], s3: [24, 0, 0], nk: [15, 0, 0], hd: [20, 0, 0], uaL: [-70, -15, 8], laL: -100, uaR: [-70, 15, -8], laR: -100, thL: [-120, 0, 8], cL: 130, fL: 0, thR: [-120, 0, -8], cR: 130, fR: 0 });
const spin = (base: Pose, rx: number, yaw = 0): Pose => ({ ...base, pel: [rx, yaw, 0] });
def('Roll', [[0, spin(BALL, 30), 'lin'], [6, spin(BALL, 110), 'lin'], [12, spin(BALL, 200), 'lin'], [18, spin(BALL, 290), 'lin'], [24, spin(BALL, 380), 'lin'], [30, { ...CROUCH, pel: [370, -30, 0] }, 'out'], [48, { ...ST, pel: [360, -30, 0] }]]);
def('getup_back', [[0, ON_BACK], [12, Z({ pel: [-112, 0, 0], s1: [14, 0, 0], nk: [14, 0, 0], hd: [20, 0, 0], uaL: [20, 0, 30], laL: -40, uaR: [20, 0, -30], laR: -40, thL: [-118, 0, 8], cL: 70, thR: [-118, 0, -8], cR: 70 }), 'io'],
  [22, S({ ...CROUCH, uaL: [30, 0, 30], laL: -40, uaR: [30, 0, -30], laR: -40 }), 'in'], [26, CROUCH, 'out'], [40, ST]]);
def('getup_face', [[0, ON_FACE], [16, Z({ pel: [62, 0, 0], s1: [-8, 0, 0], hd: [-40, 0, 0], uaL: [-78, 0, 20], laL: -20, uaR: [-78, 0, -20], laR: -20, thL: [-40, 0, 8], cL: 100, fL: 40, thR: [-40, 0, -8], cR: 100, fR: 40 }), 'io'], [32, CROUCH, 'io'], [48, ST]]);
def('fall_face', [[0, ST], [14, Z({ pel: [40, 0, 0], s1: [10, 0, 0], hd: [-20, 0, 0], uaL: [-90, 0, 30], laL: -30, uaR: [-90, 0, -30], laR: -30, thL: [-10, 0, 8], cL: 40, fL: 20, thR: [10, 0, -8], cR: 30, fR: 30 }), 'in'],
  [30, ON_FACE, 'in'], [36, { ...ON_FACE, thL: [22, 0, 12], cL: 30, thR: [18, 0, -12], cR: 36, uaL: [-150, 0, 46], uaR: [-150, 0, -46] }, 'out'], [45, ON_FACE, 'in'], [50, { ...ON_FACE, thL: [8, 0, 10], thR: [8, 0, -10] }, 'out'], [58, ON_FACE]]);

// hit reactions
const REEL_HEAD = S({ pel: [-8, -30, 0], s1: [-16, 8, 0], s3: [-14, 10, 0], nk: [-16, 0, 0], hd: [-32, 18, 8], uaL: [-30, -10, 34], laL: -62, uaR: [-6, 10, -40], laR: -72, thL: [-18, 25, 10], cL: 28, fL: -4, thR: [26, -15, -14], cR: 40, fR: -42, p: [0, 0, -0.1] });
def('Hit_Head', [[0, ST], [3, REEL_HEAD, 'out'], [9, over(ST, REEL_HEAD, -0.2), 'io'], [30, ST]]);
const REEL_BODY = S({ pel: [12, -30, 0], s1: [28, 8, 0], s3: [20, 10, 0], nk: [10, 0, 0], hd: [16, 10, 0], uaL: [-30, -34, 10], laL: -112, uaR: [-20, 34, -10], laR: -116, thL: [-42, 25, 10], cL: 54, fL: -12, thR: [-4, -15, -14], cR: 54, fR: -40, p: [0, 0, -0.12] });
def('Hit_Chest', [[0, ST], [3, REEL_BODY, 'out'], [10, over(ST, REEL_BODY, -0.2), 'io'], [32, ST]]);
const FLY = Z({ abs: 0.5, pel: [-62, 0, 0], s1: [22, 0, 0], s3: [18, 0, 0], nk: [10, 0, 0], hd: [14, 0, 0], uaL: [-78, 0, 34], laL: -20, uaR: [-70, 0, -40], laR: -28, thL: [-66, 0, 16], cL: 30, fL: 20, thR: [-48, 0, -14], cR: 44, fR: 20 });
def('Hit_Knockback', [[0, { ...REEL_HEAD, abs: 0.52 }], [5, FLY, 'out'], [24, { ...FLY, abs: 0.42, pel: [-84, 0, 0], s1: [8, 0, 0], s3: [6, 0, 0], uaL: [-30, 0, 60], uaR: [-24, 0, -64], thL: [-30, 0, 16], thR: [-18, 0, -14] }], [44, { ...ON_BACK, abs: 0.3 }]]);
def('Hit_Knockface', [[0, { ...REEL_BODY, abs: 0.52 }], [6, Z({ abs: 0.5, pel: [50, 0, 0], s1: [14, 0, 0], hd: [-30, 0, 0], uaL: [-120, 0, 30], laL: -30, uaR: [-110, 0, -34], laR: -36, thL: [20, 0, 10], cL: 50, fL: 40, thR: [34, 0, -10], cR: 30, fR: 40 }), 'out'], [30, { ...ON_FACE, abs: 0.3 }]]);

// spirit power-up, victory
const GATHER = S({ pel: [6, -10, 0], s1: [20, 4, 0], s3: [12, 4, 0], uaL: [-60, -40, 10], laL: -110, uaR: [-60, 40, -10], laR: -110, thL: [-48, 10, 14], cL: 70, fL: -22, thR: [-20, -10, -16], cR: 70, fR: -44, hd: [14, 6, 0] });
const BURST = S({ pel: [-6, 0, 0], s1: [-12, 0, 0], s3: [-10, 0, 0], uaL: [20, 0, 48], laL: -40, uaR: [20, 0, -48], laR: -40, thL: [-20, 0, 18], cL: 26, fL: -6, thR: [-16, 0, -18], cR: 26, fR: -10, hd: [-24, 0, 0] });
def('Spell_Simple_Enter', [[0, ST], [10, GATHER, 'out'], [30, S({ ...GATHER, s1: [24, 4, 0] })]]);
def('Spell_Simple_Shoot', [[0, GATHER], [5, BURST, 'in'], [8, over(GATHER, BURST, 0.08), 'out'], [26, BURST], [40, ST]]);
const CHEER = S({ pel: [0, 0, 0], s1: [-4, 0, 0], s3: [-4, 0, 0], uaL: [-10, 0, 20], laL: -110, uaR: [-170, 0, -12], laR: -12, thL: [-10, 0, 10], cL: 14, fL: -4, thR: [-10, 0, -10], cR: 14, fR: -4, hd: [-8, 0, 0] });
const CHEER2 = S({ ...CHEER, uaR: [-150, 0, -14], laR: -70, thL: [-26, 0, 10], cL: 44, fL: -18, thR: [-26, 0, -10], cR: 44, fR: -18, s1: [6, 0, 0], hd: [2, 0, 0] });
def('Dance_Loop', [[0, CHEER2], [9, { ...CHEER, p: [0, 0.12, 0] }, 'out'], [18, CHEER2, 'in'], [24, CHEER2]]);
def('Yes', [[0, ST], [10, CHEER2, 'out'], [18, { ...CHEER, p: [0, 0.25, 0], thL: [-50, 0, 14], cL: 100, thR: [-10, 0, -10], cR: 80 }, 'out'], [28, CHEER2, 'in'], [36, S({ ...CHEER, uaL: [0, 0, 30], laL: -120, pel: [0, 12, 4], hd: [-6, -10, -6] }), 'out'], [60, S({ ...CHEER, uaL: [0, 0, 30], laL: -122, pel: [0, 12, 4], hd: [-6, -10, -6] })]]);

// ================================================================== hand strikes
// jab (lead hand): quick but with the whole body behind it
const JAB_W = S({ pel: [0, -22, 0], uaL: [-40, -14, 22], laL: -124, thL: [-30, 20, 10], cL: 40, fL: -10, p: [0, 0, -0.03] });
const JAB = S({ pel: [0, -54, 0], s1: [9, -2, 0], s3: [5, -4, 0], uaL: [-94, 54, 0], laL: -4, uaR: [-30, 10, -20], laR: -132, thL: [-40, 49, 8], cL: 46, fL: -6, thR: [24, 12, -10], cR: 18, fR: -42, p: [0, 0, 0.09] });
def('Punch_Jab', [[0, ST], [4, JAB_W, 'out'], ...imp(7, JAB_W, JAB, 'hand_l', 6, 1.4), [24, ST]]);

// cross (rear hand): hips and shoulders turn all the way through
const CROSS_W = S({ pel: [0, -54, 0], s1: [6, 0, 0], s3: [4, -4, 0], uaR: [22, 28, -30], laR: -124, uaL: [-62, 4, 10], laL: -78, thL: [-42, 49, 10], cL: 56, fL: -14, thR: [6, 9, -14], cR: 46, fR: -34, p: [0, 0, -0.06] });
const CROSS = S({ pel: [0, 26, 0], s1: [11, 10, 0], s3: [7, 14, 0], uaR: [-94, -48, 0], laR: -4, uaL: [32, -10, 24], laL: -126, thL: [-44, -28, 6], cL: 52, fL: -8, thR: [34, -42, -8], cR: 12, fR: -46, p: [0, 0, 0.15] });
def('Punch_Cross', [[0, ST], [6, CROSS_W, 'out'], ...imp(10, CROSS_W, CROSS, 'hand_r', 7, 1.6), [34, ST]]);

// hook (lead hand): the arm stays bent, the body whips it round
const HOOK_W = S({ pel: [0, -62, 0], s1: [8, -6, 0], s3: [4, -8, 0], uaL: [0, 30, 78], laL: -80, uaR: [-30, 10, -20], laR: -130, thL: [-40, 56, 8], cL: 52, fL: -12, thR: [8, 14, -12], cR: 42, fR: -34, p: [0, 0, -0.04] });
const HOOK = S({ pel: [0, 30, 0], s1: [8, 12, 0], s3: [4, 16, 0], uaL: [0, -92, 86], laL: -72, uaR: [22, 0, -24], laR: -126, thL: [-40, -32, 6], cL: 48, fL: -8, thR: [28, -40, -8], cR: 20, fR: -46, p: [0.03, 0, 0.22] });
def('Melee_Hook', [[0, ST], [8, HOOK_W, 'out'], ...imp(13, HOOK_W, HOOK, 'hand_l', 8, 1.7), [40, ST]]);

// quick lead backfist / low straight / double palm (the three-beat hand string)
const BACKFIST_W = S({ pel: [0, -10, 0], uaL: [-60, -70, 20], laL: -120, thL: [-30, 8, 10], cL: 40, fL: -10 });
const BACKFIST = S({ pel: [0, -58, 0], s1: [8, -4, 0], s3: [4, -6, 0], uaL: [-86, 62, 10], laL: -8, uaR: [-10, 10, -24], laR: -124, thL: [-40, 53, 8], cL: 46, fL: -6, thR: [22, 14, -10], cR: 20, fR: -42, p: [0, 0, 0.08] });
def('punch_seq_a', [[0, ST], [3, BACKFIST_W, 'out'], ...imp(6, BACKFIST_W, BACKFIST, 'hand_l', 5, 1.4), [22, ST]]);
const BODY_W = S({ pel: [4, -56, 0], s1: [14, 0, 0], uaR: [26, 24, -26], laR: -118, thL: [-48, 51, 10], cL: 66, fL: -18, thR: [0, 11, -14], cR: 56, fR: -40, p: [0, 0, -0.04] });
const BODY = S({ pel: [8, 22, 0], s1: [20, 10, 0], s3: [10, 12, 0], uaR: [-74, -42, 0], laR: -6, uaL: [24, -10, 22], laL: -128, thL: [-56, -24, 6], cL: 70, fL: -14, thR: [26, -38, -8], cR: 34, fR: -52, p: [0, 0, 0.14] });
def('punch_seq_b', [[0, ST], [5, BODY_W, 'out'], ...imp(8, BODY_W, BODY, 'hand_r', 6, 1.5), [28, ST]]);
const PALM_W = S({ pel: [6, -40, 0], s1: [16, 4, 0], s3: [8, 6, 0], uaL: [30, 0, 16], laL: -118, uaR: [34, 0, -16], laR: -120, thL: [-50, 35, 10], cL: 72, fL: -22, thR: [-6, -5, -14], cR: 62, fR: -40, p: [0, 0, -0.08] });
const PALM = S({ pel: [6, -6, 0], s1: [16, 2, 0], s3: [10, 2, 0], uaL: [-86, 14, 4], laL: -6, uaR: [-84, -12, -4], laR: -6, thL: [-52, 4, 8], cL: 56, fL: -4, thR: [34, -12, -10], cR: 12, fR: -46, p: [0, 0, 0.2] });
def('punch_seq_c', [[0, ST], [9, PALM_W, 'out'], ...imp(14, PALM_W, PALM, 'hand_r', 9, 1.7), [44, ST]]);
def('box_triple', [[0, ST], [4, JAB_W, 'out'], ...imp(7, JAB_W, JAB, 'hand_l', 4, 1.4), [14, CROSS_W, 'out'], ...imp(18, CROSS_W, CROSS, 'hand_r', 4, 1.5), [25, HOOK_W, 'out'], ...imp(30, HOOK_W, HOOK, 'hand_l', 8, 1.7), [56, ST]]);

// uppercut: sink, then drive up off both legs
const UPPER_W = S({ pel: [8, -58, 0], s1: [22, 0, 0], s3: [10, -4, 0], uaR: [30, 20, -14], laR: -80, uaL: [-60, 4, 12], laL: -100, thL: [-66, 53, 12], cL: 96, fL: -30, thR: [-16, 13, -14], cR: 84, fR: -46, p: [0, 0, -0.03] });
const UPPER = S({ pel: [-8, 24, 0], s1: [-10, 8, 0], s3: [-8, 12, 0], uaR: [-138, -36, -6], laR: -62, uaL: [26, -10, 24], laL: -124, thL: [-10, -26, 6], cL: 8, fL: 26, thR: [12, -30, -8], cR: 10, fR: 20, p: [0, 0.1, 0.12] });
def('uppercut', [[0, ST], [8, UPPER_W, 'out'], ...imp(12, UPPER_W, UPPER, 'hand_r', 8, 1.7), [28, CROUCH, 'io'], [42, ST]]);

// charged straight: a long coil that can be held, then a full-body lunge
const CHARGE_W = S({ pel: [4, -72, 0], s1: [12, -6, 0], s3: [6, -8, 0], uaR: [44, 20, -20], laR: -112, uaL: [-84, 76, 0], laL: -14, thL: [-56, 67, 12], cL: 80, fL: -24, thR: [-10, 30, -18], cR: 70, fR: -50, p: [0, 0, -0.1] });
const CHARGE = S({ pel: [6, 36, 0], s1: [14, 12, 0], s3: [8, 16, 0], uaR: [-92, -62, 0], laR: -2, uaL: [40, -10, 26], laL: -124, thL: [-58, -38, 6], cL: 62, fL: -4, thR: [40, -50, -8], cR: 8, fR: -48, p: [0, 0, 0.3] });
def('charge_punch', [[0, ST], [10, CHARGE_W, 'out'], [13, S({ ...CHARGE_W, p: [0, 0, -0.12] })], ...imp(18, CHARGE_W, CHARGE, 'hand_r', 11, 1.9), [52, ST]], { wind: 11 / 60 });

// downward elbow
const ELBOW_W = S({ pel: [-6, -44, 0], s1: [-8, 0, 0], s3: [-6, 0, 0], uaR: [-165, 0, -16], laR: -138, uaL: [-60, 6, 12], laL: -90, thL: [-22, 39, 10], cL: 26, fL: -4, thR: [10, -1, -14], cR: 22, fR: -10 });
const ELBOW = S({ pel: [12, 14, 0], s1: [26, 8, 0], s3: [14, 10, 0], uaR: [-66, -28, -4], laR: -134, uaL: [20, -10, 22], laL: -122, thL: [-58, -16, 6], cL: 78, fL: -18, thR: [14, -30, -10], cR: 50, fR: -54, p: [0, 0, 0.16] });
def('elbow_drop', [[0, ST], [7, ELBOW_W, 'out'], ...imp(11, ELBOW_W, ELBOW, 'lowerarm_r', 7, 1.4), [34, ST]]);

// shoulder charge (super armour): tuck in behind the lead shoulder and run through
const BASH_W = S({ pel: [10, -50, 0], s1: [20, -4, 0], s3: [10, -6, 0], uaL: [-20, -40, 10], laL: -128, uaR: [20, 10, -22], laR: -100, thL: [-56, 45, 10], cL: 76, fL: -20, thR: [-4, 5, -14], cR: 60, fR: -44 });
const BASH = S({ pel: [16, -78, 12], s1: [22, -6, 6], s3: [12, -6, 4], uaL: [-36, -50, 6], laL: -136, uaR: [34, 10, -30], laR: -70, thL: [-58, 73, 8], cL: 64, fL: -8, thR: [36, 34, -8], cR: 12, fR: -48, p: [0, 0, 0.2] });
def('Shield_Dash_RM', [[0, ST], [5, BASH_W, 'out'], [9, BASH, 'in'], ...imp(14, BASH_W, BASH, 'upperarm_l', 10, 1.3), [30, CROUCH, 'io'], [46, ST]]);

// ================================================================== kicks
/** right-leg roundhouse family: hips turned over, body leaning away, the leg whipping round at the given height */
const rh = (yaw: number, up: number, tilt: number, knee: number, o: Pose = {}) => S({
  pel: [0, yaw, -tilt], s1: [4, -yaw * 0.2, tilt * 0.35], s3: [0, -yaw * 0.2, tilt * 0.3],
  thL: [-6, 0, tilt + 4], cL: 14, fL: -8, thR: [0, 0, -(90 + up - tilt)], cR: knee, fR: 38,
  uaL: [-58, 30, 26], laL: -108, uaR: [38, 0, -38], laR: -28, ...o,
});
const KICK_W = S({ pel: [0, -46, 0], s1: [10, 4, 0], uaL: [-64, 20, 18], laL: -84, uaR: [-40, 30, -14], laR: -110, thL: [-40, 44, 10], cL: 54, fL: -14, thR: [10, 2, -14], cR: 44, fR: -40, p: [0, 0, 0.02] });
const rhChamber = (up: number) => S({ pel: [0, 34, -8], s1: [6, -8, 4], thL: [-8, 0, 12], cL: 16, fL: -8, thR: [-44, 0, -(52 + up)], cR: 124, fR: 30, uaL: [-60, 20, 22], laL: -100, uaR: [-10, 20, -30], laR: -80 });
const LOW = rh(60, -34, 6, 14, { p: [0, 0, 0.06], thL: [-20, 0, 10], cL: 36, fL: -16 });
def('kick_low', [[0, ST], [5, { ...KICK_W, thR: [-10, 0, -34], cR: 80 }, 'out'], ...imp(9, KICK_W, LOW, 'foot_r', 6, 1.5), [30, ST]]);
const MID = rh(82, 4, 20, 6, { p: [0, 0, 0.08] });
def('kick_mid', [[0, ST], [5, KICK_W, 'out'], [9, rhChamber(0), 'lin'], ...imp(12, rhChamber(0), MID, 'foot_r', 7, 1.6), [24, rhChamber(-10), 'io'], [36, ST]]);
const HIGH = rh(94, 34, 34, 4, { p: [0, 0, 0.1] });
def('kick_round', [[0, ST], [6, KICK_W, 'out'], [10, rhChamber(20), 'lin'], ...imp(14, rhChamber(20), HIGH, 'foot_r', 8, 1.7), [28, rhChamber(0), 'io'], [42, ST]]);

// front snap kick
const FRONT_C = S({ pel: [-8, -4, 0], s1: [12, 4, 0], thL: [10, 4, 4], cL: 14, fL: -16, thR: [-104, -8, -4], cR: 122, fR: 25, uaL: [-46, -10, 18], laL: -110, uaR: [10, 10, -26], laR: -100 });
const FRONT = S({ pel: [-18, 8, 0], s1: [14, -4, 0], s3: [8, -4, 0], thL: [20, -8, 4], cL: 8, fL: -10, thR: [-96, -8, 0], cR: 2, fR: 42, uaL: [-40, -10, 24], laL: -116, uaR: [34, 0, -32], laR: -56, p: [0, 0, 0.07] });
def('kick_front', [[0, ST], [6, FRONT_C, 'out'], ...imp(10, FRONT_C, FRONT, 'foot_r', 6, 1.6), [20, FRONT_C, 'io'], [32, ST]]);
// heavy thrust kick with the sole
const STOMP_C = S({ pel: [-14, -10, 0], s1: [18, 4, 0], thL: [14, 10, 4], cL: 22, fL: -22, thR: [-128, -6, -4], cR: 132, fR: -10, uaL: [-56, -4, 22], laL: -100, uaR: [-30, 10, -30], laR: -100, p: [0, 0, -0.04] });
const STOMP = S({ pel: [-26, 12, 0], s1: [16, -6, 0], s3: [10, -6, 0], thL: [30, -12, 4], cL: 6, fL: -10, thR: [-74, -8, 0], cR: 0, fR: -24, uaL: [-30, -10, 34], laL: -90, uaR: [40, 0, -40], laR: -40, p: [0, 0, 0.16] });
def('stomp_kick', [[0, ST], [10, STOMP_C, 'out'], ...imp(15, STOMP_C, STOMP, 'foot_r', 9, 1.8), [30, FRONT_C, 'io'], [46, ST]]);
def('kick_mid_push', [[0, ST], [10, STOMP_C, 'out'], ...imp(15, STOMP_C, STOMP, 'foot_r', 9, 1.8), [46, ST]]);

// side kick: chamber to the chest, thrust the heel straight out
const SIDE_W = S({ pel: [0, -62, 0], s1: [10, 0, 0], uaL: [-60, 30, 14], laL: -110, uaR: [-40, 30, -14], laR: -120, thL: [-44, 58, 10], cL: 60, fL: -16, thR: [6, 14, -12], cR: 46, fR: -40 });
const SIDE_C = S({ pel: [0, 62, -10], s1: [4, -14, 4], s3: [0, -10, 0], thL: [-8, 0, 14], cL: 18, fL: -8, thR: [-78, 0, -36], cR: 128, fR: 0, uaL: [-52, 30, 20], laL: -120, uaR: [-30, 0, -30], laR: -110 });
const SIDE = S({ pel: [0, 96, -28], s1: [0, -12, 10], s3: [0, -10, 8], thL: [-4, 0, 32], cL: 8, fL: -6, thR: [0, 0, -68], cR: 0, fR: [-10, 0, 24], uaL: [-44, 40, 26], laL: -124, uaR: [0, 0, -60], laR: -14, p: [0, 0, 0.16] });
def('kick_side', [[0, ST], [6, SIDE_W, 'out'], [10, SIDE_C, 'lin'], ...imp(14, SIDE_C, SIDE, 'foot_r', 9, 1.8), [30, SIDE_C, 'io'], [44, ST]]);

// rising knee
const KNEE_W = S({ pel: [4, -42, 0], s1: [10, 2, 0], uaL: [-78, 6, 10], laL: -50, uaR: [-74, 14, -10], laR: -56, thL: [-38, 40, 10], cL: 50, fL: -12, thR: [12, 0, -14], cR: 40, fR: -36 });
const KNEE = S({ pel: [-12, 18, 0], s1: [16, 0, 0], s3: [8, 0, 0], thL: [12, -18, 4], cL: 4, fL: 24, thR: [-114, -12, -4], cR: 130, fR: 35, uaL: [-34, -10, 16], laL: -98, uaR: [-34, 10, -16], laR: -98, p: [0, 0, 0.16] });
def('knee', [[0, ST], [5, KNEE_W, 'out'], ...imp(9, KNEE_W, KNEE, 'calf_r', 7, 1.2), [32, ST]]);
def('knee_fly', [[0, ST], [6, { ...CROUCH, p: [0, 0, -0.02] }, 'out'], ...imp(12, CROUCH, { ...KNEE, p: [0, 0.32, 0.2], thL: [20, -18, 4], cL: 40, fL: 40 }, 'calf_r', 8, 1.2), [30, CROUCH, 'in'], [42, ST]]);

// spinning back kick (turns clockwise, heel driven straight back at the target)
def('kick_back_spin', [[0, ST],
  [6, S({ pel: [0, -78, 0], s1: [10, -10, 0], s3: [4, -10, 0], thL: [-36, 62, 8], cL: 48, fL: -12, thR: [4, 22, -10], cR: 42, fR: -36, uaL: [-40, -30, 10], laL: -100, uaR: [-20, -10, -26], laR: -110 }), 'out'],
  [11, S({ pel: [26, -150, 0], s1: [10, -15, 0], s3: [0, -10, 0], thL: [-30, 0, 4], cL: 24, fL: -20, thR: [-72, 0, -5], cR: 118, fR: 0, uaL: [-50, 0, 20], laL: -110, uaR: [-30, 0, -20], laR: -116 }), 'lin'],
  ...imp(16, S({ pel: [26, -150, 0], thR: [-72, 0, -5], cR: 118 }), S({ pel: [60, -186, 0], s1: [-6, -18, 0], s3: [-6, -12, 0], thL: [-60, 0, 4], cL: 8, fL: -8, thR: [42, 0, 0], cR: 0, fR: -26, uaL: [-60, 0, 30], laL: -90, uaR: [-20, 0, -30], laR: -100, p: [0, 0, 0.14] }), 'foot_r', 8, 1.8),
  [32, S({ pel: [14, -300, 0], thL: [-16, 0, 6], cL: 22, fL: -20, thR: [-50, 0, -10], cR: 100, fR: 0 }), 'io'], [46, S({ pel: [0, -390, 0] })]]);

// spinning hook kick (turns clockwise, the straight leg sweeps round heel first)
const HOOKK = (yaw: number, up: number, knee: number, o: Pose = {}) => S({ pel: [0, yaw, -28], s1: [0, -14, 10], s3: [0, -12, 8], thL: [-4, 0, 32], cL: 10, fL: -6, thR: [0, 0, -(62 + up)], cR: knee, fR: [-10, 0, 20], uaL: [-30, 20, 50], laL: -40, uaR: [10, 0, -70], laR: -20, ...o });
def('kick_spin', [[0, ST],
  [6, S({ pel: [0, -84, 0], s1: [12, -12, 0], s3: [4, -12, 0], thL: [-40, 66, 8], cL: 54, fL: -14, thR: [4, 24, -10], cR: 46, fR: -38, uaL: [-40, -40, 10], laL: -100, uaR: [-20, -20, -26], laR: -110 }), 'out'],
  [12, HOOKK(-196, -30, 50, { pel: [0, -196, -12], thL: [-10, 0, 14], cL: 24, fL: -12 }), 'lin'],
  ...imp(17, HOOKK(-196, -30, 50), HOOKK(-274, 6, 0, { p: [0, 0, 0.12] }), 'foot_r', 7, 1.8),
  [30, S({ pel: [0, -340, -6], thL: [-14, 0, 10], cL: 24, fL: -10, thR: [-20, 0, -30], cR: 80, fR: 0 }), 'io'], [48, S({ pel: [0, -390, 0] })]]);

// 540 tornado kick: spin up off the ground into a roundhouse
def('kick_tornado', [[0, ST], [7, { ...CROUCH, pel: [10, 20, 0] }, 'out'],
  [14, S({ pel: [0, 170, 0], thL: [-70, 0, 8], cL: 100, fL: 20, thR: [-10, 0, -10], cR: 40, fR: 30, uaL: [-40, 0, 50], laL: -60, uaR: [-40, 0, -50], laR: -60, p: [0, 0.3, 0] }), 'lin'],
  [20, { ...rhChamber(20), pel: [0, 360, -8], thL: [-60, 0, 10], cL: 110, fL: 20, p: [0, 0.42, 0.05] }, 'lin'],
  ...imp(24, { ...rhChamber(20), pel: [0, 360, -8] }, { ...rh(454, 30, 30, 4), thL: [-50, 0, 30], cL: 100, fL: 20, p: [0, 0.36, 0.14] }, 'foot_r', 7, 1.8),
  [40, { ...CROUCH, pel: [10, 330, 0] }, 'in'], [56, S({ pel: [0, 330, 0] })]]);

// double kick (hop: left roundhouse, switch in the air, right roundhouse)
def('kick_double', [[0, ST], [5, { ...mir(rhChamber(0)), p: [0, 0.04, 0] }, 'out'], ...imp(10, mir(rhChamber(0)), { ...mir(rh(78, 0, 18, 6)), p: [0, 0.14, 0.08] }, 'foot_l', 3, 1.5),
  [16, { ...rhChamber(10), p: [0, 0.3, 0.1], thL: [-50, 0, 10], cL: 90, fL: 20 }, 'lin'],
  ...imp(20, rhChamber(10), { ...rh(84, 16, 24, 4), p: [0, 0.3, 0.16], thL: [-30, 0, 26], cL: 70, fL: 20 }, 'foot_r', 6, 1.7), [34, CROUCH, 'in'], [44, ST]]);

// flying side kick (dash attack): tucked take-off, then the whole body is one line behind the heel
const FLYK = S({ pel: [0, 96, -44], s1: [0, -12, 14], s3: [0, -10, 10], thL: [-70, 0, 20], cL: 124, fL: 10, thR: [0, 0, -50], cR: 0, fR: [-10, 0, 24], uaL: [-44, 40, 26], laL: -124, uaR: [0, 0, -60], laR: -14, p: [0, 0.34, 0.2] });
def('kick_jump', [[0, ST], [5, { ...SIDE_C, p: [0, 0.2, 0.04], thL: [-50, 0, 14], cL: 90 }, 'out'], [10, FLYK, 'in'], [16, { ...FLYK, sc: { fR: 1.6 } }, 'lin', 'foot_r'], [24, { ...FLYK, p: [0, 0.22, 0.2] }, 'lin'], [32, CROUCH, 'in'], [44, ST]]);
// sliding low kick
const SLIDE = S({ pel: [-58, -40, 0], s1: [16, 10, 0], s3: [14, 10, 0], thL: [-30, 40, 4], cL: 2, fL: 20, thR: [-50, 20, -10], cR: 120, fR: 20, uaL: [30, 0, 40], laL: -20, uaR: [50, 0, -20], laR: -30, p: [0, 0, 0.1] });
def('Slide_Start', [[0, ST], [6, SLIDE, 'in'], [12, SLIDE, 'lin', 'foot_l'], [26, { ...SLIDE, pel: [-62, -40, 0] }], [42, ST]]);
// backflip kick (launcher)
def('flip_kick', [[0, ST], [5, { ...CROUCH, pel: [14, -10, 0] }, 'out'],
  ...imp(10, CROUCH, S({ pel: [-46, 0, 0], s1: [-10, 0, 0], thL: [-10, 0, 6], cL: 60, fL: 30, thR: [-92, 0, -4], cR: 0, fR: 40, uaL: [20, 0, 40], laL: -30, uaR: [20, 0, -40], laR: -30, p: [0, 0.22, 0.06], hd: [0, 0, 0] }), 'foot_r', 3, 1.7),
  [18, { ...BALL, pel: [-180, 0, 0], abs: 1.0 }, 'out'], [25, { ...BALL, pel: [-300, 0, 0], abs: 0.95 }, 'lin'], [31, { ...CROUCH, pel: [-350, -30, 0] }, 'lin'], [42, { ...ST, pel: [-360, -30, 0] }]]);

// ================================================================== air attacks (the jump itself comes from physics)
const AIRP_W = A({ pel: [0, -50, 0], s1: [0, 0, 0], uaR: [-150, 20, -20], laR: -110, uaL: [-70, 30, 10], laL: -60, thL: [-60, 30, 6], cL: 100, fL: 25, thR: [10, 0, -8], cR: 90, fR: 35 });
const AIRP = A({ pel: [26, 26, 0], s1: [16, 10, 0], s3: [8, 12, 0], uaR: [-70, -46, 0], laR: -4, uaL: [30, -10, 26], laL: -120, thL: [-20, -20, 6], cL: 110, fL: 30, thR: [30, -30, -8], cR: 50, fR: 40 });
def('air_punch', [[0, AIR1], [5, AIRP_W, 'out'], ...imp(9, AIRP_W, AIRP, 'hand_r', 10, 1.7), [32, AIR1]]);
const AIRK_C = A({ pel: [0, 60, -10], s1: [4, -14, 4], thL: [-80, 0, 14], cL: 120, fL: 10, thR: [-78, 0, -36], cR: 128, fR: 0, uaL: [-52, 30, 20], laL: -120, uaR: [-30, 0, -30], laR: -110 });
const AIRK = A({ pel: [0, 96, -30], s1: [0, -12, 16], s3: [0, -10, 12], thL: [-76, 0, 20], cL: 126, fL: 10, thR: [0, 0, -26], cR: 0, fR: [-10, 0, 24], uaL: [-44, 40, 26], laL: -124, uaR: [0, 0, -60], laR: -14, abs: 0.56 });
def('air_kick', [[0, AIR1], [4, AIRK_C, 'out'], ...imp(8, AIRK_C, AIRK, 'foot_r', 12, 1.7), [34, AIR1]]);

// ================================================================== spirit blade (held in the right hand)
const SW = (o: Pose) => S({ uaL: [10, 0, 26], laL: -60, ...o });
const SWA_W = SW({ pel: [0, -60, 0], s1: [4, -8, 0], uaR: [-150, 30, -30], laR: -70, thL: [-40, 55, 10], cL: 52, fL: -12, thR: [8, 15, -12], cR: 40 });
const SWA = SW({ pel: [6, 30, 0], s1: [18, 12, 0], s3: [8, 14, 0], uaR: [-50, -84, 0], laR: -14, thL: [-48, -32, 6], cL: 58, fL: -10, thR: [30, -44, -8], cR: 18, fR: -46, p: [0, 0, 0.14] });
def('Sword_Regular_A', [[0, ST], [5, SWA_W, 'out'], ...imp(9, SWA_W, SWA, 'hand_r', 7, 1.2), [32, ST]]);
const SWB = SW({ pel: [0, -64, 0], s1: [8, -10, 0], s3: [4, -10, 0], uaR: [-88, 60, -10], laR: -8, thL: [-44, 58, 8], cL: 50, fL: -6, thR: [24, 20, -10], cR: 18, fR: -42, p: [0, 0, 0.14] });
def('Sword_Regular_B', [[0, SWA], [5, SW({ ...SWA, uaR: [-70, -100, 0], laR: -50 }), 'out'], ...imp(10, SWA, SWB, 'hand_r', 7, 1.2), [34, ST]]);
const SWC_W = SW({ pel: [-8, -30, 0], s1: [-14, 6, 0], s3: [-10, 6, 0], uaR: [-176, 0, -10], laR: -60, uaL: [-170, 0, 10], laL: -70, thL: [-20, 25, 10], cL: 20, fL: 10, thR: [10, -15, -14], cR: 14, fR: 0, p: [0, 0.06, 0] });
const SWC = SW({ pel: [14, -6, 0], s1: [30, 2, 0], s3: [16, 2, 0], uaR: [-48, -20, -4], laR: -10, uaL: [-44, 20, 4], laL: -20, thL: [-62, 4, 10], cL: 76, fL: -10, thR: [20, -12, -12], cR: 46, fR: -56, p: [0, 0, 0.2] });
def('Sword_Regular_C', [[0, ST], [11, SWC_W, 'out'], ...imp(16, SWC_W, SWC, 'hand_r', 10, 1.3), [48, ST]]);
def('Sword_Dash_RM', [[0, ST], [6, SW({ ...CROSS_W, uaR: [40, 30, -30], laR: -60 }), 'out'], [10, SW({ ...CROSS, uaL: [32, -10, 24], laL: -126 }), 'in'], [14, { ...SW({ ...CROSS, uaL: [32, -10, 24], laL: -126 }), sc: { hR: 1.2 } }, 'lin', 'hand_r'], [28, SW({ ...CROSS, uaL: [32, -10, 24], laL: -126 })], [46, ST]]);
