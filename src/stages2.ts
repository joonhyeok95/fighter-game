// Extra arenas (original designs):
//  - "Sunset Stair": a railless five-tier stairway hanging in a burning dusk sky
//  - "Abyss Cave": a stone disc over an underground lake, lit by one shaft of light and glowing crystals
import * as THREE from 'three';
import { Assets } from './assets';
import { toon } from './character';
import { rng, outlined, glow } from './stage';
import { STAIR, CAVE_R } from './maps';

type Tick = (t: number) => void;
const rampOf = () => (toon(0) as THREE.MeshToonMaterial).gradientMap;

/** gradient sky dome with twinkling stars */
function skyDome(g: THREE.Group, ticks: Tick[], zen: number[], mid: number[], hor: number[], low: number[], deep: number[], stars = 2.4) {
  const v = (c: number[]) => new THREE.Vector3(c[0], c[1], c[2]);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, zen: { value: v(zen) }, mid: { value: v(mid) }, hor: { value: v(hor) }, low: { value: v(low) }, deep: { value: v(deep) }, stars: { value: stars } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float time, stars; uniform vec3 zen, mid, hor, low, deep; varying vec3 vp;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vp); float y = d.y;
        vec3 col = mix(mid, zen, smoothstep(0.12, 0.75, y));
        col = mix(col, hor, pow(1.0 - smoothstep(-0.05, 0.30, y), 2.4) * 0.85);
        col = mix(col, low, pow(1.0 - smoothstep(-0.08, 0.12, y), 3.0) * 0.75);
        col = mix(col, deep, smoothstep(-0.04, -0.5, y));
        vec3 p = d * 190.0; float h = hash(floor(p));
        float tw = 0.55 + 0.45 * sin(time * (1.0 + h * 3.0) + h * 90.0);
        col += vec3(1.1, 0.95, 0.9) * step(0.9965, h) * smoothstep(0.32, 0.0, length(fract(p) - 0.5)) * smoothstep(0.1, 0.5, y) * tw * stars;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), m));
  ticks.push((t) => (m.uniforms.time.value = t));
}
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** flat strip lying on the ground */
function strip(g: THREE.Group, w: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
}
function shard(r: () => number, size: number, mat: THREE.Material) {
  const geo = new THREE.IcosahedronGeometry(size, 0); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.7 + r() * 0.6), p.getY(i) * (0.6 + r() * 0.9), p.getZ(i) * (0.7 + r() * 0.6));
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.rotation.set(r() * 3, r() * 3, r() * 3); return m;
}

// =====================================================================================================
// Sunset Stair
// =====================================================================================================
function tierTexture(k: number, r: () => number) {
  const { W, TD } = STAIR; const S = 96; // px per metre
  return canvasTex(W * S, Math.round(TD * S), (x) => {
    const w = W * S, h = TD * S;
    x.fillStyle = '#1a1420'; x.fillRect(0, 0, w, h);
    // worn basalt flags, staggered
    const cols = 11, rows = 3; const cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
      const ox = (j % 2) * cw * 0.5; const l = 15 + r() * 8 + (k % 2) * 2;
      x.fillStyle = `hsl(${338 + r() * 16}, ${22 + r() * 10}%, ${l}%)`; x.fillRect(i * cw + ox + 3, j * ch + 3, cw - 6, ch - 6);
      x.fillStyle = 'rgba(255,190,150,.05)'; x.fillRect(i * cw + ox + 3, j * ch + 3, cw - 6, 5);
      if (r() < 0.3) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.beginPath(); const sx = i * cw + ox + r() * cw, sy = j * ch + r() * ch; x.moveTo(sx, sy); x.lineTo(sx + (r() - .5) * 60, sy + (r() - .5) * 50); x.lineTo(sx + (r() - .5) * 90, sy + (r() - .5) * 70); x.stroke(); }
    }
    // gold inlay frame + tier mark (k+1 diamonds)
    x.strokeStyle = '#c9963f'; x.lineWidth = 5; x.strokeRect(34, 30, w - 68, h - 60);
    x.strokeStyle = '#6e4a24'; x.lineWidth = 2; x.strokeRect(46, 42, w - 92, h - 84);
    const n = STAIR.N - k; const cx = w / 2, cy = h / 2;
    x.fillStyle = '#17111c'; x.beginPath(); x.ellipse(cx, cy, 60 + n * 34, 62, 0, 0, 7); x.fill(); x.strokeStyle = '#c9963f'; x.lineWidth = 4; x.stroke();
    for (let i = 0; i < n; i++) { const dx = cx + (i - (n - 1) / 2) * 62; x.fillStyle = i % 2 ? '#e8b85a' : '#ff5a4a'; x.beginPath(); x.moveTo(dx, cy - 30); x.lineTo(dx + 21, cy); x.lineTo(dx, cy + 30); x.lineTo(dx - 21, cy); x.closePath(); x.fill(); }
    // scorched danger band along both open sides
    for (const sx of [0, w - 110]) { const gr = x.createLinearGradient(sx ? w : 0, 0, sx ? w - 110 : 110, 0); gr.addColorStop(0, 'rgba(255,60,50,.3)'); gr.addColorStop(1, 'rgba(255,60,50,0)'); x.fillStyle = gr; x.fillRect(sx, 0, 110, h); }
  });
}
export function buildStairs(scene: THREE.Scene, A: Assets) {
  const g = new THREE.Group(); scene.add(g);
  const r = rng(21); const ticks: Tick[] = []; const ramp = rampOf();
  const { W, D, N, TD, SH } = STAIR;
  scene.fog = new THREE.Fog(0x3a1024, 40, 240);
  skyDome(g, ticks, [0.02, 0.012, 0.07], [0.17, 0.035, 0.16], [0.66, 0.13, 0.12], [0.9, 0.36, 0.14], [0.12, 0.03, 0.08], 1.6);

  // ---- sinking sun behind the top of the stair
  const sunDir = new THREE.Vector3(0.12, 0.09, -1).normalize();
  const sun = new THREE.Mesh(new THREE.CircleGeometry(58, 64), glow(2.6, 1.05, 0.42)); sun.position.copy(sunDir).multiplyScalar(390); sun.lookAt(0, 0, 0); g.add(sun);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: 0xff7a3a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.copy(sunDir).multiplyScalar(385); halo.scale.setScalar(230); g.add(halo);

  // ---- the stair: five slabs, each a monolith reaching down into the clouds
  const side = new THREE.MeshToonMaterial({ color: 0x2a1c2c, gradientMap: ramp });
  const face = new THREE.MeshToonMaterial({ color: 0x3a2634, gradientMap: ramp });
  const rock = new THREE.MeshToonMaterial({ color: 0x1c1422, gradientMap: ramp });
  const gold = glow(2.3, 1.5, 0.55), danger = glow(2.9, 0.5, 0.55);
  const dangerMats: THREE.MeshBasicMaterial[] = [danger];
  for (let k = 0; k < N; k++) {
    const h = (2 - k) * SH, zc = -D / 2 + TD * (k + 0.5);
    const top = new THREE.MeshToonMaterial({ map: tierTexture(k, r), gradientMap: ramp });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, TD), [side, side, top, side, face, side]);
    slab.position.set(0, h - 0.25, zc); slab.receiveShadow = true; g.add(slab);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 30, TD), [rock, rock, rock, rock, face, rock]); body.position.set(0, h - 0.5 - 15, zc); body.receiveShadow = true; g.add(body);
    // glowing lip on the step edge, red warning lines on the open sides
    strip(g, W - 0.5, 0.07, 0, h + 0.012, zc + TD / 2 - 0.07, gold);
    for (const sx of [-1, 1]) strip(g, 0.09, TD, sx * (W / 2 - 0.1), h + 0.012, zc, danger);
    const riser = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, 0.05), gold); riser.position.set(0, h - 0.28, zc + TD / 2 + 0.005); g.add(riser);
    // brazier posts hanging off both sides at every tier
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), side); post.position.set(sx * (W / 2 + 0.95), h - 3.1, zc - TD / 2 + 0.25); g.add(outlined(post, 1.04));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.3), side); arm.position.set(sx * (W / 2 + 0.4), h - 0.6, zc - TD / 2 + 0.25); g.add(arm);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.22, 8), new THREE.MeshToonMaterial({ color: 0x8a5a2a, gradientMap: ramp })); bowl.position.set(post.position.x, h + 0.5, post.position.z); g.add(outlined(bowl, 1.08));
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: 0xff8a3a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      fl.position.set(post.position.x, h + 0.95, post.position.z); fl.scale.setScalar(1.5); fl.userData.ph = r() * 10; g.add(fl);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), glow(3.0, 1.2, 0.35)); core.position.copy(fl.position).setY(h + 0.8); core.scale.y = 1.7; g.add(core);
      ticks.push((t) => { const f = 1.4 + Math.sin(t * 9 + fl.userData.ph) * 0.14 + Math.sin(t * 23 + fl.userData.ph * 2) * 0.08; fl.scale.setScalar(f); core.rotation.y = t * 2 + fl.userData.ph; });
    }
  }
  // the two ends are just as open
  strip(g, W, 0.09, 0, 2 * SH + 0.012, -D / 2 + 0.1, danger); strip(g, W, 0.09, 0, -2 * SH + 0.012, D / 2 - 0.1, danger);
  ticks.push((t) => { const p = 0.75 + Math.sin(t * 3.2) * 0.25; for (const m of dangerMats) m.color.setRGB(2.9 * p, 0.5 * p, 0.55 * p); });

  // ---- the gate above the top tier, on its own rock
  const gate = new THREE.Group(); gate.position.set(0, 2 * SH - 3, -D / 2 - 22); gate.scale.setScalar(2.4); g.add(gate);
  const isle = shard(r, 4.6, rock); isle.scale.set(1.5, 0.75, 0.8); isle.position.y = -3.6; gate.add(outlined(isle, 1.02));
  const gm = new THREE.MeshToonMaterial({ color: 0x7a1f2e, gradientMap: ramp }), gd = new THREE.MeshToonMaterial({ color: 0x1f1624, gradientMap: ramp });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), gm); p.position.set(sx * 3.3, 3, 0); gate.add(outlined(p, 1.04)); const ft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), gd); ft.position.set(sx * 3.3, -0.2, 0); gate.add(outlined(ft, 1.05)); }
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.7, 1.1), gd); b1.position.y = 6.7; gate.add(outlined(b1, 1.03));
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.45, 0.7), gm); b2.position.y = 5.5; gate.add(outlined(b2, 1.04));
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), gd); tip.position.set(sx * 4.9, 7.2, 0); tip.rotation.z = sx * -0.5; gate.add(tip); }
  const sig = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 6, 6), glow(2.8, 1.3, 0.5)); sig.position.y = 3; gate.add(sig);
  const sig2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 4), glow(2.9, 0.6, 0.6)); sig2.position.y = 3; gate.add(sig2);
  ticks.push((t) => { sig.rotation.z = t * 0.35; sig2.rotation.z = -t * 0.6; });

  // ---- broken steps drifting away below the bottom tier, floating rocks all around
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.2 + r() * 2.4, 0.5, 1.2 + r() * 1.2), face);
    s.position.set((r() - .5) * 11, -2 * SH - 4 - i * 1.6, D / 2 + 2.5 + i * 2.3); s.rotation.set((r() - .5) * 0.7, r() * 3, (r() - .5) * 0.7); s.userData = { y: s.position.y, ph: r() * 6 };
    g.add(outlined(s, 1.04)); ticks.push((t) => { s.position.y = s.userData.y + Math.sin(t * 0.6 + s.userData.ph) * 0.3; });
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 30 + r() * 60; const m = shard(r, 1.5 + r() * 4.5, rock);
    m.position.set(Math.sin(a) * d, -10 + r() * 26, Math.cos(a) * d - 8); m.userData = { y: m.position.y, ph: r() * 6 }; g.add(outlined(m, 1.03));
    ticks.push((t) => { m.position.y = m.userData.y + Math.sin(t * 0.3 + m.userData.ph) * 0.7; m.rotation.y += 0.0008; });
  }
  // ---- clouds lit from below by the sun
  const cloudTex = A.tex.get('smoke_04');
  for (let i = 0; i < 50; i++) {
    const a = r() * Math.PI * 2, d = 22 + r() * 120; const hi = r();
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color().setHSL(0.96 + hi * 0.08, 0.6, 0.22 + hi * 0.2), transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
    m.position.set(Math.sin(a) * d, -30 + r() * 18, Math.cos(a) * d); m.scale.setScalar(24 + r() * 30); m.material.rotation = r() * 6; g.add(m);
  }
  // ---- embers rising past the stair
  const EN = 220; const ep = new Float32Array(EN * 3), ev: number[] = [];
  for (let i = 0; i < EN; i++) { ep[i * 3] = (r() - .5) * 34; ep[i * 3 + 1] = -8 + r() * 22; ep[i * 3 + 2] = (r() - .5) * 34; ev.push(0.5 + r() * 1.3); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const em = new THREE.PointsMaterial({ map: A.tex.get('light_01'), size: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); em.color.setRGB(3, 1.3, 0.4);
  g.add(new THREE.Points(eg, em));
  let last = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
    for (let i = 0; i < EN; i++) { ep[i * 3 + 1] += ev[i] * dt; ep[i * 3] += Math.sin(t * 0.9 + i) * 0.004; if (ep[i * 3 + 1] > 14) ep[i * 3 + 1] = -8; }
    eg.attributes.position.needsUpdate = true;
  });

  // ---- lighting: low warm sun from behind the gate, cool fill from the camera side
  g.add(new THREE.HemisphereLight(0xffc2b0, 0x3a1838, 0.8));
  const key = new THREE.DirectionalLight(0xfff0e4, 2.0);
  key.position.set(7, 18, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera; sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 50;
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; g.add(key); g.add(key.target);
  const back = new THREE.DirectionalLight(0xff6a3c, 1.25); back.position.set(2, 5, -14); g.add(back);

  g.userData.tick = (t: number) => { for (const f of ticks) f(t); };
  return g;
}

// =====================================================================================================
// Abyss Cave
// =====================================================================================================
const CAVE_FLOOR = 7.4;
function caveFloorTexture(r: () => number) {
  const S = 2048, k = S / (CAVE_FLOOR * 2), C = S / 2;
  return canvasTex(S, S, (x) => {
    x.fillStyle = '#12151f'; x.fillRect(0, 0, S, S);
    // irregular flagstones
    for (let i = 0; i < 520; i++) {
      const a = r() * 7, d = Math.sqrt(r()) * CAVE_FLOOR * k; const px = C + Math.cos(a) * d, py = C + Math.sin(a) * d; const n = 5 + (r() * 3 | 0), sz = 38 + r() * 60;
      x.fillStyle = `hsl(${215 + r() * 25}, ${14 + r() * 10}%, ${11 + r() * 9}%)`; x.beginPath();
      for (let j = 0; j < n; j++) { const b = (j / n) * Math.PI * 2 + r() * 0.5, rr = sz * (0.6 + r() * 0.5); x[j ? 'lineTo' : 'moveTo'](px + Math.cos(b) * rr, py + Math.sin(b) * rr); }
      x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3; x.stroke();
    }
    // carved rings and a worn compass in the middle
    const ring = (rad: number, w: number, col: string) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(C, C, rad * k, 0, 7); x.stroke(); };
    ring(CAVE_R - 0.15, 10, '#06080e'); ring(CAVE_R - 0.15, 3, '#3f6f86'); ring(4.2, 6, '#080a12'); ring(4.2, 2, '#34566b'); ring(1.5, 6, '#080a12'); ring(1.5, 2, '#4a8098');
    x.strokeStyle = '#2f5266'; x.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(C + Math.cos(a) * 1.5 * k, C + Math.sin(a) * 1.5 * k); x.lineTo(C + Math.cos(a) * (i % 2 ? 2.6 : 4.2) * k, C + Math.sin(a) * (i % 2 ? 2.6 : 4.2) * k); x.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = 5.35 * k; x.save(); x.translate(C + Math.cos(a) * rr, C + Math.sin(a) * rr); x.rotate(a + Math.PI / 4); x.strokeStyle = '#3f6f86'; x.lineWidth = 3; x.strokeRect(-12, -12, 24, 24); x.restore(); }
    // darker towards the rim: the light only reaches the middle
    const vg = x.createRadialGradient(C, C, 1.5 * k, C, C, CAVE_FLOOR * k); vg.addColorStop(0, 'rgba(150,190,255,.14)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = vg; x.fillRect(0, 0, S, S);
  });
}
function caveGlowTexture() {
  const S = 1024, k = S / (CAVE_FLOOR * 2), C = S / 2;
  return canvasTex(S, S, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const ring = (rad: number, w: number, col: string, blur: number) => { x.shadowColor = col; x.shadowBlur = blur; x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(C, C, rad * k, 0, 7); x.stroke(); };
    ring(CAVE_R - 0.15, 4, '#39d6ff', 26); ring(CAVE_R - 0.15, 2, '#c8f6ff', 6); ring(1.5, 3, '#6fe6ff', 18);
  });
}
export function buildCave(scene: THREE.Scene, A: Assets) {
  const g = new THREE.Group(); scene.add(g);
  const r = rng(53); const ticks: Tick[] = []; const ramp = rampOf();
  scene.fog = new THREE.Fog(0x04050c, 16, 70);

  // ---- the cavern shell: a lumpy dome, only ever seen dimly
  const shellGeo = new THREE.IcosahedronGeometry(36, 4); const sp = shellGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) { const k = 1 + (Math.sin(sp.getX(i) * 0.5) * Math.cos(sp.getZ(i) * 0.43) + Math.sin(sp.getY(i) * 0.7 + sp.getX(i) * 0.21)) * 0.07; sp.setXYZ(i, sp.getX(i) * k, sp.getY(i) * k, sp.getZ(i) * k); }
  shellGeo.computeVertexNormals();
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x2a2d4a, flatShading: true });
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshLambertMaterial({ color: 0x232641, flatShading: true, side: THREE.BackSide })); shell.scale.y = 0.62; shell.position.y = -4; g.add(shell);
  const ceil = (d: number) => -4 + 0.62 * Math.sqrt(Math.max(0, 36 * 36 - d * d));

  // ---- the duelling stone: a disc on a rock pillar rising out of an underground lake
  const floor = new THREE.Mesh(new THREE.CircleGeometry(CAVE_FLOOR, 96), new THREE.MeshToonMaterial({ map: caveFloorTexture(r), gradientMap: ramp }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(CAVE_FLOOR, 64), new THREE.MeshBasicMaterial({ map: caveGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  seal.rotation.x = -Math.PI / 2; seal.position.y = 0.012; g.add(seal);
  ticks.push((t) => { const p = 1.0 + Math.sin(t * 1.3) * 0.3; (seal.material as THREE.MeshBasicMaterial).color.setRGB(p, p, p); });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(CAVE_FLOOR, CAVE_FLOOR - 1.4, 3.4, 40, 1, true), rockMat); rim.position.y = -1.7; g.add(rim);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(CAVE_FLOOR - 1.4, 3.2, 12, 14, 3, true), rockMat); stem.position.y = -9.4; g.add(stem);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: 0x06222e })); lake.rotation.x = -Math.PI / 2; lake.position.y = -12; g.add(lake);
  const lakeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: 0x1fb0d0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); lakeGlow.position.y = -11.5; lakeGlow.scale.setScalar(46); g.add(lakeGlow);

  // ---- a wall of fangs and crystals around the rim: nobody gets thrown out of here
  const cyan = () => glow(0.7, 2.4, 3.0), violet = () => glow(2.0, 0.9, 3.1);
  const crystals: THREE.Mesh[] = [];
  const crystal = (x: number, y: number, z: number, s: number, m: THREE.Material) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), m); c.scale.set(s * 0.75, s * 2.6, s * 0.75); c.position.set(x, y + s * 0.42, z); c.rotation.set((r() - .5) * 0.7, r() * 3, (r() - .5) * 0.7); g.add(c); crystals.push(c); return c;
  };
  const NF = 46;
  for (let i = 0; i < NF; i++) {
    const a = (i / NF) * Math.PI * 2 + r() * 0.06, d = CAVE_R + 0.42 + r() * 0.3; const hh = 0.45 + r() * 0.95;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 + r() * 0.18, hh, 5), rockMat); f.position.set(Math.sin(a) * d, hh / 2 - 0.02, Math.cos(a) * d); f.rotation.set((r() - .5) * 0.3, r() * 3, (r() - .5) * 0.3); f.castShadow = true; g.add(f);
    if (i % 3 === 0) crystal(Math.sin(a + 0.07) * (d + 0.1), 0, Math.cos(a + 0.07) * (d + 0.1), 0.5 + r() * 0.6, i % 2 ? cyan() : violet());
  }
  // ---- rock columns standing in the lake, each crowned with a crystal cluster that lights the dark
  const lightCols = [0x58d8ff, 0xa070ff, 0x58d8ff, 0xff6ad0];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = 12 + r() * 12, topY = -3 + r() * (d < 19 ? 4.5 : 9);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9 + r() * 0.8, 1.8 + r() * 1.5, topY + 13, 7, 2), rockMat); col.position.set(Math.sin(a) * d, (topY - 13) / 2, Math.cos(a) * d); col.rotation.y = r() * 3; g.add(col);
    const lc = lightCols[i % 4]; const mk = () => { const m = glow(1, 1, 1); m.color.set(lc).multiplyScalar(2.6); return m; };
    for (let j = 0; j < 4; j++) crystal(col.position.x + (r() - .5) * 1.2, topY, col.position.z + (r() - .5) * 1.2, 1.2 + r() * 1.8, mk());
    if (i % 4 === 0) { const pl = new THREE.PointLight(lc, 220, 34, 2); pl.position.set(Math.sin(a) * (d - 3), topY + 2, Math.cos(a) * (d - 3)); g.add(pl); }
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: lc, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); hl.position.set(col.position.x, topY + 0.8, col.position.z); hl.scale.setScalar(7); g.add(hl);
  }
  ticks.push((t) => { for (let i = 0; i < crystals.length; i++) { const p = 0.82 + Math.sin(t * 1.7 + i * 1.3) * 0.18; crystals[i].scale.y = crystals[i].userData.sy ??= crystals[i].scale.y; (crystals[i].material as THREE.MeshBasicMaterial).color.multiplyScalar(1).lerp((crystals[i].userData.base ??= (crystals[i].material as THREE.MeshBasicMaterial).color.clone()), 1).multiplyScalar(p); } });
  // ---- stalactites
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 7 + r() * 24; const len = d < 14 ? 1.5 + r() * 1.5 : 3 + r() * 7 * (d / 30 + 0.3);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.5 + r() * 0.9, len, 6), rockMat); s.rotation.x = Math.PI; s.position.set(Math.sin(a) * d, ceil(d) - len / 2 + 0.6, Math.cos(a) * d); g.add(s);
  }
  // ---- the shaft of light through the roof
  const shaftFade = canvasTex(4, 128, (x) => { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#666'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128); });
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.06, alphaMap: shaftFade, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.9, 19, 40, 1, true), shaftMat); shaft.position.y = 9.5; g.add(shaft);
  const shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.7, 19, 40, 1, true), shaftMat.clone()); shaft2.position.y = 9.5; g.add(shaft2);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), glow(2.2, 2.5, 3.0)); hole.rotation.x = Math.PI / 2; hole.position.y = ceil(0) - 0.6; g.add(hole);
  ticks.push((t) => { shaftMat.opacity = 0.06 + Math.sin(t * 0.7) * 0.015; shaft.rotation.y = t * 0.03; });
  // ---- drifting spores
  const SN = 260; const pp = new Float32Array(SN * 3), ph: number[] = [];
  for (let i = 0; i < SN; i++) { const a = r() * 7, d = Math.sqrt(r()) * 22; pp[i * 3] = Math.cos(a) * d; pp[i * 3 + 1] = -3 + r() * 14; pp[i * 3 + 2] = Math.sin(a) * d; ph.push(r() * 20); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pm = new THREE.PointsMaterial({ map: A.tex.get('light_01'), size: 0.14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); pm.color.setRGB(0.9, 2.4, 2.8);
  g.add(new THREE.Points(pg, pm));
  ticks.push((t) => { for (let i = 0; i < SN; i++) { pp[i * 3 + 1] += Math.sin(t * 0.5 + ph[i]) * 0.003; pp[i * 3] += Math.cos(t * 0.3 + ph[i]) * 0.002; } pg.attributes.position.needsUpdate = true; });

  // ---- lighting: one cold spot from the roof, faint violet ambient, a rim light so silhouettes read
  g.add(new THREE.HemisphereLight(0x7f96ff, 0x241640, 0.62));
  const spot = new THREE.SpotLight(0xdcebff, 3.0, 0, 0.5, 0.75, 0);
  spot.position.set(1.5, 20, 1.5); spot.target.position.set(0, 0, 0); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 4; spot.shadow.camera.far = 40; spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.02;
  g.add(spot); g.add(spot.target);
  const rimL = new THREE.DirectionalLight(0x8a6bff, 0.7); rimL.position.set(-6, 5, -10); g.add(rimL);
  const rimR = new THREE.DirectionalLight(0x3fd0ff, 0.45); rimR.position.set(8, 3, 6); g.add(rimR);

  g.userData.tick = (t: number) => { for (const f of ticks) f(t); };
  return g;
}
