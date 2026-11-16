// Arena layouts: ground height, walkable bounds and ring-out edges. Visuals live in stage.ts / stages2.ts.
import * as THREE from 'three';

export interface MapDef {
  id: string; name: string; desc: string;
  /** 1:1 only */
  duel?: boolean;
  /** barrier at the edge: 0 = open (anyone sent flying goes over), Infinity = solid wall (nobody leaves) */
  railH: number;
  /** half-size shown on the minimap */
  view: number;
  /** ground height at (x,z); -Infinity where there is nothing to stand on */
  floor(x: number, z: number): number;
  /** pull p back inside the walkable area (margin m); returns the outward normal if it was outside */
  confine(p: THREE.Vector3, m: number): THREE.Vector3 | null;
  /** distance to the nearest ring-out edge and the direction towards it */
  edge(x: number, z: number): { d: number; out: THREE.Vector3 };
  spawn(i: number, n: number, close: boolean): [number, number];
}

const N = new THREE.Vector3();
function radial(R: number, floorR: number, spawnR: number, ringout: boolean) {
  return {
    floor: (x: number, z: number) => (Math.hypot(x, z) < floorR ? 0 : -Infinity),
    confine(p: THREE.Vector3, m: number) {
      const r = Math.hypot(p.x, p.z), max = R - m; if (r <= max) return null;
      N.set(p.x / r, 0, p.z / r); p.x = N.x * max; p.z = N.z * max; return N;
    },
    edge(x: number, z: number) { const r = Math.hypot(x, z); return { d: ringout ? R - r : Infinity, out: r > 1e-3 ? new THREE.Vector3(x / r, 0, z / r) : new THREE.Vector3(0, 0, 1) }; },
    spawn(i: number, n: number, close: boolean): [number, number] { const a = (i / n) * Math.PI * 2 + Math.PI, r = close ? 2 : spawnR; return [Math.sin(a) * r, Math.cos(a) * r]; },
  };
}

/** the stairway: 5 tiers climbing towards -z, open on every side */
export const STAIR = { W: 11, D: 16, N: 5, TD: 3.2, SH: 0.55 };
export const stairH = (z: number) => (2 - Math.min(STAIR.N - 1, Math.max(0, Math.floor((z + STAIR.D / 2) / STAIR.TD)))) * STAIR.SH;
export const CAVE_R = 6.5;

export const MAPS: Record<string, MapDef> = {
  court: { id: 'court', name: '월야 비무대', desc: '난간이 둘러진 원형 비무대. 난간 너머로 날려 보내면 링아웃.', railH: 0.55, view: 9.6, ...radial(9, 9.25, 5, true) },
  stairs: {
    id: 'stairs', name: '낙조 계단', desc: '난간 없는 5단 계단. 띄우거나 날리면 그대로 추락하고, 위층에서 아래로 차 내리기 좋다.', railH: 0, view: 9.6,
    floor: (x, z) => (Math.abs(x) <= STAIR.W / 2 && Math.abs(z) <= STAIR.D / 2 ? stairH(z) : -Infinity),
    confine(p, m) {
      const mx = STAIR.W / 2 - m, mz = STAIR.D / 2 - m; let hit = false; N.set(0, 0, 0);
      if (Math.abs(p.x) > mx) { N.x = Math.sign(p.x); p.x = N.x * mx; hit = true; }
      if (Math.abs(p.z) > mz) { N.z = Math.sign(p.z); p.z = N.z * mz; hit = true; }
      return hit ? N.normalize() : null;
    },
    edge(x, z) {
      const dx = STAIR.W / 2 - Math.abs(x), dz = STAIR.D / 2 - Math.abs(z);
      return dx < dz ? { d: dx, out: new THREE.Vector3(Math.sign(x) || 1, 0, 0) } : { d: dz, out: new THREE.Vector3(0, 0, Math.sign(z) || 1) };
    },
    spawn(i, n, close) { const a = (i / n) * Math.PI * 2 + Math.PI; return close ? [Math.sin(a) * 2, Math.cos(a) * 2] : [Math.sin(a) * 3.6, Math.cos(a) * 5.2]; },
  },
  cave: { id: 'cave', name: '심연 동굴', desc: '빛줄기 하나뿐인 어두운 동굴. 1:1 전용이며 링아웃 없이 암벽에 튕겨 나온다.', duel: true, railH: Infinity, view: 7.4, ...radial(CAVE_R, 7.4, 3, false) },
};
export const MAP = { cur: MAPS.court };
