import * as THREE from 'three';
import { Assets } from './assets';

interface P { s: THREE.Sprite; life: number; max: number; grow: number; vel: THREE.Vector3; spin: number }

export class FX {
  scene: THREE.Scene; A: Assets; parts: P[] = [];
  audio?: AudioContext; master?: GainNode; volume = 0.7;
  constructor(scene: THREE.Scene, A: Assets, audio?: AudioContext) {
    this.scene = scene; this.A = A; this.audio = audio;
    if (audio) { this.master = audio.createGain(); this.master.gain.value = this.volume; this.master.connect(audio.destination); }
  }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }
  sprite(tex: string, pos: THREE.Vector3, color: number, size: number, life: number, grow = 1.5, vel = new THREE.Vector3(), spin = 0) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.A.tex.get(tex), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
    s.position.copy(pos); s.scale.setScalar(size); s.material.rotation = Math.random() * 6; this.scene.add(s);
    this.parts.push({ s, life, max: life, grow, vel, spin });
  }
  /** impact: spark + flash + streaks along the hit direction (+ shockwave ring for heavy hits) */
  hit(pos: THREE.Vector3, kind: 'hit' | 'medium' | 'heavy' | 'block' | 'counter' | 'grab' | 'sword', dir = new THREE.Vector3(), w = 1) {
    const col = { hit: 0xfff1b0, medium: 0xffd27a, heavy: 0xffa040, block: 0x66b3ff, counter: 0x55ff88, grab: 0xffe040, sword: 0xc890ff }[kind];
    const big = [0.8, 1, 1.35, 1.8][w] ?? 1;
    this.sprite('spark_05', pos, col, 0.85 * big, 10 + w * 2, 2.2);
    this.sprite('star_06', pos, 0xffffff, 0.4 * big, 6 + w, 2.2);
    if (kind !== 'block') {
      const n = 4 + w * 4;
      for (let i = 0; i < n; i++) {
        const v = dir.clone().multiplyScalar(3 + w * 2.5).add(new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 3.5, (Math.random() - .5) * 5));
        this.sprite('light_01', pos, col, 0.12 + w * 0.05, 12 + w * 4, 0.3, v);
      }
    }
    if (w >= 2 || kind === 'counter') this.sprite('circle_05', pos, col, 0.45 * big, 10 + w * 2, 2.6 + w * 0.4);
    if (w >= 3) { this.sprite('magic_03', pos, 0xffffff, 1.0, 8, 2.0); for (let i = 0; i < 4; i++) this.cloud(pos.clone().add(new THREE.Vector3((Math.random() - .5) * .4, (Math.random() - .5) * .3, (Math.random() - .5) * .4)), 0.7, dir.clone().multiplyScalar(1.5).add(new THREE.Vector3((Math.random() - .5) * 2, Math.random(), (Math.random() - .5) * 2))); }
    if (kind === 'block') this.sprite('circle_05', pos, col, 0.8, 10, 1.8);
    // layered sound: sampled impact + synthesized low thump for weight
    if (kind === 'block') this.sfx('impactPlate_light_000', 0.9);
    else {
      const heavy = w >= 3 || kind === 'sword';
      this.sfx(heavy ? (Math.random() < .5 ? 'impactPunch_heavy_000' : 'impactPunch_heavy_001') : (Math.random() < .5 ? 'impactPunch_medium_000' : 'impactPunch_medium_001'), 0.8 + w * 0.12, heavy ? 0.82 : 0.95);
      this.thud(0.35 + w * 0.25, heavy ? 0.8 : 1);
    }
  }
  burst(pos: THREE.Vector3, color: number, size = 3) { this.sprite('magic_03', pos, color, size, 30, 1.6, new THREE.Vector3(), 0.05); this.sprite('twirl_02', pos, color, size * 0.8, 26, 2, new THREE.Vector3(), -0.08); }
  dust(pos: THREE.Vector3, big = 1) { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; this.cloud(pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, 0.25, Math.sin(a) * 0.35)), (1.1 + Math.random() * 0.6) * big, new THREE.Vector3(Math.cos(a) * 1.6, 0.6 + Math.random() * 0.5, Math.sin(a) * 1.6)); } }
  /** cartoon cloud puff: opaque-ish white smoke with normal blending */
  cloud(pos: THREE.Vector3, size: number, vel: THREE.Vector3) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.A.tex.get('smoke_04'), color: 0xffffff, transparent: true, depthWrite: false }));
    s.position.copy(pos); s.scale.setScalar(size); s.material.rotation = Math.random() * 6; this.scene.add(s);
    this.parts.push({ s, life: 34, max: 34, grow: 1.25, vel, spin: (Math.random() - .5) * 0.04 });
  }
  puff(pos: THREE.Vector3, color: number, size = 2) {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.A.tex.get('smoke_04'), color, transparent: true, depthWrite: false }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * 0.8, (Math.random() - .5) * 1.2, (Math.random() - .5) * 0.8)); s.scale.setScalar(size * (0.5 + Math.random() * 0.4)); this.scene.add(s);
      this.parts.push({ s, life: 28, max: 28, grow: 1.3, vel: new THREE.Vector3((Math.random() - .5), 0.6, (Math.random() - .5)), spin: 0.02 });
    }
  }
  /** fading ribbon-like trail of the striking limb */
  trail(pos: THREE.Vector3, color: number, w: number) { this.sprite('light_01', pos, color, 0.32 + w * 0.08, 9, 0.7); }
  private noise?: AudioBuffer;
  /** synthesized swing sound: filtered noise burst with a falling pitch */
  whoosh(vol = 0.4, pitch = 1) {
    const a = this.audio; if (!a || !this.master) return;
    if (!this.noise) { const b = a.createBuffer(1, a.sampleRate * 0.4, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; }
    const src = a.createBufferSource(); src.buffer = this.noise;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    const t = a.currentTime; f.frequency.setValueAtTime(1800 * pitch, t); f.frequency.exponentialRampToValueAtTime(400 * pitch, t + 0.22);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.3);
  }
  /** synthesized low-frequency body thump: gives weight to impacts and landings */
  thud(vol = 0.5, pitch = 1) {
    const a = this.audio; if (!a || !this.master) return;
    const t = a.currentTime;
    // body: falling sine; sub: a lower, longer tail that sells mass
    for (const [f0, f1, len, k] of [[140, 45, 0.22, 1], [70, 30, 0.34, 0.7]] as const) {
      const o = a.createOscillator(); const g = a.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * pitch, t); o.frequency.exponentialRampToValueAtTime(f1 * pitch, t + len * 0.8);
      g.gain.setValueAtTime(Math.min(1, vol * k), t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + len + 0.03);
    }
  }
  sfx(name: string, vol = 1, rate = 1) {
    const b = this.A.sfx.get(name); if (!b || !this.audio || !this.master) return;
    const s = this.audio.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    const g = this.audio.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.master); s.start();
  }
  update() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life--;
      const k = p.life / p.max;
      p.s.material.opacity = Math.min(1, k * 1.6);
      p.s.scale.multiplyScalar(1 + (p.grow - 1) * 0.06);
      p.s.position.addScaledVector(p.vel, 1 / 60); p.vel.y -= 0.1;
      p.s.material.rotation += p.spin;
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.parts.splice(i, 1); }
    }
  }
}

/** Glowing spirit aura + blade for the transformation. */
export function makeAura(A: Assets, color: number) {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get(i ? 'twirl_02' : 'magic_03'), color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(2.6 - i * 0.6); s.position.y = 1.0; (s as any).spin = i ? -0.04 : 0.03; g.add(s);
  }
  const light = new THREE.PointLight(color, 6, 5); light.position.y = 1.2; g.add(light);
  return g;
}
export function makeBlade(color: number) {
  const geo = new THREE.BoxGeometry(0.05, 1.05, 0.11); geo.translate(0, 0.62, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 }));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0x333344 })); guard.position.y = 0.08; m.add(guard);
  return m;
}
