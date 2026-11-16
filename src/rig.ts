// The chibi fighter skeleton: plain Object3D joints (no skinning). Shared by the character builder and the
// procedural animation system, so poses are authored against exactly the rig that is drawn.
// Model space: +z forward, +y up, +x = the fighter's left. Every joint rests at identity rotation;
// arms and legs hang straight down (-y).
import * as THREE from 'three';

export type V3 = [number, number, number];
export const JOINTS: Record<string, { parent: string | null; pos: V3 }> = {
  pelvis: { parent: null, pos: [0, 0.5, 0] },
  spine_01: { parent: 'pelvis', pos: [0, 0.05, 0] },
  spine_03: { parent: 'spine_01', pos: [0, 0.15, 0] },
  neck_01: { parent: 'spine_03', pos: [0, 0.19, 0] },
  Head: { parent: 'neck_01', pos: [0, 0.03, 0] },
  upperarm_l: { parent: 'spine_03', pos: [0.2, 0.13, 0] },
  lowerarm_l: { parent: 'upperarm_l', pos: [0, -0.16, 0] },
  hand_l: { parent: 'lowerarm_l', pos: [0, -0.15, 0] },
  upperarm_r: { parent: 'spine_03', pos: [-0.2, 0.13, 0] },
  lowerarm_r: { parent: 'upperarm_r', pos: [0, -0.16, 0] },
  hand_r: { parent: 'lowerarm_r', pos: [0, -0.15, 0] },
  thigh_l: { parent: 'pelvis', pos: [0.095, -0.03, 0] },
  calf_l: { parent: 'thigh_l', pos: [0, -0.21, 0] },
  foot_l: { parent: 'calf_l', pos: [0, -0.21, 0] },
  thigh_r: { parent: 'pelvis', pos: [-0.095, -0.03, 0] },
  calf_r: { parent: 'thigh_r', pos: [0, -0.21, 0] },
  foot_r: { parent: 'calf_r', pos: [0, -0.21, 0] },
};
export const JOINT_NAMES = Object.keys(JOINTS);
export const PELVIS_Y = JOINTS.pelvis.pos[1];
/** distance from the ankle joint down to the sole */
export const SOLE = 0.05;
/** head sphere: radius and centre above the Head joint */
export const HEAD_R = 0.29, HEAD_UP = 0.27;

export function makeSkeleton() {
  const root = new THREE.Group(); const nodes: Record<string, THREE.Object3D> = {};
  for (const [n, j] of Object.entries(JOINTS)) {
    const o = new THREE.Object3D(); o.name = n; o.position.set(...j.pos); o.rotation.order = 'YXZ';
    (j.parent ? nodes[j.parent] : root).add(o); nodes[n] = o;
  }
  return { root, nodes };
}
