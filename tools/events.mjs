// Detect strike events in CMU clips: peaks of hand reach, foot raise, knee raise; plus spins.
import { loadGLB } from './gltf-node.mjs';
import * as THREE from 'three';
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
for (const id of process.argv.slice(2)) {
  const g = await loadGLB(`assets/anims/cmu/${id}.glb`); const S = g.scene; const clip = g.animations[0];
  const mx = new THREE.AnimationMixer(S); mx.clipAction(clip).play(); const B = (n) => S.getObjectByName(n);
  mx.setTime(0); S.updateMatrixWorld(true); const H = wp(B('hip')).y - Math.min(wp(B('lFoot')).y, wp(B('rFoot')).y);
  const dt = 1 / 30, rows = [];
  let prevYaw = null;
  for (let t = 0.1; t < clip.duration; t += dt) {
    mx.setTime(t); S.updateMatrixWorld(true);
    const hip = wp(B('hip')), ch = wp(B('chest'));
    const lf = wp(B('lFoot')), rf = wp(B('rFoot')), lh = wp(B('lHand')), rh = wp(B('rHand')), lk = wp(B('lShin')), rk = wp(B('rShin'));
    const floor = Math.min(lf.y, rf.y);
    const L = wp(B('lThigh')).sub(wp(B('rThigh'))); const yaw = Math.atan2(L.x, L.z);
    let spin = 0; if (prevYaw !== null) { let d = yaw - prevYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); spin = d / dt; } prevYaw = yaw;
    const reach = (h) => Math.hypot(h.x - ch.x, h.z - ch.z) / H;
    rows.push({ t, lh: reach(lh), rh: reach(rh), lf: (lf.y - floor) / H, rf: (rf.y - floor) / H, lk: (lk.y - floor) / H, rk: (rk.y - floor) / H, hipY: (hip.y - floor) / H, air: floor - 0, spin });
  }
  const ev = [];
  const peak = (key, thr, label) => { for (let i = 2; i < rows.length - 2; i++) { const v = rows[i][key]; if (v > thr && v >= rows[i - 1][key] && v >= rows[i + 1][key] && v >= rows[i - 2][key] && v >= rows[i + 2][key]) ev.push(`${rows[i].t.toFixed(2)}:${label}${key[0] === 'l' ? 'L' : 'R'}=${v.toFixed(2)}`); } };
  peak('lh', 0.62, 'punch'); peak('rh', 0.62, 'punch'); peak('lf', 0.55, 'kick'); peak('rf', 0.55, 'kick');
  // knee: knee high but foot not extended forward much
  for (const s of ['l', 'r']) for (let i = 2; i < rows.length - 2; i++) { const r = rows[i], k = r[s + 'k']; if (k > 0.95 && k >= rows[i - 1][s + 'k'] && k >= rows[i + 1][s + 'k'] && r[s + 'f'] < k) ev.push(`${r.t.toFixed(2)}:knee${s.toUpperCase()}=${k.toFixed(2)}`); }
  for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].spin) > 9 && Math.abs(rows[i - 1].spin) <= 9) ev.push(`${rows[i].t.toFixed(2)}:SPIN`);
  ev.sort((a, b) => parseFloat(a) - parseFloat(b));
  console.log(`${id} (${clip.duration.toFixed(1)}s): ${ev.join(' ')}`);
}
