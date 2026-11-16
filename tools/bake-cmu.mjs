// Retarget animation clips from other rigs onto the Quaternius UAL2 mannequin rig.
//  - CMU mocap (RancidMilk glTF, DAZ-style names)  -> kicks, punch sequences, falls, get-ups
//  - Quaternius UAL1 (Rigify DEF-* names)          -> idle, locomotion, jab/cross, hits, roll ...
// Output: public/anims/baked.json  { clipName: { duration, fps, frames, tracks:{bone:[x,y,z,w,...]}, pelvisPos:[x,y,z,...] } }
//
// Method (swing retarget): per frame compute source joint world positions, normalise facing
// (+Z at segment start), remove horizontal root motion, scale height, then rotate each target
// bone (parents first) so its direction to its child matches the source bone direction.
import fs from 'node:fs';
import * as THREE from 'three';
import { loadGLB } from './gltf-node.mjs';

const FPS = 30;
const UP = new THREE.Vector3(0, 1, 0);

// ---------- rigs -------------------------------------------------------------
const CMU = {
  hip: 'hip', spine: 'abdomen', lThigh: 'lThigh', rThigh: 'rThigh', lFoot: 'lFoot', rFoot: 'rFoot',
  chain: [
    ['spine_01', 'spine_02', 'abdomen', 'chest'],
    ['spine_02', 'spine_03', 'abdomen', 'chest'],
    ['spine_03', 'neck_01', 'chest', 'neck'],
    ['neck_01', 'Head', 'neck', 'head'],
    ['clavicle_l', 'upperarm_l', 'lCollar', 'lShldr'],
    ['upperarm_l', 'lowerarm_l', 'lShldr', 'lForeArm'],
    ['lowerarm_l', 'hand_l', 'lForeArm', 'lHand'],
    ['hand_l', 'middle_01_l', 'lHand', 'lMid1'],
    ['clavicle_r', 'upperarm_r', 'rCollar', 'rShldr'],
    ['upperarm_r', 'lowerarm_r', 'rShldr', 'rForeArm'],
    ['lowerarm_r', 'hand_r', 'rForeArm', 'rHand'],
    ['hand_r', 'middle_01_r', 'rHand', 'rMid1'],
    ['thigh_l', 'calf_l', 'lThigh', 'lShin'],
    ['calf_l', 'foot_l', 'lShin', 'lFoot'],
    ['thigh_r', 'calf_r', 'rThigh', 'rShin'],
    ['calf_r', 'foot_r', 'rShin', 'rFoot'],
  ],
};
const side = (L) => (L === 'L' ? 'l' : 'r');
const ualFingerChain = [];
for (const L of ['L', 'R']) {
  const s = side(L);
  for (const f of ['index', 'middle', 'pinky', 'ring']) {
    ualFingerChain.push([`${f}_01_${s}`, `${f}_02_${s}`, `DEF-f_${f}01${L}`, `DEF-f_${f}02${L}`]);
    ualFingerChain.push([`${f}_02_${s}`, `${f}_03_${s}`, `DEF-f_${f}02${L}`, `DEF-f_${f}03${L}`]);
  }
  ualFingerChain.push([`thumb_01_${s}`, `thumb_02_${s}`, `DEF-thumb01${L}`, `DEF-thumb02${L}`]);
  ualFingerChain.push([`thumb_02_${s}`, `thumb_03_${s}`, `DEF-thumb02${L}`, `DEF-thumb03${L}`]);
}
const UAL1 = {
  hip: 'DEF-hips', spine: 'DEF-spine001', lThigh: 'DEF-thighL', rThigh: 'DEF-thighR', lFoot: 'DEF-footL', rFoot: 'DEF-footR',
  noYaw: true,
  chain: [
    ['spine_01', 'spine_02', 'DEF-spine001', 'DEF-spine002'],
    ['spine_02', 'spine_03', 'DEF-spine002', 'DEF-spine003'],
    ['spine_03', 'neck_01', 'DEF-spine003', 'DEF-neck'],
    ['neck_01', 'Head', 'DEF-neck', 'DEF-head'],
    ...['L', 'R'].flatMap((L) => {
      const s = side(L);
      return [
        [`clavicle_${s}`, `upperarm_${s}`, `DEF-shoulder${L}`, `DEF-upper_arm${L}`],
        [`upperarm_${s}`, `lowerarm_${s}`, `DEF-upper_arm${L}`, `DEF-forearm${L}`],
        [`lowerarm_${s}`, `hand_${s}`, `DEF-forearm${L}`, `DEF-hand${L}`],
        [`hand_${s}`, `middle_01_${s}`, `DEF-hand${L}`, `DEF-f_middle01${L}`],
        [`thigh_${s}`, `calf_${s}`, `DEF-thigh${L}`, `DEF-shin${L}`],
        [`calf_${s}`, `foot_${s}`, `DEF-shin${L}`, `DEF-foot${L}`],
        [`foot_${s}`, `ball_${s}`, `DEF-foot${L}`, `DEF-toe${L}`],
      ];
    }),
    ...ualFingerChain,
  ],
};

// ---------- jobs -------------------------------------------------------------
// [outName, rig, file, clip(or null), start, end(or null = full), loop]
const JOBS = [
  // CMU martial arts
  ['kick_front', CMU, 'assets/anims/cmu/135_04.glb', null, 6.35, 7.30],
  ['kick_round', CMU, 'assets/anims/cmu/135_07.glb', null, 0.60, 1.65],
  ['kick_side', CMU, 'assets/anims/cmu/135_11.glb', null, 2.50, 3.55],
  ['kick_jump', CMU, 'assets/anims/cmu/90_05.glb', null, 1.95, 2.85],
  ['kick_spin', CMU, 'assets/anims/cmu/88_06.glb', null, 0.15, 1.25],
  ['punch_seq_a', CMU, 'assets/anims/cmu/144_20.glb', null, 2.05, 2.55],
  ['punch_seq_b', CMU, 'assets/anims/cmu/144_20.glb', null, 2.55, 3.10],
  ['punch_seq_c', CMU, 'assets/anims/cmu/144_20.glb', null, 3.45, 4.00],
  ['fall_face', CMU, 'assets/anims/cmu/90_16.glb', null, 2.90, 4.30],
  ['getup_back', CMU, 'assets/anims/cmu/140_08.glb', null, 4.25, 6.00],
  ['getup_face', CMU, 'assets/anims/cmu/140_01.glb', null, 1.80, 4.60],
  ['guard_pose', CMU, 'assets/anims/cmu/144_07.glb', null, 1.00, 1.40],
  // style-specific techniques
  ['box_triple', CMU, 'assets/anims/cmu/14_02.glb', null, 1.22, 2.50],
  ['knee', CMU, 'assets/anims/cmu/86_01.glb', null, 27.50, 28.30],
  ['knee_fly', CMU, 'assets/anims/cmu/113_13.glb', null, 7.75, 8.85],
  ['kick_low', CMU, 'assets/anims/cmu/74_03.glb', null, 1.30, 2.10],
  ['kick_mid', CMU, 'assets/anims/cmu/141_14.glb', null, 1.85, 2.75],
  ['kick_back_spin', CMU, 'assets/anims/cmu/88_04.glb', null, 3.45, 4.25],
  ['kick_tornado', CMU, 'assets/anims/cmu/90_06.glb', null, 3.15, 4.20],
  ['kick_double', CMU, 'assets/anims/cmu/87_01.glb', null, 1.75, 2.75],
  ['flip_kick', CMU, 'assets/anims/cmu/90_08.glb', null, 1.30, 2.45],
  ['pull_throw', CMU, 'assets/anims/cmu/18_03.glb', null, 1.30, 2.40],
  // UAL1 (different rig)
  ...['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
    'Punch_Jab', 'Punch_Cross', 'Punch_Enter', 'Hit_Chest', 'Hit_Head', 'Roll', 'Death01', 'Dance_Loop',
    'Spell_Simple_Enter', 'Spell_Simple_Shoot', 'Push_Loop'].map((c) => [c, UAL1, 'public/models/ual1.glb', c, 0, null]),
];

// ---------- target -----------------------------------------------------------
const tgt = await loadGLB('public/models/ual2.glb');
const T = tgt.scene; T.updateMatrixWorld(true);
const tb = (n) => { const o = T.getObjectByName(n); if (!o) throw new Error('target bone ' + n); return o; };
const restLocal = new Map();
T.traverse((o) => restLocal.set(o, o.quaternion.clone()));
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const frame = (up, left) => {
  up = up.clone().normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  const l = new THREE.Vector3().crossVectors(up, fwd).normalize();
  return new THREE.Matrix4().makeBasis(l, up, fwd);
};
const tPelvis = tb('pelvis');
const tPelvisRestW = wp(tPelvis);
const tPelvisRestLocal = tPelvis.position.clone();
const tAnkleY = wp(tb('foot_l')).y;
const tRestFrame = frame(wp(tb('spine_01')).sub(tPelvisRestW), wp(tb('thigh_l')).sub(wp(tb('thigh_r'))));
const tRestFrameInv = tRestFrame.clone().invert();
const tPelvisRestWQ = wq(tPelvis);
const resetTarget = () => T.traverse((o) => { const q = restLocal.get(o); if (q) o.quaternion.copy(q); });
const setWorldQuat = (o, q) => { o.quaternion.copy(wq(o.parent).invert().multiply(q)); o.updateMatrixWorld(true); };

const cache = {};
const out = {};
for (const [name, rig, file, clipName, t0, t1raw] of JOBS) {
  const src = (cache[file] ??= await loadGLB(file));
  const S = src.scene;
  const clip = clipName ? src.animations.find((a) => a.name === clipName) : src.animations[0];
  if (!clip) throw new Error('clip ' + clipName);
  const t1 = t1raw ?? clip.duration;
  const mixer = new THREE.AnimationMixer(S);
  const act = mixer.clipAction(clip); act.play();
  const sp = (n) => { const o = S.getObjectByName(n); if (!o) throw new Error('src bone ' + n + ' in ' + file); return wp(o); };
  const ev = (t) => { mixer.setTime(t); S.updateMatrixWorld(true); };

  // height calibration
  let scale, floorY;
  if (rig === CMU) {
    ev(0); // CMU frame 0 is a T-pose standing calibration frame
    scale = (tPelvisRestW.y - tAnkleY) / (sp(rig.hip).y - Math.min(sp(rig.lFoot).y, sp(rig.rFoot).y));
  } else {
    scale = 1; floorY = 0; // same mannequin proportions, same floor
  }
  ev(t0);
  let yaw0 = 0;
  if (!rig.noYaw) {
    const left0 = sp(rig.lThigh).sub(sp(rig.rThigh)); left0.y = 0;
    const fwd0 = new THREE.Vector3().crossVectors(left0, UP).normalize();
    yaw0 = Math.atan2(fwd0.x, fwd0.z);
  }
  const n = Math.max(2, Math.round((t1 - t0) * FPS) + 1);
  const ts = Array.from({ length: n }, (_, i) => t0 + (i / (n - 1)) * (t1 - t0));
  // strikes: aim so the striking limb at its furthest extension points straight ahead (+Z)
  if (rig === CMU && /^(kick|punch|box|knee|flip)/.test(name)) {
    let best = -1, ang = 0;
    for (const t of ts) {
      ev(t); const h = sp(rig.hip);
      for (const l of ['lFoot', 'rFoot', 'lHand', 'rHand']) {
        const q = sp(l); const dx = q.x - h.x, dz = q.z - h.z; const dd = Math.hypot(dx, dz) + (l.endsWith('Foot') ? 0.3 * (q.y - h.y) : 0);
        if (dd > best) { best = dd; ang = Math.atan2(dx, dz); }
      }
    }
    yaw0 = ang;
  }
  const unYaw = new THREE.Quaternion().setFromAxisAngle(UP, -yaw0);
  if (rig === CMU) {
    floorY = Infinity;
    for (const t of ts) { ev(t); floorY = Math.min(floorY, sp(rig.lFoot).y, sp(rig.rFoot).y); }
  }
  const bones = ['pelvis', ...rig.chain.map((c) => c[0])];
  const tracks = Object.fromEntries(bones.map((b) => [b, []]));
  const pelvisPos = [];
  for (const t of ts) {
    ev(t);
    const P = (nm) => sp(nm).applyQuaternion(unYaw);
    resetTarget(); T.updateMatrixWorld(true);
    const sFrame = frame(P(rig.spine).sub(P(rig.hip)), P(rig.lThigh).sub(P(rig.rThigh)));
    const rq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(sFrame, tRestFrameInv));
    setWorldQuat(tPelvis, rq.multiply(tPelvisRestWQ.clone()));
    const hipY = rig === CMU ? (P(rig.hip).y - floorY) * scale + tAnkleY * 0.55 : P(rig.hip).y;
    const w = tPelvisRestW.clone(); w.y = hipY;
    const loc = tPelvis.parent.worldToLocal(w);
    pelvisPos.push(+loc.x.toFixed(4), +loc.y.toFixed(4), +loc.z.toFixed(4));
    tPelvis.position.copy(loc); T.updateMatrixWorld(true);
    for (const [b, c, sf, st] of rig.chain) {
      const bo = tb(b), co = tb(c);
      const cur = wp(co).sub(wp(bo)).normalize();
      const want = P(st).sub(P(sf)).normalize();
      setWorldQuat(bo, new THREE.Quaternion().setFromUnitVectors(cur, want).multiply(wq(bo)));
    }
    for (const b of bones) { const q = tb(b).quaternion; tracks[b].push(+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5), +q.w.toFixed(5)); }
    tPelvis.position.copy(tPelvisRestLocal);
  }
  out[name] = { duration: +(t1 - t0).toFixed(3), fps: FPS, frames: n, tracks, pelvisPos };
}

// CMU clips have no finger data: give them clenched fists taken from the retargeted jab.
const jab = out.Punch_Jab; const mid = Math.floor(jab.frames * 0.4);
for (const [name, rig] of JOBS.map((j) => [j[0], j[1]])) {
  if (rig !== CMU) continue;
  const c = out[name];
  for (const [b] of ualFingerChain) {
    const q = jab.tracks[b].slice(mid * 4, mid * 4 + 4);
    c.tracks[b] = Array.from({ length: c.frames }, () => q).flat();
  }
}
fs.mkdirSync('public/anims', { recursive: true });
fs.writeFileSync('public/anims/baked.json', JSON.stringify(out));
console.log('baked', Object.keys(out).length, 'clips ->', (fs.statSync('public/anims/baked.json').size / 1024).toFixed(0) + 'KB');
