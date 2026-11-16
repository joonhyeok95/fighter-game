// The house fighters, built from scratch as chunky SD (about 2.7 heads tall) figures:
//  - rigid toon-shaded parts on the joints of rig.ts (big head, big fists and feet, short thick limbs)
//  - one merged mesh + one ink outline shell per joint, vertex-coloured
//  - a drawn anime face (canvas texture) and sculpted hair
// Two original designs: a spiky-haired boy in a hooded sleeveless vest and baggy trousers, and a girl with a long
// high ponytail in a crop top, shorts and shin wraps. Both fight barefoot with wrapped ankles and fingerless gloves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSkeleton, HEAD_R, HEAD_UP, V3 } from './rig';

export interface Look {
  female: boolean; skin: number; hair: number; eye: number;
  /** trim colour: zipper, hems, straps, side lines (the fighter's identifying colour) */
  accent: number; shirt: number;
}

const SKIN = [0xf8d6ba, 0xecbd98, 0xc9916a];
export const HAIR_COLORS = [0x1c1c22, 0x4a2c20, 0xc9a24a, 0xd4553a, 0x3d6fb6, 0x6bbf59, 0xe8e4dc];
const INK = 0x2a2a31, INK2 = 0x45454f;

let gradient: THREE.DataTexture | null = null;
function toonRamp() {
  if (gradient) return gradient;
  const d = new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(d, 3, 1); gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  return gradient;
}
export const toon = (color: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });

/** character material: toon shading plus a hard-edged rim light so silhouettes pop against the night stage */
export function toonChar(extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  const m = toon(0xffffff, extra);
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normalize(normal)), 0.0, 1.0);
      float rimUp = 1.0 - smoothstep(0.3, 0.75, normalize(normal).y);
      outgoingLight += vec3(0.55, 0.75, 1.25) * smoothstep(0.62, 0.72, rimF) * rimUp * 0.45 * (0.4 + diffuseColor.rgb);
      #include <opaque_fragment>`);
  };
  return m;
}
/** ink outline: pushes vertices along the normal and draws back faces (inverted hull) */
function outlineMaterial(width: number) {
  const m = new THREE.MeshBasicMaterial({ color: 0x120f22, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`); };
  m.userData.outline = true;
  return m;
}

// ---------------------------------------------------------------- part kit
interface PartOpts { p?: V3; r?: V3; s?: V3; ol?: boolean; m?: THREE.Matrix4 }
class Kit {
  items = new Map<string, { g: THREE.BufferGeometry; ol: boolean }[]>();
  add(bone: string, g: THREE.BufferGeometry, color: number, o: PartOpts = {}) {
    const m = o.m ?? new THREE.Matrix4().compose(new THREE.Vector3(...(o.p ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r ?? [0, 0, 0]))), new THREE.Vector3(...(o.s ?? [1, 1, 1])));
    const geo = g.index ? g.toNonIndexed() : g; geo.applyMatrix4(m); geo.deleteAttribute('uv');
    const n = geo.attributes.position.count; const c = new THREE.Color(color); const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.items.has(bone)) this.items.set(bone, []);
    this.items.get(bone)!.push({ g: geo, ol: o.ol !== false });
  }
  build(nodes: Record<string, THREE.Object3D>, mat: THREE.Material, olMat: THREE.Material) {
    for (const [bone, list] of this.items) {
      const mesh = new THREE.Mesh(mergeGeometries(list.map((x) => x.g)), mat); mesh.castShadow = true; mesh.frustumCulled = false; nodes[bone].add(mesh);
      const ols = list.filter((x) => x.ol);
      if (ols.length) { const ol = new THREE.Mesh(mergeGeometries(ols.map((x) => x.g)), olMat); ol.frustumCulled = false; nodes[bone].add(ol); }
    }
  }
}
const sph = (rx: number, ry = rx, rz = rx) => new THREE.SphereGeometry(1, 18, 14).scale(rx, ry, rz);
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 5, 14);
const cyl = (rt: number, rb: number, h: number, squash = 1) => new THREE.CylinderGeometry(rt, rb, h, 18).scale(1, 1, squash);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

// ---------------------------------------------------------------- face
const faces = new Map<string, THREE.CanvasTexture>();
function faceTexture(look: Look) {
  const key = [look.female, look.eye, look.hair].join();
  const hit = faces.get(key); if (hit) return hit;
  const S = 256; const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d')!;
  const css = (n: number, k = 1) => '#' + new THREE.Color(n).multiplyScalar(k).getHexString();
  const f = look.female; const ey = 146;
  for (const sx of [-1, 1]) {
    const bx = 128 + sx * 80, by = ey + 34;
    const g = x.createRadialGradient(bx, by, 2, bx, by, 26); g.addColorStop(0, 'rgba(255,120,130,.5)'); g.addColorStop(1, 'rgba(255,120,130,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, 26, 15, 0, 0, 7); x.fill();
  }
  for (const sx of [-1, 1]) {
    const cx = 128 + sx * 50, rx = f ? 25 : 24, ry = f ? 31 : 28;
    // eye white, iris (dark at the top, the eye colour glowing at the bottom), pupil
    x.fillStyle = '#fffdf8'; x.beginPath(); x.ellipse(cx, ey, rx, ry, 0, 0, 7); x.fill();
    x.save(); x.beginPath(); x.ellipse(cx, ey, rx, ry, 0, 0, 7); x.clip();
    const ig = x.createLinearGradient(0, ey - ry, 0, ey + ry); ig.addColorStop(0, css(look.eye, 0.25)); ig.addColorStop(0.55, css(look.eye, 0.8)); ig.addColorStop(1, css(new THREE.Color(look.eye).lerp(new THREE.Color(0xffffff), 0.35).getHex()));
    x.fillStyle = ig; x.beginPath(); x.ellipse(cx - sx * 3, ey + 3, rx * 0.8, ry * 0.92, 0, 0, 7); x.fill();
    x.fillStyle = '#120e1c'; x.beginPath(); x.ellipse(cx - sx * 3, ey + 3, rx * 0.34, ry * 0.42, 0, 0, 7); x.fill();
    // shadow of the upper lid
    x.fillStyle = 'rgba(18,14,28,.55)'; x.beginPath(); x.ellipse(cx, ey - ry * 1.02, rx * 1.3, ry * 0.5, 0, 0, 7); x.fill();
    x.restore();
    // highlights
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx - 9, ey - 9, 7.5, 9, -0.4, 0, 7); x.fill();
    x.beginPath(); x.arc(cx + 8, ey + 14, 3.6, 0, 7); x.fill();
    // lids: thick upper lash line with an outer flick, thin lower line
    x.strokeStyle = '#17121f'; x.lineCap = 'round'; x.lineJoin = 'round';
    x.lineWidth = f ? 8 : 7.5; x.beginPath(); x.moveTo(cx - sx * (rx + 2), ey - ry * 0.3); x.quadraticCurveTo(cx - sx * rx * 0.5, ey - ry * 1.2, cx + sx * rx * 0.4, ey - ry * 1.02); x.quadraticCurveTo(cx + sx * (rx + 3), ey - ry * 0.75, cx + sx * (rx + 7), ey - ry * (f ? 0.2 : 0.3)); x.stroke();
    if (f) { x.lineWidth = 4; x.beginPath(); x.moveTo(cx + sx * (rx + 4), ey - ry * 0.55); x.lineTo(cx + sx * (rx + 13), ey - ry * 0.78); x.stroke(); }
    x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx - sx * rx * 0.6, ey + ry * 0.98); x.quadraticCurveTo(cx, ey + ry * 1.1, cx + sx * rx * 0.8, ey + ry * 0.8); x.stroke();
    // brows: straight and determined for the boy, a softer arch for the girl
    x.strokeStyle = css(look.hair, look.hair === 0xe8e4dc ? 0.5 : 0.75); x.lineWidth = f ? 5 : 7;
    x.beginPath(); x.moveTo(cx - sx * (rx - 2), ey - ry - (f ? 15 : 9)); x.quadraticCurveTo(cx + sx * 4, ey - ry - (f ? 23 : 21), cx + sx * (rx + 6), ey - ry - (f ? 15 : 19)); x.stroke();
  }
  // mouth
  x.strokeStyle = '#8a3f33'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath();
  if (f) { x.moveTo(116, ey + 52); x.quadraticCurveTo(128, ey + 61, 140, ey + 52); } else { x.moveTo(117, ey + 55); x.quadraticCurveTo(129, ey + 58, 141, ey + 51); }
  x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; faces.set(key, t); return t;
}

// ---------------------------------------------------------------- hair
const HC = new THREE.Vector3(0, HEAD_UP, 0.005);
/** point on the head sphere: yaw 0 = front, 90 = the fighter's left, 180 = back; pitch up from the equator */
function onHead(yaw: number, pitch: number, k = 1) {
  const a = THREE.MathUtils.degToRad(yaw), b = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)).multiplyScalar(HEAD_R * k);
}
/** a hair spike rooted on the scalp. bias bends it away from the surface normal; flat (0..1) presses it against the head */
function spike(kit: Kit, color: number, yaw: number, pitch: number, len: number, rad: number, bias: V3 = [0, 0, 0], flat = 1, bone = 'Head', ol = true) {
  const n = onHead(yaw, pitch).normalize(); const d = n.clone().add(new THREE.Vector3(...bias)).normalize();
  let z = n.clone().addScaledVector(d, -n.dot(d)); if (z.lengthSq() < 1e-4) z = new THREE.Vector3(0, 0, 1).addScaledVector(d, -d.z); z.normalize();
  const xx = new THREE.Vector3().crossVectors(d, z);
  const m = new THREE.Matrix4().makeBasis(xx, d, z).setPosition(onHead(yaw, pitch, 0.93).add(HC));
  kit.add(bone, new THREE.ConeGeometry(rad, len, 7).translate(0, len / 2, 0).scale(1, 1, flat), color, { m, ol });
}

function buildHead(kit: Kit, look: Look, nodes: Record<string, THREE.Object3D>) {
  const R = HEAD_R, hc: V3 = [HC.x, HC.y, HC.z];
  kit.add('Head', sph(R * 1.04, R * 0.96, R), look.skin, { p: hc });
  for (const sx of [-1, 1]) kit.add('Head', sph(0.03, 0.062, 0.045), look.skin, { p: [sx * R * 1.03, HC.y - 0.035, -0.01] });
  kit.add('neck_01', cyl(0.05, 0.058, 0.07), look.skin, { p: [0, 0.01, 0] });
  // drawn face on a patch just over the front of the skull
  const patch = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 28, 20, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.22, Math.PI * 0.58),
    new THREE.MeshBasicMaterial({ map: faceTexture(look), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  patch.scale.set(1.04, 0.96, 1); patch.position.copy(HC); patch.name = 'face'; nodes.Head.add(patch);
  // hair cap: top half of a sphere tipped backwards, so the hairline sits high on the forehead and low on the nape
  const h = look.hair;
  kit.add('Head', new THREE.SphereGeometry(R * 1.075, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1.04, 1, 1.02), h, { p: [0, HC.y + 0.005, -0.012], r: [-0.62, 0, 0] });
  if (!look.female) {
    // messy spikes: a crown fanning up and back, tufts over the ears, bangs falling between the eyes
    const S: [number, number, number, number, V3][] = [
      [0, 78, 0.27, 0.105, [0, 0.2, 0.5]], [35, 62, 0.25, 0.1, [0.5, 0.2, 0.2]], [-35, 62, 0.25, 0.1, [-0.5, 0.2, 0.2]],
      [80, 52, 0.25, 0.1, [0.5, 0.25, -0.1]], [-80, 52, 0.25, 0.1, [-0.5, 0.25, -0.1]], [130, 55, 0.27, 0.105, [0.3, 0.3, -0.4]], [-130, 55, 0.27, 0.105, [-0.3, 0.3, -0.4]],
      [180, 62, 0.29, 0.11, [0, 0.4, -0.4]], [180, 22, 0.25, 0.105, [0, 0.1, -0.5]], [118, 14, 0.23, 0.1, [0.3, -0.25, -0.5]], [-118, 14, 0.23, 0.1, [-0.3, -0.25, -0.5]],
      [150, -12, 0.2, 0.09, [0.2, -0.6, -0.3]], [-150, -12, 0.2, 0.09, [-0.2, -0.6, -0.3]], [0, 60, 0.2, 0.09, [0.15, 0.1, 0.9]],
    ];
    for (const [yaw, pitch, len, rad, bias] of S) spike(kit, h, yaw, pitch, len, rad, bias);
    for (const [yaw, pitch, len, rad, bx] of [[-44, 40, 0.17, 0.07, -0.35], [-22, 45, 0.2, 0.075, -0.1], [4, 46, 0.23, 0.08, 0.06], [28, 44, 0.19, 0.075, 0.25], [48, 38, 0.16, 0.065, 0.4]] as const) spike(kit, h, yaw, pitch, len, rad, [bx, -2.2, 0.25], 0.5);
    for (const sx of [-1, 1]) spike(kit, h, sx * 74, 22, 0.2, 0.065, [sx * 0.1, -2.4, 0.5], 0.55);
  } else {
    for (const [yaw, pitch, len, rad, bx] of [[-48, 40, 0.18, 0.075, -0.5], [-24, 46, 0.2, 0.08, -0.2], [0, 48, 0.19, 0.08, 0.1], [24, 46, 0.2, 0.08, 0.3], [48, 40, 0.18, 0.075, 0.5]] as const) spike(kit, h, yaw, pitch, len, rad, [bx, -2.2, 0.25], 0.5);
    for (const sx of [-1, 1]) { spike(kit, h, sx * 72, 24, 0.36, 0.06, [sx * 0.15, -3, 0.35], 0.6); spike(kit, h, sx * 100, 10, 0.2, 0.07, [0, -2, -0.4], 0.6); }
    // long high ponytail on its own pivot (it sways with the fight)
    const root = onHead(180, 58, 1.0).add(HC);
    const tail = new THREE.Object3D(); tail.name = 'tail'; tail.position.copy(root); nodes.Head.add(tail); nodes.tail = tail;
    kit.add('Head', sph(0.085, 0.075, 0.085), h, { p: [root.x, root.y - 0.01, root.z + 0.02] });
    kit.add('Head', new THREE.TorusGeometry(0.062, 0.03, 8, 16), look.accent, { p: [root.x, root.y + 0.012, root.z - 0.03], r: [0.75, 0, 0] });
    kit.add('tail', cap(0.075, 0.1), h, { p: [0, 0.03, -0.11], r: [-1.05, 0, 0] });
    kit.add('tail', sph(0.088), h, { p: [0, 0.045, -0.19] });
    kit.add('tail', new THREE.ConeGeometry(0.09, 0.7, 9).translate(0, 0.35, 0), h, { p: [0, 0.07, -0.2], r: [Math.PI - 0.14, 0, 0] });
    kit.add('tail', new THREE.ConeGeometry(0.055, 0.5, 7).translate(0, 0.25, 0), h, { p: [0.03, 0.02, -0.24], r: [Math.PI - 0.3, 0, 0.1] });
  }
}

// ---------------------------------------------------------------- body
function buildBody(kit: Kit, look: Look) {
  const A = look.accent, K = look.skin, f = look.female;
  const cuff = new THREE.Color(look.shirt).multiplyScalar(0.72).getHex();
  if (!f) {
    // hips of the baggy trousers, belt + buckle, strap hanging off the left hip
    kit.add('pelvis', sph(0.168, 0.125, 0.14), INK, { p: [0, -0.01, 0] });
    kit.add('pelvis', cyl(0.166, 0.17, 0.045, 0.84), INK2, { p: [0, 0.035, 0] });
    kit.add('pelvis', box(0.062, 0.05, 0.02), A, { p: [0, 0.035, 0.142], ol: false });
    kit.add('pelvis', box(0.03, 0.2, 0.014), A, { p: [0.105, -0.07, 0.118], r: [0.12, 0, -0.1], ol: false });
    // vest: waist with silver hem and pocket seams, chest with zipper, open collar over the grey shirt
    kit.add('spine_01', sph(0.166, 0.11, 0.138), INK, { p: [0, 0.07, 0] });
    kit.add('spine_01', cyl(0.168, 0.17, 0.024, 0.84), A, { p: [0, 0.035, 0] });
    kit.add('spine_01', box(0.016, 0.1, 0.014), A, { p: [0, 0.085, 0.134], ol: false });
    for (const sx of [-1, 1]) kit.add('spine_01', box(0.062, 0.012, 0.012), A, { p: [sx * 0.092, 0.085, 0.106], r: [0, sx * 0.5, sx * -0.12], ol: false });
    kit.add('spine_03', sph(0.19, 0.155, 0.15), INK, { p: [0, 0.065, 0] });
    kit.add('spine_03', box(0.016, 0.11, 0.014), A, { p: [0, 0.04, 0.146], ol: false });
    kit.add('spine_03', sph(0.052, 0.06, 0.026), look.shirt, { p: [0, 0.155, 0.118], r: [-0.45, 0, 0], ol: false });
    for (const sx of [-1, 1]) kit.add('spine_03', box(0.016, 0.125, 0.014), A, { p: [sx * 0.05, 0.14, 0.129], r: [-0.5, 0, sx * -0.62], ol: false });
    // hood bunched behind the neck with a silver rim
    kit.add('spine_03', sph(0.16, 0.075, 0.105), INK, { p: [0, 0.2, -0.085], r: [0.35, 0, 0] });
    kit.add('spine_03', new THREE.TorusGeometry(0.108, 0.017, 7, 20).scale(1.25, 1, 1), A, { p: [0, 0.2, -0.03], r: [Math.PI / 2 + 0.38, 0, 0], ol: false });
  } else {
    // shorts with red hem trim and belt, bare midriff, crop top with red hem and a scoop neck
    kit.add('pelvis', sph(0.158, 0.118, 0.132), INK, { p: [0, -0.01, 0] });
    kit.add('pelvis', cyl(0.152, 0.158, 0.04, 0.84), INK2, { p: [0, 0.045, 0] });
    kit.add('pelvis', box(0.055, 0.045, 0.02), A, { p: [0, 0.045, 0.128], ol: false });
    kit.add('spine_01', sph(0.138, 0.11, 0.112), K, { p: [0, 0.06, 0] });
    kit.add('spine_03', sph(0.165, 0.125, 0.136), INK, { p: [0, 0.075, 0] });
    for (const sx of [-1, 1]) kit.add('spine_03', sph(0.07, 0.065, 0.06), INK, { p: [sx * 0.066, 0.06, 0.088] });
    kit.add('spine_03', cyl(0.134, 0.126, 0.024, 0.84), A, { p: [0, -0.012, 0.004] });
    kit.add('spine_03', sph(0.085, 0.06, 0.03), K, { p: [0, 0.165, 0.098], r: [-0.5, 0, 0], ol: false });
    kit.add('spine_03', sph(0.12, 0.05, 0.09), K, { p: [0, 0.175, 0] });
  }
  for (const [s, sx] of [['l', 1], ['r', -1]] as const) {
    if (!f) {
      // short grey sleeve with a darker cuff, bare arm, fingerless glove with a silver wrist strap
      kit.add('upperarm_' + s, cap(0.072, 0.05), look.shirt, { p: [0, -0.04, 0] });
      kit.add('upperarm_' + s, cyl(0.076, 0.078, 0.022), cuff, { p: [0, -0.105, 0] });
      kit.add('upperarm_' + s, cap(0.056, 0.08), K, { p: [0, -0.11, 0] });
      kit.add('lowerarm_' + s, cap(0.054, 0.08), K, { p: [0, -0.07, 0] });
      kit.add('hand_' + s, cyl(0.064, 0.066, 0.034), A, { p: [0, 0.0, 0] });
      kit.add('hand_' + s, sph(0.082, 0.088, 0.09), INK, { p: [0, -0.07, 0.005] });
      kit.add('hand_' + s, sph(0.066, 0.045, 0.072), K, { p: [0, -0.128, 0.012] });
      // baggy trouser leg with a silver side line, gathered into dark ankle wraps; bare feet
      kit.add('thigh_' + s, cap(0.104, 0.1), INK, { p: [0, -0.1, 0] });
      kit.add('thigh_' + s, box(0.014, 0.19, 0.034), A, { p: [sx * 0.1, -0.1, 0], ol: false });
      kit.add('calf_' + s, sph(0.106), INK, { p: [0, 0, 0] });
      kit.add('calf_' + s, cyl(0.108, 0.088, 0.15), INK, { p: [0, -0.07, 0] });
      kit.add('calf_' + s, box(0.014, 0.14, 0.034), A, { p: [sx * 0.097, -0.065, 0], r: [0, 0, sx * -0.13], ol: false });
      kit.add('calf_' + s, new THREE.TorusGeometry(0.075, 0.03, 8, 16), INK, { p: [0, -0.145, 0], r: [Math.PI / 2, 0, 0] });
      kit.add('calf_' + s, cyl(0.062, 0.058, 0.075), INK2, { p: [0, -0.19, 0] });
      for (const y of [-0.172, -0.2]) kit.add('calf_' + s, cyl(0.064, 0.064, 0.008), INK, { p: [0, y, 0], ol: false });
    } else {
      kit.add('upperarm_' + s, sph(0.06), K, { p: [0, 0, 0] });
      kit.add('upperarm_' + s, cap(0.05, 0.1), K, { p: [0, -0.085, 0] });
      kit.add('upperarm_' + s, cyl(0.056, 0.056, 0.04), INK, { p: [0, -0.1, 0] });
      kit.add('lowerarm_' + s, cap(0.048, 0.085), K, { p: [0, -0.07, 0] });
      kit.add('hand_' + s, cyl(0.058, 0.06, 0.03), A, { p: [0, 0.0, 0] });
      kit.add('hand_' + s, sph(0.076, 0.082, 0.084), INK, { p: [0, -0.066, 0.005] });
      kit.add('hand_' + s, box(0.012, 0.05, 0.05), A, { p: [sx * 0.074, -0.06, 0.005], ol: false });
      kit.add('hand_' + s, sph(0.06, 0.042, 0.066), K, { p: [0, -0.12, 0.012] });
      // shorts leg with a red hem, bare thigh and knee, black shin wrap banded in red
      kit.add('thigh_' + s, cap(0.092, 0.03), INK, { p: [0, -0.03, 0] });
      kit.add('thigh_' + s, cyl(0.094, 0.092, 0.022), A, { p: [0, -0.088, 0] });
      kit.add('thigh_' + s, box(0.012, 0.09, 0.03), A, { p: [sx * 0.09, -0.04, 0], ol: false });
      kit.add('thigh_' + s, cap(0.078, 0.1), K, { p: [0, -0.11, 0] });
      kit.add('calf_' + s, sph(0.074), K, { p: [0, 0, 0] });
      kit.add('calf_' + s, cyl(0.074, 0.058, 0.165), INK, { p: [0, -0.125, 0] });
      kit.add('calf_' + s, cyl(0.078, 0.076, 0.024), A, { p: [0, -0.05, 0] });
      kit.add('calf_' + s, cyl(0.062, 0.06, 0.02), A, { p: [0, -0.195, 0] });
    }
    // big bare foot, heel and instep wrapped
    kit.add('foot_' + s, sph(0.066, 0.044, 0.115), K, { p: [0, -0.008, 0.05] });
    kit.add('foot_' + s, sph(0.062, 0.05, 0.066), f ? INK : INK2, { p: [0, 0.0, -0.005] });
    for (let i = 0; i < 4; i++) kit.add('foot_' + s, sph(0.02, 0.02, 0.024), K, { p: [sx * (0.038 - i * 0.027), -0.022, 0.155 - Math.abs(i - 1) * 0.008], ol: false });
  }
}

/** build one fighter. Every joint of rig.ts is a named node, so animation clips bind by name. */
export function buildChibi(look: Look) {
  const { root, nodes } = makeSkeleton();
  const kit = new Kit();
  buildBody(kit, look); buildHead(kit, look, nodes);
  kit.build(nodes, toonChar({ vertexColors: true }), outlineMaterial(0.011));
  // anchors for the spirit blade (edge direction = index - pinky)
  const idx = new THREE.Object3D(); idx.name = 'index_01_r'; idx.position.set(0, -0.07, 0.1); nodes.hand_r.add(idx);
  const pk = new THREE.Object3D(); pk.name = 'pinky_01_r'; pk.position.set(0, -0.07, -0.06); nodes.hand_r.add(pk);
  return root;
}

/** the two house designs (seed 0/1 = the player's boy/girl exactly as designed); AI fighters wear the same outfits
 *  with their own trim colour, hair colour and skin tone so they stay readable in a crowd */
export const ACCENT = { male: 0xc8ccd6, female: 0xd8333b };
export function lookFor(seed: number, suit: number, body: 'male' | 'female'): Look {
  const f = body === 'female', own = seed < 2;
  const lighten = (c: number, k: number) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
  return {
    female: f, skin: own ? SKIN[0] : SKIN[seed % 3], hair: own ? (f ? 0x4a2c20 : 0x1c1c22) : HAIR_COLORS[(seed * 3 + 1) % HAIR_COLORS.length],
    accent: suit, shirt: own ? 0xc9c9cf : lighten(suit, 0.5), eye: f ? (own ? 0xd0283a : suit) : (own ? 0x4a4a5e : suit),
  };
}
