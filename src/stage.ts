// "Moonlit Court": a floating night arena under a giant moon (original design).
// Polished indigo stone with gold inlay and glowing seals, crystal-capped railing, drifting petals and sky lanterns.
import * as THREE from 'three';
import { ARENA_R, FLOOR_R, RAIL_H } from './fighter';
import { Assets } from './assets';
import { toon } from './character';
import { buildStairs, buildCave } from './stages2';

const INK = 0x0d0b1a;
export function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
export function outlined(mesh: THREE.Mesh, w = 1.06) {
  const ol = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  ol.scale.setScalar(w); mesh.add(ol); mesh.castShadow = true; return mesh;
}
/** unlit colour above 1.0 so the bloom pass picks it up */
export function glow(r: number, g: number, b: number, extra: THREE.MeshBasicMaterialParameters = {}) {
  const m = new THREE.MeshBasicMaterial({ fog: false, ...extra }); m.color.setRGB(r, g, b); return m;
}
/** nature-kit model recoloured: foliage becomes blossom pink, wood becomes dark plum */
function blossom(A: Assets, name: string, x: number, y: number, z: number, s = 1, ry = 0, tint = 0xff9ecb) {
  const src = A.env.get(name); if (!src) return new THREE.Object3D();
  const o = src.clone(); o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.y = ry;
  o.traverse((m: any) => {
    if (!m.isMesh) return;
    const c: THREE.Color = (m.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0x88aa66);
    m.material = toon(c.g > c.r ? tint : 0x3b2740); m.castShadow = false;
  });
  return o;
}

/** polished stone laid in rings (polar tiles) with gold inlay */
function floorTexture() {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d')!;
  const r = rng(11); const C = S / 2, k = S / (FLOOR_R * 2);
  x.fillStyle = '#0e1022'; x.fillRect(0, 0, S, S);
  const rings = [0, 0.95, 1.75, 2.6, 3.7, 4.9, 6.1, 7.3, 8.45, FLOOR_R + 0.2];
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i] * k, r1 = rings[i + 1] * k; const n = i === 0 ? 1 : 6 * (i + 1); const off = (i % 2) * Math.PI / n;
    for (let j = 0; j < n; j++) {
      const a0 = off + (j / n) * Math.PI * 2, a1 = off + ((j + 1) / n) * Math.PI * 2;
      const t = r(); const L = 21 + t * 7 + (i % 2) * 3;
      x.fillStyle = `hsl(${226 + t * 12}, ${34 + t * 8}%, ${L}%)`;
      x.beginPath(); x.arc(C, C, r1 - 2, a0 + 2 / r1, a1 - 2 / r1); x.arc(C, C, r0 + 2, a1 - 2 / Math.max(r0, 40), a0 + 2 / Math.max(r0, 40), true); x.closePath(); x.fill();
      // soft polish streak
      if (r() < 0.35) { x.strokeStyle = 'rgba(190,200,255,.07)'; x.lineWidth = (r1 - r0) * 0.25; x.beginPath(); x.arc(C, C, (r0 + r1) / 2 + (r() - .5) * (r1 - r0) * .4, a0 + 0.02, a0 + (a1 - a0) * (0.3 + r() * 0.5)); x.stroke(); }
    }
  }
  const ring = (rad: number, w: number, col: string) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(C, C, rad * k, 0, Math.PI * 2); x.stroke(); };
  const gold = '#d9a94a', goldHi = '#ffe3a0';
  // outer danger band + trims
  ring((ARENA_R + FLOOR_R) / 2 + 0.1, (FLOOR_R - ARENA_R + 0.5) * k, '#15152a');
  ring(ARENA_R - 0.28, 16, gold); ring(ARENA_R - 0.28, 5, goldHi); ring(ARENA_R - 0.62, 4, gold);
  // chevrons pointing inwards along the edge
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2; x.save(); x.translate(C + Math.cos(a) * (ARENA_R - 1.02) * k, C + Math.sin(a) * (ARENA_R - 1.02) * k); x.rotate(a);
    x.fillStyle = i % 2 ? 'rgba(217,169,74,.55)' : 'rgba(255,90,120,.5)'; x.beginPath(); x.moveTo(-14, 0); x.lineTo(8, -16); x.lineTo(8, 16); x.closePath(); x.fill(); x.restore();
  }
  ring(6.1, 5, gold); ring(3.7, 5, gold); ring(2.6, 12, gold); ring(2.6, 4, goldHi); ring(0.95, 8, gold);
  // central seal: an eight-petal flower inside the inner ring
  x.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (pass ? Math.PI / 8 : 0); const len = (pass ? 1.72 : 2.45) * k, wd = (pass ? 0.3 : 0.42) * k;
    x.save(); x.translate(C, C); x.rotate(a);
    x.beginPath(); x.moveTo(0.95 * k, 0); x.quadraticCurveTo((0.95 * k + len) / 2, -wd, len, 0); x.quadraticCurveTo((0.95 * k + len) / 2, wd, 0.95 * k, 0); x.closePath();
    x.fillStyle = pass ? 'rgba(255,110,150,.22)' : 'rgba(120,150,255,.16)'; x.fill(); x.strokeStyle = gold; x.lineWidth = 4; x.stroke(); x.restore();
  }
  // crescent in the middle
  x.fillStyle = goldHi; x.beginPath(); x.arc(C, C, 0.6 * k, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#23254a'; x.beginPath(); x.arc(C + 0.2 * k, C - 0.12 * k, 0.5 * k, 0, Math.PI * 2); x.fill();
  // spokes between the two gold rings
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.PI / 16; x.strokeStyle = 'rgba(217,169,74,.7)'; x.lineWidth = 3; x.beginPath(); x.moveTo(C + Math.cos(a) * 3.7 * k, C + Math.sin(a) * 3.7 * k); x.lineTo(C + Math.cos(a) * 6.1 * k, C + Math.sin(a) * 6.1 * k); x.stroke(); }
  // vignette toward the rim so the centre reads brightest
  const vg = x.createRadialGradient(C, C, 2 * k, C, C, FLOOR_R * k); vg.addColorStop(0, 'rgba(150,160,255,.10)'); vg.addColorStop(0.6, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,4,20,.45)');
  x.fillStyle = vg; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** additive light layer over the floor: glowing seal lines and the ring-out warning line */
function glowTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d')!;
  const C = S / 2, k = S / (FLOOR_R * 2);
  const ring = (rad: number, w: number, col: string, blur: number) => { x.shadowColor = col; x.shadowBlur = blur; x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(C, C, rad * k, 0, Math.PI * 2); x.stroke(); };
  ring(2.6, 3, '#6fe6ff', 22); ring(2.6, 2, '#ffffff', 6);
  ring(ARENA_R - 0.05, 4, '#ff4d78', 26); ring(ARENA_R - 0.05, 2, '#ffd0dc', 6);
  ring(6.1, 1.5, '#8f9dff', 14);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.shadowColor = '#6fe6ff'; x.shadowBlur = 16; x.fillStyle = '#c8f6ff'; x.beginPath(); x.arc(C + Math.cos(a) * 2.6 * k, C + Math.sin(a) * 2.6 * k, 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function moonTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d')!; const r = rng(5);
  const g = x.createRadialGradient(S * 0.42, S * 0.4, 10, S / 2, S / 2, S / 2); g.addColorStop(0, '#fffdf2'); g.addColorStop(0.75, '#ffeecb'); g.addColorStop(1, '#f6cfa6');
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, 7); x.fill();
  x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(214,170,150,${0.12 + r() * 0.16})`; x.beginPath(); x.arc(r() * S, r() * S, 14 + r() * 56, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildStage(scene: THREE.Scene, A: Assets, id = 'court') { return id === 'stairs' ? buildStairs(scene, A) : id === 'cave' ? buildCave(scene, A) : buildCourt(scene, A); }
function buildCourt(scene: THREE.Scene, A: Assets) {
  const g = new THREE.Group(); scene.add(g);
  const r = rng(7);
  const ticks: ((t: number) => void)[] = [];

  // ---- sky: indigo zenith, magenta-to-amber horizon, twinkling stars
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float time; varying vec3 vp;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vp); float y = d.y;
        vec3 zen = vec3(0.012,0.018,0.085), mid = vec3(0.10,0.045,0.26), hor = vec3(0.60,0.12,0.36), low = vec3(0.86,0.34,0.22), deep = vec3(0.10,0.05,0.20);
        vec3 col = mix(mid, zen, smoothstep(0.12, 0.75, y));
        col = mix(col, hor, pow(1.0 - smoothstep(-0.05, 0.30, y), 2.4) * 0.85);
        col = mix(col, low, pow(1.0 - smoothstep(-0.08, 0.12, y), 3.0) * 0.75);
        col = mix(col, deep, smoothstep(-0.04, -0.5, y));
        vec3 p = d * 190.0; vec3 id = floor(p); float h = hash(id);
        float tw = 0.55 + 0.45 * sin(time * (1.0 + h * 3.0) + h * 90.0);
        float st = step(0.9965, h) * smoothstep(0.32, 0.0, length(fract(p) - 0.5)) * smoothstep(0.08, 0.45, y) * tw;
        col += vec3(0.9, 0.95, 1.2) * st * 2.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), skyMat));
  ticks.push((t) => (skyMat.uniforms.time.value = t));
  scene.fog = new THREE.Fog(0x4a2468, 45, 260);

  // ---- moon
  const moonDir = new THREE.Vector3(-0.22, 0.3, -1).normalize();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(46, 64), glow(1.9, 1.8, 1.6, { map: moonTexture() }));
  moon.position.copy(moonDir).multiplyScalar(380); moon.lookAt(0, 0, 0); g.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: 0xffc9a8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.copy(moonDir).multiplyScalar(385); halo.scale.setScalar(150); g.add(halo);

  // ---- arena floor
  const ramp = (toon(0) as THREE.MeshToonMaterial).gradientMap;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 128), new THREE.MeshToonMaterial({ map: floorTexture(), gradientMap: ramp }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 96), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  seal.rotation.x = -Math.PI / 2; seal.position.y = 0.012; (seal.material as THREE.MeshBasicMaterial).color.setRGB(1.5, 1.5, 1.5); g.add(seal);
  ticks.push((t) => { const p = 0.85 + Math.sin(t * 1.6) * 0.2; (seal.material as THREE.MeshBasicMaterial).color.setRGB(p, p, p); });

  // ---- plinth: dark stone drum, gold lip, hanging rock with crystals
  const stone = toon(0x2a2a48), rock = toon(0x3a3358), goldMat = toon(0xe0b050), dark = toon(0x1c1d33);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R - 0.25, 0.9, 96, 1, true), stone); rim.position.y = -0.45; g.add(rim);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R, 0.09, 8, 128), goldMat); lip.rotation.x = Math.PI / 2; lip.position.y = -0.02; g.add(lip);
  const lip2 = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R - 0.2, 0.05, 6, 128), glow(0.5, 1.9, 2.4)); lip2.rotation.x = Math.PI / 2; lip2.position.y = -0.9; g.add(lip2);
  const under = new THREE.Mesh(new THREE.ConeGeometry(FLOOR_R - 0.3, 11, 10, 4), rock); under.rotation.x = Math.PI; under.position.y = -6.4; g.add(outlined(under, 1.01));
  const crystalMat = glow(0.6, 1.7, 2.6);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 2 + r() * 6, s = 0.5 + r() * 1.1;
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crystalMat); cr.scale.set(s * 0.6, s * 2.4, s * 0.6);
    cr.position.set(Math.sin(a) * d, -1.6 - (d / FLOOR_R) * 0.5 - r() * 3.5, Math.cos(a) * d); cr.rotation.set((r() - .5) * 0.6, r() * 3, (r() - .5) * 0.6); g.add(cr);
  }

  // ---- railing: dark lacquer posts, gold bands, floating crystal on every post, a light line along the top rail
  const N = 36; const crystals: THREE.Mesh[] = [];
  const postGeo = new THREE.BoxGeometry(0.2, RAIL_H + 0.2, 0.2), bandGeo = new THREE.BoxGeometry(0.25, 0.07, 0.25), gemGeo = new THREE.OctahedronGeometry(0.11, 0);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2; const px = Math.sin(a) * ARENA_R, pz = Math.cos(a) * ARENA_R;
    const post = outlined(new THREE.Mesh(postGeo, i % 3 === 0 ? toon(0xb02a48) : dark), 1.1); post.position.set(px, (RAIL_H + 0.2) / 2, pz); post.rotation.y = a; g.add(post);
    const band = new THREE.Mesh(bandGeo, goldMat); band.position.set(px, RAIL_H + 0.2, pz); band.rotation.y = a; g.add(band);
    const gem = new THREE.Mesh(gemGeo, i % 3 === 0 ? glow(3.2, 1.0, 1.6) : crystalMat); gem.position.set(px, RAIL_H + 0.45, pz); gem.scale.y = 1.5; gem.userData.ph = i * 0.7; g.add(gem); crystals.push(gem);
  }
  ticks.push((t) => { for (const c of crystals) { c.position.y = RAIL_H + 0.45 + Math.sin(t * 2 + c.userData.ph) * 0.035; c.rotation.y = t * 1.2 + c.userData.ph; } });
  for (const [y, rad] of [[RAIL_H, 0.06], [RAIL_H * 0.45, 0.045]] as const) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, rad, 8, 120), dark); rail.rotation.x = Math.PI / 2; rail.position.y = y; rail.castShadow = true; g.add(rail);
    const rl = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, rad * 1.6, 8, 120), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); rail.add(rl);
  }
  const line = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, 0.018, 6, 160), glow(2.4, 1.6, 0.7)); line.rotation.x = Math.PI / 2; line.position.y = RAIL_H + 0.075; g.add(line);

  // ---- floating paper lanterns around the court
  const lanterns: THREE.Object3D[] = [];
  const paper = glow(2.3, 1.15, 0.5), capMat = toon(0x2a1c2c);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12; const rr = FLOOR_R + 2.2 + (i % 2) * 2.2;
    const L = new THREE.Group(); L.position.set(Math.sin(a) * rr, -0.6 + (i % 3) * 0.7, Math.cos(a) * rr);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 12), paper); L.add(body);
    for (const y of [0.3, -0.3]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), capMat); cap.position.y = y; L.add(cap); }
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.35, 6), toon(0xd9a94a)); tassel.position.y = -0.5; L.add(tassel);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: 0xff9a50, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); aura.scale.setScalar(2.2); L.add(aura);
    L.userData = { y: L.position.y, ph: i * 1.3 }; g.add(L); lanterns.push(L);
  }
  ticks.push((t) => { for (const L of lanterns) { L.position.y = L.userData.y + Math.sin(t * 0.8 + L.userData.ph) * 0.18; L.rotation.y = Math.sin(t * 0.5 + L.userData.ph) * 0.3; } });

  // ---- far scenery: floating islands with blossom trees, gates and tiered towers
  const grass = toon(0x4b3f7a), lacquer = toon(0xc22d4e);
  const island = (x: number, y: number, z: number, s: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.88, 0.7, 18), grass); t.position.set(x, y, z); g.add(t);
    const u = new THREE.Mesh(new THREE.ConeGeometry(s * 0.93, s * 2.1, 8, 2), rock); u.rotation.x = Math.PI; u.position.set(x, y - s * 1.05 - 0.35, z); g.add(u);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.16, 0), crystalMat); cr.scale.y = 2.6; cr.position.set(x + s * 0.3, y - s * 1.2, z); g.add(cr);
  };
  const gate = (x: number, y: number, z: number, s: number) => {
    const G = new THREE.Group(); G.position.set(x, y, z); G.scale.setScalar(s); G.lookAt(0, y, 0);
    for (const sx of [-1, 1]) { const p = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 10), lacquer), 1.06); p.position.set(sx * 1.25, 1.7, 0); G.add(p); const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.3, 10), dark); ft.position.set(sx * 1.25, 0.15, 0); G.add(ft); }
    const b1 = outlined(new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.26, 0.34), dark), 1.04); b1.position.y = 3.5; G.add(b1);
    const b0 = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.1, 0.44), goldMat); b0.position.y = 3.68; G.add(b0);
    const b2 = outlined(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.2, 0.24), lacquer), 1.05); b2.position.y = 2.85; G.add(b2);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow(3.2, 1.0, 1.6)); gem.position.y = 3.18; G.add(gem);
    g.add(G);
  };
  const tower = (x: number, y: number, z: number, s: number, tiers: number) => {
    const T = new THREE.Group(); T.position.set(x, y, z); T.scale.setScalar(s); T.rotation.y = r() * 3;
    let yy = 0, w = 2.2;
    for (let i = 0; i < tiers; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, w), toon(0x2c2552)); b.position.y = yy + 0.55; T.add(b);
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.32, w * 0.55), glow(2.4, 1.3, 0.55)); win.position.y = yy + 0.55; T.add(win);
      const win2 = win.clone(); win2.rotation.y = Math.PI / 2; T.add(win2);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 1.05, 0.7, 4), toon(0x7a2348)); roof.rotation.y = Math.PI / 4; roof.position.y = yy + 1.45; T.add(roof);
      yy += 1.5; w *= 0.82;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 6), goldMat); spire.position.y = yy + 0.6; T.add(spire);
    g.add(T);
  };
  const trees = ['tree_oak', 'tree_fat', 'tree_default', 'tree_pineRoundA'];
  const pinks = [0xff9ecb, 0xffc1dd, 0xf07fb4, 0xd9a6ff];
  const isl: [number, number, number, number, string][] = [
    [-21, -2, -19, 5, 'gate'], [23, -4, -17, 4.5, 'trees'], [-7, -6, -33, 6.5, 'tower'], [30, 1, 15, 4, 'gate'], [-29, -1, 13, 4.8, 'trees'], [5, -8, 30, 5.5, 'trees'],
    [48, 3, -40, 8, 'tower'], [-52, 6, -30, 7, 'tower'], [-44, -5, 38, 7, 'trees'], [16, 8, -62, 9, 'tower'], [60, -2, 20, 7, 'tower'],
  ];
  for (const [x, y, z, s, kind] of isl) {
    island(x, y, z, s);
    if (kind === 'gate') { gate(x, y + 0.35, z, s * 0.42); for (let k = 0; k < 2; k++) g.add(blossom(A, trees[k], x + (k ? 1 : -1) * s * 0.6, y + 0.3, z + (r() - 0.5) * s * 0.5, 2.4 + r(), r() * 6, pinks[k])); }
    else if (kind === 'tower') { tower(x, y + 0.35, z, s * 0.42, 3 + Math.floor(r() * 3)); g.add(blossom(A, trees[1], x + s * 0.55, y + 0.3, z + s * 0.2, 2.2 + r(), r() * 6, pinks[2])); }
    else for (let k = 0; k < 4; k++) g.add(blossom(A, trees[(k + Math.floor(Math.abs(x))) & 3], x + (r() - 0.5) * s * 1.2, y + 0.3, z + (r() - 0.5) * s * 1.2, 2.6 + r() * 1.8, r() * 6, pinks[k & 3]));
  }

  // ---- sea of clouds below, tinted by the horizon
  const cloudTex = A.tex.get('smoke_04');
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 26 + r() * 110; const hi = r();
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color().setHSL(0.72 + hi * 0.2, 0.6, 0.24 + hi * 0.2), transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
    m.position.set(Math.sin(a) * d, -26 + r() * 20, Math.cos(a) * d); m.scale.setScalar(22 + r() * 30); m.material.rotation = r() * 6; g.add(m);
  }

  // ---- sky lanterns drifting upward
  const sky: THREE.Sprite[] = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.tex.get('light_01'), color: r() < 0.8 ? 0xffa24e : 0xff6f8e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const a = r() * Math.PI * 2, d = 16 + r() * 90; s.position.set(Math.sin(a) * d, -12 + r() * 60, Math.cos(a) * d); s.scale.setScalar(0.7 + r() * 1.6);
    s.userData = { v: 0.25 + r() * 0.45, ph: r() * 10, x: s.position.x }; g.add(s); sky.push(s);
  }
  let lastT = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    for (const s of sky) { s.position.y += s.userData.v * dt; s.position.x = s.userData.x + Math.sin(t * 0.3 + s.userData.ph) * 1.2; if (s.position.y > 50) s.position.y = -12; }
  });

  // ---- drifting petals over the court
  const PN = 260; const petalGeo = new THREE.PlaneGeometry(0.075, 0.05);
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshBasicMaterial({ color: 0xffb7d6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), PN);
  petals.frustumCulled = false; g.add(petals);
  const pd = Array.from({ length: PN }, () => ({ x: (r() - .5) * 30, y: r() * 9, z: (r() - .5) * 30, v: 0.35 + r() * 0.5, ph: r() * 20, sp: 1 + r() * 3 }));
  const dummy = new THREE.Object3D();
  ticks.push((t) => {
    for (let i = 0; i < PN; i++) {
      const p = pd[i]; const yy = 9 - ((p.y + t * p.v) % 9.5);
      dummy.position.set(p.x + Math.sin(t * 0.5 + p.ph) * 0.9 + ((t * 0.4 + p.ph * 3) % 30) - 15, yy, p.z + Math.cos(t * 0.4 + p.ph) * 0.9);
      dummy.rotation.set(t * p.sp + p.ph, t * p.sp * 0.7, p.ph); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  });

  // ---- lighting: cool moon key from the camera side, warm rim from behind, violet ambient
  g.add(new THREE.HemisphereLight(0xb9c4ff, 0x4a3470, 1.2));
  const key = new THREE.DirectionalLight(0xeef1ff, 2.1);
  key.position.set(6, 18, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  g.add(key); g.add(key.target);
  const back = new THREE.DirectionalLight(0xff7fa8, 0.9); back.position.set(-6, 5, -12); g.add(back);

  g.userData.tick = (t: number) => { for (const f of ticks) f(t); };
  return g;
}
