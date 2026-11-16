// Animation contact sheet: one row per clip, N evenly spaced frames, orthographic.
// ?view=anims&clips=a,b&n=8&side=1&body=female   (side=1: seen from the fighter's left; default 3/4 front)
import * as THREE from 'three';
import { CLIPS, META } from './anims';
import { buildChibi, lookFor } from './character';

export async function runViewer() {
  const q = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfd8ef);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 5); scene.add(sun);
  const names = (q.get('clips') || 'Idle_Loop,Punch_Jab,Punch_Cross,Melee_Hook').split(',');
  const n = +(q.get('n') || '8'); const yaw = q.get('side') === '1' ? -Math.PI / 2 : q.has('yaw') ? +q.get('yaw')! : -0.6;
  const body = (q.get('body') as 'male' | 'female') || 'male';
  const DX = 1.5, DY = 1.9;
  names.forEach((name, r) => {
    const clip = CLIPS.get(name);
    const lab = document.createElement('div'); lab.textContent = name + (clip ? ` (${Math.round(clip.duration * 60)}f, hit ${META[name].hits.map((h) => Math.round(h.t * 60)).join('/') || '-'})` : ' MISSING');
    lab.style.cssText = `position:fixed;left:6px;top:${(r / names.length) * 100}%;color:#fff;font:13px sans-serif;background:#0008;padding:2px 6px`;
    document.body.appendChild(lab);
    if (!clip) return;
    for (let i = 0; i < n; i++) {
      const c = buildChibi(lookFor(body === 'female' ? 1 : 0, body === 'female' ? 0xd8333b : 0xc8ccd6, body));
      c.position.set((i - (n - 1) / 2) * DX, -r * DY, 0); c.rotation.y = q.has('turn') ? (i / n) * Math.PI * 2 : yaw; scene.add(c);
      const mixer = new THREE.AnimationMixer(c); mixer.clipAction(clip).play();
      const fr = q.has('turn') ? 0 : q.has('frames') ? +q.get('frames')!.split(',')[i] / 60 : (clip.duration * i) / (n - 1);
      mixer.setTime(Math.min(clip.duration - 1e-4, fr));
      const g = new THREE.Mesh(new THREE.PlaneGeometry(DX * 0.96, 0.01), new THREE.MeshBasicMaterial({ color: 0x335577 })); g.position.set(c.position.x, c.position.y - 0.005, 0); scene.add(g);
    }
  });
  const H = names.length * DY, W = H * (innerWidth / innerHeight);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, DY - 0.15, DY - 0.15 - H, -50, 50);
  cam.position.set(0, 0, 10);
  renderer.render(scene, cam);
  (window as any).__ready = true;
}
